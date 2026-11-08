"use client";

import { atelSupabase } from "@/lib/atelSupabaseV08";
import type { PedidoV36 } from "@/lib/atelPedidosReaisV36";
import type { RequisicaoTecnica } from "@/lib/requisicoesTecnicas";
import type { EstadoRequisicao } from "@/lib/requisicoesStore";

const KEY = "wms-expert-requisicoes";
const EVENT = "wms-requisicoes-update";
const index = new Map<number, string>();
const revisions = new Map<string, number>();
const snapshots = new Map<string, string>();
const pending = new Map<string, EstadoRequisicao>();
let flushing = false;
let hydrating = false;
let retryRequested = false;

function report(error: unknown) {
  console.error("ATEL V36.6: sincronizacao PED falhou; estado local preservado", error);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("atel-ped-sync-error", {detail: String(error)}));
}
function local(): Record<number, EstadoRequisicao> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function publish(states: Record<number, EstadoRequisicao>) {
  localStorage.setItem(KEY, JSON.stringify(states));
  window.dispatchEvent(new CustomEvent(EVENT));
}
async function flush() {
  if (flushing || hydrating) return;
  flushing = true;
  try {
    while (pending.size) {
      const [uuid, estado] = pending.entries().next().value as [string, EstadoRequisicao];
      // Mantenha a pendencia ate o servidor confirmar. Uma edicao mais recente
      // pode chegar enquanto a requisicao anterior ainda esta em andamento.
      const db = atelSupabase();
      if (!db) { throw Error("Supabase indisponivel"); }
      const rev = revisions.get(uuid) ?? 0;
      const parcial = (estado.status === "RECUSA_PARCIAL" || estado.status === "RECUSA_TOTAL") && Boolean(estado.recebimentoTecnico?.finalizadoEm);
      const {data, error} = await db.rpc(parcial ? "atel_v366_salvar_estado" : "atel_v373_salvar_e_conciliar", {p_pedido:uuid,p_revisao:rev,p_estado:estado});
      if (error) { throw Error(error.message); }
      const next = Array.isArray(data) ? data[0] : data;
      if (!next || typeof next.revisao !== "number") {throw Error("Resposta de revisao invalida");}
      revisions.set(uuid,next.revisao);
      // O RET nasce somente apos o estado ter sido persistido no servidor.
      // Em caso de falha, a pendencia fica na fila e pode ser reenviada.
      if (parcial && Object.values(estado.recebimentoTecnico?.itensConferidos ?? {}).some(item => Number(item.quantidadeRecusada) > 0)) {
        const {error: erroRet} = await db.rpc("atel_v3730_gerar_ret", {p_pedido: uuid});
        if (erroRet) throw Error("RET nao gerado: " + erroRet.message);
      }
      snapshots.set(uuid,JSON.stringify(estado));
      // Apague somente a versao efetivamente confirmada; preserve edicoes
      // feitas durante o await da RPC.
      if (pending.get(uuid) === estado) pending.delete(uuid);
    }
  } catch(e) { report(e); }
  finally {
    flushing=false;
    if (retryRequested) {
      retryRequested=false;
      if (typeof navigator !== "undefined" && navigator.onLine) void flush();
    }
  }
}
export function notificarEstadosPedV366(states: Record<number, EstadoRequisicao>) {
  if (hydrating) return;
  for (const [id,uuid] of index) {
    const state = states[id];
    if (!state) continue;
    const serial = JSON.stringify(state);
    if (serial !== snapshots.get(uuid)) pending.set(uuid, structuredClone(state));
  }
  if (flushing) retryRequested=true;
  else void flush();
}
export async function sincronizarPedidosPedV366(pedidos: PedidoV36[], catalogo: RequisicaoTecnica[]) {
  if (typeof window === "undefined") return;
  const db = atelSupabase();
  if (!db) {report("Supabase indisponivel");return;}
  // Vinculo por codigo, sem depender da posicao das listas.
  const idsPorCodigo = new Map(catalogo.map(c => [c.codigo, c.id]));
  const map = new Map<number, string>();
  for (const pedido of pedidos) {
    const id = idsPorCodigo.get(pedido.codigo);
    if (typeof id === "number") {
      map.set(id, pedido.id);
    }
  }
  // V37.9: registra vinculos explicitos antes de hidratar ou sincronizar o estado.
  // Nunca infere material pela quantidade ou pela ordem de retorno do banco.
  for (const pedido of pedidos) {
    const card = catalogo.find(c => c.codigo === pedido.codigo);
    if (!card || !map.has(card.id)) continue;
    for (const item of card.itens) {
      if (!item.itemPedidoUuid || !item.materialUuid || !Number.isSafeInteger(item.id) || item.id <= 0) {
        report(`V37.9: identificacao UUID ausente no pedido ${pedido.codigo}, item ${item.id}`);
        return;
      }
      const origem = pedido.itens.find(i => i.item_pedido_id === item.itemPedidoUuid);
      if (!origem || origem.material_id !== item.materialUuid || origem.sku !== item.codigoProduto || Number(origem.quantidade) !== Number(item.solicitado)) {
        report(`V37.9: vinculo inconsistente no pedido ${pedido.codigo}, item ${item.id}`);
        return;
      }
      const {data: vinculado, error: erroVinculo} = await db.rpc("atel_v377_vincular_item", {
        p_pedido: pedido.id, p_item_local: item.id, p_item_pedido: item.itemPedidoUuid
      });
      if (erroVinculo || vinculado !== true) {
        report(`V37.9: vinculo nao confirmado no pedido ${pedido.codigo}, item ${item.id}: ${erroVinculo?.message ?? "resposta invalida"}`);
        return;
      }
    }
  }
  // Publique o indice apenas apos a validacao de todos os vinculos.
  index.clear();
  for (const [id, uuid] of map) index.set(id, uuid);
  const uuids = pedidos.map(p=>p.id);
  if (!uuids.length) return;
  const {data,error} = await db.from("atel_operacoes_ped_v366").select("pedido_id,estado,revisao").in("pedido_id",uuids);
  if (error) {report(error.message);return;}
  const remotes = new Map((data||[]).map(r=>[r.pedido_id,r]));
  hydrating=true;
  try {
    const states=local(); let changed=false;
    for (const [id,uuid] of map) {
      if (typeof id!=="number") continue;
      const remote=remotes.get(uuid);
      if (remote) {
        revisions.set(uuid,remote.revisao);
        const rstate=remote.estado as EstadoRequisicao;
        // Nunca substituir operacao local ainda aguardando gravacao.
        if (pending.has(uuid)) continue;
        snapshots.set(uuid,JSON.stringify(rstate));
        if (JSON.stringify(states[id])!==JSON.stringify(rstate)) {states[id]=rstate;changed=true;}
      } else {
        revisions.set(uuid,0);
        if (states[id]) pending.set(uuid,structuredClone(states[id]));
      }
    }
    if (changed) publish(states);
  } finally { hydrating=false; }
  await flush();
}

// Reenvia pendencias quando a conexao retorna ou o usuario volta a aba.
// Em conflito de revisao, o servidor recusa a escrita e a pendencia permanece local.
if (typeof window !== "undefined") {
  // V37.4: outra aba atualizou o armazenamento local.
  // Notificar consumidores existentes sem escrever de volta no storage.
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key === KEY && event.storageArea === window.localStorage) {
      window.dispatchEvent(new CustomEvent(EVENT));
    }
  });
  window.addEventListener("online", () => { void flush(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flush();
  });
}

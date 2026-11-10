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
const lastFailures = new Map<string,{serial:string;error:string}>();
const RESULT_EVENT_V110 = "atel-ped-sync-result-v110";
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
// V116.2: falha em um PED nunca bloqueia a confirmacao de outro PED.
// Pendencias permanecem locais ate um ACK positivo da RPC correspondente.
async function flush() {
  if (flushing || hydrating) return;
  flushing = true;
  const attempted = new Set<string>();
  try {
    while (pending.size) {
      // Cada pedido e tentado no maximo uma vez por rodada. Isso impede
      // loop infinito quando um PED antigo apresenta conflito permanente.
      const entry = Array.from(pending.entries()).find(([uuid, estado]) =>
        !attempted.has(uuid) &&
        lastFailures.get(uuid)?.serial !== JSON.stringify(estado)
      );
      if (!entry) break;
      const [uuid, estado] = entry;
      attempted.add(uuid);
      try {
        const db = atelSupabase();
        if (!db) throw Error("Supabase indisponivel");
        const rev = revisions.get(uuid) ?? 0;
        const parcial = (estado.status === "RECUSA_PARCIAL" || estado.status === "RECUSA_TOTAL") && Boolean(estado.recebimentoTecnico?.finalizadoEm);
        const {data, error} = await db.rpc(parcial ? "atel_v109_finalizar_recebimento_parcial" : "atel_v373_salvar_e_conciliar", {p_pedido:uuid,p_revisao:rev,p_estado:estado});
        if (error) throw Error(error.message);
        const next = Array.isArray(data) ? data[0] : data;
        if (!next || typeof next.revisao !== "number") throw Error("Resposta de revisao invalida");
        revisions.set(uuid,next.revisao);
        snapshots.set(uuid,JSON.stringify(estado));
        lastFailures.delete(uuid);
        // Nunca remover uma edicao mais nova enfileirada durante a RPC.
        if (pending.get(uuid) === estado) pending.delete(uuid);
        window.dispatchEvent(new CustomEvent(RESULT_EVENT_V110, {detail: {uuid, ok: true}}));
      } catch(e) {
        const message = String(e);
        // Um estado ja finalizado e divergente exige conciliacao manual:
        // nao martelar o banco a cada mudanca de aba ou evento de rede.
        if (/pedido ja finalizado com outro conteudo|estado legado ja finalizado sem comprovante|documento terminal conflitante/i.test(message)) {
          lastFailures.set(uuid,{serial:JSON.stringify(estado),error:message});
        }
        window.dispatchEvent(new CustomEvent(RESULT_EVENT_V110, {detail: {uuid, ok: false, error: message}}));
        report(e);
        // O proximo PED segue independente do resultado deste.
      }
    }
  } finally {
    flushing = false;
    if (retryRequested) {
      retryRequested = false;
      if (typeof navigator !== "undefined" && navigator.onLine) void flush();
    }
  }
}
// V110: o coletor nao pode declarar sucesso antes da confirmacao do Supabase.
// Reenvio idempotente: a V109 identifica o mesmo estado e nao duplica movimentacao.
export async function aguardarConfirmacaoPedV110(requisicaoId: number, estadoEsperado: EstadoRequisicao): Promise<void> {
  const uuid = index.get(requisicaoId);
  if (!uuid) throw Error("Pedido real sem vinculo remoto. Reabra a listagem e tente novamente.");
  const serial = JSON.stringify(estadoEsperado);
  const blocked = lastFailures.get(uuid);
  if (blocked?.serial === serial) throw Error(blocked.error);
  if (JSON.stringify(local()[requisicaoId]) !== serial) {
    throw Error("Estado local mudou durante a finalizacao. Atualize o pedido antes de confirmar.");
  }
  if (snapshots.get(uuid) === serial) return;
  const atual = pending.get(uuid);
  if (!atual || JSON.stringify(atual) !== serial) pending.set(uuid, structuredClone(estadoEsperado));
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.removeEventListener(RESULT_EVENT_V110, onResult);
      if (timer !== undefined) clearTimeout(timer);
      if (error) reject(error); else resolve();
    };
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<{uuid: string; ok: boolean; error?: string}>).detail;
      if (!detail || detail.uuid !== uuid) return;
      if (!detail.ok) {finish(Error(detail.error || "Falha ao sincronizar recebimento."));return;}
      if (snapshots.get(uuid) === serial) finish();
    };
    window.addEventListener(RESULT_EVENT_V110, onResult);
    timer = setTimeout(() => finish(Error("Confirmacao remota excedeu 20 segundos. Operacao local pendente; tente confirmar novamente.")), 20000);
    if (snapshots.get(uuid) === serial) finish();
    else if (flushing) retryRequested = true;
    else void flush();
  });
}

export function notificarEstadosPedV366(states: Record<number, EstadoRequisicao>) {
  if (hydrating) return;
  const ultimoEstadoLocal = local();
  for (const [id,uuid] of index) {
    const state = states[id];
    if (!state) continue;
    const serial = JSON.stringify(state);
    // Imports/eventos assincronos podem chegar fora de ordem. Nao permitir
    // que uma notificacao antiga substitua o recebimento final mais recente.
    if (JSON.stringify(ultimoEstadoLocal[id]) !== serial) continue;
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
    // V116.1: pedidos documentais terminais nao podem bloquear a hidratacao
    // de pedidos ativos por auditorias legadas de vinculacao V37.10.2.
    // Os terminais continuam no indice e recebem seu estado remoto abaixo;
    // apenas a revalidacao de vinculos de itens e dispensada.
    if (["RECEBIDA", "RECEBIDA_PARCIAL", "RECUSADA", "CANCELADA"].includes(pedido.status)) continue;
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
        // Nao sobrescrever uma finalizacao local ainda sem comprovante remoto
        // apos F5/reabertura: a fila em memoria pode ter sido reiniciada.
        const localState = states[id];
        const finalLocal = Boolean(localState?.recebimentoTecnico?.finalizadoEm) &&
          ["RECUSA_PARCIAL", "RECUSA_TOTAL", "RECEBIDA_TECNICO"].includes(localState.status);
        const finalRemoto = Boolean(rstate?.recebimentoTecnico?.finalizadoEm) &&
          ["RECUSA_PARCIAL", "RECUSA_TOTAL", "RECEBIDA_TECNICO"].includes(rstate.status);
        if (finalLocal && !finalRemoto && JSON.stringify(localState) !== JSON.stringify(rstate)) {
          pending.set(uuid,structuredClone(localState));
          snapshots.set(uuid,JSON.stringify(rstate));
          continue;
        }
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

import { atelSupabase } from "@/lib/atelSupabaseV08";

const ORGANIZACAO = "6ea04673-4deb-42cf-a001-dbb027120103";
// Liberação deliberadamente fechada. Alterar apenas após instalação das CINCO RPCs
// e validação de ACL/RLS, rastreios, idempotência e concorrência do contrato revisado.
// Uma consulta bem-sucedida não comprova essa validação e nunca abre este bloqueio.
export const ESCRITA_DEVOLUCAO_LIBERADA: boolean = false;
export type StatusAdministrativo = "SOLICITADA" | "APROVADA" | "REJEITADA";
export type CursorAdministrativo = { criada_em: string; id: string };
export type CDPrincipal = { contrato_versao: 1; organizacao_id: string; local_id: string; nome: string };
export type ItemAdministrativo = {
  id: string; requisicao_id: string; organizacao_id: string; material_id: string;
  quantidade: number; sku: string; descricao: string; unidade: string;
  rastreio: string; seriais: string[]; macs: string[]; ativos_ids: string[];
};
export type RequisicaoAdministrativa = {
  id: string; organizacao_id: string; origem_id: string; destino_id: string;
  solicitada_por: string; motivo: string; status: StatusAdministrativo; revisao: number;
  criada_em: string; decidida_em: string | null; decidida_por: string | null;
  justificativa: string | null; itens: ItemAdministrativo[];
};
export type ListaAdministrativa = { contrato_versao: 1; requisicoes: RequisicaoAdministrativa[]; proximo_cursor: CursorAdministrativo | null };
export type ItemSolicitacao = { material_id: string; quantidade: number; seriais: string[]; macs: string[] };
export type SolicitarAdministrativa = { origem_id: string; motivo: string; itens: ItemSolicitacao[]; chave: string };
export type DecidirAdministrativa = { requisicao_id: string; revisao: number; justificativa: string; chave: string };
export type ResultadoAdministrativo = {
  contrato_versao: 1; requisicao_id: string; organizacao_id: string; destino_id: string;
  status: StatusAdministrativo; revisao: number; repetida: boolean; estoque_movimentado: false; ret_gerado: false;
};

export class ErroAdministrativo extends Error {
  constructor(message: string, readonly indeterminado = false) { super(message); this.name = "ErroAdministrativo"; }
}
export const uuidAdministrativo = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const objeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const textos = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string");
const dataValida = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
const statusValido = (v: unknown): v is StatusAdministrativo => v === "SOLICITADA" || v === "APROVADA" || v === "REJEITADA";
function falhaContrato(escrita = false): never { throw new ErroAdministrativo("Resposta incompatível com o contrato administrativo. Atualize a consulta antes de continuar.", escrita); }
function bloquearEscrita() {
  if (!ESCRITA_DEVOLUCAO_LIBERADA) throw new ErroAdministrativo("Escritas bloqueadas até a instalação e validação das cinco operações administrativas.");
}

async function rpc(nome: string, parametros: Record<string, unknown>, signal?: AbortSignal, escrita = false): Promise<unknown> {
  const db = atelSupabase();
  if (!db) throw new ErroAdministrativo("Supabase indisponível.");
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) throw new ErroAdministrativo("Sessão indisponível. Entre novamente para consultar as devoluções.");
  if (signal?.aborted) throw new DOMException("Consulta cancelada", "AbortError");
  try {
    const chamada = db.rpc(nome, parametros);
    const { data, error } = await (signal ? chamada.abortSignal(signal) : chamada);
    if (error) {
      const code = error.code ?? "";
      if (["PGRST202", "42883"].includes(code)) throw new ErroAdministrativo("Operação administrativa ainda não instalada ou não disponível no Supabase.");
      if (code === "42501") throw new ErroAdministrativo("Seu usuário não possui permissão para esta operação ou organização.");
      if (code === "40001") throw new ErroAdministrativo("A requisição foi alterada ou já foi decidida. Atualize a lista antes de continuar.");
      if (code === "55P03") throw new ErroAdministrativo("Operação ocupada. Tente novamente com os mesmos dados.");
      const rejeitada = ["22023", "22P02", "P0001", "23503", "23505", "23514", "57014"].includes(code);
      throw new ErroAdministrativo(error.message || "Não foi possível concluir a operação administrativa.", escrita && !rejeitada);
    }
    return data;
  } catch (error) {
    if (error instanceof ErroAdministrativo || signal?.aborted) throw error;
    throw new ErroAdministrativo("Falha de comunicação. Tente novamente com os mesmos dados.", escrita);
  }
}

export async function consultarCDPrincipal(signal?: AbortSignal): Promise<CDPrincipal> {
  const data = await rpc("atel_devolucao_admin_consultar_cd_principal", { p_organizacao_id: ORGANIZACAO }, signal);
  if (!objeto(data) || data.contrato_versao !== 1 || data.organizacao_id !== ORGANIZACAO || !uuidAdministrativo(data.local_id) || typeof data.nome !== "string" || !data.nome.trim()) falhaContrato();
  return data as CDPrincipal;
}
export async function listarAdministrativas(status: StatusAdministrativo | "", cursor: CursorAdministrativo | null, signal?: AbortSignal): Promise<ListaAdministrativa> {
  const data = await rpc("atel_devolucao_admin_listar", { p_organizacao_id: ORGANIZACAO, p_status: status || null, p_limite: 25, p_antes_em: cursor?.criada_em ?? null, p_antes_id: cursor?.id ?? null }, signal);
  if (!objeto(data) || data.contrato_versao !== 1 || !Array.isArray(data.requisicoes)) falhaContrato();
  for (const r of data.requisicoes) {
    if (!objeto(r) || r.organizacao_id !== ORGANIZACAO || !uuidAdministrativo(r.id) || !uuidAdministrativo(r.origem_id) || !uuidAdministrativo(r.destino_id)
      || !uuidAdministrativo(r.solicitada_por) || !statusValido(r.status) || r.revisao !== (r.status === "SOLICITADA" ? 1 : 2)
      || !dataValida(r.criada_em) || typeof r.motivo !== "string" || !Array.isArray(r.itens) || !r.itens.length
      || !(r.justificativa === null || typeof r.justificativa === "string") || !(r.decidida_em === null || dataValida(r.decidida_em)) || !(r.decidida_por === null || uuidAdministrativo(r.decidida_por))) falhaContrato();
    for (const i of r.itens) {
      if (!objeto(i) || i.organizacao_id !== ORGANIZACAO || i.requisicao_id !== r.id || !uuidAdministrativo(i.id) || !uuidAdministrativo(i.material_id)
        || typeof i.quantidade !== "number" || !Number.isFinite(i.quantidade) || i.quantidade <= 0 || typeof i.sku !== "string" || typeof i.descricao !== "string"
        || typeof i.unidade !== "string" || typeof i.rastreio !== "string" || !textos(i.seriais) || !textos(i.macs) || !Array.isArray(i.ativos_ids) || !i.ativos_ids.every(uuidAdministrativo)) falhaContrato();
    }
  }
  const c = data.proximo_cursor;
  if (c !== null && (!objeto(c) || !uuidAdministrativo(c.id) || !dataValida(c.criada_em))) falhaContrato();
  return data as ListaAdministrativa;
}
function resultado(data: unknown, esperado: StatusAdministrativo, id?: string): ResultadoAdministrativo {
  if (!objeto(data) || data.contrato_versao !== 1 || data.organizacao_id !== ORGANIZACAO || !uuidAdministrativo(data.requisicao_id)
    || (id !== undefined && data.requisicao_id !== id) || !uuidAdministrativo(data.destino_id) || data.status !== esperado
    || data.revisao !== (esperado === "SOLICITADA" ? 1 : 2) || typeof data.repetida !== "boolean" || data.estoque_movimentado !== false || data.ret_gerado !== false) falhaContrato(true);
  return data as ResultadoAdministrativo;
}
export async function solicitarAdministrativa(p: SolicitarAdministrativa): Promise<ResultadoAdministrativo> {
  bloquearEscrita();
  if (!uuidAdministrativo(p.origem_id) || !uuidAdministrativo(p.chave) || p.motivo.trim().length < 3 || p.motivo.trim().length > 1000 || !p.itens.length || p.itens.length > 100
    || new Set(p.itens.map(i => i.material_id)).size !== p.itens.length || p.itens.some(i => !uuidAdministrativo(i.material_id) || !Number.isFinite(i.quantidade) || i.quantidade <= 0 || i.quantidade > 100000000)) throw new ErroAdministrativo("Revise origem, motivo, materiais e quantidades.");
  return resultado(await rpc("atel_devolucao_admin_solicitar", { p_organizacao_id: ORGANIZACAO, p_origem_id: p.origem_id, p_motivo: p.motivo.trim(), p_itens: p.itens, p_chave_idempotencia: p.chave }, undefined, true), "SOLICITADA");
}
async function decidir(p: DecidirAdministrativa, aprovar: boolean): Promise<ResultadoAdministrativo> {
  bloquearEscrita();
  if (!uuidAdministrativo(p.requisicao_id) || !uuidAdministrativo(p.chave) || p.revisao !== 1 || p.justificativa.trim().length < 3 || p.justificativa.trim().length > 1000) throw new ErroAdministrativo("Informe uma justificativa de 3 a 1000 caracteres para uma requisição pendente.");
  return resultado(await rpc(aprovar ? "atel_devolucao_admin_aprovar" : "atel_devolucao_admin_rejeitar", { p_organizacao_id: ORGANIZACAO, p_requisicao_id: p.requisicao_id, p_revisao: p.revisao, p_justificativa: p.justificativa.trim(), p_chave_idempotencia: p.chave }, undefined, true), aprovar ? "APROVADA" : "REJEITADA", p.requisicao_id);
}
export const aprovarAdministrativa = (p: DecidirAdministrativa) => decidir(p, true);
export const rejeitarAdministrativa = (p: DecidirAdministrativa) => decidir(p, false);

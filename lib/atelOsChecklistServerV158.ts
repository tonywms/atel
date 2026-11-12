import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export type TipoChecklistV158 = "APR" | "ENCERRAMENTO";
export type QuestaoChecklistV158 = { id: string; grupo: string; pergunta: string; critica: boolean };
export type ModeloChecklistV158 = { codigo: TipoChecklistV158; versao: number; titulo: string; estado: "HOMOLOGACAO" | "PUBLICADO" | "INATIVO"; perguntas: QuestaoChecklistV158[] };
export type RespostaChecklistV158 = { valor: "CONFORME" | "NAO_CONFORME" | "NAO_APLICAVEL" | ""; nota: string };
export type DadosChecklistV158 = Record<string, RespostaChecklistV158>;

export function tipoValidoV158(valor: unknown): valor is TipoChecklistV158 {
  return valor === "APR" || valor === "ENCERRAMENTO";
}
export function atendimentoValidoV158(valor: unknown): number | null {
  const n = typeof valor === "number" || typeof valor === "string" ? Number(valor) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
export class ErroChecklistV158 extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

let clienteServidor: SupabaseClient | null = null;
export function bancoChecklistV158(): SupabaseClient {
  if (clienteServidor) return clienteServidor;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ErroChecklistV158("Chave do servidor Supabase ausente.", 503);
  clienteServidor = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return clienteServidor;
}

export async function contextoChecklistV158(req: NextRequest, atendimento: number) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) throw new ErroChecklistV158("Entre novamente no ATEL para acessar os checklists.", 401);
  const verificador = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await verificador.auth.getUser(token);
  if (error || !data.user) throw new ErroChecklistV158("Sessão inválida ou expirada.", 401);

  // Mesmo escopo de homologação utilizado nas rotas /api/os-andamento e /api/os-eventos.
  const tecnico = 4157;
  const base = process.env.ATEL_ADAPTER_BASE_URL;
  const chave = process.env.ATEL_ADAPTER_API_KEY;
  if (!base || !chave) throw new ErroChecklistV158("Adapter ERP não configurado.", 503);
  let resposta: Response;
  try {
    resposta = await fetch(`${base.replace(/\/$/, "")}/os/tecnico/${tecnico}`, {
      headers: { "X-API-Key": chave, Accept: "application/json" },
      cache: "no-store", signal: AbortSignal.timeout(12000),
    });
  } catch { throw new ErroChecklistV158("Não foi possível validar a OS no ERP.", 503); }
  if (!resposta.ok) throw new ErroChecklistV158("Não foi possível validar a OS no ERP.", 503);
  const lista: unknown = await resposta.json().catch(() => null);
  if (!Array.isArray(lista) || !lista.some(o => o && typeof o === "object" && Number((o as { atendimento?: unknown }).atendimento) === atendimento)) {
    throw new ErroChecklistV158("Esta OS não está autorizada para o técnico de homologação.", 403);
  }

  const db = bancoChecklistV158();
  const { data: associacoes, error: errOrganizacao } = await db.from("usuarios_organizacao")
    .select("organizacao_id,perfil").eq("usuario_id", data.user.id).eq("ativo", true).limit(2);
  if (errOrganizacao || !associacoes || associacoes.length !== 1) {
    throw new ErroChecklistV158("Vínculo organizacional ausente ou ambíguo.", 403);
  }
  return { db, usuarioId: data.user.id, organizacaoId: String(associacoes[0].organizacao_id), tecnico };
}

export async function modeloChecklistV158(db: SupabaseClient, tipo: TipoChecklistV158): Promise<ModeloChecklistV158> {
  const { data, error } = await db.from("atel_os_checklist_modelos_v158")
    .select("codigo,versao,titulo,estado,perguntas").eq("codigo", tipo).neq("estado", "INATIVO")
    .order("versao", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) throw new ErroChecklistV158("Modelo de checklist indisponível.", 503);
  if (!Array.isArray(data.perguntas) || data.perguntas.length === 0) throw new ErroChecklistV158("Checklist sem perguntas válidas.", 503);
  return data as ModeloChecklistV158;
}

export function respostasValidasV158(input: unknown, perguntas: QuestaoChecklistV158[]): DadosChecklistV158 {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ErroChecklistV158("Respostas inválidas.");
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).length > perguntas.length) throw new ErroChecklistV158("Quantidade de respostas inválida.");
  const ids = new Set(perguntas.map(p => p.id));
  const resultado: DadosChecklistV158 = {};
  for (const [id, valor] of Object.entries(raw)) {
    if (!ids.has(id)) throw new ErroChecklistV158("Pergunta fora do modelo ativo.");
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new ErroChecklistV158("Resposta inválida.");
    const v = valor as Record<string, unknown>;
    if (!["CONFORME", "NAO_CONFORME", "NAO_APLICAVEL", ""].includes(String(v.valor ?? ""))) {
      throw new ErroChecklistV158("Opção de resposta inválida.");
    }
    if (typeof v.nota !== "string" || v.nota.length > 500) throw new ErroChecklistV158("Observação da pergunta excedeu 500 caracteres.");
    resultado[id] = { valor: String(v.valor ?? "") as RespostaChecklistV158["valor"], nota: v.nota };
  }
  return resultado;
}

export async function buscarExecucaoV158(db: SupabaseClient, ctx: {organizacaoId:string;usuarioId:string;tecnico:number}, atendimento:number, tipo:TipoChecklistV158) {
  const { data, error } = await db.from("atel_os_checklist_execucoes_v158")
    .select("id,modelo_versao,respostas,observacao,situacao,atualizada_em")
    .eq("organizacao_id",ctx.organizacaoId).eq("usuario_id",ctx.usuarioId)
    .eq("tecnico_erp",ctx.tecnico).eq("atendimento_erp",atendimento).eq("tipo",tipo).maybeSingle();
  if (error) throw new ErroChecklistV158("Registro da avaliação indisponível.", 503);
  return data;
}

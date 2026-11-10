import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const respond = (body: object, status = 200) => NextResponse.json(body, { status, headers });

function servidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Credenciais Supabase indisponíveis");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function autorizado(req: NextRequest, atendimento: number) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  // Escopo atual de homologação ERP: somente técnico 4157, já vinculado à sessão de teste.
  if (error || !data.user) return null;
  const tecnico = 4157;
  const base = process.env.ATEL_ADAPTER_BASE_URL;
  const apiKey = process.env.ATEL_ADAPTER_API_KEY;
  if (!base || !apiKey) throw new Error("Adapter indisponível");
  const response = await fetch(`${base.replace(/\/$/, "")}/os/tecnico/${tecnico}`, {
    headers: { "X-API-Key": apiKey, Accept: "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Não foi possível validar as OS no ERP");
  const ordens: unknown = await response.json();
  if (!Array.isArray(ordens) || !ordens.some((o: unknown) =>
    !!o && typeof o === "object" && Number((o as { atendimento?: unknown }).atendimento) === atendimento
  )) return null;
  return { userId: data.user.id, tecnico };
}

function numeroPositivo(value: unknown) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
function versao(value: unknown) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
function dataValida(value: unknown): string | null | undefined {
  if (value === null || value === "" || value === undefined) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const data = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(data.valueOf()) || data.toISOString().slice(0, 10) !== value) return undefined;
  return value;
}

async function consultar(atendimento: number, userId: string, tecnico: number) {
  const db = servidor();
  const [eventosResult, pendenciaResult] = await Promise.all([
    db.from("atel_os_eventos")
      .select("id,tipo,etapa_anterior,etapa_nova,tipo_ocorrencia,motivo,nova_data,versao,ocorrido_em")
      .eq("usuario_id", userId).eq("tecnico_erp", tecnico).eq("atendimento_erp", atendimento)
      .order("ocorrido_em", { ascending: false }).order("versao", { ascending: false }).limit(100),
    db.from("atel_os_ocorrencias")
      .select("id,tipo,motivo,nova_data,criado_em,ativa")
      .eq("usuario_id", userId).eq("tecnico_erp", tecnico).eq("atendimento_erp", atendimento)
      .eq("ativa", true).maybeSingle(),
  ]);
  if (eventosResult.error || pendenciaResult.error) throw new Error("Histórico indisponível");
  return { atendimento, eventos: eventosResult.data ?? [], pendencia: pendenciaResult.data ?? null };
}

export async function GET(req: NextRequest) {
  const atendimento = numeroPositivo(req.nextUrl.searchParams.get("atendimento"));
  if (!atendimento) return respond({ error: "OS inválida" }, 400);
  try {
    const ctx = await autorizado(req, atendimento);
    if (!ctx) return respond({ error: "OS não autorizada para este técnico" }, 403);
    return respond(await consultar(atendimento, ctx.userId, ctx.tecnico));
  } catch {
    return respond({ error: "Não foi possível consultar os eventos desta OS" }, 502);
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return respond({ error: "JSON inválido" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return respond({ error: "Dados inválidos" }, 400);
  const input = body as Record<string, unknown>;
  const atendimento = numeroPositivo(input.atendimento);
  const expectedVersion = versao(input.versao);
  if (!atendimento || !expectedVersion) return respond({ error: "OS ou versão inválida" }, 400);
  const acao = String(input.acao ?? "");
  if (acao !== "REGISTRAR" && acao !== "RETOMAR") return respond({ error: "Ação inválida" }, 400);
  const motivo = typeof input.motivo === "string" ? input.motivo.trim() : "";
  const justificativa = typeof input.justificativa === "string" ? input.justificativa.trim() : "";
  const novaData = dataValida(input.novaData);
  if (acao === "REGISTRAR" && (
    !["CLIENTE_AUSENTE", "IMPEDIMENTO_TECNICO", "OUTRO"].includes(String(input.tipo ?? "")) ||
    motivo.length < 10 || motivo.length > 2000 || novaData === undefined
  )) return respond({ error: "Preencha o tipo, uma justificativa de 10 a 2000 caracteres e uma data válida" }, 400);
  if (acao === "RETOMAR" && justificativa.length > 2000) return respond({ error: "Justificativa muito longa" }, 400);

  try {
    const ctx = await autorizado(req, atendimento);
    if (!ctx) return respond({ error: "OS não autorizada para este técnico" }, 403);
    const args = acao === "REGISTRAR"
      ? { p_usuario: ctx.userId, p_tecnico: ctx.tecnico, p_atendimento: atendimento, p_versao: expectedVersion,
          p_tipo: String(input.tipo), p_motivo: motivo, p_nova_data: novaData }
      : { p_usuario: ctx.userId, p_tecnico: ctx.tecnico, p_atendimento: atendimento, p_versao: expectedVersion,
          p_justificativa: justificativa || null };
    const rpc = acao === "REGISTRAR" ? "atel_registrar_ocorrencia_v525d4" : "atel_retomar_os_v525d4";
    const { data, error } = await servidor().rpc(rpc, args);
    if (error) {
      const msg = error.message ?? "";
      if (/CONFLITO_VERSAO|OCORRENCIA_PENDENTE|SEM_OCORRENCIA_PENDENTE/i.test(msg))
        return respond({ error: "Esta OS mudou em outra sessão. Atualize e confira o histórico." }, 409);
      if (/JUSTIFICATIVA_ANTECIPACAO_OBRIGATORIA/.test(msg))
        return respond({ error: "Para antecipar o reagendamento, informe justificativa com pelo menos 10 caracteres." }, 400);
      if (/DADOS_INVALIDOS/.test(msg)) return respond({ error: "Verifique a justificativa e a data do reagendamento." }, 400);
      return respond({ error: "Não foi possível registrar a ação no Supabase" }, 503);
    }
    const historico = await consultar(atendimento, ctx.userId, ctx.tecnico);
    return respond({ andamento: { etapa: data.etapa, versao: data.versao, atualizado_em: data.atualizado_em }, ...historico });
  } catch {
    return respond({ error: "Não foi possível validar a OS no ERP" }, 502);
  }
}

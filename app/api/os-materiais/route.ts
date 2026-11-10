import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const reply = (obj: object, status = 200) => NextResponse.json(obj, { status, headers });
function bancoServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVER_KEY_MISSING");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function contexto(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;
  const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { db, userId: data.user.id, tecnico: 4157 };
}
async function autorizado(req: NextRequest, atendimento: number) {
  const ctx = await contexto(req);
  if (!ctx) return null;
  const base = process.env.ATEL_ADAPTER_BASE_URL;
  const apiKey = process.env.ATEL_ADAPTER_API_KEY;
  if (!base || !apiKey) throw new Error("Adapter nao configurado");
  const res = await fetch(`${base.replace(/\/$/, "")}/os/tecnico/${ctx.tecnico}`, { headers: { "X-API-Key": apiKey, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error("Consulta ERP indisponivel");
  const ordens: unknown = await res.json();
  if (!Array.isArray(ordens) || !ordens.some((o: unknown) => !!o && typeof o === "object" && Number((o as { atendimento?: unknown }).atendimento) === atendimento)) return null;
  return ctx;
}
function numeroAtendimento(v: unknown) {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
export async function GET(req: NextRequest) {
  const atendimento = numeroAtendimento(req.nextUrl.searchParams.get("atendimento"));
  if (!atendimento) return reply({ error: "Atendimento invalido" }, 400);
  try {
    const ctx = await autorizado(req, atendimento);
    if (!ctx) return reply({ error: "Acesso nao autorizado a OS" }, 403);
    const { data, error } = await bancoServidor().from("atel_os_apontamentos").select("itens,versao,atualizado_em").eq("tecnico_erp", ctx.tecnico).eq("atendimento_erp", atendimento).order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
    if (error) return reply({ error: "Consulta de apontamentos indisponivel" }, 503);
    return reply({ atendimento, itens: data?.itens ?? [], versao: data?.versao ?? 0, atualizado_em: data?.atualizado_em ?? null });
  } catch (e) { return reply({ error: e instanceof Error && e.message === "SUPABASE_SERVER_KEY_MISSING" ? "Chave de servidor Supabase ausente no ambiente. Configure SUPABASE_SERVICE_ROLE_KEY no servidor." : "Falha ao consultar a OS ou o ERP" }, e instanceof Error && e.message === "SUPABASE_SERVER_KEY_MISSING" ? 503 : 502); }
}
export async function PUT(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return reply({ error: "JSON invalido" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Dados invalidos" }, 400);
  const b = body as Record<string, unknown>;
  const atendimento = numeroAtendimento(b.atendimento);
  const versao = Number(b.versao);
  if (!atendimento || !Number.isSafeInteger(versao) || versao < 0 || !Array.isArray(b.itens) || b.itens.length > 100) return reply({ error: "Dados invalidos" }, 400);
  const itens = b.itens as unknown[];
  const ids = new Set<string>();
  for (const item of itens) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return reply({ error: "Item invalido" }, 400);
    const p = item as Record<string, unknown>;
    const codigo = numeroAtendimento(p.cod_produto);
    const qtd = Number(p.quantidade);
    const patrimonio = p.patrimonio == null ? null : String(p.patrimonio);
    const mac = p.mac == null ? null : String(p.mac);
    if (!codigo || !Number.isFinite(qtd) || qtd <= 0 || qtd > 1000000 || (patrimonio && patrimonio.length > 80) || (mac && mac.length > 80)) return reply({ error: "Produto ou quantidade invalida" }, 400);
    const id = `${codigo}:${patrimonio ?? ""}:${mac ?? ""}`;
    if (ids.has(id)) return reply({ error: "Produto duplicado" }, 400);
    ids.add(id);
  }
  try {
    const ctx = await autorizado(req, atendimento);
    if (!ctx) return reply({ error: "Acesso nao autorizado a OS" }, 403);
    // Rascunho: validar formato acima e persistir sem consultar estoque ERP.
    // Saldo e baixa WMS serao conferidos na finalizacao transacional.
    const { data, error } = await bancoServidor().rpc("atel_salvar_apontamento_v52", { p_usuario: ctx.userId, p_tecnico: ctx.tecnico, p_atendimento: atendimento, p_itens: itens, p_versao: versao });
    if (error) return reply({ error: error.message.includes("CONFLITO_VERSAO") ? "Rascunho alterado em outra sessao. Atualize antes de salvar." : "Nao foi possivel salvar o rascunho" }, error.message.includes("CONFLITO_VERSAO") ? 409 : 503);
    return reply({ atendimento, itens: data.itens, versao: data.versao, atualizado_em: data.atualizado_em });
  } catch { return reply({ error: "Falha ao validar OS ou salvar apontamentos" }, 502); }
}

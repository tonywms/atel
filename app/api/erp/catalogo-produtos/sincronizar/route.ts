import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ORG = "6ea04673-4deb-42cf-a001-dbb027120103";
const TECNICO = "4157";
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Autenticação obrigatória" }, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = process.env.ATEL_ADAPTER_BASE_URL;
  const key = process.env.ATEL_ADAPTER_API_KEY;
  if (!url || !anon || !service || !base || !key) return json({ error: "Integração ERP não configurada" }, 503);
  try {
    const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await auth.auth.getUser(token);
    if (authError || !user) return json({ error: "Sessão inválida" }, 401);
    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: vinculos, error: vinculoErro } = await db.from("usuarios_organizacao")
      .select("perfil").eq("organizacao_id", ORG).eq("usuario_id", user.id).eq("ativo", true).limit(1);
    if (vinculoErro) return json({ error: "Não foi possível validar o usuário" }, 503);
    if (!vinculos?.some(v => ["admin", "gestor", "tecnico"].includes(v.perfil))) return json({ error: "Usuário sem permissão" }, 403);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20000);
    let response: Response;
    try {
      response = await fetch(`${base.endsWith("/") ? base.slice(0, -1) : base}/inventario/usuario/${TECNICO}`, {
        headers: { "X-API-Key": key, Accept: "application/json" }, cache: "no-store", signal: ctrl.signal
      });
    } finally { clearTimeout(timeout); }
    if (!response.ok) return json({ error: `Falha ao consultar o adapter ERP (HTTP ${response.status})` }, 502);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return json({ error: "Formato inesperado do inventário ERP" }, 502);
    const mapa = new Map<string, { organizacao_id: string; sku: string; descricao: string; unidade: string }>();
    let ignorados = 0;
    for (const linha of payload) {
      if (!linha || typeof linha !== "object") { ignorados++; continue; }
      const item = linha as Record<string, unknown>;
      const sku = String(item.cod_produto ?? "").trim();
      const descricao = String(item.produto ?? "").trim();
      if (!sku || !descricao || sku === "null" || descricao === "null") { ignorados++; continue; }
      if (!mapa.has(sku)) mapa.set(sku, { organizacao_id: ORG, sku, descricao, unidade: "UN" });
    }
    if (!mapa.size) return json({ error: "O ERP não retornou produtos válidos; nenhum cadastro foi alterado" }, 422);
    // Apenas inserir códigos inexistentes. Nunca substituir descrição/unidade de cadastro existente.
    // ignoreDuplicates usa a restrição UNIQUE (organizacao_id,sku), inclusive em chamadas repetidas.
    const produtos = [...mapa.values()];
    let novos = 0;
    for (let i = 0; i < produtos.length; i += 100) {
      const lote = produtos.slice(i, i + 100);
      const { data, error } = await db.from("materiais").upsert(lote, {
        onConflict: "organizacao_id,sku", ignoreDuplicates: true
      }).select("id");
      if (error) return json({ error: `Falha ao persistir catálogo: ${error.message}. Verifique os produtos gravados antes de repetir.` }, 500);
      novos += data?.length ?? 0;
    }
    return json({ linhasERP: payload.length, codigosUnicos: produtos.length, novos, ignorados, fonte: `inventario/usuario/${TECNICO}`, persistido: true });
  } catch (e) {
    return json({ error: e instanceof Error && e.name === "AbortError" ? "Tempo limite ao consultar ERP" : "Falha na sincronização do catálogo ERP" }, 502);
  }
}

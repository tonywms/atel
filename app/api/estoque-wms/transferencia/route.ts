import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

// Transferencia CD -> estoque tecnico. Nunca consulta saldo ERP.
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Autenticacao obrigatoria" }, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serviceKey) return json({ error: "Configuracao Supabase incompleta" }, 503);
  let body: Record<string, unknown>;
  try { body = await req.json(); if (!body || Array.isArray(body) || typeof body !== "object") throw Error(); }
  catch { return json({ error: "JSON invalido" }, 400); }
  const { organizacao_id, cd_id, tecnico_usuario_id, material_id, quantidade, chave_idempotencia } = body;
  if (!uuid(organizacao_id) || !uuid(cd_id) || !uuid(tecnico_usuario_id) || !uuid(material_id) ||
      typeof quantidade !== "number" || !Number.isFinite(quantidade) || quantidade <= 0 ||
      typeof chave_idempotencia !== "string" || !chave_idempotencia.trim() || chave_idempotencia.length > 200) {
    return json({ error: "Dados de transferencia invalidos" }, 400);
  }
  try {
    const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: identity, error: authError } = await auth.auth.getUser(token);
    if (authError || !identity.user) return json({ error: "Sessao invalida" }, 401);
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: membership, error: membershipError } = await db.from("usuarios_organizacao")
      .select("perfil").eq("organizacao_id", organizacao_id).eq("usuario_id", identity.user.id).eq("ativo", true).limit(1);
    if (membershipError) return json({ error: "Falha ao validar permissao" }, 503);
    if (!membership?.some((item) => item.perfil === "admin" || item.perfil === "gestor"))
      return json({ error: "Transferencia restrita a administradores e gestores" }, 403);
    const { data, error } = await db.rpc("atel_abastecimento_cd_tecnico_v25", {
      p_organizacao_id: organizacao_id, p_cd_id: cd_id, p_tecnico_usuario_id: tecnico_usuario_id,
      p_material_id: material_id, p_quantidade: quantidade,
      p_chave_idempotencia: chave_idempotencia.trim(), p_realizado_por: identity.user.id,
    });
    if (error) return json({ error: "Transferencia recusada pelo WMS", detalhe: error.message }, 409);
    return json({ ok: true, ...data });
  } catch { return json({ error: "Falha interna na transferencia WMS" }, 502); }
}

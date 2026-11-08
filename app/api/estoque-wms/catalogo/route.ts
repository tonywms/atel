import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const org = "6ea04673-4deb-42cf-a001-dbb027120103";
const json = (data: object, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Autenticação obrigatória" }, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !serviceKey) return json({ error: "Configuração Supabase incompleta no servidor" }, 503);

  try {
    // Valida a identidade do JWT antes de usar o cliente administrativo.
    const db = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return json({ error: "Sessão Supabase inválida" }, 401);

    // Service role somente no servidor, com escopo fixo de organização e vínculo ativo.
    const adminDb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: membership, error: membershipError } = await adminDb
      .from("usuarios_organizacao")
      .select("perfil")
      .eq("organizacao_id", org)
      .eq("usuario_id", user.id)
      .eq("ativo", true)
      .limit(1);
    if (membershipError) return json({ error: "Falha ao validar vínculo ATEL", detalhe: membershipError.message }, 503);
    if (!membership?.some((m) => m.perfil === "admin" || m.perfil === "gestor" || m.perfil === "tecnico"))
      return json({ error: "Seu perfil não possui acesso ao catálogo WMS" }, 403);

    const [l, m, u] = await Promise.all([
      adminDb.from("locais_estoque").select("id,nome,tipo,responsavel_usuario_id").eq("organizacao_id", org).eq("ativo", true).order("nome"),
      adminDb.from("materiais").select("id,sku,descricao").eq("organizacao_id", org).eq("ativo", true).order("sku"),
      adminDb.from("usuarios_organizacao").select("usuario_id").eq("organizacao_id", org).eq("ativo", true).eq("perfil", "tecnico"),
    ]);
    if (l.error || m.error || u.error)
      return json({ error: "Falha na consulta dos cadastros WMS", detalhe: l.error?.message || m.error?.message || u.error?.message }, 503);
    return json({ locais: l.data || [], materiais: m.data || [], tecnicos: (u.data || []).map((x) => x.usuario_id) });
  } catch {
    return json({ error: "Falha inesperada ao consultar o WMS" }, 502);
  }
}

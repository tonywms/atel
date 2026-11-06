import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

// Consulta real de conciliacao; jamais executa baixa ou libera finalizacao.
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply({ error: "Autenticacao obrigatoria" }, 401);
  const atendimento = req.nextUrl.searchParams.get("atendimento");
  if (!atendimento || !/^[1-9]\d{0,14}$/.test(atendimento)) return reply({ error: "Atendimento ERP invalido" }, 400);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serverKey) return reply({ error: "Configuracao Supabase incompleta" }, 503);
  try {
    const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: identity, error: identityError } = await auth.auth.getUser(token);
    if (identityError || !identity.user) return reply({ error: "Sessao invalida" }, 401);
    const db = createClient(url, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: vinculos, error: vinculoError } = await db.from("usuarios_organizacao")
      .select("organizacao_id,perfil").eq("usuario_id", identity.user.id).eq("ativo", true);
    if (vinculoError) return reply({ error: "Falha ao validar vinculo" }, 503);
    if (!vinculos?.length) return reply({ error: "Usuario sem organizacao ativa" }, 403);
    const { data: rascunho, error: rascunhoError } = await db.from("atel_os_apontamentos")
      .select("id").eq("usuario_id", identity.user.id).eq("atendimento_erp", Number(atendimento)).limit(1);
    if (rascunhoError) return reply({ error: "Falha ao validar OS" }, 503);
    if (!rascunho?.length) return reply({ error: "OS nao vinculada ao usuario" }, 403);
    const { data, error } = await db.rpc("atel_conciliar_os_wms_v22", {
      p_atendimento: Number(atendimento), p_usuario: identity.user.id,
    });
    if (error) return reply({ error: "Falha na conciliacao WMS" }, 503);
    return reply({ ...data, finalizacao_liberada: false, baixa_executada: false });
  } catch {
    return reply({ error: "Falha interna na conciliacao WMS" }, 502);
  }
}

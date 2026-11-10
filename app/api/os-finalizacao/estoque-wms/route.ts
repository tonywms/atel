import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Diagnostico somente leitura. Nao libera finalizacao nem movimenta estoque.
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply({ error: "Autenticacao obrigatoria" }, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serverKey) return reply({ error: "Configuracao incompleta" }, 503);
  try {
    const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: session, error: authError } = await auth.auth.getUser(token);
    if (authError || !session.user) {
      return reply({ error: "Acesso nao autorizado" }, 403);
    }
    const db = createClient(url, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: locais, error: locaisError } = await db.from("locais_estoque")
      .select("id,organizacao_id,nome,tipo,ativo")
      .eq("responsavel_usuario_id", session.user.id).eq("ativo", true);
    if (locaisError) return reply({ error: "Falha ao consultar locais WMS" }, 503);
    if (!locais?.length) return reply({ status: "SEM_LOCAL_VINCULADO", locais: [], saldos: [], total_unidades: 0, conciliado: false, finalizacao_liberada: false, baixa_executada: false, aviso: "Nenhum local de estoque WMS ativo vinculado ao usuario autenticado. Necessaria conciliacao operacional." });
    const ids = locais.map(l => l.id);
    const { data: saldos, error: saldosError } = await db.from("saldos_estoque")
      .select("local_id,material_id,organizacao_id,quantidade,atualizado_em").in("local_id", ids);
    if (saldosError) return reply({ error: "Falha ao consultar saldos WMS" }, 503);
    const locaisPorId = new Map(locais.map(l => [l.id, l.organizacao_id]));
    const saldosValidos = (saldos ?? []).filter(s => locaisPorId.get(s.local_id) === s.organizacao_id);
    return reply({ status: saldosValidos.length ? "SALDOS_LOCALIZADOS_NAO_CONCILIADOS" : "SEM_SALDO_WMS", locais, saldos: saldosValidos, total_unidades: saldosValidos.reduce((n, s) => n + Number(s.quantidade || 0), 0), conciliado: false, finalizacao_liberada: false, baixa_executada: false, aviso: "Consulta informativa. Saldo e patrimonio ainda exigem conciliacao e baixa transacional homologada." });
  } catch {
    return reply({ error: "Falha na consulta de estoque WMS" }, 502);
  }
}

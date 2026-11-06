import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const url = process.env.ATEL_ADAPTER_BASE_URL;
  const apiKey = process.env.ATEL_ADAPTER_API_KEY;
  if (!url || !apiKey) return NextResponse.json({ error: "Adapter nao configurado no servidor" }, { status: 503, headers });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!supabaseUrl || !anonKey || !token) return NextResponse.json({ error: "Sessao obrigatoria" }, { status: 401, headers });
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || data.user?.email?.toLowerCase() !== "teste@wmsexpert.com.br") return NextResponse.json({ error: "Acesso nao autorizado" }, { status: 403, headers });

  const kind = request.nextUrl.searchParams.get("tipo");
  const id = request.nextUrl.searchParams.get("id") ?? "4157";
  if (!/^\d{1,12}$/.test(id)) return NextResponse.json({ error: "ID invalido" }, { status: 400, headers });
  const paths: Record<string, string> = {
    os: `/os/tecnico/${id}`,
    inventario: `/inventario/usuario/${id}`,
    detalhe: `/atendimentos/detalhado/${id}`,
  };
  if (!kind || !paths[kind]) return NextResponse.json({ error: "Consulta nao permitida" }, { status: 400, headers });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}${paths[kind]}`, {
      method: "GET", headers: { "X-API-Key": apiKey, Accept: "application/json" },
      signal: controller.signal, cache: "no-store",
    });
    const body = await response.text();
    let payload: unknown;
    try { payload = JSON.parse(body); } catch { payload = { mensagem: body.slice(0, 400) }; }
    let persistencia: { status: string; mensagem?: string } = { status: "nao_executada" };
    if (response.ok) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        persistencia = { status: "pendente", mensagem: "SUPABASE_SERVICE_ROLE_KEY ausente no servidor" };
      } else {
        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error: writeError } = await admin.from("adapter_homologacao_snapshots").upsert({
          tipo: kind, identificador: id, origem: "erp_adapter", payload,
          http_status: response.status, atualizado_em: new Date().toISOString(),
        }, { onConflict: "origem,tipo,identificador" });
        persistencia = writeError
          ? { status: "erro", mensagem: "Nao foi possivel persistir o snapshot. Verifique a tabela e permissoes." }
          : { status: "gravado" };
      }
    }
    return NextResponse.json({ ok: response.ok, http: response.status, tipo: kind, dados: payload, persistencia }, { status: response.ok ? 200 : 502, headers });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error && err.name === "AbortError" ? "Tempo limite de conexao (12s)" : "Falha de comunicacao com o Adapter" }, { status: 502, headers });
  } finally { clearTimeout(timeout); }
}
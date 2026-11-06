import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers });

export async function GET(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
    const base = process.env.ATEL_ADAPTER_BASE_URL;
    const apiKey = process.env.ATEL_ADAPTER_API_KEY;
    const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!url || !anon || !service || !base || !apiKey || !token) return reply({ error: "Configuração incompleta" }, 503);
    const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.getUser(token);
    // Somente homologação do técnico ERP 4157, sem escalar privilégios para outros usuários.
    if (error || !data.user || data.user.email?.toLowerCase() !== "teste@wmsexpert.com.br") return reply({ error: "Não autorizado" }, 403);
    const tecnico = 4157;
    const response = await fetch(`${base.replace(/\/$/, "")}/os/tecnico/${tecnico}`, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
      cache: "no-store", signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return reply({ error: "ERP indisponível" }, 502);
    const os: unknown = await response.json();
    if (!Array.isArray(os)) return reply({ error: "OS ERP inválidas" }, 502);
    const permitidas = new Set(os.map((v: unknown) => v && typeof v === "object"
      ? Number((v as { atendimento?: unknown }).atendimento) : 0).filter((v: number) => Number.isSafeInteger(v) && v > 0));
    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const [andamento, pendencias, eventos] = await Promise.all([
      db.from("atel_os_andamento").select("atendimento_erp,etapa,versao,atualizado_em")
        .eq("usuario_id", data.user.id).eq("tecnico_erp", tecnico).limit(1000),
      db.from("atel_os_ocorrencias").select("atendimento_erp,tipo,motivo,nova_data,criado_em,ativa")
        .eq("usuario_id", data.user.id).eq("tecnico_erp", tecnico).order("criado_em", { ascending: false }).limit(1000),
      db.from("atel_os_eventos").select("id,atendimento_erp,tipo,etapa_anterior,etapa_nova,tipo_ocorrencia,motivo,nova_data,ocorrido_em,versao")
        .eq("usuario_id", data.user.id).eq("tecnico_erp", tecnico).order("ocorrido_em", { ascending: true }).limit(1000),
    ]);
    if (andamento.error || pendencias.error || eventos.error) return reply({ error: "Consulta de andamento indisponível" }, 503);
    return reply({
      andamentos: (andamento.data ?? []).filter(v => permitidas.has(Number(v.atendimento_erp))),
      ocorrencias: (pendencias.data ?? []).filter(v => permitidas.has(Number(v.atendimento_erp))),
      eventos: (eventos.data ?? []).filter(v => permitidas.has(Number(v.atendimento_erp))),
    });
  } catch { return reply({ error: "Não foi possível consultar o acompanhamento ERP" }, 502); }
}

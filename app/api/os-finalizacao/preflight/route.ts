import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
type Item = { cod_produto: number; quantidade: number; patrimonio?: string | number | null; mac?: string | null; produto?: string };
const integer = (v: unknown) => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : null; };

export async function GET(req: NextRequest) {
  const atendimento = integer(req.nextUrl.searchParams.get("atendimento"));
  if (!atendimento) return reply({ error: "Atendimento invalido" }, 400);
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
  const base = process.env.ATEL_ADAPTER_BASE_URL;
  const apiKey = process.env.ATEL_ADAPTER_API_KEY;
  if (!token) return reply({ error: "Autenticacao obrigatoria" }, 401);
  if (!url || !publicKey || !serverKey || !base || !apiKey) return reply({ error: "Configuracao do servidor incompleta" }, 503);
  try {
    const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: session, error: authError } = await auth.auth.getUser(token);
    if (authError || !session.user || session.user.email?.toLowerCase() !== "teste@wmsexpert.com.br") return reply({ error: "Acesso nao autorizado" }, 403);
    const tecnico = 4157;
    const endpoint = base.replace(/\/$/, "");
    const headers = { "X-API-Key": apiKey, Accept: "application/json" };
    const osResponse = await fetch(`${endpoint}/os/tecnico/${tecnico}`, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!osResponse.ok) return reply({ error: "ERP indisponivel para validar a OS" }, 502);
    const ordens: unknown = await osResponse.json();
    if (!Array.isArray(ordens) || !ordens.some(o => o && typeof o === "object" && Number((o as { atendimento?: unknown }).atendimento) === atendimento)) return reply({ error: "OS nao atribuida ao tecnico" }, 403);
    const db = createClient(url, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const [stageResult, draftResult] = await Promise.all([
      db.from("atel_os_andamento").select("etapa,versao").eq("usuario_id", session.user.id).eq("tecnico_erp", tecnico).eq("atendimento_erp", atendimento).maybeSingle(),
      db.from("atel_os_apontamentos").select("itens,versao,atualizado_em").eq("tecnico_erp", tecnico).eq("atendimento_erp", atendimento).order("atualizado_em", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (stageResult.error || draftResult.error) return reply({ error: "Falha na consulta operacional" }, 503);
    const motivos: string[] = [];
    if (stageResult.data?.etapa !== "ATENDIMENTO") motivos.push("OS nao esta na etapa Atendimento");
    const itens: Item[] = Array.isArray(draftResult.data?.itens) ? draftResult.data.itens : [];
    if (itens.length === 0) motivos.push("Nenhum material apontado");
    // O ERP informa a OS, mas nao e a fonte do estoque WMS.
    // Sem saldo centralizado e vinculo tecnico/material homologados, NUNCA liberar a baixa.
    const conferencias = itens.map(item => ({
      cod_produto: item.cod_produto,
      produto: item.produto ?? "",
      quantidade: Number(item.quantidade),
      saldo_erp: null, // Campo legado do contrato; saldo WMS nao disponivel.
      patrimonio: item.patrimonio ?? null,
      mac: item.mac ?? null,
      valido: false,
    }));
    motivos.push("Estoque WMS centralizado ainda nao conciliado com os saldos dos tecnicos");
    motivos.push("Baixa transacional e idempotente da OS ainda nao homologada");
    return reply({ atendimento, tecnico_erp: tecnico, etapa: stageResult.data?.etapa ?? "PENDENTE", versao_rascunho: draftResult.data?.versao ?? 0, total_itens: itens.length, total_unidades: itens.reduce((n, i) => n + Number(i.quantidade || 0), 0), conferencias, motivos, finalizacao_liberada: false, baixa_executada: false });
  } catch { return reply({ error: "Nao foi possivel concluir a pre-conferencia" }, 502); }
}

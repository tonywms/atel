import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "no-store" };
type Tipo = "os" | "inventario" | "detalhe";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Sessao autenticada obrigatoria" }, { status: 401, headers: noCache });
  const auth = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Sessao invalida" }, { status: 401, headers: noCache });

  // Qualquer usuario autenticado pode consultar esta integracao de homologacao.
  const tecnico = "4157";
  const tipo = req.nextUrl.searchParams.get("tipo") as Tipo | null;
  const atendimento = req.nextUrl.searchParams.get("atendimento");
  if (tipo !== "os" && tipo !== "inventario" && tipo !== "detalhe") return NextResponse.json({ error: "Tipo invalido" }, { status: 400, headers: noCache });
  if (tipo === "detalhe" && (!atendimento || !/^\d{1,12}$/.test(atendimento))) return NextResponse.json({ error: "Atendimento invalido" }, { status: 400, headers: noCache });
  const base = process.env.ATEL_ADAPTER_BASE_URL;
  const key = process.env.ATEL_ADAPTER_API_KEY;
  if (!base || !key) return NextResponse.json({ error: "Adapter nao configurado" }, { status: 503, headers: noCache });

  const path = tipo === "os" ? `/os/tecnico/${tecnico}` : tipo === "inventario" ? `/inventario/usuario/${tecnico}` : `/atendimentos/detalhado/${atendimento}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    // Para detalhe, verificar se a OS pertence ao tecnico antes de consultar dados sensiveis.
    if (tipo === "detalhe") {
      const list = await fetch(`${base.replace(/\/$/, "")}/os/tecnico/${tecnico}`, { headers: { "X-API-Key": key, Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
      if (!list.ok) return NextResponse.json({ error: "Nao foi possivel verificar a atribuicao da OS" }, { status: 502, headers: noCache });
      const assigned: unknown = await list.json();
      if (!Array.isArray(assigned) || !assigned.some((os: unknown) => !!os && typeof os === "object" && String((os as Record<string, unknown>).atendimento) === atendimento)) {
        return NextResponse.json({ error: "OS nao atribuida ao tecnico" }, { status: 403, headers: noCache });
      }
    }
    const response = await fetch(`${base.replace(/\/$/, "")}${path}`, { headers: { "X-API-Key": key, Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Consulta ERP indisponivel" }, { status: 502, headers: noCache });
    const dados: unknown = await response.json();
    if ((tipo === "os" || tipo === "inventario") && !Array.isArray(dados)) return NextResponse.json({ error: "Formato ERP inesperado" }, { status: 502, headers: noCache });
    if (tipo === "detalhe" && (!dados || typeof dados !== "object" || Array.isArray(dados) || String((dados as Record<string, unknown>).IdTecnicoVisita) !== tecnico || String((dados as Record<string, unknown>).IDAtendimento) !== atendimento)) return NextResponse.json({ error: "Detalhe ERP inconsistente" }, { status: 502, headers: noCache });
    return NextResponse.json({ ok: true, tipo, tecnico, dados, somenteLeitura: true }, { headers: noCache });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error && err.name === "AbortError" ? "Tempo limite do ERP" : "Falha de comunicacao com ERP" }, { status: 502, headers: noCache });
  } finally { clearTimeout(timeout); }
}

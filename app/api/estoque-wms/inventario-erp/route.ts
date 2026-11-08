import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const org = "6ea04673-4deb-42cf-a001-dbb027120103";
const tecnicoERP = "4157"; // Vinculo de homologacao: nao aceitar ID arbitrario do cliente.
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\\s+(.+)$/i)?.[1];
  if (!token) return reply({ error: "Autenticacao obrigatoria" }, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
  const base = process.env.ATEL_ADAPTER_BASE_URL;
  const apiKey = process.env.ATEL_ADAPTER_API_KEY;
  if (!url || !anon || !service || !base || !apiKey) return reply({ error: "Integracao ERP indisponivel no servidor" }, 503);
  try {
    const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await auth.auth.getUser(token);
    if (error || !user) return reply({ error: "Sessao invalida" }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: vinculos, error: vinculoErro } = await admin.from("usuarios_organizacao")
      .select("perfil").eq("organizacao_id", org).eq("usuario_id", user.id).eq("ativo", true).limit(1);
    if (vinculoErro) return reply({ error: "Nao foi possivel validar o acesso" }, 503);
    if (!vinculos?.some(v => ["admin", "gestor", "tecnico"].includes(v.perfil)))
      return reply({ error: "Usuario sem vinculo ativo para consultar o inventario" }, 403);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${base.replace(/\/$/, "")}/inventario/usuario/${tecnicoERP}`, {
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
        cache: "no-store", signal: controller.signal
      });
      if (!response.ok) return reply({ error: `Adapter ERP nao respondeu corretamente (HTTP ${response.status})` }, 502);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) return reply({ error: "O inventario ERP retornou um formato inesperado" }, 502);
      // Nao deduplicar: cada linha de inventario e preservada, inclusive MAC/patrimonio.
      return reply({ tecnico: tecnicoERP, linhas: data, totalLinhas: data.length, somenteLeitura: true, escopo: "inventario_do_tecnico" });
    } finally { clearTimeout(timeout); }
  } catch (e) {
    return reply({ error: e instanceof Error && e.name === "AbortError" ? "Tempo limite ao consultar o ERP" : "Falha de comunicacao com o adapter ERP" }, 502);
  }
}

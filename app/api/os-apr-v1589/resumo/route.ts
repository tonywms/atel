import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bancoChecklistV158 } from "@/lib/atelOsChecklistServerV158";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Escopo = "tecnico" | "gestao";
type AprResumida = {
  atendimento_erp: number;
  resultado: "APTO" | "NAO_APTO";
  registrado_em: string;
};

const responder = (body: object, status = 200) => NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store, max-age=0" },
});

/** ATEL_E1_V158_9: consulta em lote de APRs registradas, sempre filtrada por autorizacao. */
export async function GET(req: NextRequest) {
  const escopo = req.nextUrl.searchParams.get("escopo") as Escopo | null;
  if (escopo !== "tecnico" && escopo !== "gestao") {
    return responder({ error: "Escopo inválido." }, 400);
  }
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return responder({ error: "Sessão obrigatória." }, 401);
  try {
    const auth = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: usuario, error: erroAuth } = await auth.auth.getUser(token);
    if (erroAuth || !usuario.user) return responder({ error: "Sessão inválida." }, 401);
    const db = bancoChecklistV158();
    const { data: associacoes, error: erroAssociacoes } = await db
      .from("usuarios_organizacao")
      .select("organizacao_id,perfil")
      .eq("usuario_id", usuario.user.id)
      .eq("ativo", true)
      .limit(10);
    if (erroAssociacoes || !associacoes || associacoes.length !== 1) {
      return responder({ error: "Organização de acesso indisponível ou ambígua." }, 403);
    }
    const vinculo = associacoes[0];
    if (escopo === "gestao" && vinculo.perfil !== "admin") {
      return responder({ error: "Consulta restrita à gestão." }, 403);
    }
    // ATEL_E1_V159_0_APR_BLOQUEIO_VISUAL: na homologacao, admin pode consultar a propria APR no coletor.
    if (escopo === "tecnico" && !["tecnico", "admin"].includes(vinculo.perfil)) {
      return responder({ error: "Consulta restrita ao técnico." }, 403);
    }
    let consulta = db.from("atel_os_apr_riscos_v1582")
      .select("atendimento_erp,resultado,registrado_em")
      .eq("organizacao_id", vinculo.organizacao_id)
      .eq("situacao", "REGISTRADO")
      .order("registrado_em", { ascending: false })
      .limit(1000);
    if (escopo === "tecnico") {
      // O técnico visualiza exclusivamente os registros criados pela própria conta.
      consulta = consulta.eq("usuario_id", usuario.user.id);
    }
    const { data: registros, error: erroConsulta } = await consulta;
    if (erroConsulta) return responder({ error: "Não foi possível consultar as APRs." }, 503);
    const estados: Record<string, "APTO" | "NAO_APTO"> = {};
    for (const reg of (registros ?? []) as AprResumida[]) {
      const os = Number(reg.atendimento_erp);
      const chave = String(os);
      if (Number.isSafeInteger(os) && os > 0 && !(chave in estados) &&
          (reg.resultado === "APTO" || reg.resultado === "NAO_APTO")) {
        estados[chave] = reg.resultado;
      }
    }
    return responder({ estados });
  } catch {
    return responder({ error: "Situação das APRs temporariamente indisponível." }, 503);
  }
}

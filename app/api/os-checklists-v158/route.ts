import { NextRequest, NextResponse } from "next/server";
import {
  ErroChecklistV158, atendimentoValidoV158, tipoValidoV158,
  contextoChecklistV158, modeloChecklistV158, respostasValidasV158, buscarExecucaoV158,
} from "@/lib/atelOsChecklistServerV158";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const falha = (e: unknown) => e instanceof ErroChecklistV158 ? json({ error: e.message }, e.status) : json({ error: "Falha interna na avaliação da OS." }, 500);

export async function GET(req: NextRequest) {
  const atendimento = atendimentoValidoV158(req.nextUrl.searchParams.get("atendimento"));
  const tipo = req.nextUrl.searchParams.get("tipo");
  if (!atendimento || !tipoValidoV158(tipo)) return json({ error: "Parâmetros inválidos." }, 400);
  try {
    const ctx = await contextoChecklistV158(req, atendimento);
    const [modelo, execucao] = await Promise.all([
      modeloChecklistV158(ctx.db, tipo),
      buscarExecucaoV158(ctx.db, ctx, atendimento, tipo),
    ]);
    let evidencias: { id:string; nome_arquivo:string; criado_em:string; url:string|null }[] = [];
    if (execucao?.id) {
      const { data, error } = await ctx.db.from("atel_os_checklist_fotos_v158")
        .select("id,nome_arquivo,caminho_storage,criado_em")
        .eq("execucao_id",execucao.id).eq("organizacao_id",ctx.organizacaoId).eq("usuario_id",ctx.usuarioId)
        .order("criado_em", { ascending: false }).limit(8);
      if (error) throw new ErroChecklistV158("Evidências indisponíveis.", 503);
      evidencias = await Promise.all((data ?? []).map(async f => {
        const { data: assinatura } = await ctx.db.storage.from("atel-os-checklists-v158").createSignedUrl(f.caminho_storage, 120);
        return { id:f.id, nome_arquivo:f.nome_arquivo, criado_em:f.criado_em, url:assinatura?.signedUrl ?? null };
      }));
    }
    return json({ atendimento, tipo, modelo, execucao, evidencias, demonstracao: modelo.estado === "HOMOLOGACAO" });
  } catch (e) { return falha(e); }
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try { const b: unknown = await req.json(); if (!b || typeof b !== "object" || Array.isArray(b)) return json({ error: "Dados inválidos." }, 400); body = b as Record<string, unknown>; }
  catch { return json({ error: "JSON inválido." }, 400); }
  const atendimento = atendimentoValidoV158(body.atendimento);
  const tipo = body.tipo;
  if (!atendimento || !tipoValidoV158(tipo)) return json({ error: "OS ou formulário inválido." }, 400);
  if (typeof body.observacao !== "string" || body.observacao.length > 2000) return json({ error: "Observação limitada a 2.000 caracteres." }, 400);
  try {
    const ctx = await contextoChecklistV158(req, atendimento);
    const modelo = await modeloChecklistV158(ctx.db, tipo);
    if (Number(body.modeloVersao) !== modelo.versao) throw new ErroChecklistV158("Modelo atualizado. Reabra o formulário antes de salvar.", 409);
    const respostas = respostasValidasV158(body.respostas, modelo.perguntas);
    const { data: andamento, error: erroAndamento } = await ctx.db.from("atel_os_andamento")
      .select("etapa").eq("usuario_id",ctx.usuarioId).eq("tecnico_erp",ctx.tecnico)
      .eq("atendimento_erp",atendimento).maybeSingle();
    if (erroAndamento) throw new ErroChecklistV158("Etapa da OS indisponível.", 503);
    const etapa = andamento?.etapa ?? "PENDENTE";
    const podeRegistrar = tipo === "APR" ? ["NO_CLIENTE", "ATENDIMENTO"].includes(etapa) : etapa === "ATENDIMENTO";
    if (!podeRegistrar) throw new ErroChecklistV158("Esta avaliação não pode ser salva na etapa atual da OS.", 409);
    const atual = await buscarExecucaoV158(ctx.db, ctx, atendimento, tipo);
    if (atual?.situacao && atual.situacao !== "RASCUNHO") throw new ErroChecklistV158("Registro já submetido; edição bloqueada.", 409);
    const payload = {
      organizacao_id: ctx.organizacaoId, usuario_id: ctx.usuarioId, tecnico_erp: ctx.tecnico,
      atendimento_erp: atendimento, tipo, modelo_versao: modelo.versao, respostas,
      observacao: body.observacao, situacao: "RASCUNHO", atualizada_em: new Date().toISOString(),
    };
    const { data, error } = await ctx.db.from("atel_os_checklist_execucoes_v158")
      .upsert(payload, {onConflict:"organizacao_id,usuario_id,tecnico_erp,atendimento_erp,tipo"})
      .select("id,modelo_versao,situacao,atualizada_em,respostas,observacao").single();
    if (error || !data) throw new ErroChecklistV158("Não foi possível salvar o rascunho.", 503);
    return json({ ok:true, execucao:data, modeloEstado:modelo.estado, liberaAtendimento:false, finalizaOS:false });
  } catch (e) { return falha(e); }
}

import { NextRequest, NextResponse } from "next/server";
import { atendimentoValidoV158, contextoChecklistV158, ErroChecklistV158 } from "@/lib/atelOsChecklistServerV158";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const resposta = (dados: object, status = 200) => NextResponse.json(dados, { status, headers: { "Cache-Control": "private, no-store" } });
const falha = (e: unknown) => resposta({ error: e instanceof ErroChecklistV158 ? e.message : "Não foi possível validar a OS. Nenhuma baixa foi realizada." }, e instanceof ErroChecklistV158 ? e.status : 503);

type Item = { cod_produto: number; produto: string; quantidade: number; patrimonio?: number | null; mac?: string | null };
const normal = (valor: unknown) => String(valor ?? "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");

async function obterEstado(req: NextRequest, id: number) {
  const ctx = await contextoChecklistV158(req, id); // token autenticado, OS atribuída ao técnico, vínculo com organização
  const db = ctx.db;
  const { data: concluida, error: erroConcluida } = await db.from("atel_os_finalizacoes_v160")
    .select("id,total_unidades,finalizada_em").eq("organizacao_id", ctx.organizacaoId)
    .eq("tecnico_erp", ctx.tecnico).eq("atendimento_erp", id).maybeSingle();
  if (erroConcluida) throw new ErroChecklistV158("Registro de finalização indisponível.", 503);
  if (concluida) return { ok: true, estado: "FINALIZADA", motivos: [], itens: [], total_unidades: Number(concluida.total_unidades), finalizacao_id: concluida.id, finalizada_em: concluida.finalizada_em, versao: 0 };

  const [a, m, apr, foto, vinculo] = await Promise.all([
    db.from("atel_os_andamento").select("etapa,versao").eq("usuario_id", ctx.usuarioId).eq("tecnico_erp", ctx.tecnico).eq("atendimento_erp", id).maybeSingle(),
    db.from("atel_os_apontamentos").select("itens,versao").eq("usuario_id", ctx.usuarioId).eq("tecnico_erp", ctx.tecnico).eq("atendimento_erp", id).maybeSingle(),
    db.from("atel_os_apr_riscos_v1582").select("resultado,situacao,ciencia").eq("organizacao_id",ctx.organizacaoId).eq("usuario_id",ctx.usuarioId).eq("tecnico_erp",ctx.tecnico).eq("atendimento_erp",id).maybeSingle(),
    db.from("atel_os_checklist_execucoes_v158").select("id,situacao,respostas").eq("organizacao_id",ctx.organizacaoId).eq("usuario_id",ctx.usuarioId).eq("tecnico_erp",ctx.tecnico).eq("atendimento_erp",id).eq("tipo","ENCERRAMENTO").maybeSingle(),
    db.from("atel_os_tecnico_local_v160").select("local_id").eq("organizacao_id",ctx.organizacaoId).eq("tecnico_erp",ctx.tecnico).maybeSingle(),
  ]);
  if ([a,m,apr,foto,vinculo].some(r => r.error)) throw new ErroChecklistV158("Falha ao consultar estoque ou documentos da OS.", 503);
  const motivos: string[] = [];
  if (a.data?.etapa !== "ATENDIMENTO") motivos.push("A OS ainda não está na etapa Atendimento.");
  if (!apr.data || apr.data.situacao !== "REGISTRADO" || apr.data.resultado !== "APTO" || !apr.data.ciencia) motivos.push("A APR deve estar registrada como Apta.");
  // ATEL_E1_V160_1_AUTO_RELATORIO_API: rascunho com foto sincronizada fica pronto para finalizar numa unica transacao.
  const fotoValida=Boolean(foto.data && ["RASCUNHO","SUBMETIDO"].includes(foto.data.situacao) && (foto.data.respostas as Record<string,unknown>|null)?.v1595);
  if (!fotoValida) motivos.push("Adicione ao menos uma fotografia ao Relatório Fotográfico Final.");
  if (fotoValida && foto.data) {
    const { count, error } = await db.from("atel_os_checklist_fotos_v158").select("id", { count: "exact", head: true })
      .eq("execucao_id",foto.data.id).eq("organizacao_id",ctx.organizacaoId);
    if (error || !count) motivos.push("O Relatório Fotográfico Final precisa de pelo menos uma foto sincronizada.");
  }
  const local = vinculo.data?.local_id;
  if (!local) motivos.push("Estoque do técnico não cadastrado para esta operação.");
  const itens: Item[] = Array.isArray(m.data?.itens) ? (m.data.itens as Item[]) : [];
  if (!itens.length) motivos.push("Inclua e salve os materiais utilizados na OS.");
  const sku = [...new Set(itens.map(x=>String(x.cod_produto)))];
  const { data: materiais, error: erroMateriais } = sku.length ? await db.from("materiais").select("id,sku,descricao,rastreio,ativo")
    .eq("organizacao_id",ctx.organizacaoId).in("sku",sku) : { data: [], error: null };
  if (erroMateriais) throw new ErroChecklistV158("Materiais cadastrados indisponíveis.", 503);
  const registros: { codigo: string; descricao: string; quantidade: number; saldo: number | null; estado: string }[] = [];
  const porSku = new Map<string, { descricao: string; quantidade: number; identificadores: Item[] }>();
  for (const item of itens) {
    const k=String(item.cod_produto), qtd=Number(item.quantidade);
    if (!Number.isSafeInteger(item.cod_produto) || !Number.isSafeInteger(qtd) || qtd<=0) { motivos.push("Há quantidade inválida nos materiais."); continue; }
    const antes=porSku.get(k); if (antes && normal(antes.descricao)!==normal(item.produto)) {motivos.push(`Produto ${k} com descrições diferentes.`);continue;}
    porSku.set(k,{descricao:String(item.produto||""),quantidade:(antes?.quantidade??0)+qtd,identificadores:[...(antes?.identificadores??[]),item]});
  }
  for (const [codigo,p] of porSku) {
    const material=(materiais??[]).find(m=>m.sku===codigo && m.ativo);
    if (!material || normal(material.descricao)!==normal(p.descricao)) {
      registros.push({codigo,descricao:p.descricao,quantidade:p.quantidade,saldo:null,estado:"SEM_VINCULO"});
      motivos.push(`${p.descricao}: cadastro do material não corresponde ao código da OS.`);
      continue;
    }
    let saldo=0;
    if (local) {
      const {data,error}=await db.from("saldos_estoque").select("quantidade").eq("organizacao_id",ctx.organizacaoId).eq("local_id",local).eq("material_id",material.id).maybeSingle();
      if (error) throw new ErroChecklistV158("Saldo do técnico indisponível.",503);
      saldo=Number(data?.quantidade??0);
    }
    let estado="DISPONIVEL";
    if(saldo<p.quantidade) {estado="SEM_SALDO";motivos.push(`${p.descricao}: técnico tem ${saldo} e a OS utiliza ${p.quantidade}.`);}
    if (["serial","mac"].includes(material.rastreio)) {
      for (const unidade of p.identificadores) {
        const referencia=String(unidade.patrimonio??"").trim(),mac=String(unidade.mac??"").trim();
        if (Number(unidade.quantidade)!==1 || (!referencia&&!mac)) {estado="SEM_IDENTIFICACAO";motivos.push(`${p.descricao}: informe número de série/patrimônio válido.`);continue;}
        if (!local) continue;
        const consulta=db.from("ativos_rastreados").select("id").eq("organizacao_id",ctx.organizacaoId).eq("local_id",local).eq("material_id",material.id).eq("estado","disponivel");
        const {data,error}=await (referencia?consulta.eq("serial",referencia):consulta.eq("mac",mac)).limit(1);
        if(error)throw new ErroChecklistV158("Falha ao validar equipamento rastreado.",503);
        if(!data?.length) {estado="SERIE_NAO_LOCALIZADA";motivos.push(`${p.descricao}: equipamento ${referencia||mac} não consta como disponível no estoque do técnico.`);}
      }
    }
    registros.push({codigo,descricao:p.descricao,quantidade:p.quantidade,saldo,estado});
  }
  // O Relatório Fotográfico Final será concluído junto com a OS.
  return { ok:true, estado:motivos.length?"PENDENTE":"PRONTO", motivos:[...new Set(motivos)], itens:registros,
    total_unidades:itens.reduce((n,i)=>n+Number(i.quantidade||0),0), versao:Number(m.data?.versao??0) };
}
export async function GET(req:NextRequest) {
  const id=atendimentoValidoV158(req.nextUrl.searchParams.get("atendimento"));
  if (!id) return resposta({error:"OS inválida."},400);
  try {return resposta(await obterEstado(req,id));} catch(e){return falha(e);}
}
export async function POST(req: NextRequest) {
  let b:Record<string,unknown>;
  try { const raw:unknown=await req.json(); if(!raw||typeof raw!=="object"||Array.isArray(raw))return resposta({error:"Dados inválidos."},400);b=raw as Record<string,unknown>; }
  catch { return resposta({error:"JSON inválido."},400); }
  const id=atendimentoValidoV158(b.atendimento),versao=Number(b.versao);
  if(!id||!Number.isSafeInteger(versao)||versao<0)return resposta({error:"OS ou versão de materiais inválida."},400);
  try {
    const ctx=await contextoChecklistV158(req,id);
    // RPC: estoque, APR, fotos, serial, baixa e finalização em UMA transação PostgreSQL.
    const {data,error}=await ctx.db.rpc("atel_finalizar_os_erp_v160",{
      p_organizacao:ctx.organizacaoId,p_usuario:ctx.usuarioId,p_tecnico:ctx.tecnico,p_atendimento:id,p_versao_apontamento:versao
    });
    if(error) {
      const codigo=error.message.match(/(?:SALDO_INSUFICIENTE|SERIAL_NAO_LOCALIZADO_NO_ESTOQUE_TECNICO|MATERIAL_SEM_VINCULO|MATERIAL_DIVERGENTE|RASCUNHO_MATERIAIS_ALTERADO|RELATORIO_FOTOGRAFICO_PENDENTE|APR_APTA_NAO_REGISTRADA|ETAPA_NAO_PERMITE_FINALIZAR)[A-Z0-9_]*/)?.[0];
      const msg=codigo?.startsWith("SALDO_INSUFICIENTE")?"O estoque do técnico não tem saldo suficiente para um dos materiais. Consulte o saldo e reponha antes de finalizar.":
        codigo?.startsWith("SERIAL_NAO_LOCALIZADO")?"Equipamento não encontrado no estoque do técnico com o número de série informado.":
        codigo?.startsWith("RASCUNHO_MATERIAIS_ALTERADO")?"Os materiais mudaram em outra sessão. Atualize a OS antes de finalizar.":
        codigo?.startsWith("RELATORIO_FOTOGRAFICO_PENDENTE")?"Conclua o Relatório Fotográfico Final.":
        codigo?.startsWith("MATERIAL_")?"Um material da OS não corresponde ao cadastro do estoque.":
        codigo?.startsWith("APR_")?"A APR apta ainda não está registrada.":
        codigo?.startsWith("ETAPA_")?"A OS não está na etapa Atendimento.":"A finalização não foi confirmada. Nenhuma baixa parcial foi realizada.";
      return resposta({error:msg,diagnostico:codigo??null},409);
    }
    return resposta(data as object);
  } catch(e) {return falha(e);}
}

import { NextRequest, NextResponse } from "next/server";
import { atendimentoValidoV158, contextoChecklistV158, buscarExecucaoV158, modeloChecklistV158, ErroChecklistV158 } from "@/lib/atelOsChecklistServerV158";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const TIPO="ENCERRAMENTO" as const;
const BUCKET="atel-os-checklists-v158";
const json=(data:object,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
const fail=(e:unknown)=>json({error:e instanceof ErroChecklistV158?e.message:"Falha ao registrar relatório fotográfico."},e instanceof ErroChecklistV158?e.status:503);
type DetalhesFoto={descricao:string;numeroSerie:string};
type Relatorio={detalhesFotos:Record<string,DetalhesFoto>;observacao:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validar(input:unknown):Relatorio{
 if(!input||typeof input!=="object"||Array.isArray(input))throw new ErroChecklistV158("Relatório inválido.");
 const b=input as Record<string,unknown>;
 const obs=String(b.observacao??"");if(typeof b.observacao!=="string"||obs.length>3000)throw new ErroChecklistV158("Observação limitada a 3.000 caracteres.");
 const details=b.detalhesFotos??{};
 if(!details||typeof details!=="object"||Array.isArray(details)||Object.keys(details).length>8)throw new ErroChecklistV158("Identificação de fotos inválida.");
 const saida:Record<string,DetalhesFoto>={};
 for(const [id,value] of Object.entries(details)){
  if(!uuid.test(id)||!value||typeof value!=="object"||Array.isArray(value))throw new ErroChecklistV158("Foto inválida.");
  const v=value as Record<string,unknown>;
  if(typeof v.descricao!=="string"||typeof v.numeroSerie!=="string"||v.descricao.length>350||v.numeroSerie.length>120)throw new ErroChecklistV158("Descrição ou número de série inválido.");
  saida[id]={descricao:v.descricao.trim(),numeroSerie:v.numeroSerie.trim()};
 }
 return {observacao:obs.trim(),detalhesFotos:saida};
}
async function obterFotos(ctx:Awaited<ReturnType<typeof contextoChecklistV158>>,execucaoId:string){
 const {data,error}=await ctx.db.from("atel_os_checklist_fotos_v158").select("id,nome_arquivo,criado_em,caminho_storage")
  .eq("execucao_id",execucaoId).eq("organizacao_id",ctx.organizacaoId).eq("usuario_id",ctx.usuarioId).order("criado_em",{ascending:true}).limit(8);
 if(error)throw new ErroChecklistV158("Fotos indisponíveis.",503);
 return Promise.all((data??[]).map(async f=>{
  const {data:link}=await ctx.db.storage.from(BUCKET).createSignedUrl(String(f.caminho_storage),120);
  return {id:String(f.id),nome_arquivo:String(f.nome_arquivo),criado_em:String(f.criado_em),url:link?.signedUrl??null};
 }));
}
export async function GET(req:NextRequest){
 const id=atendimentoValidoV158(req.nextUrl.searchParams.get("atendimento"));
 if(!id)return json({error:"OS inválida."},400);
 try{
  const ctx=await contextoChecklistV158(req,id);
  const registro=await buscarExecucaoV158(ctx.db,ctx,id,TIPO);
  const fotos=registro?await obterFotos(ctx,registro.id):[];
  const payload=(registro?.respostas as Record<string,unknown>|null)?.v1595;
  return json({registro:registro?{id:registro.id,situacao:registro.situacao,atualizada_em:registro.atualizada_em}:null,
   relatorio:payload&&typeof payload==="object"?payload:{observacao:"",detalhesFotos:{}},fotos});
 }catch(e){return fail(e);}
}
export async function PUT(req:NextRequest){
 let b:Record<string,unknown>;
 try{const raw:unknown=await req.json();if(!raw||typeof raw!=="object"||Array.isArray(raw))return json({error:"Dados inválidos."},400);b=raw as Record<string,unknown>;}catch{return json({error:"JSON inválido."},400);}
 const id=atendimentoValidoV158(b.atendimento);if(!id)return json({error:"OS inválida."},400);
 try{
  const dados=validar(b.relatorio);
  const ctx=await contextoChecklistV158(req,id);
  const {data:andamento,error:andamentoErro}=await ctx.db.from("atel_os_andamento").select("etapa")
   .eq("usuario_id",ctx.usuarioId).eq("tecnico_erp",ctx.tecnico).eq("atendimento_erp",id).maybeSingle();
  if(andamentoErro)throw new ErroChecklistV158("Não foi possível validar a etapa da OS.",503);
  if(andamento?.etapa!=="ATENDIMENTO")throw new ErroChecklistV158("O relatório fotográfico só pode ser preenchido durante o atendimento.",409);
  const anterior=await buscarExecucaoV158(ctx.db,ctx,id,TIPO);
  if(anterior?.situacao==="SUBMETIDO")throw new ErroChecklistV158("Relatório final já concluído; edição bloqueada.",409);
  const modelo=await modeloChecklistV158(ctx.db,TIPO);
  if(anterior){
   // Não sobrescrever uma finalização feita por outra sessão enquanto esta requisição estava em trânsito.
   const {data,error}=await ctx.db.from("atel_os_checklist_execucoes_v158").update({respostas:{v1595:dados},observacao:dados.observacao,atualizada_em:new Date().toISOString()})
    .eq("id",anterior.id).eq("usuario_id",ctx.usuarioId).eq("situacao","RASCUNHO").select("id,situacao,atualizada_em").maybeSingle();
   if(error||!data)throw new ErroChecklistV158("Relatório alterado ou já concluído. Atualize a página.",409);
   return json({ok:true,registro:data});
  }
  const {data,error}=await ctx.db.from("atel_os_checklist_execucoes_v158").insert({
   organizacao_id:ctx.organizacaoId,usuario_id:ctx.usuarioId,tecnico_erp:ctx.tecnico,atendimento_erp:id,tipo:TIPO,
   modelo_versao:modelo.versao,respostas:{v1595:dados},observacao:dados.observacao,situacao:"RASCUNHO",atualizada_em:new Date().toISOString(),
  }).select("id,situacao,atualizada_em").single();
  if(error||!data)throw new ErroChecklistV158("Falha ao iniciar relatório. Atualize e tente novamente.",409);
  return json({ok:true,registro:data});
 }catch(e){return fail(e);}
}
export async function POST(req:NextRequest){
 let b:Record<string,unknown>;
 try{const raw:unknown=await req.json();if(!raw||typeof raw!=="object"||Array.isArray(raw))return json({error:"Dados inválidos."},400);b=raw as Record<string,unknown>;}catch{return json({error:"JSON inválido."},400);}
 const id=atendimentoValidoV158(b.atendimento);if(!id)return json({error:"OS inválida."},400);
 try{
  const ctx=await contextoChecklistV158(req,id);
  const registro=await buscarExecucaoV158(ctx.db,ctx,id,TIPO);
  if(!registro)throw new ErroChecklistV158("Adicione uma foto antes de concluir o relatório.",409);
  if(registro.situacao==="SUBMETIDO")return json({ok:true,concluido:true});
  const {data:andamento,error:erroAndamento}=await ctx.db.from("atel_os_andamento").select("etapa")
   .eq("usuario_id",ctx.usuarioId).eq("tecnico_erp",ctx.tecnico).eq("atendimento_erp",id).maybeSingle();
  if(erroAndamento||andamento?.etapa!=="ATENDIMENTO")throw new ErroChecklistV158("O relatório só pode ser concluído em Atendimento.",409);
  const {data:fotos,error:erroFotos}=await ctx.db.from("atel_os_checklist_fotos_v158").select("id")
   .eq("execucao_id",registro.id).eq("organizacao_id",ctx.organizacaoId).eq("usuario_id",ctx.usuarioId).limit(8);
  if(erroFotos)throw new ErroChecklistV158("Não foi possível validar as fotos.",503);
  if(!fotos?.length)throw new ErroChecklistV158("Anexe pelo menos uma foto do serviço para concluir o relatório.",409);
  const raw=(registro.respostas as Record<string,unknown>)?.v1595;
  const dados=validar(raw);
  const ids=new Set(fotos.map(f=>f.id));
  if(Object.keys(dados.detalhesFotos).some(x=>!ids.has(x)))throw new ErroChecklistV158("Há informações de fotos que não pertencem a esta OS. Atualize as evidências.",409);
  const {data,error}=await ctx.db.from("atel_os_checklist_execucoes_v158").update({situacao:"SUBMETIDO",atualizada_em:new Date().toISOString()})
   .eq("id",registro.id).eq("usuario_id",ctx.usuarioId).eq("situacao","RASCUNHO").select("id,situacao").maybeSingle();
  if(error||!data)throw new ErroChecklistV158("Relatório concluído em outra sessão. Atualize.",409);
  return json({ok:true,concluido:true,registro:data});
 }catch(e){return fail(e);}
}

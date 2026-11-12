import { NextRequest,NextResponse } from "next/server";
import { contextoAPR, modeloAPR, andamentoAPR, buscarAPR, fotosAPR, validarAPR, erroAPR } from "@/lib/atelOsAprServerV1582";
import { ErroChecklistV158 } from "@/lib/atelOsChecklistServerV158";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(obj:object,status=200)=>NextResponse.json(obj,{status,headers:{"Cache-Control":"no-store"}});
function idOS(input:unknown){const n=Number(input);return Number.isSafeInteger(n)&&n>0?n:null;}
export async function GET(req:NextRequest){
 const id=idOS(req.nextUrl.searchParams.get("atendimento"));if(!id)return reply({error:"OS inválida."},400);
 try{
  const ctx=await contextoAPR(req,id);
  const [modelo,andamento,apr]=await Promise.all([modeloAPR(ctx.db),andamentoAPR(ctx.db,ctx,id),buscarAPR(ctx.db,ctx,id)]);
  const fotos=apr?await fotosAPR(ctx.db,ctx,String(apr.id)):[];
  return reply({modelo,andamento,apr,fotos});
 }catch(e){const v=erroAPR(e);return reply({error:v.mensagem},v.codigo);}
}
export async function PUT(req:NextRequest){
 let b:Record<string,unknown>;try{const j:unknown=await req.json();if(!j||typeof j!=="object"||Array.isArray(j))return reply({error:"Dados inválidos."},400);b=j as Record<string,unknown>;}catch{return reply({error:"JSON inválido."},400);}
 const id=idOS(b.atendimento),versao=Number(b.versao);
 if(!id||!Number.isSafeInteger(versao)||versao<0)return reply({error:"OS ou versão inválida."},400);
 try{
  const ctx=await contextoAPR(req,id);
  const [modelo,andamento,atual]=await Promise.all([modeloAPR(ctx.db),andamentoAPR(ctx.db,ctx,id),buscarAPR(ctx.db,ctx,id)]);
  if(andamento.etapa!=="NO_CLIENTE")throw new ErroChecklistV158("A APR só pode ser alterada após a chegada e antes do início do atendimento.",409);
  if(Number(b.modeloVersao)!==modelo.versao)throw new ErroChecklistV158("Versão do formulário alterada. Atualize a APR.",409);
  const dados=validarAPR(b,modelo);
  if(atual&&Number(atual.versao)!==versao)throw new ErroChecklistV158("APR modificada em outra sessão. Atualize e revise antes de salvar.",409);
  if(!atual&&versao!==0)throw new ErroChecklistV158("Rascunho não encontrado para essa versão.",409);
  const timestamp=new Date().toISOString();
  let registro:Record<string,unknown>|null=null;
  if(!atual){
   const {data,error}=await ctx.db.from("atel_os_apr_riscos_v1582").insert({
     organizacao_id:ctx.organizacaoId,usuario_id:ctx.usuarioId,tecnico_erp:ctx.tecnico,atendimento_erp:id,
     modelo_versao:modelo.versao,...dados,versao:1,atualizado_em:timestamp,
     registrado_em:dados.situacao==="REGISTRADO"?timestamp:null,
   }).select("*").single();
   if(error)throw new ErroChecklistV158("Não foi possível criar o rascunho da APR. Atualize e tente novamente.",409);
   registro=data;
  }else{
   const {data,error}=await ctx.db.from("atel_os_apr_riscos_v1582").update({
     modelo_versao:modelo.versao,...dados,versao:versao+1,atualizado_em:timestamp,
     registrado_em:dados.situacao==="REGISTRADO"?timestamp:null,
   }).eq("id",atual.id).eq("versao",versao)
   .eq("organizacao_id",ctx.organizacaoId).eq("usuario_id",ctx.usuarioId).select("*").maybeSingle();
   if(error||!data)throw new ErroChecklistV158("APR foi alterada em outra sessão. Atualize antes de salvar.",409);
   registro=data;
  }
  return reply({apr:registro,andamento});
 }catch(e){const v=erroAPR(e);return reply({error:v.mensagem},v.codigo);}
}

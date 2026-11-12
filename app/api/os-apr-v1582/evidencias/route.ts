import { NextRequest,NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { contextoAPR, andamentoAPR, buscarAPR, erroAPR } from "@/lib/atelOsAprServerV1582";
import { ErroChecklistV158 } from "@/lib/atelOsChecklistServerV158";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(obj:object,status=200)=>NextResponse.json(obj,{status,headers:{"Cache-Control":"no-store"}});
function validoId(v:FormDataEntryValue|null){const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null;}
function mimeReal(bytes:Uint8Array){
 if(bytes.length>4&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return "image/jpeg";
 if(bytes.length>8&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))return "image/png";
 if(bytes.length>12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")return "image/webp";
 return null;
}
export async function POST(req:NextRequest){
 let form:FormData;try{form=await req.formData();}catch{return reply({error:"Envio de foto inválido."},400);}
 const id=validoId(form.get("atendimento")),arquivo=form.get("arquivo");
 if(!id||!(arquivo instanceof File))return reply({error:"OS ou foto inválida."},400);
 if(arquivo.size<100||arquivo.size>5242880)return reply({error:"Foto deve ter até 5 MB."},413);
 try{
  const ctx=await contextoAPR(req,id);
  const [andamento,apr]=await Promise.all([andamentoAPR(ctx.db,ctx,id),buscarAPR(ctx.db,ctx,id)]);
  if(andamento.etapa!=="NO_CLIENTE")throw new ErroChecklistV158("Fotos só podem ser anexadas antes do atendimento.",409);
  if(!apr||apr.situacao!=="RASCUNHO")throw new ErroChecklistV158("Salve o rascunho da APR antes de anexar uma foto.",409);
  const bytes=Buffer.from(await arquivo.arrayBuffer());const mime=mimeReal(bytes);
  if(!mime||arquivo.type!==mime)throw new ErroChecklistV158("Formato de foto inválido. Use JPEG, PNG ou WebP.");
  const sha=createHash("sha256").update(bytes).digest("hex");
  const {data:jaExiste}=await ctx.db.from("atel_os_apr_fotos_v1582").select("id,nome_arquivo,criado_em,caminho_storage")
    .eq("apr_id",apr.id).eq("sha256",sha).maybeSingle();
  if(jaExiste){const {data:url}=await ctx.db.storage.from("atel-os-checklists-v158").createSignedUrl(jaExiste.caminho_storage,120);
    return reply({duplicada:true,evidencia:{id:jaExiste.id,nome_arquivo:jaExiste.nome_arquivo,criado_em:jaExiste.criado_em,url:url?.signedUrl||null}});}
  const {count,error:erroCount}=await ctx.db.from("atel_os_apr_fotos_v1582").select("id",{count:"exact",head:true}).eq("apr_id",apr.id);
  if(erroCount)throw new ErroChecklistV158("Não foi possível conferir o limite de fotos.",503);
  if((count||0)>=8)throw new ErroChecklistV158("Limite de 8 fotos por APR.");
  const ext=mime==="image/jpeg"?"jpg":mime==="image/png"?"png":"webp";
  const caminho=`${ctx.organizacaoId}/${ctx.usuarioId}/os-${id}/apr-v1582/${sha}.${ext}`;
  const bucket=ctx.db.storage.from("atel-os-checklists-v158");
  const {error:erroUpload}=await bucket.upload(caminho,bytes,{contentType:mime,cacheControl:"3600",upsert:false});
  if(erroUpload&&!String(erroUpload.message).toLowerCase().includes("already exists"))throw new ErroChecklistV158("Não foi possível enviar a foto ao armazenamento privado.",503);
  const nome=arquivo.name.replace(/[\\/<>"']/g,"_").slice(0,120)||`foto.${ext}`;
  const {data,error}=await ctx.db.from("atel_os_apr_fotos_v1582").insert({
    apr_id:apr.id,organizacao_id:ctx.organizacaoId,usuario_id:ctx.usuarioId,nome_arquivo:nome,
    caminho_storage:caminho,mime_type:mime,tamanho_bytes:bytes.length,sha256:sha
  }).select("id,nome_arquivo,criado_em,caminho_storage").single();
  if(error||!data)throw new ErroChecklistV158("Foto enviada, mas registro pendente. Tente sincronizar novamente.",503);
  const {data:url}=await bucket.createSignedUrl(caminho,120);
  return reply({duplicada:false,evidencia:{id:data.id,nome_arquivo:data.nome_arquivo,criado_em:data.criado_em,url:url?.signedUrl||null}});
 }catch(e){const v=erroAPR(e);return reply({error:v.mensagem},v.codigo);}
}

export async function DELETE(req:NextRequest){
 const id=Number(req.nextUrl.searchParams.get("atendimento")),fotoId=req.nextUrl.searchParams.get("id");
 if(!Number.isSafeInteger(id)||id<=0||!fotoId||!/^[0-9a-f-]{36}$/i.test(fotoId))return reply({error:"Identificação inválida."},400);
 try{
  const ctx=await contextoAPR(req,id);
  const [andamento,apr]=await Promise.all([andamentoAPR(ctx.db,ctx,id),buscarAPR(ctx.db,ctx,id)]);
  if(andamento.etapa!=="NO_CLIENTE"||!apr||apr.situacao!=="RASCUNHO")throw new ErroChecklistV158("Apenas fotos de rascunhos podem ser removidas.",409);
  const {data:foto,error:consultaErro}=await ctx.db.from("atel_os_apr_fotos_v1582")
   .select("caminho_storage").eq("id",fotoId).eq("apr_id",apr.id)
   .eq("usuario_id",ctx.usuarioId).eq("organizacao_id",ctx.organizacaoId).maybeSingle();
  if(consultaErro||!foto)throw new ErroChecklistV158("Foto não localizada nesta APR.",404);
  const {error:erroArmazenamento}=await ctx.db.storage.from("atel-os-checklists-v158").remove([foto.caminho_storage]);
  if(erroArmazenamento)throw new ErroChecklistV158("Não foi possível remover o arquivo privado.",503);
  const {error:erroDb}=await ctx.db.from("atel_os_apr_fotos_v1582").delete()
   .eq("id",fotoId).eq("apr_id",apr.id).eq("usuario_id",ctx.usuarioId);
  if(erroDb)throw new ErroChecklistV158("Arquivo removido, mas houve falha na atualização das evidências. Contate o suporte.",503);
  return reply({ok:true});
 }catch(e){const v=erroAPR(e);return reply({error:v.mensagem},v.codigo);}
}

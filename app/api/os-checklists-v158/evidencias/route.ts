import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import {
  ErroChecklistV158, atendimentoValidoV158, tipoValidoV158,
  contextoChecklistV158, buscarExecucaoV158,
} from "@/lib/atelOsChecklistServerV158";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BUCKET = "atel-os-checklists-v158";
const resposta = (body: object, status = 200) => NextResponse.json(body, {status,headers:{"Cache-Control":"no-store"}});
const falha = (e:unknown) => e instanceof ErroChecklistV158 ? resposta({error:e.message}, e.status) : resposta({error:"Falha interna ao processar a evidência."},500);
const identificar = (buf:Buffer): {mime:string;ext:string}|null => {
  if(buf.length>=3 && buf[0]===0xff && buf[1]===0xd8 && buf[2]===0xff) return {mime:"image/jpeg",ext:"jpg"};
  if(buf.length>=8 && buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return {mime:"image/png",ext:"png"};
  if(buf.length>=12 && buf.toString("ascii",0,4)==="RIFF" && buf.toString("ascii",8,12)==="WEBP") return {mime:"image/webp",ext:"webp"};
  return null;
};

export async function POST(req:NextRequest) {
  try {
    const dados = await req.formData();
    const atendimento = atendimentoValidoV158(dados.get("atendimento"));
    const tipo = dados.get("tipo");
    const arquivo = dados.get("arquivo");
    if (!atendimento || !tipoValidoV158(tipo) || !(arquivo instanceof File)) throw new ErroChecklistV158("Arquivo, OS ou tipo inválido.");
    if (arquivo.size===0 || arquivo.size>5242880) throw new ErroChecklistV158("A foto precisa ter no máximo 5 MB.",413);
    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const imagem = identificar(buffer);
    if (!imagem || arquivo.type !== imagem.mime) throw new ErroChecklistV158("Use uma foto JPG, PNG ou WebP válida.");
    const ctx = await contextoChecklistV158(req,atendimento);
    const execucao = await buscarExecucaoV158(ctx.db,ctx,atendimento,tipo);
    if (!execucao || execucao.situacao!=="RASCUNHO") throw new ErroChecklistV158("Salve o rascunho do checklist antes de enviar fotos.",409);
    const {data: fotos, error:erroFotos} = await ctx.db.from("atel_os_checklist_fotos_v158")
      .select("id,sha256,caminho_storage,nome_arquivo,criado_em")
      .eq("execucao_id",execucao.id).eq("organizacao_id",ctx.organizacaoId).eq("usuario_id",ctx.usuarioId).limit(9);
    if (erroFotos) throw new ErroChecklistV158("Não foi possível validar as evidências existentes.",503);
    const hash=createHash("sha256").update(buffer).digest("hex");
    const anterior=fotos?.find(f=>f.sha256===hash);
    if(anterior){
      const {data:assinatura}=await ctx.db.storage.from(BUCKET).createSignedUrl(anterior.caminho_storage,120);
      return resposta({ok:true,duplicada:true,evidencia:{id:anterior.id,nome_arquivo:anterior.nome_arquivo,criado_em:anterior.criado_em,url:assinatura?.signedUrl??null}});
    }
    if ((fotos?.length??0)>=8) throw new ErroChecklistV158("Limite de oito fotos por checklist.",409);
    const nome=(arquivo.name||"foto").replace(/[^A-Za-z0-9_.-]/g,"_").slice(0,100);
    const caminho=`${ctx.organizacaoId}/${ctx.usuarioId}/${atendimento}/${tipo}/${randomUUID()}.${imagem.ext}`;
    const storage=ctx.db.storage.from(BUCKET);
    const {error:erroUpload}=await storage.upload(caminho,buffer,{contentType:imagem.mime,upsert:false});
    if (erroUpload) throw new ErroChecklistV158("Não foi possível armazenar a foto.",503);
    const {data:registro,error:erroRegistro}=await ctx.db.from("atel_os_checklist_fotos_v158")
      .insert({execucao_id:execucao.id,organizacao_id:ctx.organizacaoId,usuario_id:ctx.usuarioId,nome_arquivo:nome,caminho_storage:caminho,mime_type:imagem.mime,tamanho_bytes:buffer.length,sha256:hash})
      .select("id,nome_arquivo,criado_em").single();
    if(erroRegistro||!registro){await storage.remove([caminho]);throw new ErroChecklistV158("Falha ao registrar metadados da foto.",503);}
    const {data:assinatura}=await storage.createSignedUrl(caminho,120);
    return resposta({ok:true,duplicada:false,evidencia:{...registro,url:assinatura?.signedUrl??null}});
  } catch(e) { return falha(e); }
}

export async function DELETE(req:NextRequest) {
  const atendimento=atendimentoValidoV158(req.nextUrl.searchParams.get("atendimento"));
  const tipo=req.nextUrl.searchParams.get("tipo");
  const id=req.nextUrl.searchParams.get("id");
  if(!atendimento || !tipoValidoV158(tipo) || !id || !/^[0-9a-f-]{36}$/i.test(id))return resposta({error:"Parâmetros inválidos."},400);
  try {
    const ctx=await contextoChecklistV158(req,atendimento);
    const execucao=await buscarExecucaoV158(ctx.db,ctx,atendimento,tipo);
    if(!execucao||execucao.situacao!=="RASCUNHO")throw new ErroChecklistV158("Registro não pode ser alterado.",409);
    const {data,error}=await ctx.db.from("atel_os_checklist_fotos_v158").select("caminho_storage")
      .eq("id",id).eq("execucao_id",execucao.id).eq("organizacao_id",ctx.organizacaoId).eq("usuario_id",ctx.usuarioId).maybeSingle();
    if(error||!data)throw new ErroChecklistV158("Evidência não encontrada.",404);
    // A exclusão do registro é feita após a exclusão do arquivo. Uma falha não é ocultada.
    const {error:erroStorage}=await ctx.db.storage.from(BUCKET).remove([data.caminho_storage]);
    if(erroStorage)throw new ErroChecklistV158("Não foi possível remover a foto privada.",503);
    const {error:erroDb}=await ctx.db.from("atel_os_checklist_fotos_v158").delete()
      .eq("id",id).eq("execucao_id",execucao.id).eq("usuario_id",ctx.usuarioId);
    if(erroDb)throw new ErroChecklistV158("Arquivo removido, mas falhou a atualização do registro. Contate o suporte.",503);
    return resposta({ok:true});
  } catch(e) { return falha(e); }
}

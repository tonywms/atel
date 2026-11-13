import {NextRequest} from "next/server";
import {adminAprV1584,numeroOsV1584} from "@/lib/atelOsAprAdminV1584";
import {ErroChecklistV158} from "@/lib/atelOsChecklistServerV158";
import {gerarRelatorioFotograficoPdfV1595,type EvidenciaFotoPdfV1595} from "@/lib/atelRelatorioFotograficoPdfV1595";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const falha=(msg:string,status:number)=>Response.json({error:msg},{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:NextRequest){
 const id=numeroOsV1584(req.nextUrl.searchParams.get("atendimento"));
 if(!id)return falha("OS inválida.",400);
 try{
  const ctx=await adminAprV1584(req);
  const {data,error}=await ctx.db.from("atel_os_checklist_execucoes_v158")
   .select("id,respostas,observacao,atualizada_em").eq("organizacao_id",ctx.organizacaoId)
   .eq("atendimento_erp",id).eq("tipo","ENCERRAMENTO").eq("situacao","SUBMETIDO")
   .order("atualizada_em",{ascending:false}).limit(1).maybeSingle();
  if(error)throw new ErroChecklistV158("Não foi possível consultar o relatório final.",503);
  if(!data?.respostas?.v1595)return falha("Relatório fotográfico final não concluído.",404);
  const registro=data.respostas.v1595 as {observacao?:string;detalhesFotos?:Record<string,{descricao?:string;numeroSerie?:string}>};
  const {data:fotos,error:erroFotos}=await ctx.db.from("atel_os_checklist_fotos_v158")
   .select("id,nome_arquivo,caminho_storage,mime_type").eq("execucao_id",data.id)
   .eq("organizacao_id",ctx.organizacaoId).order("criado_em",{ascending:true}).limit(8);
  if(erroFotos)throw new ErroChecklistV158("Não foi possível reunir as fotografias.",503);
  const evidencias:(EvidenciaFotoPdfV1595&{descricao:string;numeroSerie:string})[]=[];
  for(const f of fotos??[]){
   const {data:blob,error:erroBlob}=await ctx.db.storage.from("atel-os-checklists-v158").download(String(f.caminho_storage));
   const metadata=registro.detalhesFotos?.[f.id]??{};
   evidencias.push({nome:String(f.nome_arquivo),mime:String(f.mime_type),dados:!erroBlob&&blob?new Uint8Array(await blob.arrayBuffer()):null,
    descricao:String(metadata.descricao??""),numeroSerie:String(metadata.numeroSerie??"")});
  }
  const ts=new Date(data.atualizada_em);
  const pdf=gerarRelatorioFotograficoPdfV1595({os:id,registradoEm:Number.isNaN(ts.getTime())?"Sem data":ts.toLocaleString("pt-BR",{timeZone:"America/Fortaleza"}),
   observacao:String(registro.observacao??data.observacao??""),evidencias});
  return new Response(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="RELATORIO_FOTOGRAFICO_OS_${id}.pdf"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch(e){return falha(e instanceof ErroChecklistV158?e.message:"Não foi possível gerar PDF final.",e instanceof ErroChecklistV158?e.status:503);}
}

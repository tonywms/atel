import {NextRequest,NextResponse} from "next/server";
import {adminAprV1584,numeroOsV1584} from "@/lib/atelOsAprAdminV1584";
import {ErroChecklistV158} from "@/lib/atelOsChecklistServerV158";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 const id=numeroOsV1584(req.nextUrl.searchParams.get("atendimento"));
 if(!id)return NextResponse.json({error:"OS inválida."},{status:400});
 try{
  const ctx=await adminAprV1584(req);
  const {data,error}=await ctx.db.from("atel_os_checklist_execucoes_v158")
   .select("id,situacao,atualizada_em,observacao,respostas")
   .eq("organizacao_id",ctx.organizacaoId).eq("atendimento_erp",id)
   .eq("tipo","ENCERRAMENTO").eq("situacao","SUBMETIDO")
   .order("atualizada_em",{ascending:false}).limit(1).maybeSingle();
  if(error)throw new ErroChecklistV158("Relatório indisponível.",503);
  const valido=Boolean(data&&data.respostas&&typeof data.respostas==="object"&&data.respostas.v1595);
  return NextResponse.json({relatorio:valido?{id:data!.id,situacao:data!.situacao,atualizada_em:data!.atualizada_em}:null},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof ErroChecklistV158?e.message:"Falha na consulta do relatório."},{status:e instanceof ErroChecklistV158?e.status:503});}
}

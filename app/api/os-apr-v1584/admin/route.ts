import { NextRequest, NextResponse } from "next/server";
import { numeroOsV1584, aprRegistradaGestorV1584 } from "@/lib/atelOsAprAdminV1584";
import { ErroChecklistV158 } from "@/lib/atelOsChecklistServerV158";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const respond=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:NextRequest){
 const atendimento=numeroOsV1584(req.nextUrl.searchParams.get("atendimento"));
 if(!atendimento)return respond({error:"OS inválida."},400);
 try{
  const {apr}=await aprRegistradaGestorV1584(req,atendimento);
  return respond({atendimento,apr:apr?{id:apr.id,resultado:apr.resultado,situacao:apr.situacao,modelo_versao:apr.modelo_versao,registrado_em:apr.registrado_em}:null});
 }catch(e){const status=e instanceof ErroChecklistV158?e.status:503;return respond({error:e instanceof ErroChecklistV158?e.message:"APR administrativa indisponível."},status);}
}

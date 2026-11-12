import { NextRequest } from "next/server";
import { numeroOsV1584, aprRegistradaGestorV1584 } from "@/lib/atelOsAprAdminV1584";
import { ErroChecklistV158 } from "@/lib/atelOsChecklistServerV158";
import { gerarAprPdfV1584, type EvidenciaAprPdfV1584 } from "@/lib/atelAprPdfV1584";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function erro(texto:string,status=500){return Response.json({error:texto},{status,headers:{"Cache-Control":"no-store"}});}
type Opt={id:string;nome:string};
export async function GET(req:NextRequest){
 const atendimento=numeroOsV1584(req.nextUrl.searchParams.get("atendimento"));
 if(!atendimento)return erro("OS inválida.",400);
 try{
  const {db,apr}=await aprRegistradaGestorV1584(req,atendimento);
  if(!apr)return erro("Ainda não existe APR registrada para esta OS.",404);
  const [modelo,arquivos]=await Promise.all([
   db.from("atel_os_apr_modelos_v1582").select("riscos,medidas").eq("codigo","APR_RISCOS").eq("versao",apr.modelo_versao).single(),
   db.from("atel_os_apr_fotos_v1582").select("id,nome_arquivo,caminho_storage,mime_type")
     .eq("apr_id",apr.id).order("criado_em",{ascending:true}).limit(8),
  ]);
  if(modelo.error||arquivos.error||!modelo.data)throw new ErroChecklistV158("Não foi possível reunir as evidências da APR.",503);
  const dict=(rows:unknown):Map<string,string>=>new Map((Array.isArray(rows)?rows:[]).filter((x:unknown):x is Opt=>
   !!x&&typeof x==="object"&&typeof (x as Opt).id==="string"&&typeof (x as Opt).nome==="string").map((x:Opt)=>[x.id,x.nome]));
  const riscos=dict(modelo.data.riscos),medidas=dict(modelo.data.medidas);
  const lista=(v:unknown,map:Map<string,string>)=>Array.isArray(v)?v.filter((x):x is string=>typeof x==="string").map(x=>map.get(x)||x):[];
  const evidencias:EvidenciaAprPdfV1584[]=[];
  for(const f of arquivos.data||[]){
   // Somente nomes previamente relacionados à mesma APR, nunca caminhos fornecidos pelo navegador.
   const {data,error:errFoto}=await db.storage.from("atel-os-checklists-v158").download(String(f.caminho_storage));
   const bytes=!errFoto&&data?new Uint8Array(await data.arrayBuffer()):null;
   evidencias.push({nome:String(f.nome_arquivo),mime:String(f.mime_type),dados:bytes});
  }
  const data=new Date(String(apr.registrado_em||apr.atualizado_em));
  const registradoEm=Number.isNaN(data.getTime())?"Sem data":data.toLocaleString("pt-BR",{timeZone:"America/Fortaleza"});
  const pdf=gerarAprPdfV1584({os:atendimento,registradoEm,resultado:String(apr.resultado),versao:Number(apr.modelo_versao),
    riscos:lista(apr.riscos,riscos),medidas:lista(apr.medidas,medidas),nenhumRisco:apr.nenhum_risco===true,
    riscosOutros:String(apr.riscos_outros||""),medidasOutros:String(apr.medidas_outros||""),
    observacao:String(apr.observacao||""),
    acompanhamentoSupervisor:apr.acompanhamento_supervisor===true,
    acompanhamentoSesmt:apr.acompanhamento_sesmt===true,
    profissionais:Array.isArray(apr.profissionais)?apr.profissionais.filter((v:unknown):v is {nome:string;funcao:string}=>!!v&&typeof v==="object"&&typeof (v as {nome?:unknown}).nome==="string"&&typeof (v as {funcao?:unknown}).funcao==="string"):[],
    evidencias});
  return new Response(new Uint8Array(pdf),{status:200,headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="APR_OS_${atendimento}.pdf"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch(e){return erro(e instanceof ErroChecklistV158?e.message:"Falha ao gerar o PDF da APR.",e instanceof ErroChecklistV158?e.status:503);}
}

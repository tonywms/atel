"use client";
import { useEffect, useState } from "react";
import { atelSupabase } from "@/lib/atelSupabaseV08";
type Apr={resultado:string;registrado_em:string;modelo_versao:number};
type Retorno={apr:Apr|null;error?:string};
/** Evidência da etapa "No cliente". Somente gestor autorizado pode ver o PDF. */
export default function AtelAprEvidenciaGestaoV1584({atendimento}:{atendimento:number}){
 const [apr,setApr]=useState<Apr|null>(null);
 const [consultando,setConsultando]=useState(true),[abrindo,setAbrindo]=useState(false);
 const [erro,setErro]=useState("");
 useEffect(()=>{
  let ativo=true;setApr(null);setConsultando(true);setErro("");
  (async()=>{
   try{
    const sb=atelSupabase();if(!sb)throw new Error("Sessão de gestão indisponível.");
    const {data:{session}}=await sb.auth.getSession();if(!session?.access_token)throw new Error("Faça login novamente.");
    const res=await fetch(`/api/os-apr-v1584/admin?atendimento=${encodeURIComponent(String(atendimento))}`,{cache:"no-store",headers:{Authorization:`Bearer ${session.access_token}`}});
    const data=(await res.json()) as Retorno;
    if(!res.ok)throw new Error(data.error||"Falha ao consultar APR.");
    if(ativo)setApr(data.apr||null);
   }catch(e){if(ativo)setErro(e instanceof Error?e.message:"APR indisponível.");}
   finally{if(ativo)setConsultando(false);}
  })();return()=>{ativo=false;};
 },[atendimento]);
 async function abrir(){
  const janela=window.open("about:blank","_blank");
  setAbrindo(true);setErro("");
  try{
   const sb=atelSupabase();if(!sb)throw new Error("Sessão indisponível.");
   const {data:{session}}=await sb.auth.getSession();if(!session?.access_token)throw new Error("Faça login novamente.");
   const res=await fetch(`/api/os-apr-v1584/pdf?atendimento=${encodeURIComponent(String(atendimento))}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
   if(!res.ok){const body=await res.json().catch(()=>({error:"PDF indisponível."})) as {error?:string};throw new Error(body.error||"Falha ao gerar PDF.");}
   const url=URL.createObjectURL(await res.blob());
   if(janela)janela.location.href=url;
   else{const link=document.createElement("a");link.href=url;link.download=`APR_OS_${atendimento}.pdf`;document.body.append(link);link.click();link.remove();}
   window.setTimeout(()=>URL.revokeObjectURL(url),120_000);
  }catch(e){if(janela)janela.close();setErro(e instanceof Error?e.message:"Falha ao abrir PDF.");}
  finally{setAbrindo(false);}
 }
 if(consultando)return null;
 if(!apr)return erro?<p style={{fontSize:11,color:"#8b5c10",margin:"10px 0 0"}} role="status">Evidências APR indisponíveis para consulta.</p>:null;
 const tempo=new Date(apr.registrado_em),data=Number.isNaN(tempo.getTime())?"Data não informada":tempo.toLocaleString("pt-BR");
 return <div data-atel-apr-gestao="v158.4" style={{marginTop:12,padding:"12px 13px",border:"1px solid #cbe5ef",borderLeft:"4px solid #0c93b7",borderRadius:11,background:"#f4fbfe",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
  <span aria-hidden="true" style={{display:"grid",placeItems:"center",width:38,height:38,background:"#e2f4fc",borderRadius:10,color:"#08799e",fontSize:18}}>▤</span>
  <div style={{flex:"1 1 180px",minWidth:0,display:"grid",gap:3}}>
   <strong style={{fontSize:12,color:"#073e59"}}>APR — Evidência do atendimento</strong>
   <span style={{fontSize:11,color:apr.resultado==="APTO"?"#15795b":"#a45428",fontWeight:800}}>{apr.resultado==="APTO"?"Avaliação registrada · Apto":"Avaliação registrada · Não apto"}</span>
   <small style={{fontSize:10,color:"#5c7785"}}>Etapa: No cliente · {data} · Modelo V{apr.modelo_versao}</small>
  </div>
  <button type="button" onClick={()=>void abrir()} disabled={abrindo} style={{minHeight:39,border:0,borderRadius:8,padding:"8px 13px",background:"#0a85a6",color:"white",fontSize:11,fontWeight:900,cursor:abrindo?"wait":"pointer"}}>{abrindo?"GERANDO PDF...":"VISUALIZAR PDF"}</button>
  {erro&&<span role="alert" style={{flexBasis:"100%",color:"#b44326",fontSize:11}}>{erro}</span>}
 </div>;
}

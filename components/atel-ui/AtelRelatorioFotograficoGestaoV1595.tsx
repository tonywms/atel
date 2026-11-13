"use client";
import {useEffect,useState} from "react";
import {atelSupabase} from "@/lib/atelSupabaseV08";
type Consulta={relatorio:{id:string;situacao:string;atualizada_em:string}|null;error?:string};
export default function AtelRelatorioFotograficoGestaoV1595({atendimento}:{atendimento:number}){
 const [registro,setRegistro]=useState<Consulta["relatorio"]>(null),[abrindo,setAbrindo]=useState(false),[erro,setErro]=useState("");
 useEffect(()=>{let ativo=true;setRegistro(null);setErro("");
  void (async()=>{
   try{const sb=atelSupabase();if(!sb)return;const {data:{session}}=await sb.auth.getSession();if(!session?.access_token)return;
    const res=await fetch(`/api/os-relatorio-fotografico-v1595/admin?atendimento=${atendimento}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
    const b=await res.json() as Consulta;if(!res.ok)throw new Error(b.error||"Relatório indisponível.");if(ativo)setRegistro(b.relatorio);
   }catch(e){if(ativo)setErro(e instanceof Error?e.message:"Falha ao consultar relatório.");}
  })();return()=>{ativo=false};
 },[atendimento]);
 async function pdf(){
  const janela=window.open("about:blank","_blank");setAbrindo(true);setErro("");
  try{const sb=atelSupabase();if(!sb)throw new Error("Sessão indisponível.");const {data:{session}}=await sb.auth.getSession();if(!session?.access_token)throw new Error("Faça login novamente.");
   const res=await fetch(`/api/os-relatorio-fotografico-v1595/pdf?atendimento=${atendimento}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
   if(!res.ok){const d=await res.json().catch(()=>({error:"PDF indisponível."})) as {error?:string};throw new Error(d.error||"PDF indisponível.");}
   const url=URL.createObjectURL(await res.blob());if(janela)janela.location.href=url;
   else{const a=document.createElement("a");a.href=url;a.download=`RELATORIO_FOTOGRAFICO_OS_${atendimento}.pdf`;a.click();}
   window.setTimeout(()=>URL.revokeObjectURL(url),120000);
  }catch(e){janela?.close();setErro(e instanceof Error?e.message:"Falha ao abrir PDF.");}finally{setAbrindo(false)}
 }
 if(!registro)return null;
 const ts=new Date(registro.atualizada_em);
 return <div data-atel-relatorio-v1595="concluido" style={{marginTop:10,padding:"12px 13px",border:"1px solid #bee2ed",borderLeft:"4px solid #0a92b6",background:"#f4fbfe",borderRadius:10,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
  <span aria-hidden="true" style={{display:"grid",placeItems:"center",background:"#e1f3fb",width:38,height:38,borderRadius:10,fontSize:19,color:"#08799e"}}>▧</span>
  <div style={{flex:"1 1 180px",display:"grid",gap:3}}><strong style={{fontSize:12,color:"#063e58"}}>Relatório Fotográfico Final — OS</strong><span style={{fontSize:11,color:"#16745d",fontWeight:800}}>Evidências de execução registradas</span><small style={{fontSize:10,color:"#698292"}}>{Number.isNaN(ts.getTime())?"Data não informada":ts.toLocaleString("pt-BR")}</small></div>
  <button type="button" disabled={abrindo} onClick={()=>void pdf()} style={{padding:"10px 14px",minHeight:40,border:0,borderRadius:8,background:"#0a85a6",color:"white",fontSize:11,fontWeight:900,cursor:"pointer"}}>{abrindo?"GERANDO PDF...":"VISUALIZAR PDF FINAL"}</button>
  {erro&&<small role="alert" style={{flexBasis:"100%",color:"#aa3e2b"}}>{erro}</small>}
 </div>;
}

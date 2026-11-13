"use client";
import { useState, type CSSProperties } from "react";
import { atelSupabase } from "@/lib/atelSupabaseV08";

type Status = { ok:boolean;estado:"PRONTO"|"PENDENTE"|"FINALIZADA";motivos:string[];itens:{codigo:string;descricao:string;quantidade:number;saldo:number|null;estado:string}[];total_unidades:number;versao:number;finalizacao_id?:string };
export default function AtelOsFinalizacaoV160({atendimento,disabled,onConcluida}:{atendimento:number;disabled?:boolean;onConcluida:()=>void}) {
 const [aberto,setAberto]=useState(false);
 const [ocupado,setOcupado]=useState(false);
 const [dados,setDados]=useState<Status|null>(null);
 const [erro,setErro]=useState("");
 const [concluido,setConcluido]=useState(false);
 async function requisitar(metodo:"GET"|"POST",versao=0) {
  const client=atelSupabase();if(!client)throw new Error("Conexão Supabase não configurada.");
  const {data:{session},error:authError}=await client.auth.getSession();
  if(authError||!session?.access_token)throw new Error("Sessão expirada. Entre novamente no ATEL.");
  const url=`/api/os-finalizacao-v160${metodo==="GET"?`?atendimento=${encodeURIComponent(String(atendimento))}`:""}`;
  const res=await fetch(url,{method:metodo,headers:{Authorization:`Bearer ${session.access_token}`,...(metodo==="POST"?{"Content-Type":"application/json"}:{})},body:metodo==="POST"?JSON.stringify({atendimento,versao}):undefined,cache:"no-store"});
  const payload:unknown=await res.json().catch(()=>null);
  const r=payload&&typeof payload==="object"?payload as Record<string,unknown>:{};
  if(!res.ok)throw new Error(typeof r.error==="string"?r.error:"Não foi possível conferir os materiais.");
  return r;
 }
 // ATEL_E1_V160_1_PREPARAR_RELATORIO: garante que as descricoes opcionais digitadas sejam persistidas antes da consulta.
 async function prepararRelatorio(){
  const tarefas:Promise<void>[]=[];
  window.dispatchEvent(new CustomEvent("atel:preparar-relatorio-v1601",{detail:{atendimento,aceitar:(tarefa:Promise<void>)=>tarefas.push(tarefa)}}));
  await Promise.all(tarefas);
 }
 async function abrir(){setAberto(true);setOcupado(true);setDados(null);setErro("");setConcluido(false);
  try {await prepararRelatorio();const r=await requisitar("GET");setDados(r as Status);if(r.estado==="FINALIZADA")setConcluido(true);}
  catch(e){setErro(e instanceof Error?e.message:"Não foi possível validar a OS.");}
  finally{setOcupado(false)}
 }
 async function finalizar(){if(!dados||dados.estado!=="PRONTO"||ocupado)return;
  setOcupado(true);setErro("");
  try {const retorno=await requisitar("POST",dados.versao);if(retorno.ok!==true||retorno.etapa!=="FINALIZADA")throw new Error("Finalização não confirmada pelo servidor.");setConcluido(true);}
  catch(e){setErro(e instanceof Error?e.message:"A OS não foi finalizada.");}
  finally{setOcupado(false)}
 }
 const btn:CSSProperties={width:"100%",minHeight:47,border:0,borderRadius:4,fontSize:12,fontWeight:900,background:"#087fa3",color:"#fff",cursor:"pointer"};
 return <>
  <button type="button" onClick={()=>void abrir()} disabled={disabled} style={{...btn,opacity:disabled ? 0.6 : 1}}>CONFERIR E FINALIZAR OS</button>
  {aberto&&<div role="presentation" onClick={()=>!ocupado&&setAberto(false)} style={{position:"absolute",inset:0,zIndex:13000,background:"rgba(6,35,51,.74)",display:"flex",alignItems:"center",justifyContent:"center",padding:13,boxSizing:"border-box"}}>
   <div role="dialog" aria-modal="true" aria-label="Finalização da ordem de serviço" onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:358,maxHeight:"calc(100% - 22px)",overflowY:"auto",background:"#fff",color:"#0a4059",borderRadius:15,padding:16,boxSizing:"border-box",boxShadow:"0 25px 65px rgba(0,0,0,.3)"}}>
    <div style={{fontSize:10,fontWeight:900,color:"#0884aa",letterSpacing:1}}>ENCERRAMENTO DA ORDEM DE SERVIÇO</div>
    <h2 style={{fontSize:18,margin:"5px 0 8px"}}>{concluido?"OS concluída no ATEL":ocupado&&!dados?"Conferindo estoque do técnico...":dados?.estado==="PRONTO"?"Pronta para finalizar":"Verifique os materiais da OS"}</h2>
    {ocupado&&!dados&&<p role="status" style={{fontSize:12,lineHeight:1.5}}>Conferindo APR, fotos, materiais e saldo disponível.</p>}
    {concluido&&<div style={{padding:13,background:"#eaf9ef",border:"1px solid #b7e5c9",borderRadius:10,color:"#08784b",fontSize:12,lineHeight:1.5}}>A finalização foi registrada no ATEL e o consumo foi descontado do estoque do técnico. Nenhuma segunda baixa ocorrerá ao abrir novamente. A sincronização de status com o ERP externo é uma integração separada.</div>}
    {!concluido&&dados&&<>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"10px 0"}}>
      <div style={{borderRadius:9,background:"#eff8fc",padding:10,fontSize:10}}>Materiais <strong style={{display:"block",fontSize:18}}>{dados.itens.length}</strong></div>
      <div style={{borderRadius:9,background:"#eff8fc",padding:10,fontSize:10}}>Unidades <strong style={{display:"block",fontSize:18}}>{dados.total_unidades}</strong></div>
     </div>
     {dados.itens.map(item=><div key={item.codigo} style={{display:"flex",justifyContent:"space-between",gap:8,padding:"9px 0",borderBottom:"1px solid #e4eff4",fontSize:11}}><span><strong>{item.descricao}</strong><span style={{display:"block",fontSize:10,color:"#608092"}}>Código {item.codigo} · Utilizado: {item.quantidade}</span></span><strong style={{color:item.estado==="DISPONIVEL"?"#138663":"#b03b2b",whiteSpace:"nowrap"}}>Saldo: {item.saldo??"—"}</strong></div>)}
     {dados.estado==="PENDENTE"&&<div role="alert" style={{marginTop:12,padding:12,background:"#fff4e4",border:"1px solid #edcc93",borderRadius:10}}><strong style={{fontSize:12,color:"#996016"}}>O que falta para finalizar</strong><ul style={{fontSize:11,lineHeight:1.55,paddingLeft:18,margin:"8px 0 0"}}>{dados.motivos.map((motivo,i)=><li key={i}>{motivo}</li>)}</ul></div>}
     {dados.estado==="PRONTO"&&<p style={{padding:11,background:"#e8f8f0",borderRadius:8,fontSize:11,color:"#127a50"}}>APR, fotografias e saldo conferidos. Ao confirmar, o ATEL concluirá o Relatório Fotográfico Final automaticamente, descontará os materiais do estoque do técnico e registrará a OS em uma única transação. Descrições e número de série das fotos são opcionais.</p>}
    </>}
    {erro&&<div role="alert" style={{fontSize:11,marginTop:10,padding:11,color:"#a53225",background:"#fff1ef",borderRadius:9}}>{erro}</div>}
    <div style={{display:"grid",gap:8,marginTop:15}}>
     {dados?.estado==="PRONTO"&&!concluido&&<button type="button" disabled={ocupado} onClick={()=>void finalizar()} style={{...btn,borderRadius:9,opacity:ocupado ? 0.55 : 1}}>{ocupado?"FINALIZANDO...":"CONFIRMAR E FINALIZAR OS"}</button>}
     <button type="button" disabled={ocupado} onClick={()=>concluido?onConcluida():setAberto(false)} style={{...btn,borderRadius:9,background:concluido?"#087fa3":"#eff7fb",color:concluido?"white":"#087fa3",border:concluido?0:"1px solid #bfdde9"}}>{concluido?"VOLTAR À LISTA DE OS":"VOLTAR AO ATENDIMENTO"}</button>
    </div>
   </div>
  </div>}
 </>;
}

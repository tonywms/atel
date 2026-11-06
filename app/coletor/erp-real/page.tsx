"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { ClipboardList, Boxes, RefreshCw, Search, ArrowLeft, ChevronRight, ShieldCheck } from "lucide-react";

type Item = Record<string, unknown>;
type Result = { ok?: boolean; http?: number; dados?: unknown; error?: string; persistencia?: { status: string; mensagem?: string } };
const value = (x: unknown) => x === null || x === undefined || x === "" ? "—" : String(x);
const text = (x: unknown) => value(x).toLocaleLowerCase("pt-BR");
const box: React.CSSProperties = { background: "#fff", border: "1px solid #dbe6ef", borderRadius: 16, padding: 16, boxShadow: "0 3px 12px #163d5710" };
const button: React.CSSProperties = { border: "1px solid #b8d7e7", borderRadius: 10, padding: "11px 13px", background: "#fff", color: "#075c7e", fontWeight: 750, cursor: "pointer" };
export default function ErpRealPage() {
 const [id,setId]=useState("4157"); const [tab,setTab]=useState<"os"|"inventario">("os"); const [query,setQuery]=useState("");
 const [result,setResult]=useState<Result|null>(null); const [loading,setLoading]=useState(false);
 const [detail,setDetail]=useState<{id:string;result:Result|null;loading:boolean}|null>(null);
 async function request(tipo:"os"|"inventario"|"detalhe", codigo:string):Promise<Result>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key) throw new Error("Supabase não configurado");
  const client=createClient(url,key);const {data}=await client.auth.getSession();
  if(!data.session?.access_token) throw new Error("Faça login com a conta de homologação");
  const res=await fetch(`/api/adapter-homologacao?tipo=${tipo}&id=${encodeURIComponent(codigo)}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:"no-store"});
  const body=await res.json() as Result;if(!res.ok||!body.ok)throw new Error(body.error||`Falha na consulta (${res.status})`);return body;
 }
 async function load(t:"os"|"inventario"=tab){setTab(t);setLoading(true);setResult(null);setDetail(null);try{setResult(await request(t,id));}catch(e){setResult({error:e instanceof Error?e.message:"Falha inesperada"});}finally{setLoading(false);}}
 async function openDetail(codigo:string){setDetail({id:codigo,result:null,loading:true});try{const r=await request("detalhe",codigo);setDetail({id:codigo,result:r,loading:false});}catch(e){setDetail({id:codigo,result:{error:e instanceof Error?e.message:"Falha inesperada"},loading:false});}}
 const rows=useMemo(()=>Array.isArray(result?.dados)?result.dados.filter((x):x is Item=>typeof x==="object"&&x!==null):[],[result]);
 const filtered=useMemo(()=>rows.filter(x=>Object.values(x).some(v=>text(v).includes(query.toLocaleLowerCase("pt-BR")))),[rows,query]);
 useEffect(()=>{void load("os");/* load on mount, controlled by user thereafter */},[]); // eslint-disable-line react-hooks/exhaustive-deps
 return <div style={{minHeight:"100vh",background:"#edf4f9",color:"#17334a",padding:"18px 12px 40px"}}><div style={{maxWidth:760,margin:"0 auto",display:"grid",gap:14}}>
  <header style={{background:"linear-gradient(110deg,#0b4166,#0888af)",color:"white",padding:20,borderRadius:18}}><Link href="/coletor/ordens-servico" style={{color:"white",display:"inline-flex",gap:7,alignItems:"center",fontSize:13}}><ArrowLeft size={16}/> Voltar às OS locais</Link><h1 style={{fontSize:24,margin:"14px 0 4px"}}>ERP real · Coletor</h1><div style={{fontSize:13,opacity:.9}}>Consulta de homologação · somente leitura · sem movimentar estoque</div></header>
  <section style={box}><label htmlFor="tecnico" style={{fontSize:12,fontWeight:800}}>ID do técnico</label><div style={{display:"flex",gap:8,marginTop:7,flexWrap:"wrap"}}><input id="tecnico" inputMode="numeric" value={id} onChange={e=>setId(e.target.value.replace(/\D/g,"").slice(0,12))} style={{...button,flex:1,minWidth:110,color:"#142e42"}}/><button style={{...button,background:"#087da6",color:"white"}} disabled={loading||!id} onClick={()=>void load()}><RefreshCw size={15} style={{display:"inline",verticalAlign:"middle"}}/> Consultar</button></div><div style={{display:"flex",gap:8,marginTop:12}}><button style={{...button,flex:1,background:tab==="os"?"#e0f4ff":"white"}} onClick={()=>void load("os")} disabled={loading}><ClipboardList size={15} style={{display:"inline"}}/> OS</button><button style={{...button,flex:1,background:tab==="inventario"?"#e0f4ff":"white"}} onClick={()=>void load("inventario")} disabled={loading}><Boxes size={15} style={{display:"inline"}}/> Estoque</button></div></section>
  <section style={box}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}><strong>{tab==="os"?"Ordens de serviço do ERP":"Materiais do técnico"}</strong><span style={{fontSize:12,color:"#54718a"}}>{loading?"Consultando...":`${filtered.length} itens`}</span></div>
  {result?.error&&<p role="alert" style={{color:"#b42318"}}>{result.error}</p>}
  {result?.ok&&<p style={{fontSize:12,color:"#24754c",display:"flex",gap:6,alignItems:"center"}}><ShieldCheck size={14}/> HTTP {result.http} · snapshot {result.persistencia?.status||"não informado"}</p>}
  <div style={{position:"relative",margin:"12px 0"}}><Search size={16} style={{position:"absolute",top:14,left:12,color:"#648198"}}/><input aria-label="Filtrar resultados" placeholder="Buscar protocolo, cliente ou material" value={query} onChange={e=>setQuery(e.target.value)} style={{width:"100%",boxSizing:"border-box",border:"1px solid #d6e2ec",borderRadius:10,padding:"12px 12px 12px 36px",fontSize:14}}/></div>
  {!loading&&result?.ok&&filtered.length===0&&<p>Nenhum resultado para a pesquisa.</p>}
  <div style={{display:"grid",gap:10}}>{filtered.map((r,i)=>tab==="os"?<button key={`${value(r.atendimento)}-${i}`} onClick={()=>void openDetail(String(r.atendimento))} style={{...box,textAlign:"left",cursor:"pointer",borderLeft:"5px solid #0796c4"}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong>Atendimento nº {value(r.atendimento)}</strong><ChevronRight size={18}/></div><div style={{fontSize:12,color:"#537084",marginTop:4}}>Protocolo: {value(r.protocolo)}</div><div style={{fontWeight:700,marginTop:9}}>{value(r.cliente)}</div><div style={{fontSize:13,marginTop:4}}>Serviço: {value(r.servico)}</div><div style={{fontSize:12,marginTop:7,color:"#537084"}}>Início: {value(r.data_inicio)} · Técnico: {value(r.tecnico)}</div></button>:<article key={`${value(r.cod_produto)}-${i}`} style={{...box,borderLeft:"5px solid #0796c4"}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{value(r.produto)}</strong><strong>{value(r.quantidade)}</strong></div><div style={{fontSize:12,color:"#537084",marginTop:6}}>Código: {value(r.cod_produto)} · MAC: {value(r.mac)} · Patrimônio: {value(r.patrimonio)}</div></article>)}</div></section>
  {detail&&<section style={box}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><strong>Detalhe do atendimento nº {detail.id}</strong><button style={button} onClick={()=>setDetail(null)}>Fechar</button></div>{detail.loading?<p>Consultando detalhes...</p>:detail.result?.error?<p role="alert" style={{color:"#b42318"}}>{detail.result.error}</p>:<pre style={{overflowX:"auto",whiteSpace:"pre-wrap",overflowWrap:"anywhere",background:"#10263b",color:"#e5f6ff",padding:12,borderRadius:10,fontSize:12}}>{JSON.stringify(detail.result?.dados,null,2)}</pre>}</section>}
  <p style={{fontSize:12,color:"#5c7385",textAlign:"center"}}>Dados consultados do ERP via API autenticada. Operações de baixa, devolução e conclusão permanecem nas rotinas locais, sem vínculo automático com o ERP.</p>
 </div></div>;
}

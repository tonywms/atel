"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {atelSupabase} from "@/lib/atelSupabaseV08";
type Pendencia={id:string;codigo:string;origem:string;destino:string;material:string;sku:string;quantidade:number;criada_em:string};
export default function TransferenciasInternasPendentes(){
 const router=useRouter();const [lista,setLista]=useState<Pendencia[]>([]);const [erro,setErro]=useState("");const [loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;async function carregar(){try{const db=atelSupabase();if(!db)throw Error("Supabase indisponível");const {data:{session}}=await db.auth.getSession();if(!session)throw Error("Entre com sua conta para consultar transferências");const r=await fetch("/api/estoque-wms/transferencia-interna",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.detalhe||d.error);if(active){setLista(d.transferencias||[]);setErro("")}}catch(e){if(active)setErro(e instanceof Error?e.message:"Falha de consulta")}finally{if(active)setLoading(false)}}void carregar();const interval=setInterval(()=>void carregar(),30000);return()=>{active=false;clearInterval(interval)}},[]);
 return <section style={{margin:"12px 0 20px",padding:16,border:"1px solid #335779",borderRadius:16,background:"linear-gradient(145deg,#0b233b,#142e4b)",color:"#f0f7ff"}}>
 <div style={{fontSize:11,fontWeight:800,letterSpacing:1.3,color:"#87c9ee"}}>TRANSFERÊNCIAS INTERNAS • WMS</div>
 <h3 style={{margin:"7px 0",fontSize:19}}>Recebimentos por produto</h3>
 <p style={{fontSize:12,opacity:.8,margin:"0 0 12px"}}>Transferências de mini-CD/depósito para estoque técnico. Sem bipagem de volumes.</p>
 {loading&&<p>Consultando pendências...</p>}{erro&&<p role="alert" style={{color:"#ffc3b7"}}>{erro}</p>}
 {!loading&&!erro&&lista.length===0&&<p style={{fontSize:13}}>Nenhuma transferência interna pendente para seu usuário.</p>}
 {lista.map(t=><button key={t.id} type="button" onClick={()=>router.push(`/coletor/recebimento/${t.id}`)} style={{display:"block",width:"100%",textAlign:"left",padding:13,marginTop:8,border:"1px solid #456b8d",borderRadius:12,background:"#193955",color:"white",cursor:"pointer"}}><strong>{t.codigo}</strong><div style={{fontSize:12,marginTop:5}}>{t.origem} → {t.destino}</div><div style={{fontSize:12,marginTop:5}}>{t.sku} • {t.material} • {t.quantidade} un.</div><small style={{color:"#a4d9ff"}}>Conferir e dar aceite →</small></button>)}
 </section>;
}

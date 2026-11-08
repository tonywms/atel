"use client";
import {useEffect,useState} from "react";
import {atelSupabase} from "@/lib/atelSupabaseV08";
type Item={sku:string;descricao:string;quantidade:number};
type Pedido={id:string;codigo:string;tipo:string;status:string;prioridade:string;origem:string;destino:string;criado_em:string;itens:Item[]};
const ORG="6ea04673-4deb-42cf-a001-dbb027120103";
export default function PedidosReaisV36({coletor=false}:{coletor?:boolean}){
 const [pedidos,setPedidos]=useState<Pedido[]>([]),[erro,setErro]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let vivo=true;async function carregar(){try{const db=atelSupabase();if(!db)throw Error("Supabase indisponível");const {data,error}=await db.rpc("atel_v36_listar_pedidos",{p_org:ORG});if(error)throw Error(error.message);if(vivo)setPedidos((data||[]).filter((p:Pedido)=>p.tipo==="ABASTECIMENTO"));}catch(e){if(vivo)setErro(e instanceof Error?e.message:"Falha na consulta")}finally{if(vivo)setLoading(false)}}void carregar();const t=setInterval(()=>void carregar(),30000);return()=>{vivo=false;clearInterval(t)}},[]);
 const lista=coletor?pedidos.filter(p=>["PENDENTE","EM_SEPARACAO"].includes(p.status)):pedidos;
 return <section style={{background:coletor?"#102d46":"#fff",color:coletor?"#fff":"#143650",border:"1px solid #c8dce8",borderRadius:16,padding:18,margin:"16px 0",boxSizing:"border-box",width:"100%",minWidth:0}}>
 <div style={{fontWeight:800,fontSize:15,marginBottom:10}}>Pedidos reais do ERP / Supabase <span style={{fontSize:11,fontWeight:500}}>({lista.length})</span></div>
 {loading&&<p>Consultando pedidos...</p>}{erro&&<p role="alert" style={{color:"#e88657"}}>{erro}</p>}
 {lista.map(p=><article key={p.id} style={{border:"1px solid #a3c8dc55",borderRadius:12,padding:12,marginBottom:9}}>
 <div style={{display:"flex",gap:8,justifyContent:"space-between",flexWrap:"wrap"}}><strong>{p.codigo}</strong><span style={{fontSize:11,fontWeight:700}}>{p.status} · {p.prioridade}</span></div>
 <div style={{fontSize:12,margin:"8px 0"}}>{p.origem} → {p.destino}</div>
 <div style={{fontSize:12}}>{p.itens.map(i=>`${i.sku}: ${i.descricao} (${i.quantidade})`).join(" • ")}</div>
 {coletor&&<p style={{fontSize:11,marginTop:10,color:"#f3c879"}}>Aguardando integração da execução da separação. Não usar o detalhe mockado para este pedido.</p>}
 </article>)}
 {!loading&&!erro&&lista.length===0&&<p style={{fontSize:12}}>Nenhum pedido real nesta fila.</p>}
 </section>
}

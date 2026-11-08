"use client";
import {useEffect,useRef,useState} from "react";
import {atelSupabase} from "@/lib/atelSupabaseV08";
import {Warehouse,Package,ClipboardList,Plus,Trash2,ShieldCheck,RefreshCw,Truck,MapPin,Layers3,Database,CircleCheck,LockKeyhole,AlertTriangle,Building2,Boxes,ChevronDown} from "lucide-react";
import styles from "./page.module.css";
const org="6ea04673-4deb-42cf-a001-dbb027120103";
type Local={id:string;nome:string;tipo:string};
type Material={id:string;sku:string;descricao:string;unidade?:string};
type Linha={material_id:string;quantidade:string};
function ProdutoPicker({materiais,value,onChange,numero}:{materiais:Material[];value:string;onChange:(id:string)=>void;numero:number}){
 const [aberto,setAberto]=useState(false),[termo,setTermo]=useState("");
 const area=useRef<HTMLDivElement>(null),campo=useRef<HTMLInputElement>(null);
 const escolhido=materiais.find(m=>m.id===value);
 const encontrados=materiais.filter(m=>`${m.sku} ${m.descricao}`.toLocaleLowerCase("pt-BR").includes(termo.trim().toLocaleLowerCase("pt-BR")));
 useEffect(()=>{if(!aberto)return;const fechar=(e:PointerEvent)=>{if(area.current&&!area.current.contains(e.target as Node))setAberto(false)};document.addEventListener("pointerdown",fechar);return()=>document.removeEventListener("pointerdown",fechar)},[aberto]);
 return <div ref={area} style={{position:"relative",flex:"1 1 0",minWidth:0}}>
  <button type="button" aria-label={`Selecionar produto ${numero}`} aria-haspopup="listbox" aria-expanded={aberto} onClick={()=>{setAberto(v=>!v);setTermo("");setTimeout(()=>campo.current?.focus(),0)}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,width:"100%",minHeight:48,padding:"10px 14px",background:"#f7fafc",border:"1px solid #cddfea",borderRadius:10,color:"#153b54",textAlign:"left",fontSize:13,cursor:"pointer"}}>
   <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{escolhido?`${escolhido.sku} — ${escolhido.descricao}`:"Selecione o material"}</span><ChevronDown size={16} strokeWidth={2} aria-hidden="true" style={{flexShrink:0,color:"#365a73"}}/>
  </button>
  {aberto&&<div style={{position:"absolute",top:"calc(100% + 5px)",left:0,right:0,zIndex:50,background:"white",border:"1px solid #b8d2e2",borderRadius:11,boxShadow:"0 14px 35px #163b5433",padding:8}}>
   <input ref={campo} type="search" aria-label={`Pesquisar produto ${numero}`} placeholder="Buscar código ou descrição" value={termo} onChange={e=>setTermo(e.target.value)} onKeyDown={e=>{if(e.key==="Escape")setAberto(false);if(e.key==="Enter"&&encontrados.length===1){e.preventDefault();onChange(encontrados[0].id);setAberto(false)}}} style={{width:"100%",height:40,padding:"9px 11px",border:"1px solid #cbdde8",borderRadius:8,marginBottom:6,fontSize:13}}/>
   <div role="listbox" aria-label={`Produtos disponíveis ${numero}`} style={{maxHeight:260,overflowY:"auto",overscrollBehavior:"contain"}}>
    {encontrados.map(m=><button type="button" role="option" aria-selected={m.id===value} key={m.id} onClick={()=>{onChange(m.id);setAberto(false)}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 12px",border:0,borderRadius:7,background:m.id===value?"#e5f4fb":"transparent",color:"#1b435c",fontSize:12,cursor:"pointer"}}>{m.sku} — {m.descricao}</button>)}
    {!encontrados.length&&<div style={{padding:12,color:"#667d8b",fontSize:12}}>Nenhum produto encontrado.</div>}
   </div>
  </div>}
 </div>;
}
export default function GerarPedidoSaida(){
 const [locais,setLocais]=useState<Local[]>([]),[materiais,setMateriais]=useState<Material[]>([]);
 const [origem,setOrigem]=useState(""),[destino,setDestino]=useState(""),[prioridade,setPrioridade]=useState("NORMAL");
 const [itens,setItens]=useState<Linha[]>([{material_id:"",quantidade:"1"}]);
 const [sincronizando,setSincronizando]=useState(false),[syncMsg,setSyncMsg]=useState("");
 const [observacao,setObservacao]=useState(""),[erro,setErro]=useState(""),[ok,setOk]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;(async()=>{try{const db=atelSupabase();if(!db)throw Error("Supabase indisponível");const {data:{session}}=await db.auth.getSession();if(!session)throw Error("Sessão expirada");const r=await fetch("/api/estoque-wms/catalogo",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"Catálogo indisponível");if(alive){setLocais(d.locais||[]);setMateriais(d.materiais||[]);setOrigem((d.locais||[]).find((l:Local)=>l.tipo==="cd")?.id||"");}}catch(e){if(alive)setErro(e instanceof Error?e.message:"Falha de conexão")}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[]);
 useEffect(()=>{let active=true;const timer=window.setTimeout(()=>{if(active)void sincronizarERP()},250);return()=>{active=false;window.clearTimeout(timer)}},[]);
 async function sincronizarERP(){
   setSincronizando(true);setSyncMsg("");
   try{
     const db=atelSupabase();if(!db)throw Error("Supabase indisponível");
     const {data:{session}}=await db.auth.getSession();if(!session)throw Error("Sessão expirada");
     const r=await fetch("/api/erp/catalogo-produtos/sincronizar",{method:"POST",headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
     const d=await r.json();if(!r.ok)throw Error(d.error||"Falha ao sincronizar produtos");
     const r2=await fetch("/api/estoque-wms/catalogo",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
     const c=await r2.json();if(!r2.ok)throw Error(c.error||"Falha ao atualizar catálogo");
     setMateriais(c.materiais||[]);
     setSyncMsg(`ERP consultado: ${d.linhasERP} linhas, ${d.codigosUnicos} produtos únicos, ${d.novos} novos cadastros. ${d.ignorados} linhas sem código ou descrição. Nenhum saldo foi alterado.`);
   }catch(e){setSyncMsg("Catálogo Supabase disponível. Consulta ERP pendente: "+(e instanceof Error?e.message:"Falha ao sincronizar"));}
   finally{setSincronizando(false);}
 }
 async function enviar(e:React.FormEvent){e.preventDefault();setErro("");setOk("");
 const lista=itens.map(i=>({material_id:i.material_id,quantidade:Number(i.quantidade)}));
 if(!origem||!destino||lista.some(i=>!i.material_id||!Number.isFinite(i.quantidade)||i.quantidade<=0)||new Set(lista.map(i=>i.material_id)).size!==lista.length){setErro("Confira destino, produtos, quantidades e itens duplicados.");return;}
 setBusy(true);try{const db=atelSupabase();if(!db)throw Error("Supabase indisponível");const {data:{session}}=await db.auth.getSession();if(!session)throw Error("Sessão expirada");const {data,error}=await db.rpc("atel_v36_criar_pedido",{p_org:org,p_origem:origem,p_destino:destino,p_prioridade:prioridade,p_itens:lista,p_observacao:observacao,p_chave:crypto.randomUUID()});if(error)throw Error(error.message);setOk("Pedido "+data.codigo+" criado no Supabase. A integração com a separação operacional ainda será habilitada na próxima etapa.");setItens([{material_id:"",quantidade:"1"}]);setObservacao("");}catch(e){setErro(e instanceof Error?e.message:"Falha ao salvar pedido")}finally{setBusy(false)}}
 return <main className={styles.root}>
 <header className={styles.hero}><div className={styles.heroText}><div className={styles.kicker}><span className={styles.kickerIcon}><ClipboardList size={15}/></span> OPERAÇÕES ERP / WMS <span className={styles.kickerLine}/></div><h1>Gerar Pedido <span>de Saída</span></h1><p>Emissão de pedidos de abastecimento do CD Principal para mini-CDs, depósitos e técnicos, com catálogo real e rastreabilidade operacional.</p><div className={styles.heroTags}><span><ShieldCheck size={13}/> Segurança transacional</span><span><Database size={13}/> Catálogo Supabase</span><span><ClipboardList size={13}/> Abastecimento WMS</span></div></div><div className={styles.heroArt} aria-hidden="true"><div className={styles.orbit}><Warehouse size={35}/></div><span className={styles.artLine}/><div className={styles.orbitSmall}><Truck size={24}/></div><div className={styles.artLabel}>FLUXO DE ABASTECIMENTO <strong>ERP → WMS</strong></div></div></header>
 <div className={styles.sectionLabel}><span>VISÃO GERAL</span><div/></div>
 <section className={styles.metrics} aria-label="Indicadores operacionais">
 <div className={styles.metric}><div className={styles.metricTop}><span>Centros de distribuição</span><span className={styles.metricIcon}><Warehouse size={19}/></span></div><strong>{locais.filter(l=>l.tipo==="cd").length}</strong><small>Unidades de origem</small></div>
 <div className={styles.metric}><div className={styles.metricTop}><span>Mini-CDs e depósitos</span><span className={styles.metricIcon}><Building2 size={19}/></span></div><strong>{locais.filter(l=>l.tipo==="ponto_apoio").length}</strong><small>Destinos de abastecimento</small></div>
 <div className={styles.metric}><div className={styles.metricTop}><span>Estoques técnicos</span><span className={styles.metricIcon}><Boxes size={19}/></span></div><strong>{locais.filter(l=>l.tipo==="estoque_tecnico").length}</strong><small>Posições individuais</small></div>
 <div className={styles.metric}><div className={styles.metricTop}><span>Materiais cadastrados</span><span className={styles.metricIcon}><Package size={19}/></span></div><strong>{materiais.length}</strong><small>Itens do catálogo</small></div>
 </section>
 <div className={styles.sectionLabel}><span>EXECUÇÃO OPERACIONAL</span><div/></div>
 <div className={styles.layout}>
 <section className={styles.panel}><div className={styles.panelHeading}><div className={styles.panelSymbol}><ClipboardList size={22}/></div><div><span className={styles.overline}>PEDIDO DE ABASTECIMENTO</span><h2>Novo pedido</h2><p>Selecione o destino, os materiais e as quantidades.</p></div><span className={styles.step}>01 / 02</span></div>
 <form onSubmit={enviar}><div className={styles.fields}>
 <label><span className={styles.fieldLabel}><Warehouse size={15}/> Local de origem</span><select value={origem} onChange={e=>setOrigem(e.target.value)} required><option value="">Selecione o CD de origem</option>{locais.filter(l=>l.tipo==="cd").map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
 <label><span className={styles.fieldLabel}><MapPin size={15}/> Local de destino</span><select value={destino} onChange={e=>setDestino(e.target.value)} required><option value="">Selecione mini-CD, depósito ou técnico</option>{locais.filter(l=>["ponto_apoio","estoque_tecnico"].includes(l.tipo)).map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
 <label><span className={styles.fieldLabel}><Layers3 size={15}/> Prioridade</span><select value={prioridade} onChange={e=>setPrioridade(e.target.value)}><option>NORMAL</option><option>ALTA</option><option>URGENTE</option></select></label>
 </div><div className={styles.subheading}><Package size={16}/> Produtos do pedido</div>
 <div role="status" aria-live="polite" style={{fontSize:12,color:"#536f83",marginBottom:12}}>{sincronizando?"Verificando automaticamente novos produtos no ERP...":syncMsg||"Catálogo carregado do Supabase; novidades do ERP são verificadas automaticamente."}</div>

 {itens.map((item,i)=><div className={styles.item} key={i}><ProdutoPicker materiais={materiais} value={item.material_id} numero={i+1} onChange={id=>setItens(a=>a.map((x,j)=>j===i?{...x,material_id:id}:x))}/><input aria-label={"Quantidade "+(i+1)} type="number" min="0.001" step="any" value={item.quantidade} onChange={e=>setItens(a=>a.map((x,j)=>j===i?{...x,quantidade:e.target.value}:x))} required/><button type="button" aria-label="Remover produto" disabled={itens.length===1} onClick={()=>setItens(a=>a.filter((_,j)=>j!==i))}><Trash2 size={17}/></button></div>)}
 <button className={styles.add} type="button" onClick={()=>setItens(a=>[...a,{material_id:"",quantidade:"1"}])}><Plus size={16}/> Adicionar produto</button>
 <label className={styles.notes}><span className={styles.fieldLabel}><ClipboardList size={15}/> Observações</span><textarea maxLength={1000} value={observacao} onChange={e=>setObservacao(e.target.value)} rows={3}/></label>
 {erro&&<div role="alert" className={styles.error}><AlertTriangle size={16}/>{erro}</div>}{ok&&<div role="status" className={styles.success}><CircleCheck size={16}/>{ok}</div>}
 <div className={styles.actions}><div className={styles.actionNote}><LockKeyhole size={15}/> Pedido sem baixa de estoque na emissão</div><button disabled={busy||loading} type="submit">{busy?<RefreshCw size={17}/>:<ClipboardList size={17}/>} {busy?"Gravando pedido...":"Gerar pedido no ERP/WMS"}</button></div></form></section>
 <section className={styles.reviewPanel}><div className={styles.reviewHead}><div className={styles.panelSymbolAlt}><ClipboardList size={22}/></div><div><span className={styles.overline}>VALIDAÇÃO OPERACIONAL</span><h2>Conferência</h2><p>Revise antes de confirmar</p></div></div>
 <div className={styles.summary}><div><span><Warehouse size={14}/> Origem</span><strong>{locais.find(l=>l.id===origem)?.nome||"Aguardando seleção"}</strong></div><div><span><MapPin size={14}/> Destino</span><strong>{locais.find(l=>l.id===destino)?.nome||"Aguardando seleção"}</strong></div><div><span><Package size={14}/> Produtos</span><strong>{itens.filter(i=>i.material_id).length} item(ns) selecionado(s)</strong></div><div><span><Layers3 size={14}/> Prioridade</span><strong>{prioridade}</strong></div></div>
 <div className={styles.security}><div className={styles.securityTitle}><ShieldCheck size={18}/> Proteções ativas</div><span><CircleCheck size={14}/> Pedido persistido no Supabase</span><span><CircleCheck size={14}/> Identificação por organização</span><span><CircleCheck size={14}/> Sem baixa de estoque antecipada</span></div>
 <div className={styles.notice}><AlertTriangle size={16}/><span>Integração com a separação operacional ainda não ativada nesta etapa. O pedido é registrado, mas não movimenta estoque.</span></div>
 <div className={styles.reviewFoot}><LockKeyhole size={14}/> Operação rastreável</div></section></div>
 </main>;
}

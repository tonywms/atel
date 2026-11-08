"use client";
import { useEffect, useMemo, useState } from "react";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import { ArrowLeftRight, ArrowRight, Boxes, Building2, ClipboardCheck, Database, Package, ShieldCheck, Truck, Warehouse, MapPin, CircleCheck, AlertTriangle, RefreshCw, LockKeyhole, Layers3 } from "lucide-react";
import styles from "./transferencia.module.css";
type Local={id:string;nome:string;tipo:string;responsavel_usuario_id:string|null};
type Material={id:string;sku:string;descricao:string};
const org="6ea04673-4deb-42cf-a001-dbb027120103";
export default function TransferenciaEstoque(){
 const [tentativa,setTentativa]=useState(0);
 const [locais,setLocais]=useState<Local[]>([]),[materiais,setMateriais]=useState<Material[]>([]),[autorizados,setAutorizados]=useState<string[]>([]);
 const [origem,setOrigem]=useState(""),[destino,setDestino]=useState(""),[material,setMaterial]=useState(""),[quantidade,setQuantidade]=useState(""),[token,setToken]=useState(""),[erro,setErro]=useState(""),[sucesso,setSucesso]=useState(""),[carregando,setCarregando]=useState(true),[enviando,setEnviando]=useState(false);
 useEffect(()=>{let ativo=true;async function carregar(){setCarregando(true);setErro("");setToken("");try{
 const db=atelSupabase();if(!db)throw Error("Supabase não configurado. Confira as variáveis públicas do ATEL.");
 const {data:{session},error:authError}=await db.auth.getSession();if(authError||!session)throw Error("Sessão Supabase indisponível. Entre novamente no sistema.");
 const resp=await fetch("/api/estoque-wms/catalogo",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
 const data=await resp.json();if(!resp.ok)throw Error(data.error||"Falha na consulta do catálogo WMS");
 if(ativo){setToken(session.access_token);setLocais(data.locais||[]);setMateriais(data.materiais||[]);setAutorizados(data.tecnicos||[]);}
 }catch(e){if(ativo){setLocais([]);setMateriais([]);setAutorizados([]);setErro(e instanceof Error?e.message:"Erro de conexão");}}finally{if(ativo)setCarregando(false)}}void carregar();return()=>{ativo=false}},[tentativa]);
 const origens=locais.filter(l=>l.tipo==="cd"||l.tipo==="ponto_apoio");const destinos=locais.filter(l=>l.id!==origem);
 const destinoSelecionado=useMemo(()=>locais.find(l=>l.id===destino),[locais,destino]);
 const destinoHabilitado=!!destinoSelecionado&&destinoSelecionado.tipo==="estoque_tecnico"&&!!destinoSelecionado.responsavel_usuario_id&&autorizados.includes(destinoSelecionado.responsavel_usuario_id)&&origem!==destino;
 async function enviar(e:React.FormEvent){e.preventDefault();setErro("");setSucesso("");if(enviando)return;
 if(!destinoHabilitado){setErro("Selecione um estoque técnico válido como destino.");return;}
 const qtd=Number(quantidade);if(!origem||!material||!Number.isFinite(qtd)||qtd<=0){setErro("Selecione origem, material e quantidade válida.");return;}
 setEnviando(true);try{const chave=crypto.randomUUID();const interna=locais.find(l=>l.id===origem)?.tipo==="ponto_apoio";const resp=await fetch(interna?"/api/estoque-wms/transferencia-interna":"/api/estoque-wms/transferencia",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(interna?{acao:"criar",organizacao_id:org,origem_id:origem,destino_id:destino,material_id:material,quantidade:qtd,chave_idempotencia:chave}:{organizacao_id:org,cd_id:origem,tecnico_usuario_id:destinoSelecionado!.responsavel_usuario_id,material_id:material,quantidade:qtd,chave_idempotencia:chave})});const data=await resp.json();if(!resp.ok)throw Error(data.detalhe||data.error||"Operação não autorizada");setSucesso(interna?`Transferência ${data.codigo||""} enviada ao coletor do técnico. Aguardando aceite.`:`Transferência registrada. Movimento: ${data.movimentacao_id||"confirmado"}`);setQuantidade("");}catch(e){setErro(e instanceof Error?e.message:"Falha na transferência")}finally{setEnviando(false)}}
 return <main className={styles.root}>
 <header className={styles.hero}><div className={styles.heroText}><div className={styles.kicker}><span className={styles.kickerIcon}><ArrowLeftRight size={15}/></span> OPERAÇÕES LOGÍSTICAS <span className={styles.kickerLine}/></div><h1>Transferência <span>de Estoque</span></h1><p>Controle de movimentações entre centros de distribuição, unidades de apoio e estoques técnicos, com rastreabilidade ponta a ponta.</p><div className={styles.heroTags}><span><ShieldCheck size={13}/> Segurança transacional</span><span><Database size={13}/> Inventário WMS</span><span><ClipboardCheck size={13}/> Auditoria integrada</span></div></div><div className={styles.heroArt} aria-hidden="true"><div className={styles.orbit}><Warehouse size={35}/></div><span className={styles.artLine}/><div className={styles.orbitSmall}><Truck size={24}/></div><div className={styles.artLabel}>FLUXO DE MATERIAIS <strong>CD → DESTINO</strong></div></div></header>
 {erro&&<section role="alert" className={styles.catalogAlert}><div className={styles.catalogAlertIcon}><AlertTriangle size={20}/></div><div className={styles.catalogAlertText}><strong>Não foi possível carregar o catálogo WMS</strong><p>{erro}</p><small>Os indicadores e a transferência ficam indisponíveis até a consulta ser restabelecida. Nenhum estoque foi alterado.</small></div><button className={styles.retryButton} type="button" disabled={carregando} onClick={()=>setTentativa(v=>v+1)}><RefreshCw size={15}/> {carregando?"Consultando...":"Tentar novamente"}</button></section>}
 <div className={styles.sectionLabel}><span>VISÃO GERAL</span><div/></div>
 <section className={styles.metrics} aria-label="Indicadores de estoque">
 <div className={styles.metric}><div className={styles.metricTop}><span>Centros de distribuição</span><span className={styles.metricIcon}><Warehouse size={19}/></span></div><strong>{carregando||erro?"—":origens.length}</strong><small>Unidades de origem</small></div>
 <div className={styles.metric}><div className={styles.metricTop}><span>Mini-CDs e depósitos</span><span className={styles.metricIcon}><Building2 size={19}/></span></div><strong>{carregando||erro?"—":locais.filter(l=>l.tipo==="ponto_apoio").length}</strong><small>Unidades de apoio</small></div>
 <div className={styles.metric}><div className={styles.metricTop}><span>Estoques técnicos</span><span className={styles.metricIcon}><Boxes size={19}/></span></div><strong>{carregando||erro?"—":locais.filter(l=>l.tipo==="estoque_tecnico").length}</strong><small>Posições individuais</small></div>
 <div className={styles.metric}><div className={styles.metricTop}><span>Materiais cadastrados</span><span className={styles.metricIcon}><Package size={19}/></span></div><strong>{carregando||erro?"—":materiais.length}</strong><small>Itens do catálogo</small></div>
 </section>
 <div className={styles.sectionLabel}><span>EXECUÇÃO OPERACIONAL</span><div/></div>
 <div className={styles.layout}>
 <section className={styles.panel}><div className={styles.panelHeading}><div className={styles.panelSymbol}><ArrowLeftRight size={22}/></div><div><span className={styles.overline}>MOVIMENTAÇÃO INTERNA</span><h2>Nova transferência</h2><p>Preencha os dados para registrar a saída e a entrada do material.</p></div><span className={styles.step}>01 / 02</span></div>
 <form onSubmit={enviar}><div className={styles.fields}>
 <label><span className={styles.fieldLabel}><Warehouse size={15}/> Local de origem</span><select value={origem} onChange={e=>{setOrigem(e.target.value);setDestino("")}} required><option value="">Selecione CD, mini-CD ou depósito de origem</option>{origens.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
 <label><span className={styles.fieldLabel}><MapPin size={15}/> Local de destino</span><select value={destino} onChange={e=>setDestino(e.target.value)} required><option value="">Selecione o destino</option>{destinos.map(l=><option key={l.id} value={l.id}>{l.nome} · {l.tipo==="estoque_tecnico"?"Técnico":l.tipo==="ponto_apoio"?"Mini-CD / Depósito":l.tipo.toUpperCase()}</option>)}</select></label>
 <label className={styles.full}><span className={styles.fieldLabel}><Package size={15}/> Material</span><select value={material} onChange={e=>setMaterial(e.target.value)} required><option value="">Selecione o material</option>{materiais.map(m=><option key={m.id} value={m.id}>{m.sku} — {m.descricao}</option>)}</select></label>
 <label><span className={styles.fieldLabel}><Layers3 size={15}/> Quantidade</span><input type="number" min="0.001" step="any" value={quantidade} onChange={e=>setQuantidade(e.target.value)} placeholder="Informe a quantidade" required/></label>
 </div>
 {destinoSelecionado&&!destinoHabilitado&&<div className={styles.notice}><AlertTriangle size={17}/><span>Selecione um estoque técnico vinculado a um usuário autorizado.</span></div>}
 <div className={styles.actions}><div className={styles.actionNote}><LockKeyhole size={15}/> Sujeito a saldo e permissão de acesso</div><button type="submit" disabled={carregando||!!erro||enviando||!token||!destinoHabilitado}>{enviando?<RefreshCw size={17}/>:<ArrowLeftRight size={17}/>} {enviando?"Registrando transferência...":"Confirmar transferência"} <ArrowRight size={17}/></button></div></form>
 </section>
 <aside className={styles.reviewPanel}><div className={styles.reviewHead}><div className={styles.panelSymbolAlt}><ClipboardCheck size={22}/></div><div><span className={styles.overline}>VALIDAÇÃO OPERACIONAL</span><h2>Conferência</h2><p>Revise antes de confirmar</p></div></div>
 <div className={styles.summary}><div><span><Warehouse size={14}/> Origem</span><strong>{locais.find(l=>l.id===origem)?.nome||"Aguardando seleção"}</strong></div><div><span><MapPin size={14}/> Destino</span><strong>{destinoSelecionado?.nome||"Aguardando seleção"}</strong></div><div><span><Package size={14}/> Material</span><strong>{materiais.find(m=>m.id===material)?.descricao||"Aguardando seleção"}</strong></div><div><span><Layers3 size={14}/> Quantidade</span><strong>{quantidade||"—"}</strong></div></div>
 <div className={styles.security}><div className={styles.securityTitle}><ShieldCheck size={18}/> Proteções ativas</div><span><CircleCheck size={14}/> Estoque controlado pelo WMS</span><span><CircleCheck size={14}/> Validação de saldo na origem</span><span><CircleCheck size={14}/> Movimentação auditável</span></div>
 <div className={styles.reviewFoot}><LockKeyhole size={14}/> Operação segura e rastreável</div>
 </aside></div>
 {carregando&&<p role="status" className={styles.info}><RefreshCw size={16}/> Carregando cadastros WMS...</p>}{sucesso&&<p role="status" className={styles.success}><CircleCheck size={16}/>{sucesso}</p>}
 </main>;
}

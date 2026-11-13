"use client";
import {useCallback,useEffect,useRef,useState,type ChangeEvent} from "react";
import {atelSupabase} from "@/lib/atelSupabaseV08";
import {guardarFotoPendenteV1581,listarFotosPendentesV1581,excluirFotoPendenteV1581,type FotoPendenteV1581} from "@/lib/atelOsChecklistOfflineV1581";
import "./atel-relatorio-fotografico-v1595.css";

type Foto={id:string;nome_arquivo:string;criado_em:string;url:string|null};
type FotoInfo={descricao:string;numeroSerie:string};
type Relatorio={observacao:string;detalhesFotos:Record<string,FotoInfo>};
type Consulta={registro:{id:string;situacao:string;atualizada_em:string}|null;relatorio:Relatorio;fotos:Foto[]};
const VAZIO:Relatorio={observacao:"",detalhesFotos:{}};
async function tokenUsuario(){
 const sb=atelSupabase();if(!sb)throw new Error("ATEL não configurado.");
 const {data:{session}}=await sb.auth.getSession();
 if(!session?.access_token||!session.user?.id)throw new Error("Sessão expirada. Entre novamente.");
 return {token:session.access_token,usuario:session.user.id};
}
async function chamada<T>(url:string,token:string,init:RequestInit={}):Promise<T>{
 const h=new Headers(init.headers);h.set("Authorization",`Bearer ${token}`);
 if(typeof init.body==="string")h.set("Content-Type","application/json");
 const res=await fetch(url,{...init,headers:h,cache:"no-store"});
 const payload=await res.json().catch(()=>({error:"Resposta inesperada."})) as {error?:string};
 if(!res.ok)throw new Error(payload.error||`Falha HTTP ${res.status}`);
 return payload as T;
}
function seguro(v:unknown):Relatorio{
 if(!v||typeof v!=="object")return VAZIO;
 const r=v as Partial<Relatorio>;
 return {observacao:typeof r.observacao==="string"?r.observacao:"",detalhesFotos:r.detalhesFotos&&typeof r.detalhesFotos==="object"&&!Array.isArray(r.detalhesFotos)?r.detalhesFotos:{}};
}
export default function AtelRelatorioFotograficoV1595({atendimento,etapa}:{atendimento:number;etapa:string}){
 const [dados,setDados]=useState<Relatorio>(VAZIO),[fotos,setFotos]=useState<Foto[]>([]);
 const [pendentes,setPendentes]=useState<FotoPendenteV1581[]>([]);
 const [carregando,setCarregando]=useState(true),[ocupado,setOcupado]=useState(false);
 const [submetido,setSubmetido]=useState(false),[erro,setErro]=useState(""),[info,setInfo]=useState("");
 const [revisao,setRevisao]=useState(0),[sincronizado,setSincronizado]=useState(true);
 const chave=useRef(""),escopo=useRef(""),fotoBusy=useRef(false),montado=useRef(true);
 const ultima=useRef<Relatorio>(VAZIO);
 const editar=(proximo:Relatorio)=>{
  ultima.current=proximo;setDados(proximo);setSincronizado(false);setRevisao(n=>n+1);
  if(chave.current){try{localStorage.setItem(chave.current,JSON.stringify({alteradoEm:Date.now(),dados:proximo}));}catch{setErro("Não foi possível guardar as alterações no dispositivo.");}}
 };
 const recarregar=useCallback(async(guardarFormulario=true)=>{
  const {token,usuario}=await tokenUsuario();
  const ck=`atel:v1595:foto:${usuario}:${atendimento}`;
  const localScope=`atel:v1595:${usuario}:${atendimento}`;
  chave.current=ck;escopo.current=localScope;
  const res=await chamada<Consulta>(`/api/os-relatorio-fotografico-v1595?atendimento=${atendimento}`,token);
  if(!montado.current)return;
  setFotos(res.fotos||[]);setSubmetido(res.registro?.situacao==="SUBMETIDO");
  const server=seguro(res.relatorio);let atual=server;
  if(guardarFormulario&&res.registro?.situacao!=="SUBMETIDO"){
   try{
    const raw=localStorage.getItem(ck);if(raw){const loc=JSON.parse(raw) as {alteradoEm?:number;dados?:Relatorio};
     const serverTs=res.registro?.atualizada_em?new Date(res.registro.atualizada_em).getTime():0;
     if((loc.alteradoEm??0)>serverTs&&loc.dados)atual=seguro(loc.dados);
    }
   }catch{/* Servidor continua como fonte validada. */}
  }
  if(guardarFormulario){ultima.current=atual;setDados(atual);setSincronizado(JSON.stringify(atual)===JSON.stringify(server)||res.registro?.situacao==="SUBMETIDO");}
  try{setPendentes(await listarFotosPendentesV1581(localScope));}catch{/* O aviso sera exibido ao tentar anexar. */}
 },[atendimento]);
 useEffect(()=>{montado.current=true;setCarregando(true);setErro("");setInfo("");
  void recarregar().catch(e=>{if(montado.current)setErro(e instanceof Error?e.message:"Relatório indisponível.");}).finally(()=>{if(montado.current)setCarregando(false)});
  return()=>{montado.current=false};
 },[recarregar]);
 const salvar=useCallback(async(silencioso=false)=>{
  const snapshot=ultima.current;
  const {token}=await tokenUsuario();
  await chamada(`/api/os-relatorio-fotografico-v1595`,token,{method:"PUT",body:JSON.stringify({atendimento,relatorio:snapshot})});
  if(JSON.stringify(ultima.current)===JSON.stringify(snapshot)){
   setSincronizado(true);if(chave.current){try{localStorage.removeItem(chave.current)}catch{/*ignore*/}}
  }
  if(!silencioso)setInfo("Rascunho sincronizado. Nenhuma finalização foi executada.");
 },[atendimento]);
 useEffect(()=>{
  if(carregando||submetido||sincronizado||!chave.current)return;
  const handle=window.setTimeout(()=>void salvar(true).catch(()=>{/* preservado em localStorage */}),1800);
  return()=>clearTimeout(handle);
 },[revisao,carregando,submetido,sincronizado,salvar]);
 const enviarFila=useCallback(async()=>{
  if(fotoBusy.current||submetido||!escopo.current)return;
  if(!navigator.onLine)return;
  fotoBusy.current=true;setOcupado(true);
  try{
   await salvar(true); // Cria a execução antes do primeiro upload.
   const {token}=await tokenUsuario();
   const fila=await listarFotosPendentesV1581(escopo.current);
   for(const f of fila){
    const form=new FormData();form.set("atendimento",String(atendimento));form.set("tipo","ENCERRAMENTO");
    form.set("arquivo",new File([f.arquivo],f.nome,{type:f.mime}));
    await chamada(`/api/os-checklists-v158/evidencias`,token,{method:"POST",body:form});
    await excluirFotoPendenteV1581(f.id);
   }
   await recarregar(false);setInfo("Fotografias sincronizadas com o ATEL.");setErro("");
  }catch(e){setErro((e instanceof Error?e.message:"Falha no envio.")+" A foto pendente continua guardada neste dispositivo.");
    try{setPendentes(await listarFotosPendentesV1581(escopo.current))}catch{/* ignore */}
  }finally{fotoBusy.current=false;setOcupado(false)}
 },[atendimento,salvar,recarregar,submetido]);
 useEffect(()=>{
  if(carregando||submetido||!pendentes.length)return;
  const onOnline=()=>void enviarFila();
  window.addEventListener("online",onOnline);
  return()=>window.removeEventListener("online",onOnline);
 },[carregando,submetido,pendentes.length,enviarFila]);
 async function adicionarFotos(e:ChangeEvent<HTMLInputElement>){
  const files=Array.from(e.target.files??[]);e.target.value="";
  if(!files.length||submetido)return;
  if(files.length+fotos.length+pendentes.length>8){setErro("Máximo de 8 fotografias por OS.");return;}
  if(!escopo.current){setErro("Aguarde o carregamento da OS antes de anexar.");return;}
  try{
   for(const f of files){if(f.size<1||f.size>5242880||!["image/jpeg","image/png","image/webp"].includes(f.type))throw new Error("Use JPG, PNG ou WebP até 5 MB.");
    await guardarFotoPendenteV1581({id:crypto.randomUUID(),escopo:escopo.current,nome:f.name,mime:f.type,criadaEm:Date.now(),arquivo:f});
   }
   setPendentes(await listarFotosPendentesV1581(escopo.current));setErro("");setInfo("Fotos protegidas no dispositivo. Enviando para o ATEL...");
   void enviarFila();
  }catch(err){setErro(err instanceof Error?err.message:"Não foi possível salvar a foto no dispositivo.");}
 }
 async function apagarFoto(id:string){
  if(submetido||ocupado)return;if(!confirm("Excluir esta foto da OS?"))return;
  setOcupado(true);
  try{const {token}=await tokenUsuario();await chamada(`/api/os-checklists-v158/evidencias?atendimento=${atendimento}&tipo=ENCERRAMENTO&id=${id}`,token,{method:"DELETE"});
   const next={...ultima.current,detalhesFotos:{...ultima.current.detalhesFotos}};delete next.detalhesFotos[id];editar(next);
   setFotos(prev=>prev.filter(f=>f.id!==id));setInfo("Evidência excluída.");
  }catch(e){setErro(e instanceof Error?e.message:"Não foi possível excluir.");}finally{setOcupado(false)}
 }
 async function concluir(){
  if(submetido||ocupado)return;
  if(!fotos.length){setErro("Anexe ao menos uma fotografia antes de concluir o relatório.");return;}
  if(pendentes.length){setErro("Envie todas as fotos pendentes antes de concluir.");return;}
  if(!confirm("Concluir relatório fotográfico desta OS? As evidências ficarão disponíveis à gestão e não poderão mais ser alteradas."))return;
  setOcupado(true);setErro("");setInfo("");
  try{await salvar(true);const {token}=await tokenUsuario();await chamada(`/api/os-relatorio-fotografico-v1595`,token,{method:"POST",body:JSON.stringify({atendimento})});
   setSubmetido(true);setSincronizado(true);if(chave.current){try{localStorage.removeItem(chave.current)}catch{/*ignore*/}}
   setInfo("Relatório fotográfico concluído. O PDF já está disponível na gestão da OS.");
  }catch(e){setErro(e instanceof Error?e.message:"Não foi possível concluir.");}finally{setOcupado(false)}
 }
 // ATEL_E1_V160_1_SINCRONIZAR_RASCUNHO: salva qualquer texto opcional pendente antes de validar a finalizacao.
 useEffect(()=>{
  const preparar=(evento:Event)=>{
   const detalhe=(evento as CustomEvent<{atendimento:number;aceitar:(tarefa:Promise<void>)=>void}>).detail;
   if(!detalhe||detalhe.atendimento!==atendimento||typeof detalhe.aceitar!=="function")return;
   const tarefa=(async()=>{
    if(carregando||ocupado||fotoBusy.current||pendentes.length>0)throw new Error("Aguarde a sincronização das fotografias antes de finalizar a OS.");
    if(!submetido&&!sincronizado)await salvar(true);
   })();
   detalhe.aceitar(tarefa);
  };
  window.addEventListener("atel:preparar-relatorio-v1601",preparar);
  return()=>window.removeEventListener("atel:preparar-relatorio-v1601",preparar);
 },[atendimento,carregando,ocupado,pendentes.length,submetido,sincronizado,salvar]);
 if(etapa!=="ATENDIMENTO")return null;
 return <section className="atel-v1595-report" aria-label="Relatório fotográfico final da OS">
  <div className="atel-v1595-report-title"><div><span>DOCUMENTAÇÃO DA EXECUÇÃO</span><strong>Relatório Fotográfico Final</strong></div><b className={submetido?"done":""}>{submetido?"CONCLUÍDO":`${fotos.length}/8 fotos`}</b></div>
  <p className="atel-v1595-report-sub">Registre as condições finais do local, os equipamentos instalados ou retirados e seus números de série, quando aplicável.</p>
  {carregando&&<p className="atel-v1595-msg">Recuperando fotos e rascunho...</p>}
  <div className="atel-v1595-report-body">
   <label className="atel-v1595-label" htmlFor={`atel-foto-obs-${atendimento}`}>Descrição geral do serviço <small>(opcional)</small></label>
   <textarea id={`atel-foto-obs-${atendimento}`} disabled={carregando||submetido||ocupado} value={dados.observacao} onChange={e=>editar({...ultima.current,observacao:e.target.value})} maxLength={3000} rows={3} placeholder="Ex.: ponto instalado, condições do ambiente, ajustes e observações relevantes." />
   <div className="atel-v1595-label">Fotografias e equipamentos</div>
   {fotos.map(f=>{const m=dados.detalhesFotos[f.id]??{descricao:"",numeroSerie:""};return <div className="atel-v1595-photo" key={f.id}>
    <div className="atel-v1595-photo-head">{f.url?<a href={f.url} target="_blank" rel="noopener noreferrer"><img src={f.url} alt={`Foto ${f.nome_arquivo}`}/></a>:<div className="atel-v1595-photo-placeholder">Foto indisponível</div>}
     <div><strong>{f.nome_arquivo}</strong><span>Armazenada no ATEL</span>{!submetido&&<button type="button" onClick={()=>void apagarFoto(f.id)} disabled={ocupado}>Excluir</button>}</div>
    </div>
    <label>O que aparece na foto? <small>(opcional)</small><input disabled={submetido||ocupado} maxLength={350} value={m.descricao} placeholder="Ex.: ONU instalada, roteador, cabeamento, ambiente" onChange={e=>editar({...ultima.current,detalhesFotos:{...ultima.current.detalhesFotos,[f.id]:{...m,descricao:e.target.value}}})}/></label>
    <label>Nº de série / patrimônio <small>(se houver)</small><input disabled={submetido||ocupado} maxLength={120} value={m.numeroSerie} placeholder="Identificação do equipamento" onChange={e=>editar({...ultima.current,detalhesFotos:{...ultima.current.detalhesFotos,[f.id]:{...m,numeroSerie:e.target.value}}})}/></label>
   </div>})}
   {pendentes.map(f=><div className="atel-v1595-pendente" key={f.id}><span>Foto aguardando sincronização: <b>{f.nome}</b></span><button type="button" onClick={()=>void excluirFotoPendenteV1581(f.id).then(()=>listarFotosPendentesV1581(escopo.current)).then(setPendentes)} disabled={ocupado}>Remover</button></div>)}
   {!submetido&&fotos.length+pendentes.length<8&&<label className="atel-v1595-add"><span>＋ ADICIONAR FOTOGRAFIAS</span><small>Câmera ou galeria · Até 8 fotos · 5 MB cada</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={ocupado||carregando} onChange={e=>void adicionarFotos(e)}/></label>}
   {pendentes.length>0&&!submetido&&<button className="atel-v1595-retry" type="button" onClick={()=>void enviarFila()} disabled={ocupado}>REENVIAR FOTOS PENDENTES ({pendentes.length})</button>}
   {erro&&<p className="atel-v1595-error" role="alert">{erro}</p>}
   {info&&<p className="atel-v1595-success" role="status">{info}</p>}
   {!submetido&&!carregando&&<><p className="atel-v1595-hint">Os textos e números de série são opcionais. Ao finalizar a OS, o relatório será concluído automaticamente e o PDF ficará disponível na gestão. Você também pode publicar antecipadamente abaixo.</p>
     <button type="button" className="atel-v1595-finish" disabled={ocupado||pendentes.length>0||!fotos.length} onClick={()=>void concluir()}>{ocupado?"PROCESSANDO...":"CONCLUIR RELATÓRIO FOTOGRÁFICO"}</button></>}
   {submetido&&<p className="atel-v1595-success">Relatório registrado. PDF disponível na gestão da OS. Nenhuma baixa de estoque foi realizada.</p>}
  </div>
 </section>;
}

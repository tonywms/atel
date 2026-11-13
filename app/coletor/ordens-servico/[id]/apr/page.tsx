"use client";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import { guardarFotoPendenteV1581, listarFotosPendentesV1581, excluirFotoPendenteV1581, type FotoPendenteV1581 } from "@/lib/atelOsChecklistOfflineV1581";
import styles from "./apr-v1582.module.css";

type Op={id:string;nome:string};
type ProfissionalAPR={nome:string;funcao:string};
type Modelo={versao:number;estado:string;titulo:string;riscos:Op[];medidas:Op[]};
type Dados={riscos:string[];medidas:string[];nenhum_risco:boolean;riscos_outros:string;medidas_outros:string;observacao:string;resultado:"PENDENTE"|"APTO"|"NAO_APTO";ciencia:boolean;acompanhamento_supervisor:boolean;acompanhamento_sesmt:boolean;profissionais:ProfissionalAPR[];situacao:"RASCUNHO"|"REGISTRADO"};
type Registro=Dados&{id:string;versao:number;atualizado_em:string;modelo_versao:number};
type Foto={id:string;nome_arquivo:string;criado_em:string;url:string|null};
type Carga={modelo:Modelo;andamento:{etapa:string;versao:number};apr:Registro|null;fotos:Foto[]};
const OBSERVACAO_MODELO_APR_V1585="Em conformidade com a alínea 35.4.5 da NR-35 (trabalho em altura), deve ser preenchida sempre que iniciar as atividades, buscando garantir padronização das atividades de risco em altura e nas proximidades de redes elétricas, também em conformidade com a NR-10 (Segurança em Instalações e Serviços com Eletricidade). É vedada toda atividade sem a prévia análise deste procedimento (AR).";
const vazio:Dados={riscos:[],medidas:[],nenhum_risco:false,riscos_outros:"",medidas_outros:"",observacao:"",resultado:"PENDENTE",ciencia:false,acompanhamento_supervisor:false,acompanhamento_sesmt:false,profissionais:[{nome:"",funcao:""}],situacao:"RASCUNHO"};
function isObj(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v);}
function toForm(v:unknown):Dados{if(!isObj(v))return {...vazio};return {
 riscos:Array.isArray(v.riscos)?v.riscos.filter(x=>typeof x==="string"):[],
 medidas:Array.isArray(v.medidas)?v.medidas.filter(x=>typeof x==="string"):[],
 nenhum_risco:v.nenhum_risco===true,riscos_outros:typeof v.riscos_outros==="string"?v.riscos_outros:"",
 medidas_outros:typeof v.medidas_outros==="string"?v.medidas_outros:"",observacao:typeof v.observacao==="string"?v.observacao:"",
 resultado:v.resultado==="APTO"||v.resultado==="NAO_APTO"?v.resultado:"PENDENTE",ciencia:v.ciencia===true,
 acompanhamento_supervisor:v.acompanhamento_supervisor===true,acompanhamento_sesmt:v.acompanhamento_sesmt===true,
 profissionais:Array.isArray(v.profissionais)&&v.profissionais.length?v.profissionais.slice(0,6).filter(isObj).map(p=>({nome:typeof p.nome==="string"?p.nome:"",funcao:typeof p.funcao==="string"?p.funcao:""})):[{nome:"",funcao:""}],
 situacao:v.situacao==="REGISTRADO"?"REGISTRADO":"RASCUNHO"};}
async function api<T>(url:string,init:RequestInit={}):Promise<T>{
 const sb=atelSupabase();if(!sb)throw new Error("Supabase não configurado.");
 const {data:{session}}=await sb.auth.getSession();if(!session?.access_token)throw new Error("Sessão expirada. Faça login novamente.");
 const headers=new Headers(init.headers);headers.set("Authorization",`Bearer ${session.access_token}`);
 if(typeof init.body==="string")headers.set("Content-Type","application/json");
 const res=await fetch(url,{...init,headers,cache:"no-store"});
 const b:unknown=await res.json().catch(()=>null);
 if(!res.ok)throw new Error(isObj(b)&&typeof b.error==="string"?b.error:"Não foi possível comunicar com o servidor.");
 return b as T;
}
export default function AprOsV1582Page(){
 const router=useRouter(),params=useParams();const id=Number(Array.isArray(params.id)?params.id[0]:params.id);
 const conteudoRef=useRef<HTMLDivElement|null>(null);
 const [passo,setPasso]=useState(0),[modelo,setModelo]=useState<Modelo|null>(null),[etapa,setEtapa]=useState("PENDENTE"),[etapaVersao,setEtapaVersao]=useState(0);
 const [draft,setDraft]=useState<Dados>(vazio),[reg,setReg]=useState<Registro|null>(null),[fotos,setFotos]=useState<Foto[]>([]),[pendentes,setPendentes]=useState<FotoPendenteV1581[]>([]);
 const [carregando,setCarregando]=useState(true),[ocupado,setOcupado]=useState(false),[subindo,setSubindo]=useState(false);
 // ATEL_E1_V159_2_APR_FLUXO_APTO_EPI: confirmar antes de registrar APR apta e alterar etapa da OS.
 const [confirmarInicio,setConfirmarInicio]=useState(false);
 const [erro,setErro]=useState(""),[aviso,setAviso]=useState(""),[alterado,setAlterado]=useState(false),[revisao,setRevisao]=useState(0);
 const chaveRef=useRef(""),fotoEscopoRef=useRef(""),dadosRef=useRef<Dados>(vazio),versaoRef=useRef(0),revisaoRef=useRef(0),salvandoRef=useRef<Promise<boolean>|null>(null),subindoRef=useRef(false),ativoRef=useRef(true);
 const endereco=`/coletor/ordens-servico/${id}?origem=erp`;
 const guardarLocal=useCallback((dados:Dados,dirty:boolean)=>{if(!chaveRef.current)return;
  try{window.localStorage.setItem(chaveRef.current,JSON.stringify({esquema:2,alterado:dirty,form:dados,ts:Date.now()}));}
  catch{setErro("Armazenamento local cheio ou bloqueado. Libere espaço no navegador antes de sair da APR.");}
 },[]);
 function mudar(atualiza:(d:Dados)=>Dados){
  const prox={...atualiza(dadosRef.current),situacao:"RASCUNHO" as const};
  dadosRef.current=prox;setDraft(prox);revisaoRef.current++;setRevisao(revisaoRef.current);setAlterado(true);
  guardarLocal(prox,true);setAviso("");
 }
 async function carregar(){
  if(!Number.isSafeInteger(id)||id<=0){setErro("OS inválida.");setCarregando(false);return;}
  setCarregando(true);setErro("");
  try{
   const sb=atelSupabase();if(!sb)throw new Error("Configuração do ATEL indisponível.");
   const {data:{session}}=await sb.auth.getSession();if(!session?.user?.id)throw new Error("Sessão expirada.");
   const localKey=`atel:os:apr:v1582:${session.user.id}:${id}`;
   chaveRef.current=localKey;fotoEscopoRef.current=`atel:os:apr:fotos:v1582:${session.user.id}:${id}`;
   let cache:{form:Dados;alterado:boolean}|null=null;
   try{const raw=window.localStorage.getItem(localKey);const parsed:unknown=raw?JSON.parse(raw):null;
    if(isObj(parsed)&&parsed.esquema===2&&isObj(parsed.form))cache={form:toForm(parsed.form),alterado:parsed.alterado===true};}catch{/* servidor ainda pode recuperar */}
   if(cache){dadosRef.current=cache.form;setDraft(cache.form);setAlterado(cache.alterado);}
   try{setPendentes(await listarFotosPendentesV1581(fotoEscopoRef.current));}catch{/* browser pode negar IndexedDB */}
   const d=await api<Carga>(`/api/os-apr-v1582?atendimento=${id}`);
   if(!d||!d.modelo||!Array.isArray(d.modelo.riscos)||!Array.isArray(d.modelo.medidas))throw new Error("Modelo de APR incompleto.");
   if(!ativoRef.current)return;
   setModelo(d.modelo);setEtapa(d.andamento.etapa);setEtapaVersao(d.andamento.versao);setReg(d.apr);setFotos(d.fotos||[]);versaoRef.current=d.apr?.versao||0;
   if(!cache?.alterado||d.apr?.situacao==="REGISTRADO"){const remoto=toForm(d.apr||vazio);dadosRef.current=remoto;setDraft(remoto);setAlterado(false);guardarLocal(remoto,false);}
   else setAviso("Rascunho local recuperado. As alterações ainda não sincronizadas foram preservadas.");
  }catch(e){setErro(e instanceof Error?e.message:"Falha ao carregar a APR. O rascunho local, quando existente, foi preservado.");}
  finally{if(ativoRef.current)setCarregando(false);}
 }
 useEffect(()=>{ativoRef.current=true;void carregar();return()=>{ativoRef.current=false;};/* Só muda ao abrir outra OS */},[id]);
 const sincronizar=useCallback(async(registrar=false):Promise<boolean>=>{
  // Nunca salvar um rascunho por cima de uma APR ja registrada.
  if(!registrar&&dadosRef.current.situacao==="REGISTRADO")return true;
  if(salvandoRef.current){await salvandoRef.current;if(!registrar&&!alterado)return true;}
  if(!modelo||etapa!=="NO_CLIENTE"){setErro("A APR pode ser registrada somente após a chegada ao cliente.");return false;}
  if(typeof navigator!=="undefined"&&!navigator.onLine){setAviso("Sem internet. Rascunho preservado neste dispositivo.");return false;}
  const snapshot={...dadosRef.current,situacao:registrar?"REGISTRADO" as const:"RASCUNHO" as const};
  const inicio=revisaoRef.current;
  const tarefa=(async()=>{
    try{
      const resultado=await api<{apr:Registro}>("/api/os-apr-v1582",{method:"PUT",body:JSON.stringify({atendimento:id,modeloVersao:modelo.versao,versao:versaoRef.current,...snapshot})});
      if(!resultado.apr||typeof resultado.apr.id!=="string")throw new Error("Resposta de sincronização inválida.");
      versaoRef.current=resultado.apr.versao;setReg(resultado.apr);
      if(revisaoRef.current===inicio){dadosRef.current=snapshot;setDraft(snapshot);setAlterado(false);guardarLocal(snapshot,false);}
      setErro("");setAviso(registrar?(snapshot.resultado==="APTO"?"APR registrada. O início do atendimento já pode ser solicitado.":"Local não apto registrado. O atendimento permanece bloqueado."):"Rascunho salvo automaticamente no ATEL. Para concluir, use o botão CONCLUIR APR.");
      return true;
    }catch(e){setErro((e instanceof Error?e.message:"Falha de sincronização.")+" O rascunho local permanece preservado.");return false;}
  })();
  salvandoRef.current=tarefa;
  try{return await tarefa;}finally{if(salvandoRef.current===tarefa)salvandoRef.current=null;}
 },[modelo,etapa,id,guardarLocal,alterado]);
 useEffect(()=>{if(!modelo||!alterado||etapa!=="NO_CLIENTE"||ocupado||dadosRef.current.situacao==="REGISTRADO")return;
  const t=window.setTimeout(()=>{void sincronizar(false);},2500);return()=>window.clearTimeout(t);
 },[revisao,modelo,alterado,etapa,sincronizar,ocupado]);
 const enviarFotos=useCallback(async()=>{
  if(subindoRef.current||!fotoEscopoRef.current||etapa!=="NO_CLIENTE"||(typeof navigator!=="undefined"&&!navigator.onLine))return;
  subindoRef.current=true;setSubindo(true);const escopo=fotoEscopoRef.current;
  try{
   let lista=await listarFotosPendentesV1581(escopo);if(!lista.length)return;
   const salvou=await sincronizar(false);if(!salvou)return;
   for(const foto of lista){
    const form=new FormData();form.set("atendimento",String(id));form.set("arquivo",foto.arquivo,foto.nome);
    try{
     const resposta=await api<{evidencia:Foto}>("/api/os-apr-v1582/evidencias",{method:"POST",body:form});
     if(!resposta.evidencia?.id)break;
     await excluirFotoPendenteV1581(foto.id);
     setFotos(f=>[resposta.evidencia,...f.filter(x=>x.id!==resposta.evidencia.id)]);
    }catch(e){setErro((e instanceof Error?e.message:"Falha no envio de fotos.")+" Foto mantida no dispositivo para nova tentativa.");break;}
   }
   lista=await listarFotosPendentesV1581(escopo);setPendentes(lista);
  }catch(e){setErro((e instanceof Error?e.message:"Falha na fila de fotos.")+" As evidências locais não foram descartadas.");}
  finally{setSubindo(false);subindoRef.current=false;}
 },[etapa,id,sincronizar]);
 useEffect(()=>{const onOnline=()=>{if(alterado)void sincronizar(false).then(()=>enviarFotos());else void enviarFotos();};window.addEventListener("online",onOnline);return()=>window.removeEventListener("online",onOnline);},[sincronizar,enviarFotos]);
 async function escolherFotos(e:ChangeEvent<HTMLInputElement>){
  const arquivos=Array.from(e.currentTarget.files||[]);e.currentTarget.value="";
  if(!fotoEscopoRef.current||!arquivos.length)return;
  if(fotos.length+pendentes.length+arquivos.length>8){setErro("A APR permite no máximo 8 fotos, incluindo as ainda pendentes.");return;}
  for(const f of arquivos){
   if(!["image/jpeg","image/png","image/webp"].includes(f.type)||f.size>5242880||f.size<100){setErro("Somente fotos JPG, PNG ou WebP de até 5 MB.");continue;}
   try{const foto:FotoPendenteV1581={id:crypto.randomUUID(),escopo:fotoEscopoRef.current,nome:f.name,mime:f.type,criadaEm:Date.now(),arquivo:f};
    await guardarFotoPendenteV1581(foto);}catch{setErro("Não foi possível guardar a foto no dispositivo. Verifique o armazenamento disponível.");}
  }
  try{setPendentes(await listarFotosPendentesV1581(fotoEscopoRef.current));}catch{/* o erro ja foi indicado */}
  void enviarFotos();
 }
 async function removerPendente(fotoId:string){
  try{await excluirFotoPendenteV1581(fotoId);setPendentes(await listarFotosPendentesV1581(fotoEscopoRef.current));setAviso("Foto pendente descartada deste dispositivo.");}
  catch{setErro("Não foi possível descartar a foto pendente.");}
 }
 async function excluirFotoServidor(foto:Foto){
  if(!window.confirm(`Excluir a foto "${foto.nome_arquivo}" desta APR?`))return;
  try{await api(`/api/os-apr-v1582/evidencias?atendimento=${id}&id=${encodeURIComponent(foto.id)}`,{method:"DELETE"});
   setFotos(prev=>prev.filter(x=>x.id!==foto.id));setAviso("Foto excluída do rascunho no ATEL.");}
  catch(e){setErro(e instanceof Error?e.message:"Falha ao excluir a foto.");}
 }
 async function atualizarLinksFotos(){try{const r=await api<Carga>(`/api/os-apr-v1582?atendimento=${id}`);setFotos(r.fotos||[]);setAviso("Evidências atualizadas.");}
  catch(e){setErro(e instanceof Error?e.message:"Não foi possível atualizar os links das fotos.");}}
 /* ATEL_E1_V158_7_APR_CONCLUSAO_CLARA: validacao preventiva espelha o contrato da API. */
 function conferirConclusao():string|null{
  const d=dadosRef.current;
  if(!d.nenhum_risco && d.riscos.length===0)return "Confirme os riscos identificados ou marque que nenhum risco foi identificado.";
  if(d.nenhum_risco && d.riscos.length>0)return "Selecione riscos ou nenhum risco, nunca ambos.";
  if(d.riscos.includes("outros") && !d.riscos_outros.trim())return "Descreva os outros riscos selecionados.";
  if(d.medidas.includes("outros") && !d.medidas_outros.trim())return "Descreva as outras medidas EPI/EPC selecionadas.";
  const pessoas=d.profissionais;
  if(!pessoas.length || pessoas.some(p=>!p.nome.trim()||!p.funcao.trim()))return "Identifique pelo menos um profissional com nome completo e função; preencha também todos os profissionais adicionados.";
  if(new Set(pessoas.map(p=>p.nome.trim().toLocaleLowerCase("pt-BR"))).size!==pessoas.length)return "Não repita o mesmo profissional na APR.";
  if(d.resultado!=="APTO"&&d.resultado!=="NAO_APTO")return "Selecione o resultado da avaliação: Apto ou Não apto.";
  if(!d.ciencia)return "Marque a confirmação de que avaliou as condições do local e as medidas de controle.";
  if(d.medidas.length===0)return "Selecione ao menos uma medida de controle EPI/EPC para concluir a APR.";
  if(d.resultado==="NAO_APTO"&&d.observacao.trim().length<10)return `Para registrar o impedimento, descreva o motivo em pelo menos 10 caracteres (faltam ${10-d.observacao.trim().length}).`;
  if(d.resultado==="APTO"&&d.riscos.length>0&&d.observacao.trim().length<10)return `Explique as medidas adotadas em pelo menos 10 caracteres (faltam ${10-d.observacao.trim().length}).`;
  return null;
 }
 // ATEL_E1_V159_2_APR_FLUXO_APTO_EPI: tres etapas + confirmacao + transicao apenas apos registro no servidor.
 function solicitarConclusao(){
  setErro("");setAviso("");
  if(ocupado||subindo)return;
  const pendencia=conferirConclusao();
  if(pendencia){setErro(pendencia);requestAnimationFrame(()=>{const el=document.querySelector('[data-atel-apr-v1587-alerta]');el?.scrollIntoView({behavior:"smooth",block:"nearest"});});return;}
  if(pendentes.length>0){setErro("Ha fotos pendentes. Sincronize as evidencias antes de concluir.");return;}
  if(dadosRef.current.resultado==="APTO"){setConfirmarInicio(true);return;}
  void registrar();
 }
 async function registrar(){
  setConfirmarInicio(false);setErro("");setAviso("");
  if(ocupado||subindo)return;
  const pendencia=conferirConclusao();
  if(pendencia){setErro(pendencia);return;}
  if(pendentes.length>0){setErro("Ainda ha fotos pendentes de envio. Sincronize antes de concluir.");return;}
  setOcupado(true);
  try{
   const ok=await sincronizar(true);
   if(!ok)return;
   // A APR, inclusive seu PDF, existe no Supabase antes de alterar a etapa.
   if(dadosRef.current.resultado==="NAO_APTO"){router.replace("/coletor/ordens-servico");return;}
   try{
    const resposta=await api<{etapa:string;versao:number}>("/api/os-andamento",{method:"PUT",body:JSON.stringify({atendimento:id,versao:etapaVersao,destino:"ATENDIMENTO"})});
    if(resposta.etapa!=="ATENDIMENTO")throw new Error("A transição para Atendimento não foi confirmada.");
    setEtapa("ATENDIMENTO");setEtapaVersao(resposta.versao);
    router.replace(endereco);
   }catch(e){
    // Nunca declarar atendimento iniciado sem a confirmacao da API.
    setErro("APR Apta registrada e enviada à gestão, mas o atendimento não foi iniciado: "+(e instanceof Error?e.message:"falha na transicao")+". Volte à OS e use INICIAR ATENDIMENTO; não refaça a APR.");
   }
  }finally{setOcupado(false);}
 }

 function irParaPasso(proximo:number){
  setErro("");setAviso("");setPasso(proximo);
  // Garantia de navegacao no coletor: cada etapa comeca pelo topo.
  requestAnimationFrame(()=>{if(conteudoRef.current)conteudoRef.current.scrollTop=0;});
 }
 function confirmarPasso(){
  if(!modelo||carregando)return;
  if(passo===0){
   if(!draft.nenhum_risco&&draft.riscos.length===0){setErro("Marque pelo menos um risco ou confirme que nenhum risco foi identificado.");return;}
   if(draft.riscos.includes("outros")&&!draft.riscos_outros.trim()){setErro("Descreva os outros riscos antes de confirmar esta etapa.");return;}
   irParaPasso(1);return;
  }
  if(passo===1){
   if(draft.medidas.length===0){setErro("Selecione pelo menos uma medida de controle EPI/EPC antes de confirmar.");requestAnimationFrame(()=>{if(conteudoRef.current)conteudoRef.current.scrollTop=0;});return;}
   if(draft.medidas.includes("outros")&&!draft.medidas_outros.trim()){setErro("Descreva as outras medidas EPI/EPC antes de avançar.");return;}
   irParaPasso(2);
  }
 }
 const profissionaisRegistrados=Array.isArray(reg?.profissionais)&&reg.profissionais.length>0&&reg.profissionais.every(p=>p.nome.trim().length>0&&p.funcao.trim().length>0);
 const ris=draft.riscos.length,con=draft.medidas.length,concluido=reg?.situacao==="REGISTRADO"&&!alterado&&profissionaisRegistrados;
 const destinoSaida=concluido&&reg?.resultado==="NAO_APTO"?"/coletor/ordens-servico":endereco;
 const status=concluido?(reg?.resultado==="APTO"?"REGISTRADA · APTA":"REGISTRADA · NÃO APTA"):alterado?"ALTERAÇÕES LOCAIS":"RASCUNHO";
 const visitavel=etapa==="NO_CLIENTE"&&reg?.situacao!=="REGISTRADO"&&!ocupado;
 return <div className="collector-screen"><div className={`collector-phone ${styles.phone}`}>
   <header className={styles.header}>
     <button type="button" className={styles.back} aria-label="Voltar à OS" onClick={()=>router.push(destinoSaida)}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5m7 7-7-7 7-7"/></svg></button>
     <div className={styles.heading}><small>ORDEM DE SERVIÇO Nº {id}</small><strong>Análise de Risco · APR</strong><span>Segurança antes do atendimento</span></div>
     <span className={styles.shield} aria-hidden="true">♢</span>
   </header>
   <div className={styles.main} ref={conteudoRef} tabIndex={-1}>
     <section className={styles.status}>
      <div><span className={styles.eyebrow}>AVALIAÇÃO DO LOCAL</span><strong>{carregando?"Carregando...":status}</strong></div>
      <span className={styles.statusIcon}>APR</span>
     </section>
     {modelo&&<div className={styles.homolog}>Modelo V{modelo.versao} · Em homologação. O registro documenta a avaliação do técnico e não substitui procedimentos e autorizações de SST.</div>}
     <nav className={styles.steps} aria-label="Progresso guiado da APR">
      {["Riscos","EPI / EPC","Avaliação"].map((titulo,i)=><div key={titulo} aria-current={passo===i?"step":undefined} className={`${styles.step} ${passo===i?styles.stepOn:""} ${i<passo?styles.stepDone:""}`}><span>{i<passo?"✓":i+1}</span><b>{titulo}</b></div>)}
     </nav>
     <div className={styles.guide} role="status"><strong>ETAPA {passo+1} DE 3</strong><span>{passo===0?"Identifique os riscos presentes no local":passo===1?"Confirme as medidas de proteção verificadas":"Registre os profissionais envolvidos, revise as evidências e conclua a avaliação"}</span></div>
     {erro&&<div className={styles.error} role="alert">{erro}</div>}
     {aviso&&<div className={styles.notice} role="status">{aviso}</div>}
     {carregando?<div className={styles.loading}>Consultando APR e rascunhos...</div>:!modelo?<div className={styles.loading}>Modelo não disponível. Retorne à OS e tente novamente.</div>:<>
      {passo===0&&<section className={styles.group}>
       <div className={styles.groupHead}><strong>Riscos Potenciais</strong><span>{ris} selecionado(s)</span></div>
       <p className={styles.help}>Marque os riscos que podem existir no local. Não é necessário marcar todos.</p>
       <label className={`${styles.none} ${draft.nenhum_risco?styles.checked:""}`}><input disabled={!visitavel} type="checkbox" checked={draft.nenhum_risco} onChange={e=>mudar(d=>({...d,nenhum_risco:e.target.checked,riscos:e.target.checked?[]:d.riscos}))}/> Nenhum risco potencial identificado</label>
       <div className={styles.options}>{modelo.riscos.map(op=><label key={op.id} className={`${styles.option} ${draft.riscos.includes(op.id)?styles.checked:""}`}>
        <input disabled={!visitavel} type="checkbox" checked={draft.riscos.includes(op.id)} onChange={e=>mudar(d=>({...d,nenhum_risco:false,riscos:e.target.checked?[...d.riscos,op.id]:d.riscos.filter(x=>x!==op.id)}))}/><span>{op.nome}</span>
       </label>)}</div>
       {draft.riscos.includes("outros")&&<label className={styles.field}>Outros riscos identificados<textarea disabled={!visitavel} maxLength={500} value={draft.riscos_outros} onChange={e=>mudar(d=>({...d,riscos_outros:e.target.value}))} placeholder="Descreva os outros riscos..."/></label>}
      </section>}
      {passo===1&&<section className={styles.group}>
       <div className={styles.groupHead}><strong>Medidas de Controle (EPI/EPC)</strong><span>{con} selecionada(s)</span></div>
       <p className={styles.help}>Marque apenas as medidas efetivamente verificadas para esta atividade.</p>
       <div className={styles.options}>{modelo.medidas.map(op=><label key={op.id} className={`${styles.option} ${draft.medidas.includes(op.id)?styles.checked:""}`}>
        <input disabled={!visitavel} type="checkbox" checked={draft.medidas.includes(op.id)} onChange={e=>mudar(d=>({...d,medidas:e.target.checked?[...d.medidas,op.id]:d.medidas.filter(x=>x!==op.id)}))}/><span>{op.nome}</span>
       </label>)}</div>
       {draft.medidas.includes("outros")&&<label className={styles.field}>Outras medidas de controle<textarea disabled={!visitavel} maxLength={500} value={draft.medidas_outros} onChange={e=>mudar(d=>({...d,medidas_outros:e.target.value}))} placeholder="Descreva as outras medidas..."/></label>}
      </section>}
      {passo===2&&<section className={styles.group}>
       <div className={styles.groupHead}><strong>Avaliação e evidências</strong><span>Passo 3 de 3</span></div>
       <div className={styles.metrics}><div><strong>{ris}</strong><small>Riscos marcados</small></div><div><strong>{con}</strong><small>Medidas marcadas</small></div></div>
       <label className={styles.field}>Observações e medidas adotadas
        <textarea disabled={!visitavel} rows={4} maxLength={3000} value={draft.observacao} onChange={e=>mudar(d=>({...d,observacao:e.target.value}))} placeholder="Descreva o local, as condições identificadas e como os riscos foram controlados ou por que não é seguro prosseguir..."/>
       </label>
       {(draft.resultado==="NAO_APTO" || (draft.resultado==="APTO"&&draft.riscos.length>0)) && draft.observacao.trim().length<10 &&
        <div className={styles.obsAjuda} role="status">Justificativa obrigatória para {draft.resultado==="NAO_APTO"?"impedimento":"riscos controlados"}: mínimo de 10 caracteres. Faltam {10-draft.observacao.trim().length}.</div>}
       <div className={styles.subheading}>Fotos e evidências <span>{fotos.length} enviadas · {pendentes.length} pendente(s)</span></div>
       <label className={styles.upload}><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!visitavel||subindo||concluido} onChange={e=>void escolherFotos(e)}/>
        <span>▣</span><strong>Adicionar fotos</strong><small>JPG, PNG ou WebP · 5 MB cada · até 8</small>
       </label>
       {pendentes.length>0&&<div className={styles.pending}>{pendentes.map(f=><div key={f.id}>⟳ {f.nome} · Envio pendente <button type="button" onClick={()=>void removerPendente(f.id)}>DESCARTAR</button></div>)}<button type="button" onClick={()=>void enviarFotos()} disabled={subindo}>{subindo?"ENVIANDO...":"TENTAR SINCRONIZAR FOTOS"}</button></div>}
       {fotos.length>0&&<button type="button" className={styles.refreshPhotos} onClick={()=>void atualizarLinksFotos()}>ATUALIZAR EVIDÊNCIAS</button>}
       {fotos.length>0&&<div className={styles.photos}>{fotos.map(f=><div key={f.id} className={styles.photo}>{f.url?<a href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={f.nome_arquivo}/></a>:<span>Foto salva</span>}<small title={f.nome_arquivo}>{f.nome_arquivo}</small>{visitavel&&!concluido&&<button type="button" className={styles.removePhoto} onClick={()=>void excluirFotoServidor(f)}>EXCLUIR</button>}</div>)}</div>}
       {/* ATEL_E1_V158_6_PROFISSIONAIS_VISIVEIS: seção dedicada e obrigatória */}
       <section className={styles.profissionaisBloco} aria-label="Identificação dos profissionais envolvidos na APR">
        <div className={styles.profissionaisIntro}>
         <span className={styles.profissionaisIndice}>IDENTIFICAÇÃO OBRIGATÓRIA · APR</span>
         <strong>Profissionais envolvidos na atividade</strong>
         <p>Informe pelo menos um profissional com nome completo e função antes de registrar a avaliação.</p>
        </div>
       <div className={styles.subheading}>Acompanhamento da atividade</div>
       <p className={styles.help}>Marque apenas quem acompanhou a atividade. Não marque automaticamente.</p>
       <div className={styles.acompanhamento}>
        <label className={`${styles.acompanhamentoOpt} ${draft.acompanhamento_supervisor?styles.checked:""}`}>
         <input type="checkbox" disabled={!visitavel} checked={draft.acompanhamento_supervisor} onChange={e=>mudar(d=>({...d,acompanhamento_supervisor:e.target.checked}))}/><span>Acompanhamento do Supervisor</span>
        </label>
        <label className={`${styles.acompanhamentoOpt} ${draft.acompanhamento_sesmt?styles.checked:""}`}>
         <input type="checkbox" disabled={!visitavel} checked={draft.acompanhamento_sesmt} onChange={e=>mudar(d=>({...d,acompanhamento_sesmt:e.target.checked}))}/><span>Acompanhamento do SESMT</span>
        </label>
       </div>
       <div className={styles.subheading}>Identificação dos participantes <span>{draft.profissionais.filter(p=>p.nome.trim()&&p.funcao.trim()).length} identificado(s)</span></div>
       <p className={styles.help}>Identifique pelo menos um profissional, com nome completo e função. Inclua os acompanhantes, quando houver.</p>
       <div className={styles.profissionais}>
        {draft.profissionais.map((p,i)=><div className={styles.profissional} key={i}>
         <span className={styles.profissionalNumero}>Profissional {i+1}</span>
         <label className={styles.profissionalCampo}>Nome completo<input disabled={!visitavel} autoComplete="off" type="text" maxLength={120} value={p.nome} placeholder="Nome e sobrenome" onChange={e=>mudar(d=>({...d,profissionais:d.profissionais.map((x,j)=>j===i?{...x,nome:e.target.value}:x)}))}/></label>
         <label className={styles.profissionalCampo}>Função<input disabled={!visitavel} autoComplete="off" type="text" maxLength={100} value={p.funcao} placeholder="Ex.: Técnico de campo" onChange={e=>mudar(d=>({...d,profissionais:d.profissionais.map((x,j)=>j===i?{...x,funcao:e.target.value}:x)}))}/></label>
         {draft.profissionais.length>1&&visitavel&&<button type="button" className={styles.excluirProfissional} onClick={()=>mudar(d=>({...d,profissionais:d.profissionais.filter((_,j)=>j!==i)}))}>REMOVER PROFISSIONAL</button>}
        </div>)}
       </div>
       {visitavel&&draft.profissionais.length<6&&<button type="button" className={styles.adicionarProfissional} onClick={()=>mudar(d=>({...d,profissionais:[...d.profissionais,{nome:"",funcao:""}]}))}>+ ADICIONAR PROFISSIONAL</button>}
       <div className={styles.notaNormativa}><strong>OBSERVAÇÃO DO MODELO DO CLIENTE</strong><p>{OBSERVACAO_MODELO_APR_V1585}</p></div>
       </section>
       <div className={styles.subheading}>Resultado da avaliação</div>
       <p className={styles.help}>A seleção não equivale a aprovação automática de segurança. Registre sua avaliação real do local.</p>
       <div className={styles.verdicts}>
        <label className={`${styles.verdict} ${draft.resultado==="APTO"?styles.verdictGood:""}`}><input disabled={!visitavel} type="radio" name="apr-resultado" checked={draft.resultado==="APTO"} onChange={()=>mudar(d=>({...d,resultado:"APTO"}))}/><strong>Apto</strong><small>Condições para executar, com controles aplicados</small></label>
        <label className={`${styles.verdict} ${draft.resultado==="NAO_APTO"?styles.verdictBad:""}`}><input disabled={!visitavel} type="radio" name="apr-resultado" checked={draft.resultado==="NAO_APTO"} onChange={()=>mudar(d=>({...d,resultado:"NAO_APTO"}))}/><strong>Não apto</strong><small>Não iniciar; registrar impedimento/ocorrência</small></label>
       </div>
       <label className={`${styles.ack} ${draft.ciencia?styles.checked:""}`}><input disabled={!visitavel} type="checkbox" checked={draft.ciencia} onChange={e=>mudar(d=>({...d,ciencia:e.target.checked}))}/><span>Confirmo que avaliei as condições do local e as medidas de controle informadas nesta APR.</span></label>
       {draft.resultado==="NAO_APTO"&&<div className={styles.stop}>⚠ Local não apto: o atendimento permanecerá bloqueado. Ao concluir, você voltará à lista de Ordens de Serviço. O atendimento continuará bloqueado; a avaliação e o PDF estarão disponíveis para a gestão.</div>}
       {draft.resultado==="APTO"&&<div className={styles.success}>Ao concluir uma APR apta, confirme o início do atendimento. O ATEL registrará a APR, validará a transição no servidor e abrirá a tela de materiais da OS.</div>}
       <div className={styles.autoSaveNote}>✓ As respostas são salvas automaticamente como rascunho. Somente <strong>CONCLUIR APR</strong> registra a avaliação e a disponibiliza à gestão.</div>
       {erro&&<div className={styles.finalError} role="alert" data-atel-apr-v1587-alerta>{erro}</div>}
       {concluido&&<div className={reg?.resultado==="APTO"?styles.success:styles.stop}>Avaliação registrada no ATEL. {reg?.resultado==="APTO"?"Pode solicitar o início do atendimento.":"Atendimento bloqueado por local não apto."}</div>}
      </section>}
     </>}
   </div>
   <footer className={styles.footer}>
    {passo>0&&<button type="button" className={styles.secondary} disabled={ocupado||subindo} onClick={()=>irParaPasso(passo-1)}>VOLTAR</button>}
    {passo<2?<button type="button" className={styles.primary} disabled={carregando||!modelo||ocupado} onClick={confirmarPasso}>
      {passo===0?"CONFIRMAR RISCOS →":"CONFIRMAR EPI / EPC →"}
    </button>:<>
      {visitavel&&(!concluido||alterado)?<button type="button" className={styles.primary} disabled={ocupado||subindo||!modelo} onClick={solicitarConclusao}>
       {ocupado?"CONCLUINDO...":"CONCLUIR APR"}
      </button>:<button type="button" className={styles.primary} onClick={()=>router.push(destinoSaida)}>
       {destinoSaida==="/coletor/ordens-servico"?"VOLTAR À LISTA DE OS":"VOLTAR À ORDEM DE SERVIÇO"}
      </button>}
    </>}
   </footer>
   {confirmarInicio&&<div className={styles.confirmBackdrop}>
    <section role="dialog" aria-modal="true" aria-labelledby="atel-apr-confirmar-titulo" className={styles.confirmDialog}>
     <div className={styles.confirmIcon} aria-hidden="true">✓</div>
     <h2 id="atel-apr-confirmar-titulo">Confirmar APR Apta?</h2>
     <p>Ao confirmar, a APR será registrada e o ATEL tentará iniciar o atendimento após validação no servidor. Prossiga somente se o local estiver seguro e as medidas de controle tiverem sido aplicadas.</p>
     <div className={styles.confirmActions}>
      <button type="button" onClick={()=>setConfirmarInicio(false)} disabled={ocupado}>REVISAR APR</button>
      <button type="button" onClick={()=>void registrar()} disabled={ocupado||subindo}>CONFIRMAR APR E INICIAR ATENDIMENTO</button>
     </div>
    </section>
   </div>}
 </div></div>;
}

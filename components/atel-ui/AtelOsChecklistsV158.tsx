"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ErrorInfo, type ReactNode } from "react";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import {
  chaveLocalV1581, lerLocalV1581, gravarLocalV1581, modeloValidoV1581,
  listarFotosPendentesV1581, guardarFotoPendenteV1581, excluirFotoPendenteV1581,
  type FotoPendenteV1581, type ModeloLocalV1581, type RespostaLocalV1581,
} from "@/lib/atelOsChecklistOfflineV1581";
import styles from "./AtelOsChecklistsV158.module.css";

/* ATEL_E1_V158_1_AUTOSAVE_OFFLINE — nao altera FSM, estoque nem homologacao SST. */
type Tipo = "APR" | "ENCERRAMENTO";
type Questao = ModeloLocalV1581["perguntas"][number];
type Resposta = RespostaLocalV1581;
type Respostas = Record<string,Resposta>;
type Evidencia = {id:string;nome_arquivo:string;criado_em:string;url:string|null};
type Execucao = {id:string;modelo_versao:number;respostas:Respostas;observacao:string;situacao:string;atualizada_em:string};
type Consulta = {modelo:ModeloLocalV1581;execucao:Execucao|null;evidencias:Evidencia[];demonstracao:boolean};
type FormularioAtual = {respostas:Respostas;observacao:string};

async function apiV158<T>(url:string, init:RequestInit={}):Promise<T> {
  const client=atelSupabase();
  if(!client)throw new Error("Supabase não configurado no coletor.");
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token)throw new Error("Sessão expirada. Faça login novamente.");
  const headers=new Headers(init.headers);
  headers.set("Authorization",`Bearer ${session.access_token}`);
  if(typeof init.body==="string")headers.set("Content-Type","application/json");
  const res=await fetch(url,{...init,headers,cache:"no-store"});
  const body:unknown=await res.json().catch(()=>null);
  if(!res.ok){
    const error=body&&typeof body==="object"&&"error" in body?String((body as {error:unknown}).error):"Falha na comunicação com o ATEL.";
    throw new Error(error);
  }
  if(!body||typeof body!=="object")throw new Error("A API retornou uma resposta inválida.");
  return body as T;
}
function consultaValida(valor:unknown):valor is Consulta {
  if(!valor||typeof valor!=="object")return false;
  const c=valor as Partial<Consulta>;
  return modeloValidoV1581(c.modelo)&&Array.isArray(c.evidencias)&&c.evidencias.every(e=>e&&typeof e.id==="string"&&typeof e.nome_arquivo==="string");
}
function evidenciaValida(v:unknown):v is Evidencia {
  if(!v||typeof v!=="object")return false;
  const e=v as Partial<Evidencia>;
  return typeof e.id==="string"&&typeof e.nome_arquivo==="string"&&typeof e.criado_em==="string"&&(e.url===null||typeof e.url==="string");
}
function Icone({nome}:{nome:"escudo"|"foto"|"seta"|"salvar"|"alerta"|"cheque"|"nuvem"}){
  const c={width:19,height:19,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.9,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true as const};
  if(nome==="escudo")return <svg {...c}><path d="M12 3 4 6v6c0 5 3.3 8 8 9 4.7-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
  if(nome==="foto")return <svg {...c}><rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m3 17 5-4 4 3 4-5 5 6"/></svg>;
  if(nome==="seta")return <svg {...c}><path d="m6 9 6 6 6-6"/></svg>;
  if(nome==="salvar")return <svg {...c}><path d="M4 4h13l3 3v13H4V4Z"/><path d="M7 4v6h10V4M7 20v-7h10v7"/></svg>;
  if(nome==="alerta")return <svg {...c}><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>;
  if(nome==="nuvem")return <svg {...c}><path d="M6 17a4 4 0 0 1-1-7.9A7 7 0 0 1 18.7 10 3.6 3.6 0 0 1 18 17H6Z"/><path d="M12 11v8m-3-3 3 3 3-3"/></svg>;
  return <svg {...c}><circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/></svg>;
}

/** Erro de renderizacao de galeria nunca derruba todo o detalhe da OS. */
class ProtecaoChecklistV1581 extends Component<{children:ReactNode;titulo:string},{falhou:boolean}> {
  state={falhou:false};
  static getDerivedStateFromError(){return {falhou:true};}
  componentDidCatch(erro:Error,info:ErrorInfo){console.error("ATEL V158.1: componente de checklist isolado",erro,info.componentStack);}
  render(){
    if(this.state.falhou)return <section className={styles.recovery} role="alert"><strong>{this.props.titulo} — exibição interrompida</strong><p>Os dados salvos no dispositivo foram preservados. Reabra a avaliação para continuar.</p><button type="button" onClick={()=>this.setState({falhou:false})}>REABRIR AVALIAÇÃO</button></section>;
    return this.props.children;
  }
}

function PainelChecklist({atendimento,tipo,etapa}:{atendimento:number;tipo:Tipo;etapa:string}) {
  const [aberto,setAberto]=useState(false);
  const [dados,setDados]=useState<Consulta|null>(null);
  const [respostas,setRespostas]=useState<Respostas>({});
  const [observacao,setObservacao]=useState("");
  const [pendentes,setPendentes]=useState<FotoPendenteV1581[]>([]);
  const [loading,setLoading]=useState(true);
  const [ocupado,setOcupado]=useState(false);
  const [enviandoFoto,setEnviandoFoto]=useState(false);
  const [conectado,setConectado]=useState(true);
  const [erro,setErro]=useState("");
  const [sucesso,setSucesso]=useState("");
  const [alterado,setAlterado]=useState(false);
  const [falhaLocal,setFalhaLocal]=useState(false);
  const [revisao,setRevisao]=useState(0);
  const formRef=useRef<FormularioAtual>({respostas:{},observacao:""});
  const modeloRef=useRef<ModeloLocalV1581|null>(null);
  const dadosRef=useRef<Consulta|null>(null);
  const escopoRef=useRef<string>("");
  const revisaoRef=useRef(0);
  const syncRef=useRef<Promise<boolean>|null>(null);
  const fotosRef=useRef<Promise<void>|null>(null);
  const ativoRef=useRef(true);
  const params=`atendimento=${encodeURIComponent(String(atendimento))}&tipo=${tipo}`;

  const atualizarDados=useCallback((atualizar:(atual:Consulta|null)=>Consulta|null)=>{
    if(!ativoRef.current)return;
    const proximo=atualizar(dadosRef.current);
    dadosRef.current=proximo;
    setDados(proximo);
  },[]);
  const aplicarFormulario=useCallback((form:FormularioAtual)=>{
    formRef.current=form;
    setRespostas(form.respostas);
    setObservacao(form.observacao);
  },[]);
  const salvarNoDispositivo=useCallback((form:FormularioAtual,sincronizado:boolean)=>{
    const chave=escopoRef.current,modelo=modeloRef.current;
    if(!chave||!modelo)return false;
    const anterior=lerLocalV1581(chave);
    const gravou=gravarLocalV1581(chave,{
      esquema:1,modelo,respostas:form.respostas,observacao:form.observacao,
      atualizadoEm:Math.max(Date.now(),(anterior?.atualizadoEm??0)+1),sincronizado,
    });
    if(ativoRef.current)setFalhaLocal(!gravou);
    return gravou;
  },[]);
  const editar=useCallback((form:FormularioAtual)=>{
    aplicarFormulario(form);
    revisaoRef.current+=1;
    setRevisao(revisaoRef.current);
    salvarNoDispositivo(form,false); // Gravacao sincrona: nao depende de debounce, servidor ou internet.
    setAlterado(true);setSucesso("");
  },[aplicarFormulario,salvarNoDispositivo]);

  const sincronizar=useCallback((manual:boolean=false):Promise<boolean>=>{
    if(syncRef.current)return syncRef.current;
    if(!escopoRef.current||!modeloRef.current){if(manual)setErro("A avaliação ainda não foi carregada.");return Promise.resolve(false);}
    if(typeof navigator!=="undefined"&&!navigator.onLine){
      if(manual)setSucesso("Rascunho salvo neste dispositivo. Será sincronizado quando a conexão retornar.");
      return Promise.resolve(false);
    }
    const inicio=revisaoRef.current;
    const snapshot={...formRef.current};
    const modeloVersao=modeloRef.current.versao;
    const tarefa=(async()=>{
      try {
        const result=await apiV158<{execucao:Execucao}>("/api/os-checklists-v158",{
          method:"PUT",body:JSON.stringify({atendimento,tipo,modeloVersao,respostas:snapshot.respostas,observacao:snapshot.observacao})
        });
        if(!result.execucao||typeof result.execucao.id!=="string")throw new Error("Confirmação de salvamento inválida.");
        atualizarDados(atual=>atual?{...atual,execucao:result.execucao}:atual);
        if(revisaoRef.current===inicio){
          salvarNoDispositivo(snapshot,true);setAlterado(false);
          if(manual)setSucesso("Rascunho sincronizado com o ATEL e preservado neste dispositivo.");
        }else{
          // O tecnico continuou digitando durante o envio: manter edicoes e agendar nova sincronizacao.
          setRevisao(n=>n+1);
        }
        if(ativoRef.current)setErro("");
        return true;
      } catch(e) {
        if(ativoRef.current){
          if(manual)setErro((e instanceof Error?e.message:"Falha ao sincronizar.")+" As alterações locais foram preservadas.");
        }
        return false;
      }
    })();
    syncRef.current=tarefa;
    void tarefa.finally(()=>{if(syncRef.current===tarefa)syncRef.current=null;});
    return tarefa;
  },[atendimento,tipo,atualizarDados,salvarNoDispositivo]);

  const atualizarPendentes=useCallback(async(escopo:string)=>{
    const encontrados=await listarFotosPendentesV1581(escopo);
    if(ativoRef.current&&escopoRef.current===escopo)setPendentes(encontrados);
    return encontrados;
  },[]);
  const processarFila=useCallback(():Promise<void>=>{
    if(fotosRef.current)return fotosRef.current;
    if(!escopoRef.current||(typeof navigator!=="undefined"&&!navigator.onLine))return Promise.resolve();
    const chave=escopoRef.current;
    const tarefa=(async()=>{
      setEnviandoFoto(true);
      try {
        const fila=await listarFotosPendentesV1581(chave);
        if(fila.length===0)return;
        // Primeiro garantir um rascunho no servidor; nunca sacrificar o rascunho local.
        const confirmou=await sincronizar(false);
        if(!confirmou)return;
        for(const foto of fila){
          if(escopoRef.current!==chave)break;
          const form=new FormData();
          form.set("atendimento",String(atendimento));form.set("tipo",tipo);
          form.set("arquivo",foto.arquivo,foto.nome);
          let result:{evidencia?:unknown;duplicada?:boolean};
          try {
            result=await apiV158<{evidencia?:unknown;duplicada?:boolean}>("/api/os-checklists-v158/evidencias",{method:"POST",body:form});
          }catch{break;} // Internet/API indisponivel: fila continua intacta no IndexedDB.
          if(!evidenciaValida(result.evidencia))break; // Nunca desmontar a pagina por resposta inesperada.
          const evidencia=result.evidencia;
          await excluirFotoPendenteV1581(foto.id);
          atualizarDados(atual=>atual?{...atual,evidencias:[evidencia,...(Array.isArray(atual.evidencias)?atual.evidencias:[]).filter(f=>f.id!==evidencia.id)]}:atual);
          if(ativoRef.current)setSucesso(result.duplicada?"Foto já existente recuperada no ATEL.":"Foto enviada com segurança ao ATEL.");
        }
      }catch(e){if(ativoRef.current)setErro((e instanceof Error?e.message:"Falha na fila de fotos.")+" As fotos pendentes permanecem no dispositivo.");}
      finally{
        try{await atualizarPendentes(chave);}catch{/* arquivos locais continuam no IndexedDB */}
        if(ativoRef.current)setEnviandoFoto(false);
      }
    })();
    fotosRef.current=tarefa;
    void tarefa.finally(()=>{if(fotosRef.current===tarefa)fotosRef.current=null;});
    return tarefa;
  },[atendimento,tipo,atualizarDados,atualizarPendentes,sincronizar]);

  const carregar=useCallback(async()=>{
    const chave=escopoRef.current;
    if(!chave)return;
    setLoading(true);
    const revisaoAntes=revisaoRef.current;
    const local=lerLocalV1581(chave);
    try {
      const remoto=await apiV158<unknown>(`/api/os-checklists-v158?${params}`);
      if(!consultaValida(remoto))throw new Error("Formulário retornado pela API está incompleto.");
      if(!ativoRef.current||escopoRef.current!==chave)return;
      // Nunca substituir edicoes em andamento, nem rascunho local ainda nao enviado.
      const preservarLocal=Boolean(local&&!local.sincronizado);
      const preservarEdicao=revisaoRef.current!==revisaoAntes;
      atualizarDados(()=>remoto);
      if(!preservarEdicao){
        if(preservarLocal&&local){
          // Uma mudanca de modelo nao pode apagar o rascunho pendente.
          if(local.modelo.versao!==remoto.modelo.versao){
            modeloRef.current=local.modelo;
            atualizarDados(atual=>atual?{...atual,modelo:local.modelo}:atual);
            setErro("Modelo alterado no servidor. O rascunho antigo foi preservado; peça orientação antes de sincronizar.");
          }else{
            modeloRef.current=remoto.modelo;
          }
          aplicarFormulario({respostas:local.respostas,observacao:local.observacao});
          setAlterado(true);
        }else{
          modeloRef.current=remoto.modelo;
          const form={respostas:remoto.execucao?.respostas??{},observacao:remoto.execucao?.observacao??""};
          aplicarFormulario(form);
          salvarNoDispositivo(form,true);
          setAlterado(false);
        }
      }
      if(!preservarLocal||!local||local.modelo.versao===remoto.modelo.versao)setErro("");
    } catch(e){
      if(!ativoRef.current||escopoRef.current!==chave)return;
      const encontrado=lerLocalV1581(chave);
      if(!dadosRef.current&&encontrado&&modeloValidoV1581(encontrado.modelo)){
        modeloRef.current=encontrado.modelo;
        atualizarDados(()=>({modelo:encontrado.modelo,execucao:null,evidencias:[],demonstracao:true}));
        aplicarFormulario({respostas:encontrado.respostas,observacao:encontrado.observacao});
        setAlterado(!encontrado.sincronizado);
      }
      setErro((e instanceof Error?e.message:"Sem conexão com o ATEL.")+(dadosRef.current?" O rascunho local continua disponível.":""));
    } finally {if(ativoRef.current&&escopoRef.current===chave)setLoading(false);}
  },[params,aplicarFormulario,atualizarDados,salvarNoDispositivo]);

  useEffect(()=>{
    ativoRef.current=true;
    let cancelado=false;
    escopoRef.current="";
    setLoading(true);setErro("");setSucesso("");setPendentes([]);setDados(null);dadosRef.current=null;
    async function iniciar(){
      try {
        const sb=atelSupabase();
        if(!sb)throw new Error("Supabase não configurado.");
        const {data:{session}}=await sb.auth.getSession();
        const userId=session?.user?.id;
        if(!userId)throw new Error("Sessão expirada. Faça login novamente.");
        const chave=chaveLocalV1581(userId,atendimento,tipo);
        if(cancelado)return;
        escopoRef.current=chave;
        const local=lerLocalV1581(chave);
        if(local&&modeloValidoV1581(local.modelo)){
          modeloRef.current=local.modelo;
          aplicarFormulario({respostas:local.respostas,observacao:local.observacao});
          atualizarDados(()=>({modelo:local.modelo,execucao:null,evidencias:[],demonstracao:true}));
          setAlterado(!local.sincronizado);
        }
        try{await atualizarPendentes(chave);}catch{/* formularios continuam utilizaveis */}
        if(!cancelado)await carregar();
      }catch(e){if(!cancelado){setErro(e instanceof Error?e.message:"Não foi possível recuperar a avaliação.");setLoading(false);}}
    }
    void iniciar();
    return()=>{cancelado=true;ativoRef.current=false;};
  },[atendimento,tipo,aplicarFormulario,atualizarPendentes,atualizarDados,carregar]);

  useEffect(()=>{
    if(!alterado||!dados?.modelo||loading)return;
    const timer=window.setTimeout(()=>{void sincronizar(false);},2500);
    return()=>window.clearTimeout(timer);
  },[revisao,alterado,loading,dados?.modelo?.versao,sincronizar]);
  useEffect(()=>{
    const online=()=>{setConectado(true);void sincronizar(false).then(()=>processarFila());};
    const offline=()=>setConectado(false);
    setConectado(navigator.onLine);
    window.addEventListener("online",online);window.addEventListener("offline",offline);
    return()=>{window.removeEventListener("online",online);window.removeEventListener("offline",offline);};
  },[sincronizar,processarFila]);
  useEffect(()=>{
    if(!loading&&pendentes.length&&conectado){const timer=window.setTimeout(()=>{void processarFila();},1200);return()=>window.clearTimeout(timer);}
  },[loading,pendentes.length,conectado,processarFila]);

  const perguntas=dados?.modelo.perguntas??[];
  const preenchidas=useMemo(()=>perguntas.filter(p=>Boolean(respostas[p.id]?.valor)).length,[perguntas,respostas]);
  const naoConformes=useMemo(()=>perguntas.filter(p=>respostas[p.id]?.valor==="NAO_CONFORME"),[perguntas,respostas]);
  const grupos=useMemo(()=>{
    const m=new Map<string,Questao[]>();
    perguntas.forEach(p=>m.set(p.grupo,[...(m.get(p.grupo)??[]),p]));
    return [...m];
  },[perguntas]);
  const titulo=tipo==="APR"?"Análise Preliminar de Risco":"Checklist de encerramento";
  const subtitulo=tipo==="APR"?"Condições do local e segurança":"Equipamentos, testes e evidências";
  const visivel=tipo==="APR"?["NO_CLIENTE","ATENDIMENTO"].includes(etapa):etapa==="ATENDIMENTO";
  const evidencias=Array.isArray(dados?.evidencias)?dados.evidencias:[];
  const podeEditar=Boolean(dados?.modelo)&&!loading;

  async function salvarClick(){
    if(ocupado||!podeEditar)return;
    setOcupado(true);setErro("");setSucesso("");
    try{
      const ok=await sincronizar(true);
      if(!ok&&navigator.onLine)setSucesso("Seus dados continuam salvos neste dispositivo. Tente sincronizar novamente.");
      if(ok&&pendentes.length)void processarFila();
    }finally{setOcupado(false);}
  }
  async function enviarFoto(evento:ChangeEvent<HTMLInputElement>){
    const input=evento.currentTarget;
    const arquivo=input.files?.[0];input.value="";
    if(!arquivo||ocupado||enviandoFoto)return;
    if(!["image/jpeg","image/png","image/webp"].includes(arquivo.type)){setErro("Use uma foto JPG, PNG ou WebP.");return;}
    if(arquivo.size===0||arquivo.size>5242880){setErro("Use uma imagem de até 5 MB.");return;}
    if(evidencias.length+pendentes.length>=8){setErro("Limite de oito fotos por checklist.");return;}
    const escopo=escopoRef.current;
    if(!escopo){setErro("Abra o checklist autenticado antes de anexar fotos.");return;}
    setErro("");setSucesso("");
    try{
      const id=typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await guardarFotoPendenteV1581({id,escopo,nome:arquivo.name||"foto.jpg",mime:arquivo.type,criadaEm:Date.now(),arquivo});
      await atualizarPendentes(escopo);
      setSucesso("Foto protegida neste dispositivo. Envio para o ATEL será tentado automaticamente.");
      if(navigator.onLine)void processarFila();
    }catch(e){setErro((e instanceof Error?e.message:"Falha ao proteger a foto.")+" Nenhum envio foi confirmado; selecione novamente se necessário.");}
  }
  async function excluirFoto(id:string){
    if(ocupado||enviandoFoto)return;
    setOcupado(true);setErro("");
    try{
      await apiV158<{ok:true}>(`/api/os-checklists-v158/evidencias?${params}&id=${encodeURIComponent(id)}`,{method:"DELETE"});
      atualizarDados(atual=>atual?{...atual,evidencias:atual.evidencias.filter(f=>f.id!==id)}:atual);
      setSucesso("Evidência removida.");
    }catch(e){setErro(e instanceof Error?e.message:"Não foi possível remover a evidência.");}
    finally{setOcupado(false);}
  }
  async function excluirPendente(id:string){
    try{await excluirFotoPendenteV1581(id);await atualizarPendentes(escopoRef.current);setSucesso("Foto pendente removida deste dispositivo.");}
    catch(e){setErro(e instanceof Error?e.message:"Falha ao remover foto pendente.");}
  }
  async function atualizarFotos(){
    if(alterado){setErro("As respostas foram alteradas. Sincronize ou aguarde o salvamento automático antes de atualizar os links.");return;}
    await carregar();
  }
  if(!visivel)return null;
  return <section className={styles.card} aria-label={titulo}>
    <button type="button" className={styles.cardToggle} onClick={()=>setAberto(v=>!v)} aria-expanded={aberto}>
      <span className={styles.logo}><Icone nome={tipo==="APR"?"escudo":"foto"}/></span>
      <span className={styles.heading}><small>{tipo==="APR"?"SEGURANÇA ANTES DO SERVIÇO":"DOCUMENTAÇÃO APÓS A EXECUÇÃO"}</small><strong>{titulo}</strong><span>{subtitulo}</span></span>
      <span className={styles.chevron}><Icone nome="seta"/></span>
    </button>
    <div className={styles.footerBar}>
      <span className={styles.status}><span className={styles.statusDot}/>{falhaLocal?"Falha na cópia local":alterado?"Salvo no dispositivo · aguardando sincronização":dados?.execucao?"Sincronizado no ATEL":dados?"Rascunho disponível no dispositivo":"Aguardando carregamento"}</span>
      <span className={styles.counter}>{loading?"Consultando...":`${preenchidas}/${perguntas.length} respostas`}</span>
    </div>
    {aberto&&<div className={styles.formArea}>
      <div className={styles.homolog}><Icone nome="alerta"/><div><strong>Modelo em homologação</strong><span>Respostas demonstrativas não liberam atendimento nem finalizam OS.</span></div></div>
      {!conectado&&<div className={styles.offlineNotice}><Icone nome="nuvem"/>Sem internet: respostas continuam sendo salvas neste dispositivo. Fotos ficam na fila de envio.</div>}
      {falhaLocal&&<div className={styles.error} role="alert">O navegador não permitiu salvar os dados neste dispositivo. Verifique espaço disponível e permissões de armazenamento.</div>}
      {loading&&<div className={styles.loading} role="status">Recuperando rascunho e evidências...</div>}
      {dados&&<>
        <div className={styles.progresso}><span>Progresso do preenchimento</span><strong>{perguntas.length?Math.round(preenchidas/perguntas.length*100):0}%</strong></div>
        <div className={styles.track}><span style={{width:`${perguntas.length?Math.round(preenchidas/perguntas.length*100):0}%`}}/></div>
        {grupos.map(([grupo,lista])=><div className={styles.grupo} key={grupo}>
          <h3>{grupo}</h3>
          {lista.map((q,i)=><div key={q.id} className={styles.pergunta}>
            <label className={styles.questao} htmlFor={`${tipo}-${q.id}-nota`}><span>{i+1}.</span> {q.pergunta}</label>
            <div className={styles.escolhas} role="group" aria-label={q.pergunta}>
              {(["CONFORME","NAO_CONFORME","NAO_APLICAVEL"] as const).map(valor=><button type="button" key={valor} disabled={!podeEditar}
                aria-pressed={respostas[q.id]?.valor===valor}
                className={`${styles.escolha} ${respostas[q.id]?.valor===valor?styles.selecionada:""} ${valor==="NAO_CONFORME"?styles.negativa:""}`}
                onClick={()=>editar({respostas:{...formRef.current.respostas,[q.id]:{valor,nota:formRef.current.respostas[q.id]?.nota??""}},observacao:formRef.current.observacao})}
              >{valor==="CONFORME"?"Conforme":valor==="NAO_CONFORME"?"Não conforme":"N/A"}</button>)}
            </div>
            {(respostas[q.id]?.valor==="NAO_CONFORME"||respostas[q.id]?.nota)&&<textarea
              id={`${tipo}-${q.id}-nota`} className={styles.nota} disabled={!podeEditar}
              aria-label={`Observação sobre ${q.pergunta}`} rows={2} maxLength={500}
              placeholder="Descreva a condição observada e as medidas necessárias..."
              value={respostas[q.id]?.nota??""}
              onChange={(e:ChangeEvent<HTMLTextAreaElement>)=>editar({respostas:{...formRef.current.respostas,[q.id]:{valor:formRef.current.respostas[q.id]?.valor??"",nota:e.target.value}},observacao:formRef.current.observacao})}
            />}
          </div>)}
        </div>)}
        {naoConformes.length>0&&<div className={styles.warning} role="status"><Icone nome="alerta"/><span>{naoConformes.length} condição(ões) não conforme(s). Não execute atividade insegura; registre a ocorrência e siga o procedimento de SST.</span></div>}
        <label className={styles.observacaoLabel} htmlFor={`${tipo}-observacao-v158`}>Observações gerais do técnico</label>
        <textarea id={`${tipo}-observacao-v158`} className={styles.observacao} rows={3} maxLength={2000} disabled={!podeEditar}
          placeholder="Informações adicionais sobre o local, serviço ou medidas de segurança..." value={observacao}
          onChange={(e:ChangeEvent<HTMLTextAreaElement>)=>editar({respostas:formRef.current.respostas,observacao:e.target.value})} />
        <div className={styles.fotosCab}><strong>Fotos e evidências</strong><span>{evidencias.length+pendentes.length}/8</span></div>
        <div className={styles.photos}>
          {evidencias.map(f=><div key={f.id} className={styles.photo}>
            {f.url?<a href={f.url} target="_blank" rel="noopener noreferrer" title="Abrir evidência"><img alt={f.nome_arquivo} src={f.url}/></a>:<span className={styles.photoExpired}>Link temporário expirado</span>}
            <button type="button" disabled={ocupado||enviandoFoto} aria-label={`Excluir evidência ${f.nome_arquivo}`} onClick={()=>void excluirFoto(f.id)}>×</button>
          </div>)}
          {pendentes.map(f=><div key={f.id} className={styles.photoPending} title={f.nome}><Icone nome="nuvem"/><strong>Envio pendente</strong><span>{f.nome}</span><button type="button" disabled={enviandoFoto} onClick={()=>void excluirPendente(f.id)}>Remover</button></div>)}
          {evidencias.length+pendentes.length<8&&<>
            <label className={styles.photoAdd}><Icone nome="foto"/><span>Anexar foto</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e:ChangeEvent<HTMLInputElement>)=>void enviarFoto(e)} disabled={ocupado||!podeEditar||enviandoFoto}/></label>
          </>}
        </div>
        <p className={styles.photoHint}>JPG, PNG ou WebP até 5 MB. Fotos são guardadas primeiro no dispositivo e enviadas ao armazenamento privado do ATEL. Não limpe os dados do navegador antes da sincronização.</p>
        {pendentes.length>0&&<button type="button" className={styles.refresh} disabled={!conectado||enviandoFoto} onClick={()=>void processarFila()}>{enviandoFoto?"ENVIANDO FOTOS...":`TENTAR ENVIAR ${pendentes.length} FOTO(S) PENDENTE(S)`}</button>}
        {erro&&<div role="alert" className={styles.error}>{erro}</div>}
        {sucesso&&<div role="status" className={styles.success}><Icone nome="cheque"/>{sucesso}</div>}
        <button type="button" className={styles.save} disabled={ocupado||loading||!dados.modelo} onClick={()=>void salvarClick()}><Icone nome="salvar"/>{ocupado?"SINCRONIZANDO...":alterado?"SINCRONIZAR RASCUNHO":"SALVAR / ATUALIZAR RASCUNHO"}</button>
        <div className={styles.disclaimer}>Salvamento local automático a cada resposta · Sincronização ao conectar · Modelo V{dados.modelo.versao} em homologação · Sem liberação de OS</div>
        {evidencias.length>0&&<button type="button" className={styles.refresh} onClick={()=>void atualizarFotos()}>Atualizar fotos / links temporários</button>}
      </>}
      {!loading&&!dados&&<div><div role="alert" className={styles.error}>{erro||"Formulário indisponível."}</div><button type="button" className={styles.refresh} onClick={()=>void carregar()}>Tentar novamente</button></div>}
    </div>}
  </section>;
}

export default function AtelOsChecklistsV158({atendimento,etapa,somenteEncerramento=false}:{atendimento:number;etapa:string;somenteEncerramento?:boolean}) {
  if(!["NO_CLIENTE","ATENDIMENTO"].includes(etapa))return null;
  return <div className={styles.root}>
    {!somenteEncerramento&&<ProtecaoChecklistV1581 titulo="Análise Preliminar de Risco"><PainelChecklist atendimento={atendimento} tipo="APR" etapa={etapa}/></ProtecaoChecklistV1581>}
    <ProtecaoChecklistV1581 titulo="Checklist de encerramento"><PainelChecklist atendimento={atendimento} tipo="ENCERRAMENTO" etapa={etapa}/></ProtecaoChecklistV1581>
  </div>;
}

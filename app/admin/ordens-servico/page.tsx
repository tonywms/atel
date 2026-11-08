"use client";
import type { ReactNode } from "react";

import { useEffect, useMemo, useState } from "react";
import { obterEstadoFSMOS, type OrdemServico } from "@/lib/ordensServicoStore";
import styles from "./page.module.css";
import { consultarOsErpV52, type OsErpV52 } from "@/lib/erpOperacionalV52";
import { atelSupabase } from "@/lib/atelSupabaseV08";

const estados: Record<string, string> = { PENDENTE: "Pendente", EM_DESLOCAMENTO: "Em deslocamento", NO_LOCAL: "No local", EM_ATENDIMENTO: "Em atendimento", PENDENTE_REAGENDAMENTO: "Pendente reagendamento", PENDENTE_TRATATIVA: "Pendente tratativa", FINALIZADA: "Finalizada", CANCELADA: "Cancelada" };
const rotulo = (v: string) => estados[v] ?? v.replaceAll("_", " ");
const estado = (o: OrdemServico) => obterEstadoFSMOS(o);
const dataBR = (v?: string) => { if (!v) return "—"; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v); return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR"); };
const dataHora = (v?: string) => { if (!v) return "—"; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString("pt-BR"); };
const prevista = (o: OrdemServico) => o.agendamentoFSM?.novaData ?? o.dataPrevista;
const temOcorrencia = (o: OrdemServico) => Boolean(o.ocorrenciaFSM) || ["PENDENTE_TRATATIVA", "PENDENTE_REAGENDAMENTO"].includes(estado(o));
type ApontamentoV525 = { cod_produto: number; produto?: string; quantidade: number; patrimonio?: string | number | null; mac?: string | null; unidade?: string };
type RascunhoV525 = { atendimento: number; itens: ApontamentoV525[]; versao: number; atualizado_em: string | null };
type AndamentoAdminERP = { atendimento_erp:number;etapa:string;versao:number;atualizado_em:string };
type OcorrenciaAdminERP = { atendimento_erp:number;tipo:"CLIENTE_AUSENTE"|"IMPEDIMENTO_TECNICO"|"OUTRO";motivo:string;nova_data:string|null;criado_em:string;ativa:boolean };
type EventoAdminERP = {id:string;atendimento_erp:number;tipo:string;etapa_anterior:string;etapa_nova:string;tipo_ocorrencia:string|null;motivo:string|null;nova_data:string|null;ocorrido_em:string;versao:number};
type PainelStatusERP = {andamentos:AndamentoAdminERP[];ocorrencias:OcorrenciaAdminERP[];eventos:EventoAdminERP[]};
const estadoEtapaERP=(v:string) => ({PENDENTE:"PENDENTE",DESLOCAMENTO:"EM_DESLOCAMENTO",NO_CLIENTE:"NO_LOCAL",ATENDIMENTO:"EM_ATENDIMENTO"} as Record<string,string>)[v]??"PENDENTE";
function enriquecerOsERP(ordens:OrdemServico[],dados:PainelStatusERP):OrdemServico[]{
 const andamentos=new Map(dados.andamentos.map(x=>[Number(x.atendimento_erp),x]));
 const ocorrencias=new Map<number,OcorrenciaAdminERP>();
 dados.ocorrencias.forEach(x=>{const id=Number(x.atendimento_erp);if(!ocorrencias.has(id))ocorrencias.set(id,x)});
 const eventos=new Map<number,EventoAdminERP[]>();
 dados.eventos.forEach(x=>{const id=Number(x.atendimento_erp);const lista=eventos.get(id)??[];lista.push(x);eventos.set(id,lista)});
 return ordens.map(os=>{
  const atual=andamentos.get(os.id),oc=ocorrencias.get(os.id),hist=eventos.get(os.id)??[];
  const ativo=oc?.ativa??false;
  const estadoFSM=(ativo?(oc?.nova_data?"PENDENTE_REAGENDAMENTO":"PENDENTE_TRATATIVA"):(atual?estadoEtapaERP(atual.etapa):"PENDENTE")) as OrdemServico["estadoFSM"];
  const mapped=hist.map(h=>{
   const origem=estadoEtapaERP(h.etapa_anterior);
   const destino=h.tipo==="OCORRENCIA"?(h.nova_data?"PENDENTE_REAGENDAMENTO":"PENDENTE_TRATATIVA"):
     h.tipo==="RETOMADA"?"EM_DESLOCAMENTO":estadoEtapaERP(h.etapa_nova);
   const anterior=origem;
   return {id:h.id,estadoAnterior:anterior as NonNullable<OrdemServico["estadoFSM"]>,estadoNovo:destino as NonNullable<OrdemServico["estadoFSM"]>,ocorridoEm:h.ocorrido_em,codigoTecnico:os.codigoTecnico,tecnico:os.tecnico,...(h.tipo_ocorrencia?{tipoOcorrencia:h.tipo_ocorrencia as "CLIENTE_AUSENTE"|"IMPEDIMENTO_TECNICO"|"OUTRO"}:{}),...(h.motivo?{motivo:h.motivo}:{}),...(h.nova_data?{novaData:h.nova_data}:{})};
  });
  return {...os,estadoFSM,historicoFSM:mapped,...(oc?{ocorrenciaFSM:{tipo:oc.tipo,motivo:oc.motivo,registradoEm:oc.criado_em}}:{}),...(ativo&&oc?.nova_data?{agendamentoFSM:{novaData:oc.nova_data,motivo:oc.motivo,registradoEm:oc.criado_em}}:{})};
 });
}
const porPagina = 8;


// V08.0.6 — Visão resumida das etapas da OS; consulta, sem alterar o fluxo FSM.

// V08.0.7 — icones SVG leves, sem dependencias externas
function IconeEtapaFSM({ etapa }: { etapa: string }) {
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (etapa) {
    case "PENDENTE": return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M9 10h6M9 14h6M9 18h4"/></svg>;
    case "EM_DESLOCAMENTO": return <svg {...common}><path d="M5 17H3v-5l2-5h14l2 5v5h-2M5 17h14M3 12h18M7 7l1-2h8l1 2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>;
    case "NO_LOCAL": return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case "EM_ATENDIMENTO": return <svg {...common}><path d="m14 7 3-3 3 3-3 3M3 21l8-8M13 11l-2-2 3-3 4 4-3 3-2-2ZM6 18l-3 3"/></svg>;
    case "FINALIZADA": return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/></svg>;
    default: return null;
  }
}

function FluxoTecnico({ ordem }: { ordem: OrdemServico }) {
  const etapas = [
    { id: "PENDENTE", nome: "Pendente" },
    { id: "EM_DESLOCAMENTO", nome: "Deslocamento" },
    { id: "NO_LOCAL", nome: "No cliente" },
    { id: "EM_ATENDIMENTO", nome: "Atendimento" },
    { id: "FINALIZADA", nome: "Finalizada" },
  ];
  const atual = estado(ordem);
  const historico = ordem.historicoFSM ?? [];
  const visitados = new Set<string>([atual]);
  historico.forEach(evento => { visitados.add(evento.estadoAnterior); visitados.add(evento.estadoNovo); });
  const atualIndex = etapas.findIndex(e => e.id === atual);
  const ultimaEtapa = atual === "FINALIZADA" ? 4 : Math.max(-1, ...etapas.map((e, i) => visitados.has(e.id) ? i : -1));
  const excepcional = ["PENDENTE_REAGENDAMENTO", "PENDENTE_TRATATIVA", "CANCELADA"].includes(atual);
  const etapaAtual = excepcional ? -1 : atualIndex;
  return <section className={styles.fsmFlow} aria-label="Etapas do atendimento técnico">
    <div className={styles.fsmFlowTitle}><strong>Andamento do atendimento</strong><span>{rotulo(atual)}</span></div>
    <ol className={styles.fsmFlowSteps}>
      {etapas.map((e, i) => {
        const concluida = atual === "FINALIZADA" || (visitados.has(e.id) && i < ultimaEtapa);
        const ativa = i === etapaAtual;
        return <li key={e.id} className={`${styles.fsmFlowStep} ${concluida ? styles.fsmFlowDone : ""} ${ativa ? styles.fsmFlowCurrent : ""}`} aria-current={ativa ? "step" : undefined}>
          <span className={styles.fsmFlowCircle}><IconeEtapaFSM etapa={e.id} /></span><span className={styles.fsmFlowLabel}>{e.nome}</span>
        </li>;
      })}
    </ol>
    {excepcional && <div className={styles.fsmFlowAlert}>Situação atual: {rotulo(atual)}. Consulte o Histórico operacional para os detalhes.</div>}
  </section>;
}

function OsIcon({ name, size = 18 }: { name: "clipboard" | "truck" | "activity" | "calendar" | "alert" | "check" | "search" | "box" | "layers" | "history" | "shield" | "hash" | "list", size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const shapes: Record<typeof name, ReactNode> = {
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M9 9h6M9 13h6M9 17h4"/></>,
    truck: <><path d="M3 6h11v11H3zM14 10h4l3 4v3h-7z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="17.5" cy="18" r="1.5"/></>,
    activity: <><path d="M3 12h4l3-7 4 14 3-7h4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6"/></>,
    alert: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17h.01"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    box: <><path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    shield: <><path d="m12 2 8 4v6c0 5-3 8-8 10-5-2-8-5-8-10V6l8-4Z"/><path d="m9 12 2 2 4-4"/></>,
    hash: <><path d="M9 3 7 21M17 3l-2 18M4 9h17M3 15h17"/></>,
    list: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  };
  return <svg {...common}>{shapes[name]}</svg>;
}

export default function PainelOrdensServico() {
  const [lista, setLista] = useState<OrdemServico[]>([]);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroTecnico, setFiltroTecnico] = useState("TODOS");
  const [pagina, setPagina] = useState(1);
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [aba, setAba] = useState<"materiais" | "historico">("materiais");
  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        const dados = await consultarOsErpV52();
        if (!Array.isArray(dados)) throw new Error("Resposta ERP inválida");
        const ordens: OrdemServico[] = dados.map((os: OsErpV52) => {
          const partes = String(os.cliente ?? "").match(/^(\d+)\s*-\s*(.+)$/);
          return {
            id: Number(os.atendimento), codigo: String(os.atendimento),
            tipo: String(os.servico || "SERVICO_ERP") as OrdemServico["tipo"],
            status: "PENDENTE", codigoTecnico: String(os.tecnico),
            tecnico: `Técnico ERP ${os.tecnico}`, base: "ERP",
            codigoCliente: partes?.[1] ?? "", cliente: partes?.[2] ?? String(os.cliente ?? ""),
            endereco: os.endereco ?? "", cidade: "",
            dataPrevista: String(os.data_inicio ?? "").slice(0, 10),
            observacao: `Protocolo: ${os.protocolo}`, materiaisPrevistos: [], itens: [],
          };
        });
        ordens.sort((x,y) => (y.dataPrevista || "").localeCompare(x.dataPrevista || "") || y.id-x.id);
        // O ERP permanece origem das OS; o WMS fornece apenas os estados e eventos operacionais.
        let sincronizadas = ordens;
        let avisoStatus = "";
        try {
          const supabase=atelSupabase();
          if(!supabase)throw new Error("Supabase não configurado");
          const {data:{session}}=await supabase.auth.getSession();
          if(!session?.access_token)throw new Error("Sessão expirada");
          const resposta=await fetch("/api/os-painel-status",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
          if(!resposta.ok) { const falha = await resposta.json().catch(() => null) as { error?: string } | null; throw new Error(falha?.error || `Status WMS indisponível (HTTP ${resposta.status})`); }
          const dados=await resposta.json() as PainelStatusERP;
          sincronizadas=enriquecerOsERP(ordens,dados);
        }catch (e) { avisoStatus=`Andamentos WMS não sincronizados: ${e instanceof Error ? e.message : "Falha desconhecida"}. Os dados da OS permanecem do ERP.`; }
        if (ativo) { setLista(sincronizadas); setErro(avisoStatus); }
      } catch (e) {
        if (ativo) { setLista([]); setErro(e instanceof Error ? e.message : "Falha ao consultar ERP"); }
      }
    };
    void carregar();
    const aoFoco = () => { void carregar(); };
    window.addEventListener("focus", aoFoco);
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void carregar();},15000);
    return () => { ativo = false; window.removeEventListener("focus", aoFoco);window.clearInterval(timer); };
  }, []);
  const tecnicos = useMemo(() => [...new Set(lista.map(o => o.tecnico).filter(Boolean))].sort(), [lista]);
  const status = useMemo(() => [...new Set(lista.map(estado))].sort(), [lista]);
  const filtradas = useMemo(() => lista.filter(o => (filtroStatus === "TODOS" || estado(o) === filtroStatus) && (filtroTecnico === "TODOS" || o.tecnico === filtroTecnico) && [o.codigo, o.observacao, o.tipo, o.cliente, o.codigoCliente, o.tecnico, o.codigoTecnico, o.cidade, estado(o)].join(" ").toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR"))), [lista, busca, filtroStatus, filtroTecnico]);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const exibidas = filtradas.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);
  // A seleção deve pertencer ao resultado filtrado e à página visível.
  // Se a pesquisa excluir a OS selecionada, o detalhe acompanha o primeiro card visível.
  const ordem = exibidas.find(o => o.id === selecionada) ?? exibidas[0] ?? null;
  const [rascunho, setRascunho] = useState<RascunhoV525 | null>(null);
  const [erroMateriais, setErroMateriais] = useState("");
  const [carregandoMateriais, setCarregandoMateriais] = useState(false);
  const [revisaoMateriais, setRevisaoMateriais] = useState(0);
  useEffect(() => {
    const atendimento = ordem?.id ?? null;
    if (!atendimento) { setRascunho(null); setErroMateriais(""); return; }
    let ativo = true;
    const consultar = async () => {
      try {
        if (ativo) setCarregandoMateriais(true);
        const supabase = atelSupabase();
        if (!supabase) throw new Error("Supabase não configurado.");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
        const response = await fetch(`/api/os-materiais?atendimento=${atendimento}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store"
        });
        const payload = await response.json() as RascunhoV525 & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Falha ao consultar materiais.");
        if (ativo) { setRascunho(payload); setErroMateriais(""); }
      } catch (e) {
        if (ativo) { setRascunho(null); setErroMateriais(e instanceof Error ? e.message : "Erro de consulta."); }
      } finally { if (ativo) setCarregandoMateriais(false); }
    };
    setRascunho(null);
    void consultar();
    const interval = setInterval(() => { if (document.visibilityState === "visible") void consultar(); }, 15000);
    return () => { ativo = false; clearInterval(interval); };
  }, [ordem?.id, revisaoMateriais]);

  const contagem = (fn: (o: OrdemServico) => boolean) => lista.filter(fn).length;
  const indicadores = [
    { nome: "Total de OS", icone: "clipboard" as const, valor: lista.length, cor: "azul" },
    { nome: "Em deslocamento", icone: "truck" as const, valor: contagem(o => estado(o) === "EM_DESLOCAMENTO"), cor: "ciano" },
    { nome: "Em atendimento", icone: "activity" as const, valor: contagem(o => ["NO_LOCAL", "EM_ATENDIMENTO"].includes(estado(o))), cor: "verde" },
    { nome: "Reagendadas", icone: "calendar" as const, valor: contagem(o => estado(o) === "PENDENTE_REAGENDAMENTO"), cor: "laranja" },
    { nome: "Com ocorrência", icone: "alert" as const, valor: contagem(temOcorrencia), cor: "rosa" },
    { nome: "Finalizadas", icone: "check" as const, valor: contagem(o => estado(o) === "FINALIZADA"), cor: "turquesa" },
  ];
  return <main className={styles.root}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>EXPEDIÇÕES / GESTÃO OS</span><h1>Gestão de Ordens de Serviço</h1><p>Acompanhamento dos atendimentos, materiais e histórico técnico.</p></div><span className={styles.readonly}>Consulta ERP · homologação</span></header>
    <section className={styles.kpis} aria-label="Indicadores de ordens de serviço">{indicadores.map(i=><div className={styles.kpi} key={i.nome}><div className={`${styles.kpiHead} ${styles[i.cor]}`}><span>{i.nome}</span><OsIcon name={i.icone} size={19}/></div><div className={styles.kpiBody}><strong>{i.valor}</strong><span>{lista.length ? Math.round(i.valor / lista.length * 100) : 0}% do total</span></div></div>)}</section>
    <section className={styles.toolbar}><div><strong className={styles.toolbarTitle}><OsIcon name="list" size={19}/> Acompanhamento de Ordens de Serviço</strong><small>{filtradas.length} de {lista.length} OS</small></div><div className={styles.filters}><input aria-label="Pesquisar OS" value={busca} onChange={e=>{setBusca(e.target.value);setPagina(1)}} placeholder="Pesquisar OS, cliente, técnico..."/><select aria-label="Filtrar status" value={filtroStatus} onChange={e=>{setFiltroStatus(e.target.value);setPagina(1)}}><option value="TODOS">Todos os status</option>{status.map(x=><option key={x} value={x}>{rotulo(x)}</option>)}</select><select aria-label="Filtrar técnico" value={filtroTecnico} onChange={e=>{setFiltroTecnico(e.target.value);setPagina(1)}}><option value="TODOS">Todos os técnicos</option>{tecnicos.map(x=><option key={x} value={x}>{x}</option>)}</select><button onClick={()=>{setBusca("");setFiltroStatus("TODOS");setFiltroTecnico("TODOS");setPagina(1)}}>Limpar</button></div></section>
    {erro && <p role="alert" className={styles.error}>{erro}</p>}
    <div className={styles.workspace}>
      <div className={styles.listPane}><div className={styles.paneTitle}><span className={styles.paneTitleLabel}><OsIcon name="clipboard" size={18}/> Ordens de serviço</span> <span>{filtradas.length}</span></div><div className={styles.osList}>{exibidas.map(o=><button key={o.id} onClick={()=>{setSelecionada(o.id);setAba("materiais")}} className={`${styles.osCard} ${ordem?.id===o.id?styles.selected:""}`} aria-pressed={ordem?.id===o.id}><div className={styles.osTop}><strong>OS nº {o.codigo}</strong><span className={`${styles.state} ${styles[estado(o).toLowerCase()] ?? ""}`}>{rotulo(estado(o))}</span></div><div className={styles.client}>{o.cliente}</div><div className={styles.osMeta}><span>{o.observacao}</span><span>Cliente: {o.codigoCliente}</span><span>Tipo: {rotulo(o.tipo)}</span><span>Técnico: {o.tecnico}</span><span>Data: {dataBR(prevista(o))}</span><span>Base: {o.base} · {o.codigoTecnico}</span></div></button>)}{!exibidas.length&&<div className={styles.empty}>Nenhuma OS encontrada.</div>}</div><footer className={styles.pager}><button disabled={paginaAtual<=1} onClick={()=>setPagina(p=>p-1)}>‹</button><span>{paginaAtual} / {totalPaginas}</span><button disabled={paginaAtual>=totalPaginas} onClick={()=>setPagina(p=>p+1)}>›</button></footer></div>
      <section className={styles.detailPane} aria-label="Detalhamento da ordem de serviço">{ordem?<><div className={styles.detailHead}><div><span className={styles.detailEyebrow}><OsIcon name="clipboard" size={15}/> ORDEM DE SERVIÇO</span><h2>OS nº {ordem.codigo}</h2><p>{ordem.cliente} · {ordem.observacao}</p></div><div className={styles.detailActions}><span className={`${styles.state} ${styles[estado(ordem).toLowerCase()]??""}`}>{rotulo(estado(ordem))}</span></div></div>{ordem.endereco && <p className={styles.addressNote}>Endereço: {ordem.endereco}{ordem.cidade ? ` · ${ordem.cidade}` : ""}</p>}

      <nav className={styles.tabs} aria-label="Informações da OS"><button className={aba==="materiais"?styles.active:""} onClick={()=>setAba("materiais")}><OsIcon name="box" size={17}/> Materiais e quantidades</button><button className={aba==="historico"?styles.active:""} onClick={()=>setAba("historico")}><OsIcon name="history" size={17}/> Histórico operacional ({ordem.historicoFSM?.length??0})</button></nav>
      {aba==="materiais"?<>
      <div className={styles.summary}>
        <div><small><OsIcon name="box" size={17}/> Produtos apontados</small><strong>{rascunho?.itens.length ?? 0}</strong></div>
        <div><small><OsIcon name="layers" size={17}/> Quantidade apontada</small><strong>{rascunho?.itens.reduce((a, i) => a + Number(i.quantidade || 0), 0) ?? 0}</strong></div>
        <div><small><OsIcon name="hash" size={17}/> Versão do rascunho</small><strong>{rascunho?.versao ?? 0}</strong></div>
        <div><small><OsIcon name="shield" size={17}/> Baixa de estoque</small><strong>Não realizada</strong></div>
      </div>

      {erroMateriais && <p role="alert" className={styles.error}>{erroMateriais}</p>}
      <div className={styles.tableWrap}><div className={styles.tableTitle}><span><OsIcon name="box" size={18}/> Itens e materiais da OS</span><span>{rascunho?.itens.length ?? 0} produto(s)</span></div><table><thead><tr><th>STATUS</th><th>CÓDIGO</th><th>DESCRIÇÃO DO PRODUTO</th><th>UND</th><th>Qtd</th><th>PATRIMÔNIO</th><th>MAC</th><th>BAIXA</th></tr></thead>
      <tbody>{(rascunho?.itens ?? []).map((item, i) => <tr key={`${item.cod_produto}-${item.patrimonio ?? ""}-${item.mac ?? ""}-${i}`}>
        <td><span className={styles.draftBadge}>Rascunho</span></td><td><strong className={styles.productCode}>{item.cod_produto}</strong></td><td>{item.produto || "Produto ERP"}</td><td>{item.unidade || "—"}</td><td>{item.quantidade}</td><td>{item.patrimonio ?? "—"}</td><td>{item.mac ?? "—"}</td><td><span className={styles.noBadge}>Não</span></td>
      </tr>)}
      {!rascunho?.itens.length && <tr><td colSpan={8} className={styles.empty}>{carregandoMateriais ? "Consultando..." : erroMateriais ? erroMateriais : "Nenhum material apontado nesta OS."}</td></tr>}
      </tbody></table></div>
      </>:<div className={styles.timeline}>{ordem.historicoFSM?.length?[...ordem.historicoFSM].reverse().map((h,i)=><article key={h.id||i}><div className={styles.timelineDot}/><div><strong>{rotulo(h.estadoAnterior)} → {rotulo(h.estadoNovo)}</strong><small>{dataHora(h.ocorridoEm)} · {h.tecnico}</small>{h.tipoOcorrencia&&<p>Ocorrência: {rotulo(h.tipoOcorrencia)}</p>}{h.motivo&&<p>Motivo: {h.motivo}</p>}{h.observacao&&<p>{h.observacao}</p>}{h.novaData&&<p>Nova data: {dataBR(h.novaData)}</p>}</div></article>):<div className={styles.empty}>Nenhum evento FSM registrado.</div>}</div>}
      <FluxoTecnico ordem={ordem} />
      </>:<div className={styles.placeholder}><div className={styles.placeholderIcon}>▤</div><h2>Selecione uma ordem de serviço</h2><p>Escolha um cartão à esquerda para consultar os materiais, as quantidades e o histórico do atendimento.</p></div>}</section>
    </div>
    <div className={styles.footnote}>Ordens obtidas do ERP. Etapas e histórico operacional sincronizados com o WMS quando disponíveis; nenhuma baixa de estoque ocorre neste painel.</div>
  </main>;
}

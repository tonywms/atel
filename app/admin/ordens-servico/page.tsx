"use client";

import { useEffect, useMemo, useState } from "react";
import { carregarOrdensServico, ouvirOrdensServico, obterEstadoFSMOS, type OrdemServico } from "@/lib/ordensServicoStore";
import styles from "./page.module.css";

const estados: Record<string, string> = { PENDENTE: "Pendente", EM_DESLOCAMENTO: "Em deslocamento", NO_LOCAL: "No local", EM_ATENDIMENTO: "Em atendimento", PENDENTE_REAGENDAMENTO: "Pendente reagendamento", PENDENTE_TRATATIVA: "Pendente tratativa", FINALIZADA: "Finalizada", CANCELADA: "Cancelada" };
const rotulo = (v: string) => estados[v] ?? v.replaceAll("_", " ");
const estado = (o: OrdemServico) => obterEstadoFSMOS(o);
const dataBR = (v?: string) => { if (!v) return "—"; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v); return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR"); };
const dataHora = (v?: string) => { if (!v) return "—"; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString("pt-BR"); };
const prevista = (o: OrdemServico) => o.agendamentoFSM?.novaData ?? o.dataPrevista;
const temOcorrencia = (o: OrdemServico) => Boolean(o.ocorrenciaFSM) || ["PENDENTE_TRATATIVA", "PENDENTE_REAGENDAMENTO"].includes(estado(o));
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
    const carregar = () => { try { const dados = carregarOrdensServico(); setLista(Array.isArray(dados) ? dados : []); setErro(""); } catch { setErro("Não foi possível carregar as ordens deste navegador."); } };
    carregar(); const parar = ouvirOrdensServico(carregar); window.addEventListener("focus", carregar);
    return () => { parar(); window.removeEventListener("focus", carregar); };
  }, []);
  const tecnicos = useMemo(() => [...new Set(lista.map(o => o.tecnico).filter(Boolean))].sort(), [lista]);
  const status = useMemo(() => [...new Set(lista.map(estado))].sort(), [lista]);
  const filtradas = useMemo(() => lista.filter(o => (filtroStatus === "TODOS" || estado(o) === filtroStatus) && (filtroTecnico === "TODOS" || o.tecnico === filtroTecnico) && [o.codigo, o.cliente, o.codigoCliente, o.tecnico, o.codigoTecnico, o.cidade, estado(o)].join(" ").toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR"))), [lista, busca, filtroStatus, filtroTecnico]);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const exibidas = filtradas.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);
  const ordem = selecionada === null ? null : lista.find(o => o.id === selecionada) ?? null;
  const contagem = (fn: (o: OrdemServico) => boolean) => lista.filter(fn).length;
  const indicadores = [
    { nome: "Total de OS", valor: lista.length, cor: "azul" },
    { nome: "Em deslocamento", valor: contagem(o => estado(o) === "EM_DESLOCAMENTO"), cor: "ciano" },
    { nome: "Em atendimento", valor: contagem(o => ["NO_LOCAL", "EM_ATENDIMENTO"].includes(estado(o))), cor: "verde" },
    { nome: "Reagendadas", valor: contagem(o => estado(o) === "PENDENTE_REAGENDAMENTO"), cor: "laranja" },
    { nome: "Com ocorrência", valor: contagem(temOcorrencia), cor: "rosa" },
    { nome: "Finalizadas", valor: contagem(o => estado(o) === "FINALIZADA"), cor: "turquesa" },
  ];
  return <main className={styles.root}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>EXPEDIÇÕES / GESTÃO OS</span><h1>Gestão de Ordens de Serviço</h1><p>Acompanhamento dos atendimentos, materiais e histórico técnico.</p></div><span className={styles.readonly}>Consulta operacional · dados locais</span></header>
    <section className={styles.kpis} aria-label="Indicadores de ordens de serviço">{indicadores.map(i=><div className={styles.kpi} key={i.nome}><div className={`${styles.kpiHead} ${styles[i.cor]}`}>{i.nome}</div><div className={styles.kpiBody}><strong>{i.valor}</strong><span>{lista.length ? Math.round(i.valor / lista.length * 100) : 0}% do total</span></div></div>)}</section>
    <section className={styles.toolbar}><div><strong>Acompanhamento de Ordens de Serviço</strong><small>{filtradas.length} de {lista.length} OS</small></div><div className={styles.filters}><input aria-label="Pesquisar OS" value={busca} onChange={e=>{setBusca(e.target.value);setPagina(1)}} placeholder="Pesquisar OS, cliente, técnico..."/><select aria-label="Filtrar status" value={filtroStatus} onChange={e=>{setFiltroStatus(e.target.value);setPagina(1)}}><option value="TODOS">Todos os status</option>{status.map(x=><option key={x} value={x}>{rotulo(x)}</option>)}</select><select aria-label="Filtrar técnico" value={filtroTecnico} onChange={e=>{setFiltroTecnico(e.target.value);setPagina(1)}}><option value="TODOS">Todos os técnicos</option>{tecnicos.map(x=><option key={x} value={x}>{x}</option>)}</select><button onClick={()=>{setBusca("");setFiltroStatus("TODOS");setFiltroTecnico("TODOS");setPagina(1)}}>Limpar</button></div></section>
    {erro && <p role="alert" className={styles.error}>{erro}</p>}
    <div className={styles.workspace}>
      <div className={styles.listPane}><div className={styles.paneTitle}>Ordens de serviço <span>{filtradas.length}</span></div><div className={styles.osList}>{exibidas.map(o=><button key={o.id} onClick={()=>{setSelecionada(o.id);setAba("materiais")}} className={`${styles.osCard} ${ordem?.id===o.id?styles.selected:""}`} aria-pressed={ordem?.id===o.id}><div className={styles.osTop}><strong>{o.codigo}</strong><span className={`${styles.state} ${styles[estado(o).toLowerCase()] ?? ""}`}>{rotulo(estado(o))}</span></div><div className={styles.client}>{o.cliente}</div><div className={styles.osMeta}><span>Cliente: {o.codigoCliente}</span><span>Tipo: {rotulo(o.tipo)}</span><span>Técnico: {o.tecnico}</span><span>Data: {dataBR(prevista(o))}</span><span>Base: {o.base} · {o.codigoTecnico}</span></div></button>)}{!exibidas.length&&<div className={styles.empty}>Nenhuma OS encontrada.</div>}</div><footer className={styles.pager}><button disabled={paginaAtual<=1} onClick={()=>setPagina(p=>p-1)}>‹</button><span>{paginaAtual} / {totalPaginas}</span><button disabled={paginaAtual>=totalPaginas} onClick={()=>setPagina(p=>p+1)}>›</button></footer></div>
      <section className={styles.detailPane} aria-label="Detalhamento da ordem de serviço">{ordem?<><div className={styles.detailHead}><div><span>ORDEM DE SERVIÇO</span><h2>{ordem.codigo}</h2><p>{ordem.cliente} · {ordem.cidade}</p></div><div className={styles.detailActions}><span className={`${styles.state} ${styles[estado(ordem).toLowerCase()]??""}`}>{rotulo(estado(ordem))}</span></div></div><div className={styles.infoGrid}><div><small>Técnico responsável</small><strong>{ordem.tecnico}</strong><span>{ordem.codigoTecnico} · {ordem.base}</span></div><div><small>Tipo de serviço</small><strong>{rotulo(ordem.tipo)}</strong><span>Prevista: {dataBR(prevista(ordem))}</span></div><div><small>Endereço</small><strong>{ordem.endereco || "Não informado"}</strong><span>{ordem.cidade}</span></div></div>
      
      <nav className={styles.tabs} aria-label="Informações da OS"><button className={aba==="materiais"?styles.active:""} onClick={()=>setAba("materiais")}>Materiais e quantidades</button><button className={aba==="historico"?styles.active:""} onClick={()=>setAba("historico")}>Histórico operacional ({ordem.historicoFSM?.length??0})</button></nav>
      {aba==="materiais"?<><div className={styles.summary}><div><small>Itens previstos</small><strong>{ordem.materiaisPrevistos?.length??0}</strong></div><div><small>Conferidos</small><strong>{ordem.materiaisPrevistos?.filter(m=>m.statusConferencia!=="PENDENTE").length??0}</strong></div><div><small>Itens utilizados</small><strong>{ordem.itens?.length??0}</strong></div><div><small>Quantidade utilizada</small><strong>{ordem.itens?.reduce((a,i)=>a+i.quantidade,0)??0}</strong></div></div><div className={styles.tableWrap}><table><thead><tr><th>STATUS</th><th>CÓDIGO</th><th>DESCRIÇÃO DO PRODUTO</th><th>UND</th><th>PREVISTO</th><th>CONFERIDO</th><th>UTILIZADO</th><th>DESTINO</th></tr></thead><tbody>{Array.from(new Set([...(ordem.materiaisPrevistos??[]).map(m=>m.codigoProduto),...(ordem.itens??[]).map(i=>i.codigoProduto)])).map(c=>{const m=ordem.materiaisPrevistos?.find(x=>x.codigoProduto===c);const usos=ordem.itens?.filter(x=>x.codigoProduto===c)??[];const usado=usos.reduce((n,x)=>n+x.quantidade,0);return <tr key={c}><td><span className={`${styles.dot} ${m?.statusConferencia==="OK"?styles.dotOk:m?.statusConferencia==="DIVERGENCIA"?styles.dotWarn:""}`}/></td><td><strong>{c}</strong></td><td>{m?.produto??usos[0]?.produto??"—"}</td><td>{m?.unidade??usos[0]?.unidade??"—"}</td><td>{m?.quantidade??0}</td><td>{m?.statusConferencia?rotulo(m.statusConferencia):"—"}</td><td>{usado}</td><td>{[...new Set(usos.map(x=>x.destino))].join(", ")||"—"}</td></tr>})}{!(ordem.materiaisPrevistos?.length||ordem.itens?.length)&&<tr><td colSpan={8} className={styles.empty}>Nenhum material registrado nesta OS.</td></tr>}</tbody></table></div></>:<div className={styles.timeline}>{ordem.historicoFSM?.length?[...ordem.historicoFSM].reverse().map((h,i)=><article key={h.id||i}><div className={styles.timelineDot}/><div><strong>{rotulo(h.estadoAnterior)} → {rotulo(h.estadoNovo)}</strong><small>{dataHora(h.ocorridoEm)} · {h.tecnico}</small>{h.tipoOcorrencia&&<p>Ocorrência: {rotulo(h.tipoOcorrencia)}</p>}{h.motivo&&<p>Motivo: {h.motivo}</p>}{h.observacao&&<p>{h.observacao}</p>}{h.novaData&&<p>Nova data: {dataBR(h.novaData)}</p>}</div></article>):<div className={styles.empty}>Nenhum evento FSM registrado.</div>}</div>}
      <FluxoTecnico ordem={ordem} />
      </>:<div className={styles.placeholder}><div className={styles.placeholderIcon}>▤</div><h2>Selecione uma ordem de serviço</h2><p>Escolha um cartão à esquerda para consultar os materiais, as quantidades e o histórico do atendimento.</p></div>}</section>
    </div>
    <div className={styles.footnote}>Dados desta demonstração são armazenados no navegador. A consulta não altera OS, materiais ou estoque.</div>
  </main>;
}

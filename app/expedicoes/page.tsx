"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { carregarOrdensServico, ouvirOrdensServico, obterEstadoFSMOS, type OrdemServico } from "@/lib/ordensServicoStore";
import styles from "./dashboard-os.module.css";

const STATUS = ["PENDENTE", "EM_DESLOCAMENTO", "NO_LOCAL", "EM_ATENDIMENTO", "PENDENTE_REAGENDAMENTO", "PENDENTE_TRATATIVA", "FINALIZADA", "CANCELADA"] as const;
const NOMES: Record<string, string> = {
  PENDENTE: "Pendentes", EM_DESLOCAMENTO: "Em deslocamento", NO_LOCAL: "No cliente",
  EM_ATENDIMENTO: "Em atendimento", PENDENTE_REAGENDAMENTO: "Reagendadas",
  PENDENTE_TRATATIVA: "Em tratativa", FINALIZADA: "Finalizadas", CANCELADA: "Canceladas"
};
const CORES: Record<string, string> = {
  PENDENTE: "#8298aa", EM_DESLOCAMENTO: "#4b9fc1", NO_LOCAL: "#338bb7",
  EM_ATENDIMENTO: "#e39a18", PENDENTE_REAGENDAMENTO: "#d88c35",
  PENDENTE_TRATATIVA: "#df6674", FINALIZADA: "#2ca18e", CANCELADA: "#8c96a2"
};
const etapas = ["PENDENTE", "EM_DESLOCAMENTO", "NO_LOCAL", "EM_ATENDIMENTO", "FINALIZADA"];
const dataBR = (v?: string) => {
  if (!v) return "—";
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR");
};
const estado = (os: OrdemServico) => obterEstadoFSMOS(os);
const prevista = (os: OrdemServico) => os.agendamentoFSM?.novaData || os.dataPrevista;
const problema = (os: OrdemServico) => Boolean(os.ocorrenciaFSM) || ["PENDENTE_REAGENDAMENTO", "PENDENTE_TRATATIVA"].includes(estado(os));
const atrasada = (os: OrdemServico, hoje: string) => {
  const d = prevista(os);
  return Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d < hoje && !["FINALIZADA", "CANCELADA"].includes(estado(os)));
};
const svg = (name: "os" | "car" | "pin" | "tool" | "check" | "alert") => {
  const paths: Record<string, ReactNode> = {
    os: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    car: <><path d="M5 17H3v-5l2-5h14l2 5v5h-2M5 17h14M3 12h18"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2"/></>,
    tool: <><path d="m14 7 3-3 3 3-3 3M3 21l8-8M13 11l-2-2 3-3 4 4-3 3-2-2Z"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/></>,
    alert: <><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/></>
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

export default function DashboardOS() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [busca, setBusca] = useState("");
  const [tecnico, setTecnico] = useState("TODOS");
  const [status, setStatus] = useState("TODOS");
  const [erro, setErro] = useState("");
  const [hoje, setHoje] = useState("");
  useEffect(() => {
    const atualizar = () => {
      try {
        const lista = carregarOrdensServico();
        setOrdens(Array.isArray(lista) ? lista : []);
        setErro("");
      } catch {
        setErro("Não foi possível consultar as ordens deste navegador.");
      }
      const agora = new Date();
      setHoje(`${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,"0")}-${String(agora.getDate()).padStart(2,"0")}`);
    };
    atualizar();
    const off = ouvirOrdensServico(atualizar);
    window.addEventListener("focus", atualizar);
    return () => { off(); window.removeEventListener("focus", atualizar); };
  }, []);

  const tecnicos = useMemo(() => [...new Set(ordens.map(o => o.tecnico).filter(Boolean))].sort(), [ordens]);
  const base = useMemo(() => ordens.filter(o => tecnico === "TODOS" || o.tecnico === tecnico), [ordens, tecnico]);
  const filtradas = useMemo(() => base.filter(o =>
    (status === "TODOS" || estado(o) === status) &&
    [o.codigo, o.cliente, o.tecnico, o.cidade, o.codigoCliente].join(" ").toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR").trim())
  ), [base, status, busca]);
  const contar = (s: string) => base.filter(o => estado(o) === s).length;
  const total = base.length;
  const finalizadas = contar("FINALIZADA");
  const ocorrencias = base.filter(problema).length;
  const vencidas = base.filter(o => atrasada(o, hoje)).length;
  const taxa = total ? Math.round(finalizadas / total * 100) : 0;
  const alertas = filtradas.filter(o => problema(o) || atrasada(o, hoje));
  const recentes = [...filtradas].sort((a,b) => (prevista(b) || "").localeCompare(prevista(a) || "")).slice(0, 8);
  const porTecnico = useMemo(() => {
    const mapa = new Map<string, { nome: string; total: number; concluidas: number; ativas: number }>();
    base.forEach(o => {
      const nome = o.tecnico || "Não atribuído";
      const atual = mapa.get(nome) || { nome, total: 0, concluidas: 0, ativas: 0 };
      atual.total++;
      if (estado(o) === "FINALIZADA") atual.concluidas++;
      if (["EM_DESLOCAMENTO", "NO_LOCAL", "EM_ATENDIMENTO"].includes(estado(o))) atual.ativas++;
      mapa.set(nome, atual);
    });
    return [...mapa.values()].sort((a,b) => b.total - a.total);
  }, [base]);

  return <main className={styles.page}>
    <div className={styles.heading}>
      <div><div className={styles.kicker}>EXPEDIÇÕES / DASHBOARD OS</div><h1>Dashboard de Ordens de Serviço</h1>
        <p>Visão gerencial do atendimento em campo, deslocamentos, execução e conclusão das OS.</p></div>
      <div className={styles.headingActions}><span className={styles.local}>Dados locais • demonstração</span><Link className={styles.action} href="/admin/ordens-servico">Abrir Gestão OS ↗</Link></div>
    </div>
    <div className={styles.toolbar}>
      <div className={styles.toolbarTitle}><span className={styles.circle}>✓</span> Acompanhamento dos técnicos</div>
      <div className={styles.filters}>
        <input aria-label="Pesquisar OS" placeholder="Pesquisar OS, cliente, técnico..." value={busca} onChange={e => setBusca(e.target.value)} />
        <select aria-label="Filtrar técnico" value={tecnico} onChange={e => setTecnico(e.target.value)}><option value="TODOS">Todos os técnicos</option>{tecnicos.map(t => <option key={t} value={t}>{t}</option>)}</select>
        <select aria-label="Filtrar status" value={status} onChange={e => setStatus(e.target.value)}><option value="TODOS">Todos os status</option>{STATUS.map(s => <option key={s} value={s}>{NOMES[s]}</option>)}</select>
        <button onClick={() => {setBusca("");setTecnico("TODOS");setStatus("TODOS");}}>Limpar</button>
      </div>
    </div>
    {erro && <p className={styles.error}>{erro}</p>}
    <div className={styles.kpis}>
      {[
        {titulo:"Total de OS", valor:total, sub:"Ordens cadastradas", cor:"#468eae"},
        {titulo:"Em deslocamento", valor:contar("EM_DESLOCAMENTO"), sub:"Técnicos a caminho", cor:"#5aa7c4"},
        {titulo:"No cliente", valor:contar("NO_LOCAL"), sub:"Técnicos no destino", cor:"#85b3c4"},
        {titulo:"Em atendimento", valor:contar("EM_ATENDIMENTO"), sub:"Execução em andamento", cor:"#e49a16"},
        {titulo:"Finalizadas", valor:finalizadas, sub:`${taxa}% do total`, cor:"#2ca18e"},
        {titulo:"Com ocorrência", valor:ocorrencias, sub:"Requerem acompanhamento", cor:"#e16e7d"}
      ].map(k => <div className={styles.kpi} key={k.titulo}><div className={styles.kpiTop} style={{background:k.cor}}>{k.titulo}</div><div className={styles.kpiValue}>{k.valor}</div><div className={styles.kpiSub}>{k.sub}</div></div>)}
    </div>
    <div className={styles.two}>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Fluxo das ordens de serviço</h2><p>Distribuição por etapa atual do atendimento</p></div><span className={styles.pill}>{total} OS</span></div>
        <div className={styles.flow}>
          {etapas.map((s,i) => <div className={styles.flowStep} key={s}>
            <div className={styles.flowIcon} style={{color:CORES[s],background:`${CORES[s]}17`}}>{svg((["os","car","pin","tool","check"] as const)[i])}</div>
            <strong>{contar(s)}</strong><span>{NOMES[s]}</span>
          </div>)}
        </div>
        <div className={styles.bars}>
          {STATUS.map(s => <div className={styles.barRow} key={s}><span>{NOMES[s]}</span><div className={styles.track}><div className={styles.fill} style={{width:`${total ? contar(s)/total*100 : 0}%`,background:CORES[s]}}/></div><b>{contar(s)}</b></div>)}
        </div>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Produtividade por técnico</h2><p>OS atribuídas e finalizadas, sem metas presumidas</p></div></div>
        <div className={styles.techList}>
          {porTecnico.length ? porTecnico.map(t => <div className={styles.techRow} key={t.nome}>
            <div className={styles.techTitle}><b>{t.nome}</b><span>{t.concluidas}/{t.total} finalizadas · {t.ativas} em campo</span></div>
            <div className={styles.track}><div className={styles.fill} style={{width:`${t.total ? t.concluidas/t.total*100 : 0}%`,background:"#2ca18e"}}/></div>
          </div>) : <div className={styles.empty}>Nenhuma OS para o filtro selecionado.</div>}
        </div>
      </section>
    </div>
    <div className={styles.two}>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Atenção operacional</h2><p>Ocorrências, reagendamentos e OS com previsão vencida</p></div><span className={styles.warnCount}>{alertas.length} alertas</span></div>
        <div className={styles.alertSummary}><span>{svg("alert")} {vencidas} OS vencidas no total filtrado por técnico</span><span>{ocorrencias} OS com ocorrência</span></div>
        <div className={styles.tableWrap}><table><thead><tr><th>OS / Cliente</th><th>Técnico</th><th>Motivo</th><th>Previsão</th></tr></thead><tbody>
          {alertas.slice(0,8).map(o => <tr key={o.id}><td><Link href="/admin/ordens-servico">{o.codigo}</Link><small>{o.cliente}</small></td><td>{o.tecnico}</td><td><span className={styles.warnTag}>{atrasada(o,hoje) ? "Previsão vencida" : NOMES[estado(o)] || "Ocorrência"}</span></td><td>{dataBR(prevista(o))}</td></tr>)}
          {!alertas.length && <tr><td colSpan={4} className={styles.empty}>Nenhum alerta para os filtros selecionados.</td></tr>}
        </tbody></table></div>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Ordens de serviço</h2><p>{filtradas.length} OS encontradas nos filtros</p></div><Link className={styles.panelLink} href="/admin/ordens-servico">Ver gestão completa ↗</Link></div>
        <div className={styles.tableWrap}><table><thead><tr><th>OS / Cliente</th><th>Técnico</th><th>Previsão</th><th>Status</th></tr></thead><tbody>
          {recentes.map(o => <tr key={o.id}><td><Link href="/admin/ordens-servico">{o.codigo}</Link><small>{o.cliente}</small></td><td>{o.tecnico}</td><td>{dataBR(prevista(o))}</td><td><span className={styles.status} style={{color:CORES[estado(o)]||"#64748b",background:`${CORES[estado(o)]||"#64748b"}18`}}>{NOMES[estado(o)]||estado(o)}</span></td></tr>)}
          {!recentes.length && <tr><td colSpan={4} className={styles.empty}>Nenhuma OS encontrada.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
    <div className={styles.footer}>Painel exclusivo de OS e atendimento técnico. A Gestão de Pedidos do CD permanece separada em <Link href="/expedicoes/gestao">Expedições → Gestão</Link>. Indicadores calculados com os registros deste navegador.</div>
  </main>;
}

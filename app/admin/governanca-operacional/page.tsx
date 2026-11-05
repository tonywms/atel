"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import s from "./page.module.css";

type Dict = Record<string, unknown>;
type OS = Dict & { id?: number; codigo?: string; cliente?: string; tecnico?: string; codigoTecnico?: string; base?: string; status?: string; estadoFSM?: string; tipo?: string; historicoFSM?: unknown; itens?: unknown; dataPrevista?: string };
type Mov = Dict & { id?: string; chaveIdempotencia?: string; tipo?: string; documentoOrigem?: string; codigoTecnico?: string; tecnico?: string; codigoProduto?: string; produto?: string; quantidade?: number; criadoEm?: string };
type Est = Dict & { id?: string; codigoTecnico?: string; codigoProduto?: string; quantidade?: number; tecnico?: string };
type Data = { os: OS[]; mov: Mov[]; est: Est[]; errors: string[] };
type Tab = "visao" | "ordens" | "tecnicos" | "materiais" | "auditoria";
type Audit = { severity: "critical" | "warning"; message: string };
const KEYS = { os: "wms-expert-ordens-servico", mov: "wms-expert-movimentacoes-estoque-tecnico", est: "wms-expert-estoque-tecnico" };
const val = (v: unknown) => typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
const num = (v: number) => v.toLocaleString("pt-BR");
const status = (o: OS) => val(o.estadoFSM || o.status || "SEM_STATUS").toUpperCase();
const date = (v: unknown) => {
  const d = new Date(val(v));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
const dateOnly = (v: unknown) => {
  const x = val(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(x)) return `${x.slice(8,10)}/${x.slice(5,7)}/${x.slice(0,4)}`;
  return "—";
};
function load(): Data {
  const errors: string[] = [];
  function get(k: string): Dict[] {
    try {
      const raw = localStorage.getItem(k);
      if (raw === null) { errors.push(`Base não inicializada: ${k}`); return []; }
      const v: unknown = JSON.parse(raw);
      if (!Array.isArray(v) || !v.every(x => x !== null && typeof x === "object" && !Array.isArray(x))) {
        errors.push(`Estrutura inválida: ${k}`); return [];
      }
      return v as Dict[];
    } catch { errors.push(`Não foi possível ler: ${k}`); return []; }
  }
  return { os: get(KEYS.os), mov: get(KEYS.mov), est: get(KEYS.est), errors };
}
function statusClass(st: string) {
  if (st === "FINALIZADA") return s.done;
  if (st.includes("REAGEND") || st.includes("TRATATIVA")) return s.warn;
  if (st.startsWith("PENDENTE")) return s.pending;
  return s.active;
}
function Bars({ data, max = 0 }: { data: { label: string; value: number; detail?: string }[]; max?: number }) {
  const limit = Math.max(1, max, ...data.map(x => x.value));
  return <div className={s.bars}>{data.length ? data.map(x => <div className={s.barRow} key={x.label}>
    <div className={s.barHead}><span title={x.label}>{x.label}</span><strong>{num(x.value)}{x.detail ? <small> {x.detail}</small> : null}</strong></div>
    <div className={s.track}><div className={s.fill} style={{ width: `${Math.max(0, Math.min(100, x.value / limit * 100))}%` }} /></div>
  </div>) : <div className={s.empty}>Nenhum dado para exibir.</div>}</div>;
}
export default function GovernancaExecutiva() {
  const [data, setData] = useState<Data>({ os: [], mov: [], est: [], errors: [] });
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("visao");
  const [tech, setTech] = useState("TODOS");
  const [base, setBase] = useState("TODAS");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<OS | null>(null);
  const [lastRead, setLastRead] = useState("");
  const refresh = useCallback(() => { setData(load()); setReady(true); setLastRead(new Date().toLocaleString("pt-BR")); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const technicians = useMemo(() => Array.from(new Set(data.os.map(o => val(o.tecnico)).filter(Boolean))).sort(), [data.os]);
  const bases = useMemo(() => Array.from(new Set(data.os.map(o => val(o.base)).filter(Boolean))).sort(), [data.os]);
  const filtered = useMemo(() => data.os.filter(o => (tech === "TODOS" || o.tecnico === tech) && (base === "TODAS" || o.base === base) && (!search || `${o.codigo} ${o.cliente} ${o.tecnico} ${o.tipo}`.toLowerCase().includes(search.toLowerCase()))), [data.os, tech, base, search]);
  const techCodes = useMemo(() => new Set(filtered.map(o => val(o.codigoTecnico))), [filtered]);
  const movements = useMemo(() => data.mov.filter(m => (tech === "TODOS" || techCodes.has(val(m.codigoTecnico))) && (base === "TODAS" || filtered.some(o => o.codigoTecnico === m.codigoTecnico && o.base === base))), [data.mov, tech, base, filtered, techCodes]);
  const stats = useMemo(() => {
    const finished = filtered.filter(o => status(o) === "FINALIZADA").length;
    const pending = filtered.filter(o => status(o).startsWith("PENDENTE")).length;
    const rescheduled = filtered.filter(o => status(o).includes("REAGEND")).length;
    const events = filtered.flatMap(o => Array.isArray(o.historicoFSM) ? o.historicoFSM as Dict[] : []);
    const rescheduleEvents = events.filter(e => val(e.estadoNovo).includes("REAGEND") || val(e.motivo).includes("REAGEND") || val(e.motivo).includes("ANTECIPACAO")).length;
    const consumed = movements.filter(m => m.tipo === "SAIDA_OS");
    return { finished, pending, inProgress: filtered.length - finished - pending, rescheduled, events: events.length, rescheduleEvents, consumed: consumed.reduce((sum,m) => sum + (typeof m.quantidade === "number" ? m.quantidade : 0), 0), moves: consumed.length };
  }, [filtered, movements]);
  const byTech = useMemo(() => {
    const names = Array.from(new Set(filtered.map(o => val(o.tecnico)).filter(Boolean)));
    return names.map(name => {
      const list = filtered.filter(o => o.tecnico === name);
      const codes = new Set(list.map(o => val(o.codigoTecnico)));
      const done = list.filter(o => status(o) === "FINALIZADA").length;
      const used = movements.filter(m => m.tipo === "SAIDA_OS" && codes.has(val(m.codigoTecnico))).reduce((sum,m) => sum + (Number(m.quantidade) || 0), 0);
      return { name, total: list.length, done, pending: list.filter(o => status(o).startsWith("PENDENTE")).length, used, rate: list.length ? Math.round(done/list.length*100) : 0 };
    }).sort((a,b) => b.done - a.done || a.name.localeCompare(b.name));
  }, [filtered, movements]);
  const byProduct = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number; moves: number }>();
    for (const m of movements) {
      if (m.tipo !== "SAIDA_OS") continue;
      const code = val(m.codigoProduto);
      const item = map.get(code) || { code, name: val(m.produto), count: 0, moves: 0 };
      item.count += Number(m.quantidade) || 0; item.moves++;
      map.set(code, item);
    }
    return Array.from(map.values()).sort((a,b) => b.count - a.count);
  }, [movements]);
  const timeline = useMemo(() => {
    const events = filtered.flatMap(o => Array.isArray(o.historicoFSM) ? (o.historicoFSM as Dict[]).map(e => ({ ...e, codigo: o.codigo, tecnico: o.tecnico })) : []);
    return events.filter(e => Number.isFinite(Date.parse(val(e.ocorridoEm)))).sort((a,b) => Date.parse(val(b.ocorridoEm)) - Date.parse(val(a.ocorridoEm)));
  }, [filtered]);
  const audit = useMemo(() => {
    const alerts: Audit[] = data.errors.map(message => ({ severity: "critical", message }));
    const osIDs = new Set<string>();
    for (const o of data.os) {
      const code = val(o.codigo);
      if (!code || osIDs.has(code)) alerts.push({ severity: "critical", message: `OS ausente ou duplicada: ${code || "(sem código)"}` });
      osIDs.add(code);
      if (status(o) === "FINALIZADA" && Array.isArray(o.itens)) {
        for (const i of o.itens) {
          if (!i || typeof i !== "object" || i.destino !== "CONSUMO") continue;
          const key = `SAIDA|${code}|${val(o.codigoTecnico)}|${val(i.codigoProduto)}`;
          if (!data.mov.some(m => m.chaveIdempotencia === key)) alerts.push({ severity: "warning", message: `${code}: consumo de ${val(i.codigoProduto)} sem movimentação vinculada` });
        }
      }
    }
    const keys = new Set<string>();
    for (const m of data.mov) {
      const key = val(m.chaveIdempotencia);
      if (!key || keys.has(key)) alerts.push({ severity: "critical", message: `Movimentação com chave ausente/duplicada: ${val(m.id)}` });
      keys.add(key);
    }
    for (const e of data.est) if (typeof e.quantidade !== "number" || !Number.isFinite(e.quantidade) || e.quantidade < 0) alerts.push({ severity: "critical", message: `Saldo inválido: ${val(e.codigoTecnico)} · ${val(e.codigoProduto)}` });
    return alerts;
  }, [data]);
  const states = useMemo(() => {
    const map = new Map<string,number>();
    for (const o of filtered) { const key = status(o).replaceAll("_"," "); map.set(key,(map.get(key)||0)+1); }
    return Array.from(map, ([label,value]) => ({label,value})).sort((a,b) => b.value-a.value);
  }, [filtered]);
  const exportCsv = () => {
    const rows = [["OS","Cliente","Técnico","Base","Tipo","Status","Eventos"], ...filtered.map(o => [val(o.codigo),val(o.cliente),val(o.tecnico),val(o.base),val(o.tipo),status(o),String(Array.isArray(o.historicoFSM)?o.historicoFSM.length:0)])];
    const csv = "\uFEFF" + rows.map(r => r.map(c => `"${c.replaceAll('"','""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href=url; a.download=`ATEL_PAINEL_CONTROLE_${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <main className={s.page}>
    <div className={s.shell}>
      <header className={s.header}>
        <div><div className={s.eyebrow}><span className={s.pulse}/> ATEL FSM <span className={s.slash}>/</span> INTELIGÊNCIA OPERACIONAL <span className={s.version}>V07.8</span></div>
          <h1>Painel de Controle</h1><p>Performance de campo, rastreabilidade e controle operacional em uma única visão.</p></div>
        <div className={s.headerActions}><span className={s.local}>● DEMONSTRAÇÃO LOCAL</span><button className={s.ghostBtn} onClick={refresh}>↻ Atualizar</button><button className={s.primaryBtn} onClick={exportCsv}>↓ Exportar OS</button></div>
      </header>
      <div className={s.filterBar}>
        <label className={s.searchBox}><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar OS, cliente, técnico ou serviço" /></label>
        <select aria-label="Técnico" value={tech} onChange={e=>setTech(e.target.value)}><option value="TODOS">Todos os técnicos</option>{technicians.map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Base" value={base} onChange={e=>setBase(e.target.value)}><option value="TODAS">Todas as bases</option>{bases.map(x=><option key={x}>{x}</option>)}</select>
        <span className={s.readTime}>Leitura: {lastRead || "—"}</span>
      </div>
      {!ready ? <div className={s.empty}>Carregando dados locais...</div> : <>
        <div className={s.kpis}>
          {[
            { label: "ORDENS DE SERVIÇO", value: filtered.length, note: "Total no recorte", accent: "blue", symbol: "▤" },
            { label: "FINALIZADAS", value: stats.finished, note: `${filtered.length ? (stats.finished/filtered.length*100).toFixed(1).replace(".",",") : "0"}% de conclusão`, accent: "green", symbol: "✓" },
            { label: "PENDENTES", value: stats.pending, note: "Aguardando execução", accent: "amber", symbol: "◷" },
            { label: "EM ANDAMENTO", value: stats.inProgress, note: "Atendimentos ativos", accent: "cyan", symbol: "↗" },
            { label: "EVENTOS HISTÓRICOS", value: stats.events, note: `${stats.rescheduleEvents} relacionados a reagendamento`, accent: "violet", symbol: "≡" },
            { label: "AUDITORIA", value: audit.length, note: audit.length ? "Ocorrências para revisar" : "Sem alertas nas regras verificadas", accent: audit.length ? "amber" : "green", symbol: "◇" },
          ].map(k=><div className={`${s.kpi} ${s[k.accent]}`} key={k.label}><div className={s.kpiTop}><span>{k.label}</span><span className={s.kpiSymbol}>{k.symbol}</span></div><strong>{num(k.value)}</strong><small>{k.note}</small></div>)}
        </div>
        <nav className={s.tabs} aria-label="Seções do painel de controle">
          {([["visao","Visão executiva"],["ordens","Ordens de serviço"],["tecnicos","Produtividade"],["materiais","Materiais"],["auditoria","Auditoria"]] as [Tab,string][]).map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={tab===id?s.tabActive:""}>{label}</button>)}
        </nav>
        {tab==="visao" && <>
          <div className={s.twoCols}>
            <section className={s.panel}><div className={s.panelHead}><div><span className={s.kicker}>DISTRIBUIÇÃO OPERACIONAL</span><h2>Carteira por situação</h2></div><span className={s.panelMeta}>{filtered.length} OS</span></div><Bars data={states}/><div className={s.miniSummary}><span>Atualmente reagendadas <b>{stats.rescheduled}</b></span><span>Ocorrências históricas <b>{stats.rescheduleEvents}</b></span></div></section>
            <section className={s.panel}><div className={s.panelHead}><div><span className={s.kicker}>DESEMPENHO DE CAMPO</span><h2>Finalizações por técnico</h2></div><span className={s.panelMeta}>OS concluídas</span></div><Bars data={byTech.map(t=>({label:t.name,value:t.done,detail:`/ ${t.total} OS`}))}/></section>
          </div>
          <div className={s.twoCols}>
            <section className={s.panel}><div className={s.panelHead}><div><span className={s.kicker}>CONSUMO REAL</span><h2>Materiais aplicados em OS</h2></div><span className={s.panelMeta}>{num(stats.consumed)} UN · {stats.moves} saídas</span></div><Bars data={byProduct.map(p=>({label:`${p.code} · ${p.name}`,value:p.count}))}/></section>
            <section className={s.panel}><div className={s.panelHead}><div><span className={s.kicker}>RASTREABILIDADE</span><h2>Últimos eventos operacionais</h2></div><span className={s.panelMeta}>{timeline.length} eventos</span></div><div className={s.timeline}>{timeline.slice(0,6).map((e,i)=><div className={s.event} key={`${val(e.id)}-${i}`}><span className={s.eventDot}/><div><b>{val(e.codigo)} <span>· {val(e.estadoNovo).replaceAll("_"," ")}</span></b><small>{val(e.tecnico)} · {date(e.ocorridoEm)}</small></div></div>)}{!timeline.length&&<div className={s.empty}>Sem eventos no período disponível.</div>}</div></section>
          </div>
        </>}
        {tab==="ordens" && <section className={s.panel}><div className={s.panelHead}><div><span className={s.kicker}>CONTROLE DE ATENDIMENTOS</span><h2>Ordens de serviço</h2></div><span className={s.panelMeta}>Clique em uma OS para detalhar</span></div><div className={s.tableWrap}><table><thead><tr>{["ORDEM","CLIENTE","TÉCNICO","BASE","PREVISÃO","STATUS","EVENTOS"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{filtered.map((o,i)=><tr key={`${val(o.id)}-${i}`} onClick={()=>setSelected(o)} className={s.clickable}><td className={s.mono}>{val(o.codigo)}</td><td>{val(o.cliente)}</td><td>{val(o.tecnico)}</td><td>{val(o.base)}</td><td>{dateOnly(o.dataPrevista)}</td><td><span className={`${s.status} ${statusClass(status(o))}`}>{status(o).replaceAll("_"," ")}</span></td><td>{Array.isArray(o.historicoFSM)?o.historicoFSM.length:0}</td></tr>)}</tbody></table></div>{!filtered.length&&<div className={s.empty}>Nenhuma OS encontrada.</div>}</section>}
        {tab==="tecnicos" && <section className={s.panel}><div className={s.panelHead}><div><span className={s.kicker}>EFICIÊNCIA OPERACIONAL</span><h2>Produtividade por técnico</h2></div><span className={s.panelMeta}>{byTech.length} profissionais</span></div><div className={s.tableWrap}><table><thead><tr>{["TÉCNICO","OS ATRIBUÍDAS","FINALIZADAS","PENDENTES","TAXA DE CONCLUSÃO","UNIDADES CONSUMIDAS"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{byTech.map(t=><tr key={t.name}><td><b>{t.name}</b></td><td>{t.total}</td><td>{t.done}</td><td>{t.pending}</td><td><div className={s.rate}><div className={s.track}><div className={s.fill} style={{width:`${t.rate}%`}}/></div><b>{t.rate}%</b></div></td><td>{num(t.used)}</td></tr>)}</tbody></table></div></section>}
        {tab==="materiais" && <section className={s.panel}><div className={s.panelHead}><div><span className={s.kicker}>ESTOQUE MÓVEL</span><h2>Consumo por produto</h2></div><span className={s.panelMeta}>Somente movimentações SAIDA_OS</span></div><div className={s.tableWrap}><table><thead><tr>{["PRODUTO","DESCRIÇÃO","UNIDADES CONSUMIDAS","MOVIMENTAÇÕES"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{byProduct.map(p=><tr key={p.code}><td className={s.mono}>{p.code}</td><td>{p.name}</td><td><b>{num(p.count)}</b></td><td>{p.moves}</td></tr>)}</tbody></table></div>{!byProduct.length&&<div className={s.empty}>Nenhum consumo registrado no recorte.</div>}</section>}
        {tab==="auditoria" && <section className={s.panel}><div className={s.panelHead}><div><span className={s.kicker}>INTEGRIDADE DE DADOS</span><h2>Auditoria e alertas</h2></div><span className={s.panelMeta}>Verificações globais · {audit.length} alerta(s)</span></div><p className={s.auditNote}>Conferência de identificadores duplicados, saldos negativos e movimentações vinculadas às OS finalizadas. Não substitui conciliação contábil completa.</p>{audit.length ? audit.map((a,i)=><div className={s.alert} key={i}><span>{a.severity==="critical"?"CRÍTICO":"ATENÇÃO"}</span>{a.message}</div>) : <div className={s.clean}><span>✓</span><div><b>Nenhuma inconsistência detectada</b><small>As regras de auditoria implementadas não encontraram divergências.</small></div></div>}</section>}
      </>}
      <footer className={s.footer}>ATEL FSM · DADOS LOCAIS DO NAVEGADOR <span>Sem sincronização entre perfis ou dispositivos · Consulta somente leitura</span></footer>
    </div>
    {selected && <div className={s.overlay} onClick={()=>setSelected(null)}><section className={s.modal} role="dialog" aria-modal="true" aria-label="Detalhamento da OS" onClick={e=>e.stopPropagation()}><div className={s.modalHead}><div><span className={s.kicker}>DETALHAMENTO OPERACIONAL</span><h2>{val(selected.codigo)}</h2></div><button className={s.close} onClick={()=>setSelected(null)} aria-label="Fechar">✕</button></div><div className={s.modalBody}><div className={s.detailGrid}><div><small>CLIENTE</small><b>{val(selected.cliente)}</b></div><div><small>TÉCNICO</small><b>{val(selected.tecnico)}</b></div><div><small>BASE</small><b>{val(selected.base)}</b></div><div><small>SITUAÇÃO</small><b>{status(selected).replaceAll("_"," ")}</b></div></div><h3>Histórico de atendimento</h3>{Array.isArray(selected.historicoFSM)&&selected.historicoFSM.length ? (selected.historicoFSM as Dict[]).map((e,i)=><div className={s.historyItem} key={`${val(e.id)}-${i}`}><b>{val(e.estadoAnterior).replaceAll("_"," ")} → {val(e.estadoNovo).replaceAll("_"," ")}</b><small>{date(e.ocorridoEm)} · {val(e.tecnico)}</small>{e.observacao&&<p>{val(e.observacao)}</p>}</div>) : <p className={s.empty}>Sem eventos registrados.</p>}</div></section></div>}
  </main>;
}

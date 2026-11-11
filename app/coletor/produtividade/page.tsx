"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import styles from "./produtividade.module.css";

type PedEvento = { pedido_id: string; status_anterior: string | null; status_novo: string | null; operador_id: string | null; registrado_em: string };
type Movimento = { id: string; tipo: string | null; realizado_por: string | null; criado_em: string };
type Conjunto = { ped: PedEvento[]; movimentos: Movimento[]; usuario: string; limite: boolean; consultadoEm: Date };
type Periodo = 7 | 30;

function Icon({ name, size = 21 }: { name: "back" | "chart" | "clock" | "refresh" | "box" | "check" | "alert" | "user" | "arrow"; size?: number }) {
  let content;
  switch (name) {
    case "back": content = <path d="M19 12H5m7 7-7-7 7-7" />; break;
    case "chart": content = <><path d="M4 20V10m6 10V4m6 16v-7m4 7H3" /></>; break;
    case "clock": content = <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>; break;
    case "refresh": content = <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M19 12a7 7 0 0 0-12-5L4 12m16 0-3 5a7 7 0 0 1-12-5"/></>; break;
    case "box": content = <><path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 5 9-5m-9 5v9"/></>; break;
    case "check": content = <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>; break;
    case "alert": content = <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.1"/></>; break;
    case "user": content = <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>; break;
    default: content = <path d="m9 18 6-6-6-6"/>;
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{content}</svg>;
}

function inicioPeriodo(dias: Periodo): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (dias - 1));
  return d;
}
function diaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function tituloDia(d: Date): string { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d); }

export default function ProdutividadeColetorPage() {
  const router = useRouter();
  const [dias, setDias] = useState<Periodo>(7);
  const [escopo, setEscopo] = useState<"meu" | "autorizado">("meu");
  const [conjunto, setConjunto] = useState<Conjunto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const db = atelSupabase();
      if (!db) throw new Error("Acesso ao Supabase indisponível.");
      const { data: authData, error: authError } = await db.auth.getUser();
      if (authError || !authData.user) throw new Error("Sessão expirada. Entre novamente para visualizar sua produtividade.");
      const inicio = inicioPeriodo(dias).toISOString();
      const [a,b] = await Promise.all([
        db.from("atel_operacoes_ped_auditoria_v367")
          .select("pedido_id,status_anterior,status_novo,operador_id,registrado_em")
          .gte("registrado_em", inicio).order("registrado_em",{ ascending: false }).limit(1000),
        db.from("movimentacoes_estoque")
          .select("id,tipo,realizado_por,criado_em")
          .gte("criado_em", inicio).order("criado_em",{ ascending: false }).limit(1000),
      ]);
      if (a.error) throw new Error("Auditoria PED: " + a.error.message);
      if (b.error) throw new Error("Movimentações: " + b.error.message);
      const ped = (a.data ?? []) as PedEvento[];
      const movimentos = (b.data ?? []) as Movimento[];
      setConjunto({ ped, movimentos, usuario: authData.user.id, limite: ped.length === 1000 || movimentos.length === 1000, consultadoEm: new Date() });
    } catch (error) {
      setConjunto(null);
      setErro(error instanceof Error ? error.message : "Não foi possível consultar os registros de produtividade.");
    } finally { setCarregando(false); }
  }, [dias]);

  useEffect(() => { void carregar(); }, [carregar, versao]);
  const painel = useMemo(() => {
    const ped = (conjunto?.ped ?? []).filter(x => escopo === "autorizado" || x.operador_id === conjunto?.usuario);
    const movimentos = (conjunto?.movimentos ?? []).filter(x => escopo === "autorizado" || x.realizado_por === conjunto?.usuario);
    const distinctPed = new Set(ped.map(x => x.pedido_id));
    const agora = new Date();
    const diasGrafico: Array<{dia:string;nome:string;ped:number;mov:number}> = [];
    for (let n = dias-1; n>=0; n--) {
      const d = new Date(agora); d.setHours(0,0,0,0); d.setDate(d.getDate()-n);
      const chave = diaLocal(d.toISOString());
      diasGrafico.push({ dia: chave, nome: tituloDia(d), ped: 0, mov: 0 });
    }
    const mapa = new Map(diasGrafico.map(x=>[x.dia,x]));
    ped.forEach(x=> { const d=mapa.get(diaLocal(x.registrado_em)); if(d) d.ped++; });
    movimentos.forEach(x=> { const d=mapa.get(diaLocal(x.criado_em)); if(d) d.mov++; });
    return { ped, movimentos, pedidos: distinctPed.size, serie: diasGrafico };
  }, [conjunto, dias, escopo]);

  const atividadeTotal = painel.ped.length + painel.movimentos.length;
  const diasAtivos = painel.serie.filter(x=>x.ped+x.mov>0).length;
  const maisRecente = [...painel.serie].reverse().find(x=>x.ped+x.mov>0);
  const maxDia = Math.max(1, ...painel.serie.map(x=>x.ped+x.mov));

  return <main className={styles.screen}>
    <section className={styles.phone} aria-label="Painel de produtividade ATEL">
      <div className={styles.blackTop} aria-hidden="true"/>
      <header className={styles.header}>
        <button className={styles.back} type="button" aria-label="Voltar à expedição" onClick={()=>router.push((() => {
  // ATEL_V155_ORIGEM_RETORNO: aceitar apenas rotas operacionais conhecidas.
  const origem = new URLSearchParams(window.location.search).get("origem");
  const permitidas = new Set([
    "/coletor/separacao", "/coletor/conferencia", "/coletor/embarque",
    "/coletor/recebimento", "/coletor/retornos", "/coletor/devolucao-cd",
    "/coletor/ordens-servico"
  ]);
  return origem && permitidas.has(origem) ? origem : "/coletor/expedicoes";
})())}><Icon name="back"/></button>
        <div className={styles.headerTitle}><small>CENTRAL OPERACIONAL</small><h1>Minha produtividade</h1></div>
        <div className={styles.headIcon}><Icon name="chart" size={22}/></div>
      </header>
      <div className={styles.content}>
        <section className={styles.intro} aria-label="Resumo de atividade">
          <div className={styles.eyebrow}>ACOMPANHAMENTO OPERACIONAL</div>
          <div className={styles.sectionHeading}><div><h2>Como está seu trabalho?</h2><p>Consulte as atividades registradas no sistema.</p></div><button type="button" title="Atualizar indicadores" aria-label="Atualizar indicadores" disabled={carregando} onClick={()=>setVersao(v=>v+1)} className={styles.refresh}><Icon name="refresh" size={17}/></button></div>
        </section>
        <div className={styles.filters}>
          <div className={styles.segment} aria-label="Período de consulta">
            <button type="button" aria-pressed={dias===7} className={dias===7?styles.active:""} onClick={()=>setDias(7)}>Últimos 7 dias</button>
            <button type="button" aria-pressed={dias===30} className={dias===30?styles.active:""} onClick={()=>setDias(30)}>Últimos 30 dias</button>
          </div>
          <div className={styles.segment} aria-label="Pessoas incluídas">
            <button type="button" aria-pressed={escopo==="meu"} className={escopo==="meu"?styles.active:""} onClick={()=>setEscopo("meu")}><Icon name="user" size={14}/> Só minhas atividades</button>
            <button type="button" aria-pressed={escopo==="autorizado"} className={escopo==="autorizado"?styles.active:""} onClick={()=>setEscopo("autorizado")}>Visão autorizada</button>
          </div>
        </div>
        {carregando ? <div className={styles.message}><span className={styles.loadingRing}/><strong>Atualizando sua produtividade</strong><small>Buscando registros confirmados...</small></div>
          : erro ? <div className={styles.error}><Icon name="alert" size={25}/><strong>Não foi possível carregar os dados</strong><p>{erro}</p><button type="button" onClick={()=>setVersao(v=>v+1)}>Tentar novamente</button></div>
          : <>
            <section className={styles.hero} aria-label="Panorama do período">
              <div className={styles.heroTop}><span><Icon name="chart" size={16}/> SEU PANORAMA</span><span className={styles.periodBadge}>{dias} dias</span></div>
              <div className={styles.heroNumber}>{atividadeTotal}<span>registros de atividade</span></div>
              <div className={styles.heroBottom}><span><Icon name="check" size={15}/> {diasAtivos} {diasAtivos===1?"dia com atividade":"dias com atividade"}</span><span>{maisRecente?`Última: ${maisRecente.nome}`:"Sem movimentações"}</span></div>
            </section>
            <section className={styles.metrics} aria-label="Indicadores de produtividade">
              <div className={styles.metricWide}>
                <span className={styles.metricIcon}><Icon name="box" size={21}/></span>
                <div className={styles.metricBody}><span className={styles.metricLabel}>Pedidos movimentados</span><strong>{painel.pedidos}</strong><small>Pedidos diferentes com alteração registrada</small></div>
              </div>
              <div className={styles.metricGrid}>
                <div className={styles.metric}><div className={styles.metricTop}><Icon name="check" size={18}/><span>Atualizações de pedidos</span></div><strong>{painel.ped.length}</strong><small>Mudanças de situação dos pedidos</small></div>
                <div className={styles.metric}><div className={styles.metricTop}><Icon name="box" size={18}/><span>Movimentações de estoque</span></div><strong>{painel.movimentos.length}</strong><small>Transferências e outros registros</small></div>
              </div>
            </section>
            <section className={styles.graphBox} aria-label="Evolução diária da atividade">
              <div className={styles.graphTitle}><div><span className={styles.eyebrow}>EVOLUÇÃO</span><h3>Atividades por dia</h3></div><span className={styles.graphHint}>Registros</span></div>
              <div className={styles.legend}><span><i className={styles.pedDot}/> Pedidos</span><span><i className={styles.movDot}/> Estoque</span></div>
              <div className={styles.chart}>
                {painel.serie.map((x,index)=><div className={styles.barCol} key={x.dia} title={`${x.nome}: ${x.ped} alterações de pedidos; ${x.mov} movimentações de estoque`} aria-label={`${x.nome}: ${x.ped+x.mov} registros`}>
                  <div className={styles.barStack} style={{height:`${((x.ped+x.mov)/maxDia)*100}%`}}>
                    {x.ped>0&&<div className={styles.pedBar} style={{flexGrow:x.ped}}/>}
                    {x.mov>0&&<div className={styles.movBar} style={{flexGrow:x.mov}}/>}
                  </div>
                  {dias===7&&<span className={styles.barDay}>{x.nome.slice(0,2)}</span>}
                </div>)}
              </div>
              {dias===30&&<div className={styles.axis}><span>{painel.serie[0]?.nome}</span><span>{painel.serie[Math.floor((painel.serie.length-1)/2)]?.nome}</span><span>{painel.serie[painel.serie.length-1]?.nome}</span></div>}
              {atividadeTotal===0&&<div className={styles.emptyChart}>Nenhum registro neste período e filtro.</div>}
              <p className={styles.chartCaption}>Cada coluna representa registros realizados naquele dia, não necessariamente serviços concluídos.</p>
            </section>
            <section className={styles.explain} aria-label="Entenda os indicadores">
              {/* ATEL_V154_1_GLOSSARIO_OPERACIONAL */}
              <div className={styles.explainTitle}><Icon name="alert" size={17}/><strong>Entenda os documentos e indicadores</strong></div>
              <div className={styles.explainItem}><span className={styles.numberTag}>PED</span><p><strong>Pedido</strong> — documento de pedido. Cada mudanca de status pode gerar um registro de atividade, sem significar um novo pedido.</p></div>
              <div className={styles.explainItem}><span className={styles.numberTag}>OS</span><p><strong>Ordem de Serviço</strong> — atendimento ou demanda atribuida ao tecnico. A contagem de OS ainda nao faz parte deste painel.</p></div>
              <div className={styles.explainItem}><span className={styles.numberTag}>DEV</span><p><strong>Devolucao</strong> — documento de devolucao de materiais. Nao esta contabilizado separadamente nos indicadores atuais.</p></div>
              <div className={styles.explainItem}><span className={styles.numberTag}>RET</span><p><strong>Retorno</strong> — documento que acompanha o retorno de materiais. Nao esta contabilizado separadamente nos indicadores atuais.</p></div>
              <div className={styles.explainItem}><span className={styles.numberTag}>RET PED</span><p><strong>Retorno de Pedido</strong> — retorno relacionado a um pedido. Nao esta contabilizado separadamente nos indicadores atuais.</p></div>
              <div className={styles.explainItem}><span className={styles.numberTag}>01</span><p><strong>Pedidos movimentados</strong> conta cada pedido uma unica vez no periodo, mesmo que tenha varias atualizacoes.</p></div>
              <div className={styles.explainItem}><span className={styles.numberTag}>02</span><p><strong>Atualizacoes de pedidos</strong> conta eventos de mudanca de situacao, nao pedidos finalizados.</p></div>
              <div className={styles.explainItem}><span className={styles.numberTag}>03</span><p><strong>Movimentacoes de estoque</strong> conta operacoes registradas no estoque, nao a soma de produtos ou unidades.</p></div>
            </section>
            <div className={styles.info}><Icon name="user" size={17}/><p>{escopo==="meu"?"Exibindo somente operações associadas ao seu usuário. Registros sem responsável identificado não entram nessa visão.":"Exibindo registros aos quais sua conta tem acesso. Isso pode incluir atividades de outros operadores."}</p></div>
            {conjunto?.limite&&<div className={styles.warning}><Icon name="alert" size={17}/> Foram encontrados 1.000 registros em uma fonte. Os totais podem estar incompletos.</div>}
            <p className={styles.updated}>Atualizado às {conjunto?.consultadoEm.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} • Consulta somente leitura</p>
          </>}
      </div>
      <div className={styles.androidNav} aria-hidden="true"><span className={styles.navBack}/><span className={styles.navHome}/><span className={styles.navRecent}/></div>
    </section>
  </main>;
}

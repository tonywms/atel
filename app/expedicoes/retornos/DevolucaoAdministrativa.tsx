"use client";

import { useEffect, useRef, useState } from "react";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import {
  ESCRITA_DEVOLUCAO_LIBERADA, ErroAdministrativo, aprovarAdministrativa, consultarCDPrincipal,
  listarAdministrativas, rejeitarAdministrativa, solicitarAdministrativa, uuidAdministrativo,
  type CDPrincipal, type CursorAdministrativo, type DecidirAdministrativa, type RequisicaoAdministrativa,
  type SolicitarAdministrativa, type StatusAdministrativo,
} from "./devolucaoAdmin";
import styles from "./devolucao.module.css";

type Local = { id: string; nome: string; tipo: string };
type Material = { id: string; sku: string; descricao: string; unidade: string; rastreio: string };
type ItemEdicao = { materialUuid: string; quantidade: string; rastreios: string };
type Operacao = { tipo: "SOLICITAR"; dados: SolicitarAdministrativa } | { tipo: "APROVAR" | "REJEITAR"; dados: DecidirAdministrativa };
const itemVazio = (): ItemEdicao => ({ materialUuid: "", quantidade: "", rastreios: "" });
const mensagem = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir a operação.";

export default function DevolucaoAdministrativa() {
  const [catalogo, setCatalogo] = useState<{ locais: Local[]; materiais: Material[] } | null>(null);
  const [erroCatalogo, setErroCatalogo] = useState("");
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(true);
  const [cd, setCD] = useState<CDPrincipal | null>(null);
  const [erroCD, setErroCD] = useState("");
  const [carregandoCD, setCarregandoCD] = useState(true);
  const [requisicoes, setRequisicoes] = useState<RequisicaoAdministrativa[]>([]);
  const [estadoLista, setEstadoLista] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [erroLista, setErroLista] = useState("");
  const [filtro, setFiltro] = useState<StatusAdministrativo | "">("");
  const [pagina, setPagina] = useState<CursorAdministrativo | null>(null);
  const [proximaPagina, setProximaPagina] = useState<CursorAdministrativo | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [origem, setOrigem] = useState("");
  const [motivo, setMotivo] = useState("");
  const [itens, setItens] = useState<ItemEdicao[]>([itemVazio()]);
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [operando, setOperando] = useState(false);
  const [erroAcao, setErroAcao] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [pendente, setPendente] = useState<Operacao | null>(null);
  const trava = useRef(false);
  const vivo = useRef(true);
  const intencoes = useRef(new Map<string, string>());
  const congelado = operando || pendente !== null;
  const escritasBloqueadas = !ESCRITA_DEVOLUCAO_LIBERADA || carregandoCD || !cd || Boolean(erroCD);

  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  useEffect(() => {
    if (!congelado) return;
    const proteger = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", proteger);
    return () => window.removeEventListener("beforeunload", proteger);
  }, [congelado]);

  useEffect(() => {
    const controller = new AbortController();
    setCarregandoCatalogo(true); setErroCatalogo(""); setCatalogo(null);
    void (async () => {
      try {
        const db = atelSupabase();
        if (!db) throw Error("Supabase indisponível para consultar os cadastros.");
        const { data: { session }, error } = await db.auth.getSession();
        if (error || !session) throw Error("Entre novamente para consultar os cadastros.");
        const response = await fetch("/api/estoque-wms/catalogo", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Falha ao consultar o catálogo.");
        if (!Array.isArray(data.locais) || !Array.isArray(data.materiais)
          || !data.locais.every((l: Local) => l && uuidAdministrativo(l.id) && typeof l.nome === "string" && typeof l.tipo === "string")
          || !data.materiais.every((m: Material) => m && uuidAdministrativo(m.id) && typeof m.sku === "string" && typeof m.descricao === "string" && typeof m.unidade === "string" && typeof m.rastreio === "string")) throw Error("Catálogo WMS com formato inválido.");
        if (!controller.signal.aborted) setCatalogo({ locais: data.locais, materiais: data.materiais });
      } catch (error) { if (!controller.signal.aborted) setErroCatalogo(mensagem(error)); }
      finally { if (!controller.signal.aborted) setCarregandoCatalogo(false); }
    })();
    return () => controller.abort();
  }, [tentativa]);

  useEffect(() => {
    const controller = new AbortController();
    setCarregandoCD(true); setErroCD(""); setCD(null);
    void consultarCDPrincipal(controller.signal).then(data => { if (!controller.signal.aborted) setCD(data); })
      .catch(error => { if (!controller.signal.aborted) setErroCD(mensagem(error)); })
      .finally(() => { if (!controller.signal.aborted) setCarregandoCD(false); });
    return () => controller.abort();
  }, [tentativa]);

  useEffect(() => {
    const controller = new AbortController();
    setEstadoLista("carregando"); setErroLista(""); setProximaPagina(null);
    if (!pagina) setRequisicoes([]);
    void listarAdministrativas(filtro, pagina, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      if (pagina && data.proximo_cursor?.id === pagina.id && data.proximo_cursor.criada_em === pagina.criada_em) throw Error("Cursor de consulta inválido. Atualize a lista.");
      setRequisicoes(atuais => pagina ? [...new Map([...atuais, ...data.requisicoes].map(r => [r.id, r])).values()] : data.requisicoes);
      setProximaPagina(data.proximo_cursor); setEstadoLista("pronto");
    }).catch(error => { if (!controller.signal.aborted) { setErroLista(mensagem(error)); setEstadoLista("erro"); } });
    return () => controller.abort();
  }, [filtro, pagina, tentativa]);

  function atualizar() { setPagina(null); setTentativa(v => v + 1); }
  function chavePara(assinatura: string) {
    const existente = intencoes.current.get(assinatura);
    if (existente) return existente;
    const chave = crypto.randomUUID(); intencoes.current.set(assinatura, chave); return chave;
  }
  async function executar(op: Operacao) {
    if (trava.current || escritasBloqueadas) return;
    trava.current = true; setOperando(true); setErroAcao(""); setSucesso("");
    try {
      const resultado = op.tipo === "SOLICITAR" ? await solicitarAdministrativa(op.dados)
        : op.tipo === "APROVAR" ? await aprovarAdministrativa(op.dados) : await rejeitarAdministrativa(op.dados);
      if (!vivo.current) return;
      setPendente(null);
      setSucesso(`Requisição ${resultado.requisicao_id}: ${resultado.status.toLowerCase()}.`);
      if (op.tipo === "SOLICITAR") { setOrigem(""); setMotivo(""); setItens([itemVazio()]); }
      else setJustificativas(atuais => ({ ...atuais, [op.dados.requisicao_id]: "" }));
      intencoes.current.clear(); atualizar();
    } catch (error) {
      if (!vivo.current) return;
      setErroAcao(mensagem(error));
      setPendente(error instanceof ErroAdministrativo && error.indeterminado ? op : null);
    } finally { trava.current = false; if (vivo.current) setOperando(false); }
  }
  function solicitar() {
    if (escritasBloqueadas || congelado || !catalogo) return;
    try {
      const normalizados = itens.map(item => {
        const material = catalogo.materiais.find(m => m.id === item.materialUuid);
        const quantidade = Number(item.quantidade);
        if (!material || !item.quantidade.trim() || !Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 100000000
          || (material.rastreio !== "metragem" && !Number.isInteger(quantidade)) || !/^\d+(?:\.\d{1,3})?$/.test(item.quantidade.trim())) throw Error("Revise o material e a quantidade de cada item (até três casas decimais).");
        const rastreios = item.rastreios.split(/\r?\n/).map(s => s.trim().toUpperCase()).filter(Boolean)
          .map(s => material.rastreio === "mac" ? s.replace(/[:.\-]/g, "") : s).sort();
        if ((material.rastreio === "serial" || material.rastreio === "mac") && (rastreios.length !== quantidade || rastreios.length > 1000 || new Set(rastreios).size !== rastreios.length
          || rastreios.some(s => material.rastreio === "mac" ? !/^[0-9A-F]{12}$/.test(s) : s.length > 120))) throw Error("Informe um serial ou MAC válido e único por unidade.");
        return { material_id: material.id, quantidade, seriais: material.rastreio === "serial" ? rastreios : [], macs: material.rastreio === "mac" ? rastreios : [] };
      }).sort((a, b) => a.material_id.localeCompare(b.material_id));
      const dados = { origem_id: origem, motivo: motivo.trim(), itens: normalizados };
      void executar({ tipo: "SOLICITAR", dados: { ...dados, chave: chavePara(JSON.stringify(["SOLICITAR", dados])) } });
    } catch (error) { setErroAcao(mensagem(error)); }
  }
  function decidir(r: RequisicaoAdministrativa, tipo: "APROVAR" | "REJEITAR") {
    if (escritasBloqueadas || congelado || r.status !== "SOLICITADA") return;
    const dados = { requisicao_id: r.id, revisao: r.revisao, justificativa: (justificativas[r.id] ?? "").trim() };
    void executar({ tipo, dados: { ...dados, chave: chavePara(JSON.stringify([tipo, dados])) } });
  }
  const origens = catalogo?.locais.filter(l => l.tipo === "ponto_apoio") ?? [];
  const nomeLocal = (id: string) => catalogo?.locais.find(l => l.id === id)?.nome ?? id;
  function alterarItem(index: number, valor: Partial<ItemEdicao>) { setItens(atuais => atuais.map((item, i) => i === index ? { ...item, ...valor } : item)); }

  return <section id="solicitacao-devolucao" className={styles.panel} aria-labelledby="devolucao-titulo">
    <div className={styles.heading}><div><span className={styles.eyebrow}>REQUISIÇÃO ADMINISTRATIVA</span><h2 id="devolucao-titulo">Devolução Mini-CD → CD Principal</h2><p>Solicitações administrativas e decisões. O RET acompanha o envio físico em uma etapa posterior.</p></div><span className={styles.badge}>{ESCRITA_DEVOLUCAO_LIBERADA ? "Gestão administrativa" : "Escritas bloqueadas"}</span></div>
    {!ESCRITA_DEVOLUCAO_LIBERADA && <p id="devolucao-disponibilidade" className={styles.notice}>Solicitar, aprovar e rejeitar permanecem indisponíveis até a instalação e validação das cinco operações no Supabase. As consultas exibem apenas dados confirmados pelo servidor. O preenchimento ainda não enviado fica somente nesta página.</p>}
    <div className={styles.readActions}><button type="button" className={styles.secondary} disabled={congelado || carregandoCD || carregandoCatalogo || estadoLista === "carregando"} onClick={atualizar}>Atualizar consultas</button></div>
    {carregandoCD && <p role="status">Consultando CD Principal…</p>}
    {erroCD && <p role="alert" className={styles.error}>CD Principal: {erroCD}</p>}
    {carregandoCatalogo && <p role="status">Consultando Mini-CDs e materiais…</p>}
    {erroCatalogo && <p role="alert" className={styles.error}>{erroCatalogo}</p>}
    {erroAcao && <p role="alert" className={styles.error}>{erroAcao}</p>}
    {sucesso && <p role="status" className={styles.success}>{sucesso}</p>}
    {pendente && <div className={styles.notice} role="alert">O resultado da operação não foi confirmado. Preserve estes dados e tente novamente; a mesma chave será utilizada.<button type="button" className={styles.secondary} disabled={escritasBloqueadas || operando} onClick={() => void executar(pendente)}>Repetir operação</button></div>}
    <form onSubmit={event => { event.preventDefault(); solicitar(); }} aria-describedby={!ESCRITA_DEVOLUCAO_LIBERADA ? "devolucao-disponibilidade" : undefined}>
      <fieldset disabled={carregandoCatalogo || !catalogo || congelado} className={styles.fields}><legend>Origem, destino e materiais</legend>
        <div className={styles.route}><label>Mini-CD de origem<select value={origem} onChange={e => setOrigem(e.target.value)}><option value="">Selecione o Mini-CD</option>{origens.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label><label>Destino exclusivo<input readOnly value={cd?.nome ?? "CD Principal — aguardando confirmação"} /></label></div>
        <p className={styles.help}>{cd ? `Destino confirmado pelo servidor: ${cd.local_id}.` : "O destino só será identificado pela consulta ao CD Principal da mesma organização."}</p>
        {catalogo && !origens.length && <p className={styles.notice}>Nenhum Mini-CD ativo foi retornado para esta organização.</p>}
        {itens.map((item, index) => { const m = catalogo?.materiais.find(x => x.id === item.materialUuid); return <fieldset key={index} className={styles.item}><legend>Item {index + 1}</legend>
          <div className={styles.itemFields}><label>Material<select value={item.materialUuid} onChange={e => alterarItem(index, { materialUuid: e.target.value, quantidade: "", rastreios: "" })}><option value="">Selecione o material</option>{catalogo?.materiais.map(m => <option key={m.id} value={m.id} disabled={itens.some((outro, i) => i !== index && outro.materialUuid === m.id)}>{m.sku} — {m.descricao}</option>)}</select></label><label>Quantidade {m ? `(${m.unidade})` : ""}<input type="number" min="0" step={m?.rastreio === "metragem" ? "0.001" : "1"} value={item.quantidade} onChange={e => alterarItem(index, { quantidade: e.target.value })} /></label></div>
          {(m?.rastreio === "serial" || m?.rastreio === "mac") && <label>{m.rastreio === "mac" ? "MACs" : "Seriais"}, um por linha<textarea rows={3} maxLength={130000} value={item.rastreios} onChange={e => alterarItem(index, { rastreios: e.target.value })} /><span className={styles.help}>A custódia e a identidade dos ativos serão validadas pelo servidor.</span></label>}
          {itens.length > 1 && <button type="button" className={styles.secondary} onClick={() => setItens(atuais => atuais.filter((_, i) => i !== index))}>Remover item {index + 1}</button>}
        </fieldset>; })}
        <button type="button" className={styles.secondary} disabled={itens.length >= 100} onClick={() => setItens(atuais => [...atuais, itemVazio()])}>Adicionar material</button>
        <label>Motivo da devolução<textarea rows={3} maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
      </fieldset>
      <div className={styles.footer}><p>Solicitar e aprovar não movimentam estoque nem geram RET.</p><button type="submit" className="ret-action-button" disabled={escritasBloqueadas || congelado || !catalogo}>{operando ? "Processando…" : ESCRITA_DEVOLUCAO_LIBERADA ? "Enviar solicitação" : "Enviar solicitação — indisponível"}</button></div>
    </form>
    <div className={styles.administrativeList} aria-busy={estadoLista === "carregando"}>
      <div className={styles.heading}><h3>Requisições administrativas</h3><label>Status<select value={filtro} disabled={congelado} onChange={e => { setFiltro(e.target.value as StatusAdministrativo | ""); setPagina(null); }}><option value="">Todos</option><option value="SOLICITADA">Solicitadas</option><option value="APROVADA">Aprovadas</option><option value="REJEITADA">Rejeitadas</option></select></label></div>
      {estadoLista === "carregando" && <p role="status">Consultando requisições…</p>}
      {erroLista && <p role="alert" className={styles.error}>{erroLista}</p>}
      {estadoLista === "pronto" && !requisicoes.length && <p className={styles.help}>Nenhuma requisição administrativa encontrada para este filtro.</p>}
      {requisicoes.map(r => <article key={r.id} className={styles.request}><div className={styles.heading}><div><strong className={styles.identifier}>{r.id}</strong><p>{nomeLocal(r.origem_id)} → {nomeLocal(r.destino_id)}</p></div><span className={styles.badge}>{r.status}</span></div><p>{r.motivo}</p><p className={styles.help}>{new Date(r.criada_em).toLocaleString("pt-BR")} · Revisão {r.revisao}</p>
        <ul>{r.itens.map(i => <li key={i.id}>{i.sku} — {i.descricao}: {i.quantidade} {i.unidade}{i.seriais.length > 0 && <span className={styles.help}> · Seriais: {i.seriais.join(", ")}</span>}{i.macs.length > 0 && <span className={styles.help}> · MACs: {i.macs.join(", ")}</span>}</li>)}</ul>
        {r.justificativa && <p className={styles.help}>Decisão: {r.justificativa}</p>}
        {r.status === "SOLICITADA" && <><label>Justificativa da decisão<textarea rows={2} maxLength={1000} disabled={congelado || !ESCRITA_DEVOLUCAO_LIBERADA} value={justificativas[r.id] ?? ""} onChange={e => setJustificativas(atuais => ({ ...atuais, [r.id]: e.target.value }))} /></label><div className={styles.decisionActions}><button type="button" className={styles.secondary} disabled={escritasBloqueadas || congelado || (justificativas[r.id] ?? "").trim().length < 3} onClick={() => decidir(r, "APROVAR")}>Aprovar</button><button type="button" className={styles.secondary} disabled={escritasBloqueadas || congelado || (justificativas[r.id] ?? "").trim().length < 3} onClick={() => decidir(r, "REJEITAR")}>Rejeitar</button></div></>}
      </article>)}
      {proximaPagina && estadoLista === "pronto" && <button type="button" className={styles.secondary} disabled={congelado} onClick={() => setPagina(proximaPagina)}>Carregar mais requisições</button>}
    </div>
  </section>;
}

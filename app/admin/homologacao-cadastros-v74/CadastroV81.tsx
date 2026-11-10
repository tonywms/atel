"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import ui from "./atel-v80.module.css";
import tokens from "@/components/atel-ui/atel-tokens.module.css";
import { AtelPageHeader, AtelStatCard, AtelDataTable } from "@/components/atel-ui";
import { Warehouse, Package, MapPinned, Search, RefreshCw, Database, Layers3, ShieldCheck, ChevronLeft, ChevronRight, X, AlertCircle, Inbox, SlidersHorizontal, CheckCircle2, XCircle, Filter, Info } from "lucide-react";

type Tipo = "produtos" | "depositos" | "enderecos";
type Linha = Record<string, string | number | boolean | null>;
const PAGE_SIZE = 25;
const config: Record<Tipo, { titulo: string; descricao: string; tabela: string; busca: string }> = {
  produtos: { titulo: "Produtos", descricao: "Catálogo de produtos para validação operacional", tabela: "atel_erp_produto_catalogo", busca: "Pesquisar descrição ou nome" },
  depositos: { titulo: "Depósitos", descricao: "Estrutura de depósitos para homologação", tabela: "atel_erp_depositos", busca: "Pesquisar depósito" },
  enderecos: { titulo: "Endereços", descricao: "Endereçamento logístico para homologação", tabela: "atel_erp_enderecos", busca: "Pesquisar rua" },
};
const labels: Record<string, string> = { idproduto: "ID WMS", codigoproduto: "Código", nome: "Descrição", unidadepadrao: "Unidade", idempresa: "Empresa", idfilial: "Filial", idendereco: "ID endereço", idenderecodeposito: "Depósito", idtipodeposito: "Tipo", rua: "Rua", predio: "Prédio", andar: "Andar", apto: "Apto", ativo: "Situação", controlalote: "Lote", controlavalidade: "Validade", controlanumserie: "Série" };
const cols: Record<Tipo, string[]> = {
  produtos: ["idempresa", "idproduto", "codigoproduto", "nome", "unidadepadrao", "controlalote", "controlavalidade", "controlanumserie"],
  depositos: ["idempresa", "idenderecodeposito", "nome", "idtipodeposito", "ativo"],
  enderecos: ["idfilial", "idendereco", "rua", "predio", "andar", "apto", "idenderecodeposito", "ativo"],
};
function valueOf(value: unknown) { if (value === null || value === undefined || value === "") return "—"; if (typeof value === "boolean") return value ? "Sim" : "Não"; return String(value); }
function cellValue(column: string, value: unknown) {
  if (typeof value === "boolean") return <span className={`${ui.status} ${value ? ui.statusYes : ui.statusNo}`}>{value ? "Sim" : "Não"}</span>;
  if (column === "nome") return <strong className={ui.productName}>{valueOf(value)}</strong>;
  if (column.startsWith("id") || column === "codigoproduto") return <span className={ui.code}>{valueOf(value)}</span>;
  return valueOf(value);
}
export default function CadastroV81({ tipo }: { tipo: Tipo }) {
  const [busca, setBusca] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [idAplicado, setIdAplicado] = useState("");
  const [idFiltro, setIdFiltro] = useState("");
  const [pagina, setPagina] = useState(1);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => { const timeout = setTimeout(() => setBuscaAplicada(busca), 350); return () => clearTimeout(timeout); }, [busca]);
  useEffect(() => { const timeout = setTimeout(() => setIdAplicado(idFiltro), 350); return () => clearTimeout(timeout); }, [idFiltro]);
  const client = useMemo(() => atelSupabase(), []);
  const carregar = useCallback(async (signal: AbortSignal) => {
    setCarregando(true); setErro("");
    try {
      if (!client) throw new Error("Cliente Supabase indisponível");
      const { data: { session }, error } = await client.auth.getSession();
      if (error || !session?.access_token) throw new Error("Entre com uma sessão Supabase válida");
      if (signal.aborted) return;
      const params = new URLSearchParams({ tipo, pagina: String(pagina), busca: buscaAplicada });
      if (idAplicado) params.set("id", idAplicado);
      if (empresa && tipo !== "enderecos") params.set("empresa", empresa);
      const res = await fetch(`/api/homologacao-cadastros-v74?${params.toString()}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Falha ao consultar os cadastros");
      if (!signal.aborted) { setLinhas(Array.isArray(body.registros) ? body.registros : []); setTotal(Number(body.total) || 0); }
    } catch (e) {
      if (signal.aborted) return;
      setErro(e instanceof Error ? e.message : "Erro inesperado");
    } finally { if (!signal.aborted) setCarregando(false); }
  }, [client, tipo, pagina, buscaAplicada, empresa, idAplicado]);
  useEffect(() => { const controller = new AbortController(); void carregar(controller.signal); return () => controller.abort(); }, [carregar, revisao]);
  const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const inicio = total ? (pagina - 1) * PAGE_SIZE + 1 : 0;
  const fim = Math.min(pagina * PAGE_SIZE, total);
  const Icone = tipo === "produtos" ? Package : tipo === "depositos" ? Warehouse : MapPinned;
  const temFiltros = Boolean(busca || empresa || idFiltro);
  // Contagens restritas aos registros carregados; nao representam a base inteira.
  const temSituacao = cols[tipo].includes("ativo");
  const ativosVisiveis = linhas.filter(r => r.ativo === true).length;
  const inativosVisiveis = linhas.filter(r => r.ativo === false).length;
  const situacoesConhecidas = ativosVisiveis + inativosVisiveis;
  const filtrosAtivos = [idFiltro ? `ID: ${idFiltro}` : "", busca ? `Pesquisa: ${busca}` : "", empresa && tipo !== "enderecos" ? `Empresa: ${empresa}` : ""].filter(Boolean);

  const limparFiltros = () => { setBusca(""); setEmpresa(""); setIdFiltro(""); setPagina(1); };
  return <main className={`${tokens.atelRoot} ${ui.page}`}>
    <section className={ui.hero} aria-labelledby="atel-cadastro-titulo">
      <div className={ui.heroTop}>
        <div className={ui.breadcrumb}><Layers3 size={15} aria-hidden="true"/> Cadastros <span>›</span> Homologação <span>›</span> <strong>{config[tipo].titulo}</strong></div>
        <span className={ui.environment}><ShieldCheck size={15}/> Ambiente de homologação</span>
      </div>
      <AtelPageHeader className={ui.heroMain} iconClassName={ui.heroIcon} title={config[tipo].titulo} description={`${config[tipo].descricao}. Consulta autenticada aos registros existentes.`} icon={<Icone size={29} strokeWidth={1.8}/>} titleId="atel-cadastro-titulo" titleClassName={ui.heroTitle} descriptionClassName={ui.heroDescription} action={<button type="button" className={ui.heroRefresh} title="Atualizar dados" aria-label="Atualizar dados" disabled={carregando} onClick={() => setRevisao(n => n + 1)}><RefreshCw size={20} className={carregando ? ui.spinning : ""}/></button>} />
      <div className={ui.stats} aria-label="Indicadores da consulta">
        <AtelStatCard className={`${ui.stat} ${ui.statBlue}`} iconClassName={ui.statIcon} labelClassName={ui.statLabel} valueClassName={ui.statNumber} icon={<Database size={25}/>} label={"Registros encontrados"} value={total.toLocaleString("pt-BR")} note={"Resultado da consulta atual"} />
        <AtelStatCard className={`${ui.stat} ${ui.statGreen}`} iconClassName={ui.statIcon} labelClassName={ui.statLabel} valueClassName={ui.statNumber} icon={<CheckCircle2 size={25}/>} label={temSituacao ? "Ativos na página" : "Registros na página"} value={temSituacao ? ativosVisiveis : linhas.length} note={temSituacao ? `De ${situacoesConhecidas} com situação identificada` : `Página ${pagina} de ${paginas}`} />
        <AtelStatCard className={`${ui.stat} ${ui.statRed}`} iconClassName={ui.statIcon} labelClassName={ui.statLabel} valueClassName={ui.statNumber} icon={<XCircle size={25}/>} label={temSituacao ? "Inativos na página" : "Páginas disponíveis"} value={temSituacao ? inativosVisiveis : paginas} note={temSituacao ? "Somente registros exibidos" : `${PAGE_SIZE} registros por página`} />
        <AtelStatCard className={`${ui.stat} ${ui.statPurple}`} iconClassName={ui.statIcon} labelClassName={ui.statLabel} valueClassName={ui.statSource} icon={<Database size={25}/>} label={"Origem dos dados"} value={config[tipo].tabela} note={"Supabase · Consulta autenticada"} />
      </div>
    </section>
    <section className={ui.panel} aria-labelledby="consulta-title">
      <div className={ui.panelHeader}>
        <div><h2 id="consulta-title"><Filter size={22}/> Consulta cadastral</h2><p>Pesquise, filtre e navegue pelos registros de homologação.</p></div>
        <button type="button" className={ui.refresh} disabled={carregando} onClick={() => setRevisao(n => n + 1)}><RefreshCw size={16} className={carregando ? ui.spinning : ""}/>{carregando ? "Atualizando…" : "Atualizar dados"}</button>
      </div>
      <div className={ui.filters}>
        <label className={ui.field}><span>{tipo === "produtos" ? "ID PRODUTO" : tipo === "depositos" ? "ID DEPÓSITO" : "ID ENDEREÇO"}</span><input type="text" inputMode="numeric" value={idFiltro} placeholder="ID exato" onChange={e => {setIdFiltro(e.target.value.replace(/\D/g, ""));setPagina(1);}} /></label>
        <label className={`${ui.field} ${ui.search}`}><span>{tipo === "enderecos" ? "PESQUISAR RUA" : tipo === "depositos" ? "PESQUISAR DEPÓSITO" : "PESQUISAR DESCRIÇÃO"}</span><div className={ui.searchBox}><Search size={17} aria-hidden="true"/><input type="search" value={busca} placeholder={config[tipo].busca} onChange={e => {setBusca(e.target.value);setPagina(1);}} /></div></label>
        <label className={ui.field}><span>EMPRESA</span><input type="text" inputMode="numeric" value={empresa} disabled={tipo === "enderecos"} placeholder={tipo === "enderecos" ? "Não aplicável" : "Todas"} onChange={e => {setEmpresa(e.target.value.replace(/\D/g, ""));setPagina(1);}} /></label>
        <button type="button" className={ui.clear} disabled={!temFiltros} onClick={limparFiltros}><X size={16}/> Limpar filtros</button>
      </div>
      <div className={ui.filterSummary}><div className={ui.filterChips}><span>Filtros aplicados:</span>{filtrosAtivos.length ? filtrosAtivos.map(f => <span className={ui.chip} key={f}>{f}</span>) : <span className={ui.chip}>Todos os registros</span>}</div>{temFiltros && <button type="button" onClick={limparFiltros}><X size={14}/> Limpar filtros</button>}</div>
      {erro && <div className={ui.error} role="alert"><AlertCircle size={19}/><span>Não foi possível atualizar os registros: {erro}. {linhas.length ? "Exibindo os últimos dados consultados." : ""}</span></div>}
      {temSituacao && <p className={ui.scopeNote}><Info size={14}/> Os indicadores de ativos e inativos consideram apenas os registros carregados nesta página, não o total do banco.</p>}
      <div className={ui.tableWrap} aria-busy={carregando}>
        <AtelDataTable className={ui.table}>
          <thead><tr><th scope="col" className={ui.ordinal}>#</th>{cols[tipo].map(c => <th key={c} scope="col">{labels[c] || c}</th>)}</tr></thead>
          <tbody>
            {carregando && !linhas.length ? Array.from({length: 6}, (_, index) => <tr key={`skeleton-${index}`} aria-hidden="true"><td><span className={ui.skeleton}/></td>{cols[tipo].map(c => <td key={c}><span className={ui.skeleton}/></td>)}</tr>) : linhas.length ? linhas.map((r,i) => <tr key={`${tipo}-${pagina}-${r.idproduto ?? r.idendereco ?? r.idenderecodeposito ?? i}-${i}`}><td className={ui.ordinal}>{(pagina-1)*PAGE_SIZE+i+1}</td>{cols[tipo].map(c => <td key={c}>{cellValue(c,r[c])}</td>)}</tr>) : <tr><td colSpan={cols[tipo].length + 1}><div className={ui.empty}><Inbox size={30}/><strong>{erro ? "Consulta indisponível" : "Nenhum registro encontrado"}</strong><span>{erro ? "Tente atualizar os dados." : "Experimente ajustar os filtros de pesquisa."}</span></div></td></tr>}
          </tbody>
        </AtelDataTable>
      </div>
      <footer className={ui.footer}><span>Exibindo <strong>{inicio}–{fim}</strong> de <strong>{total.toLocaleString("pt-BR")}</strong> registros {carregando && <span className={ui.updating}>· Atualizando…</span>}</span><nav className={ui.pagination} aria-label="Paginação dos registros"><span>Itens por página: <strong>{PAGE_SIZE}</strong></span><button type="button" aria-label="Página anterior" disabled={pagina <= 1 || carregando} onClick={() => setPagina(atual => Math.max(1,atual-1))}><ChevronLeft size={18}/></button><span className={ui.currentPage} aria-current="page">{pagina}</span><button type="button" aria-label="Próxima página" disabled={pagina >= paginas || carregando} onClick={() => setPagina(atual => atual+1)}><ChevronRight size={18}/></button></nav></footer>
    </section>
  </main>;
}

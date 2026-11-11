"use client";


import "@/app/coletor/retornos/atel-v47.css";
import "@/app/coletor/retornos/atel-v47-2.css";
import "./atel-v133-dev-conferencia.css";
import "./atel-v134-dev-bipagem.css";


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { atelSupabase } from "@/lib/atelSupabaseV08";

type Item = {
  chave: string;
  sku: string;
  produto: string;
  recusado: number;
  seriais?: string[];
};
type Dev = {
  id: string;
  codigo: string;
  ret_codigo: string;
  status: string;
  itens: Item[];
  endereco_id?: string;
  documento_origem?: string;
  tecnico?: string;
  codigo_tecnico?: string;
  base?: string;
  origem_fisica?: string;
  destino_fisico?: string;
  fonte?: "v105" | "v106";
};
type Endereco = { id: string; codigo: string; descricao: string };
type Conferencia = {
  chave: string;
  quantidade: number;
  condicao: string;
  seriais: string[];
  observacao: string;
};

// ATEL_E1_V134_ADDRESS_HELPERS - enderecamento real, sem valores inventados.
type PosicaoEnderecoDev = { rua: string; predio: string; andar: string; apartamento: string };

function extrairPosicaoEnderecoDev(local?: Endereco): PosicaoEnderecoDev {
  const vazio = { rua: "—", predio: "—", andar: "—", apartamento: "—" };
  if (!local) return vazio;
  const descricao = `${local.codigo ?? ""} | ${local.descricao ?? ""}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const valor = (padrao: RegExp) => {
    const encontrado = descricao.match(padrao)?.[1];
    return encontrado ? encontrado.padStart(2, "0") : "—";
  };
  let posicao: PosicaoEnderecoDev = {
    rua: valor(/\b(?:RUA|R)\s*(?:N[.º°]?\s*)?[:=\-]?\s*(\d+)\b/),
    predio: valor(/\b(?:PREDIO|P)\s*(?:N[.º°]?\s*)?[:=\-]?\s*(\d+)\b/),
    andar: valor(/\b(?:ANDAR|AND)\s*[:=\-]?\s*(\d+)\b/),
    apartamento: valor(/\b(?:APTO|APT|APARTAMENTO)\s*[:=\-]?\s*(\d+)\b/),
  };
  // Suporte tambem a etiquetas na notacao compacta R 2000 P 1 A 0 A 0.
  const sequencia = descricao.match(/\bR\s*[:=\-]?\s*(\d+)\s*[,|;/\s]+P\s*[:=\-]?\s*(\d+)\s*[,|;/\s]+A\s*[:=\-]?\s*(\d+)\s*[,|;/\s]+A\s*[:=\-]?\s*(\d+)\b/);
  if (sequencia) {
    posicao = {
      rua: sequencia[1].padStart(2, "0"),
      predio: sequencia[2].padStart(2, "0"),
      andar: sequencia[3].padStart(2, "0"),
      apartamento: sequencia[4].padStart(2, "0"),
    };
  }
  return posicao;
}

const OPCOES_CONDICAO_DEV = [
  { valor: "OK", titulo: "Material OK", legenda: "Produto em boas condições" },
  { valor: "AVARIA", titulo: "Avariado", legenda: "Produto com dano físico" },
  { valor: "DIVERGENCIA", titulo: "Divergência", legenda: "Diferença identificada" },
] as const;

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", minWidth: 0, boxSizing: "border-box",
  padding: 11, border: "1px solid #cbd5e1", borderRadius: 10,
  background: "white", color: "#12324a", fontSize: 14,
};

export default function DevolucaoCDRetV105() {
  const router = useRouter();
  const params = useParams<{ codigo?: string }>(); // ATEL_E1_V131_ROUTE
  const codigoRota = typeof params?.codigo === "string" ? params.codigo : "";
  const aberturaAutomatica = useRef(false);
  const [lista, setLista] = useState<Dev[]>([]);
  const [atual, setAtual] = useState<Dev | null>(null);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [endereco, setEndereco] = useState("");
  const [leituraEndereco, setLeituraEndereco] = useState("");
  const [erroBipagem, setErroBipagem] = useState("");
  const [condicaoAberta, setCondicaoAberta] = useState<string | null>(null);
  const leituraEnderecoRef = useRef<HTMLInputElement>(null);
  const [conferencias, setConferencias] = useState<Record<string, Conferencia>>({});
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [informacao, setInformacao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const enderecoLido = enderecos.find((e) => String(e.id) === endereco);
  const posicaoEndereco = extrairPosicaoEnderecoDev(enderecoLido);

  const rpc = useCallback(async (nome: string, parametros: Record<string, unknown> = {}) => {
    const cliente = atelSupabase();
    if (!cliente) throw new Error("Supabase indisponível");
    const { data, error } = await cliente.rpc(nome, parametros);
    if (error) throw new Error(error.message);
    return data;
  }, []);

  const atualizar = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        rpc("atel_v105_listar_devs"), rpc("atel_v106_listar_devs"),
      ]);
      const v105: Dev[] = (Array.isArray(a) ? a : []).map((d: Dev) => ({ ...d, fonte: "v105" as const }));
      const v106: Dev[] = (Array.isArray(b) ? b : []).map((d: Dev) => ({ ...d, fonte: "v106" as const }));
      // Se uma DEV existir nas duas origens, a versão sincronizada prevalece.
      const unicos = new Map<string, Dev>();
      for (const d of [...v105, ...v106]) unicos.set(d.codigo, d);
      setLista(Array.from(unicos.values()));
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, [rpc]);

  useEffect(() => {
    void atualizar();
    const aoFoco = () => { void atualizar(); };
    const aoVisivel = () => { if (document.visibilityState === "visible") void atualizar(); };
    window.addEventListener("focus", aoFoco);
    document.addEventListener("visibilitychange", aoVisivel);
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") void atualizar();
    }, 15000);
    return () => {
      window.removeEventListener("focus", aoFoco);
      document.removeEventListener("visibilitychange", aoVisivel);
      window.clearInterval(intervalo);
    };
  }, [atualizar]);

  const pendentes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lista.filter((d) => {
      if (d.status !== "AGUARDANDO_CD") return false;
      if (!termo) return true;
      return [d.codigo, d.ret_codigo, d.documento_origem, d.tecnico,
        d.codigo_tecnico, d.base, d.origem_fisica, d.destino_fisico]
        .filter(Boolean).join(" ").toLowerCase().includes(termo);
    });
  }, [lista, busca]);

  async function selecionar(dev: Dev) {
    setAtual(dev);
    if (!codigoRota) router.push(`/coletor/devolucao-cd/${encodeURIComponent(dev.codigo)}`);
    setInformacao(""); setErro(""); setEndereco(""); setEnderecos([]);
    setLeituraEndereco(""); setErroBipagem(""); setCondicaoAberta(null);
    const inicial: Record<string, Conferencia> = {};
    for (const item of dev.itens || []) {
      inicial[item.chave] = {
        chave: item.chave, quantidade: Number(item.recusado),
        condicao: "OK", seriais: [], observacao: "",
      };
    }
    setConferencias(inicial);
    try {
      const dados = await rpc(
        dev.fonte === "v106" ? "atel_v106_enderecos_dev" : "atel_v105_enderecos_dev",
        { p_dev_id: dev.id },
      );
      setEnderecos(Array.isArray(dados) ? dados as Endereco[] : []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  // V131: a URL identifica a DEV. Recarregar a pagina preserva a conferencia correta.
  useEffect(() => {
    if (!codigoRota || !lista.length) return;
    const dev = lista.find((d) => d.codigo === codigoRota && d.status === "AGUARDANDO_CD");
    if (dev && atual?.codigo !== codigoRota) void selecionar(dev);
    if (!dev && atual) setAtual(null);
  }, [codigoRota, lista, atual?.codigo]);
  // ATEL E1 V108: abre apenas a DEV real (V105) vinculada ao RET clicado.
  // A rota e o layout existentes permanecem intactos; nunca abre DEV de tecnico (V106).
  useEffect(() => {
    if (aberturaAutomatica.current || !lista.length) return;
    const ret = new URLSearchParams(window.location.search).get("ret");
    if (!ret || !/^RET-PED-[A-Z0-9]+$/.test(ret)) return;
    const dev = lista.find((d) => d.fonte === "v105" && d.ret_codigo === ret && d.status === "AGUARDANDO_CD");
    if (!dev) return;
    aberturaAutomatica.current = true;
    void selecionar(dev);
  }, [lista]);

  // ATEL_E1_V134_SCAN - valida apenas enderecos que vieram da RPC da DEV.
  function validarEnderecoBipado(codigoDigitado?: string) {
    const codigoLido = String(codigoDigitado ?? leituraEndereco).trim();
    const normalizar = (valor: unknown) => String(valor ?? "").normalize("NFKC")
      .trim().replace(/\s+/g, " ").toUpperCase();
    if (!codigoLido) {
      setEndereco("");
      setErroBipagem("Bipe ou informe o código do endereço.");
      return;
    }
    const encontrados = enderecos.filter((item) =>
      normalizar(item.codigo) === normalizar(codigoLido) ||
      normalizar(item.id) === normalizar(codigoLido)
    );
    if (encontrados.length !== 1) {
      setEndereco("");
      setErroBipagem(enderecos.length === 0
        ? "Não há endereços disponíveis para esta DEV. Verifique o cadastro."
        : encontrados.length > 1
          ? "Código ambíguo: mais de um endereço corresponde à leitura."
          : "Endereço não identificado entre os endereços válidos desta DEV.");
      return;
    }
    const encontrado = encontrados[0];
    if (!encontrado) return;
    setEndereco(String(encontrado.id));
    setLeituraEndereco(String(encontrado.codigo));
    setErroBipagem("");
  }

  function limparBipagemEndereco() {
    setLeituraEndereco("");
    setEndereco("");
    setErroBipagem("");
    leituraEnderecoRef.current?.focus();
  }

  function editar(chave: string, patch: Partial<Conferencia>) {
    setConferencias((anterior) => ({
      ...anterior,
      [chave]: { ...anterior[chave], ...patch },
    }));
  }

  async function salvar() {
    if (!atual || ocupado) return;
    if (!endereco || !enderecos.some((e) => String(e.id) === endereco)) {
      setErro("Bipe e valide um endereço físico autorizado antes de concluir.");
      return;
    }
    // A condicao de avaria/divergencia exige motivo fisico auditavel.
    const invalido = atual.itens.some((item) => {
      const c = conferencias[item.chave];
      return !c || !Number.isFinite(c.quantidade) || c.quantidade < 0 || c.quantidade > Number(item.recusado)
        || ((c.condicao === "AVARIA" || c.condicao === "DIVERGENCIA") && c.observacao.trim().length < 3);
    });
    if (invalido) { setErro("Confira as quantidades e informe o motivo da avaria/divergencia (minimo 3 caracteres)."); return; }
    setOcupado(true); setErro("");
    try {
      await rpc(
        atual.fonte === "v106" ? "atel_v106_conferir_dev" : "atel_v111_conferir_dev_ret",
        { p_dev_id: atual.id, p_endereco_id: endereco, p_itens: Object.values(conferencias) },
      );
      setInformacao(atual.fonte === "v105" ? `Conferência de ${atual.codigo} registrada; RET finalizado sem crédito duplicado no estoque.` : `Conferência de ${atual.codigo} registrada.`);
      setAtual(null);
      if (codigoRota) router.replace("/coletor/devolucao-cd");
      await atualizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  const voltar = () => {
    if (atual || codigoRota) { setAtual(null); router.push("/coletor/devolucao-cd"); }
    else router.push("/coletor/expedicoes");
  };

  return (
    <div className={"collector-screen atel-v47-screen atel-v127-dev " + (atual ? "atel-v133-detail" : "atel-v47-retornos")}>
      <div className="collector-phone" style={{ background: "#f4f8fb", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0, padding: 0 }}>
        <div style={{
          width: "100%", height: 68, minHeight: 68, display: "flex", alignItems: "center",
          gap: 12, padding: "0 16px", boxSizing: "border-box",
          background: "linear-gradient(105deg,#087ba4,#1598b4)", color: "white",
        }}>
          <button type="button" onClick={voltar} aria-label={atual ? "Voltar à lista de devoluções" : "Voltar para Expedição"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 38px",
              width: 38, height: 38, padding: 0, border: 0, borderRadius: 11,
              background: "rgba(255,255,255,.12)", color: "white", cursor: "pointer",
            }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
            </svg>
          </button>
          <div style={{ fontSize: 19, fontWeight: 750, letterSpacing: "-.35px", color: "white" }}>
            Devolução CD
          </div>
        </div>

        {!atual && (
          <div style={{ padding: "14px 13px 12px", background: "#f4f8fb" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, height: 48,
              padding: "0 14px", background: "white", border: "1px solid #d0e0e9",
              borderRadius: 12, boxSizing: "border-box",
            }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#138cb1"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
              </svg>
              <input aria-label="Pesquisar devoluções" value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Devolução / técnico / documento"
                style={{ flex: 1, minWidth: 0, height: "100%", border: 0, outline: 0, background: "transparent", fontSize: 13, color: "#19394b" }} />
              {busca && <button type="button" onClick={() => setBusca("")} aria-label="Limpar pesquisa"
                style={{ border: 0, background: "transparent", color: "#667085", fontSize: 20, cursor: "pointer" }}>×</button>}
            </div>
          </div>
        )}

        <div className="collector-operation-body" style={{
          flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",
          padding: "4px 12px 24px", boxSizing: "border-box", background: "#f4f8fb", overscrollBehavior: "contain",
        }}>
          {erro && <p role="alert" style={{ padding: 10, borderRadius: 9, background: "#fee2e2", color: "#991b1b", fontSize: 12 }}>{erro}</p>}
          {informacao && <p role="status" style={{ padding: 10, borderRadius: 9, background: "#e8f6ef", color: "#166534", fontSize: 12 }}>{informacao}</p>}

          {!atual ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 2px 8px", color: "#667085", fontSize: 9, fontWeight: 900 }}>
                <span>DEVOLUÇÕES PARA RECEBIMENTO</span>
                <span style={{ minWidth: 22, height: 22, padding: "0 6px", display: "grid", placeItems: "center", borderRadius: 11, background: "#dff4fb", color: "#087da7", fontSize: 10 }}>{pendentes.length}</span>
              </div>
              {pendentes.map((d) => {
                const itens = d.itens || [];
                const quantidade = itens.reduce((s, i) => s + (Number.isFinite(Number(i.recusado)) ? Number(i.recusado) : 0), 0);
                return (
                  <button type="button" key={`${d.fonte}-${d.id}`} onClick={() => void selecionar(d)}
                    style={{
                      width: "100%", boxSizing: "border-box", display: "block", textAlign: "left", cursor: "pointer",
                      background: "white", borderTop: "1px solid #d9e5eb", borderRight: "1px solid #d9e5eb",
                      borderBottom: "1px solid #d9e5eb", borderLeft: "7px solid #159fc5", borderRadius: 16,
                      marginBottom: 10, padding: 12, color: "#344054", boxShadow: "0 3px 9px rgba(15,23,42,.055)",
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: "#087da7", fontSize: 16, fontWeight: 900 }}>{d.codigo}</div>
                        <div style={{ marginTop: 2, color: "#98a2b3", fontSize: 9, fontWeight: 700 }}>{d.ret_codigo}</div>
                      </div>
                      <span style={{ flexShrink: 0, background: "#dff4fb", color: "#087da7", borderRadius: 15, padding: "6px 8px", fontSize: 8, fontWeight: 900 }}>AGUARDANDO CD</span>
                    </div>
                    <div style={{ height: 1, background: "#edf0f2", margin: "9px 0" }} />
                    <div style={{ color: "#344054", fontSize: 13, fontWeight: 900 }}>{d.tecnico || `Retorno ${d.ret_codigo}`}</div>
                    <div style={{ marginTop: 2, color: "#667085", fontSize: 9, fontWeight: 700 }}>
                      {[d.codigo_tecnico, d.base].filter(Boolean).join(" • ") || d.ret_codigo}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, padding: 9, borderRadius: 6, background: "#f5f8f9" }}>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ display: "block", color: "#98a2b3", fontSize: 8, fontWeight: 900 }}>ORIGEM</span>
                        <strong style={{ display: "block", marginTop: 3, color: "#344054", fontSize: 10, overflowWrap: "anywhere" }}>{d.ret_codigo}</strong>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ display: "block", color: "#98a2b3", fontSize: 8, fontWeight: 900 }}>DESTINO</span>
                        <strong style={{ display: "block", marginTop: 3, color: "#344054", fontSize: 10, overflowWrap: "anywhere" }}>{d.destino_fisico || "CD / Endereçamento"}</strong>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 24px", alignItems: "center", gap: 6, marginTop: 10 }}>
                      <div><span style={{ display: "block", color: "#98a2b3", fontSize: 8, fontWeight: 900 }}>SKUs</span><strong style={{ fontSize: 11 }}>{itens.length}</strong></div>
                      <div><span style={{ display: "block", color: "#98a2b3", fontSize: 8, fontWeight: 900 }}>QTD.</span><strong style={{ fontSize: 11 }}>{quantidade}</strong></div>
                      <div><span style={{ display: "block", color: "#98a2b3", fontSize: 8, fontWeight: 900 }}>CONFERIDOS</span><strong style={{ fontSize: 11 }}>0/{itens.length}</strong></div>
                      <span style={{ color: "#1596bc", fontSize: 24, fontWeight: 900, textAlign: "right" }}>›</span>
                    </div>
                  </button>
                );
              })}
              {!carregando && !erro && pendentes.length === 0 && (
                <div style={{ minHeight: 190, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "25px 20px", color: "#667085", fontSize: 12 }}>
                  <strong style={{ color: "#344054", fontSize: 13 }}>Nenhuma devolução pendente</strong>
                  <span style={{ marginTop: 6 }}>Nenhuma DEV aguardando recebimento no CD.</span>
                </div>
              )}
              {carregando && <div style={{ textAlign: "center", padding: 24, fontSize: 12, color: "#667085" }}>Carregando devoluções...</div>}
            </>
          ) : (
            <>
              <div className="atel-v133-document">
                <div className="atel-v133-document-main">
                  <span className="atel-v133-doc-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                      <path d="M14 3v5h5M9 12h6M9 16h6" />
                    </svg>
                  </span>
                  <div className="atel-v133-document-info">
                    <span className="atel-v133-eyebrow">DOCUMENTO DE DEVOLUÇÃO</span>
                    <strong>{atual.codigo}</strong>
                  </div>
                </div>
                <div className="atel-v133-document-bottom">
                  <span className="atel-v133-document-origin">Origem <strong>{atual.ret_codigo}</strong></span>
                  <span className="atel-v133-pill"><span aria-hidden="true" /> AGUARDANDO CD</span>
                </div>
              </div>

              {atual.status !== "AGUARDANDO_CD" ? (
                <section className="atel-v133-panel" aria-label="Situação da DEV">
                  <div className="atel-v133-status-done">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>
                    Documento já conferido.
                  </div>
                </section>
              ) : (
                <>
                  <section className="atel-v133-panel" aria-label="Conferência de produtos">
                    <div className="atel-v133-panel-heading">
                      <div>
                        <h2>Conferência de produtos</h2>
                        <p>Validação física dos itens devolvidos</p>
                      </div>
                      <span className="atel-v133-heading-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 11l2 2 4-4M9 17h6" />
                        </svg>
                      </span>
                    </div>
                    <div className="atel-v133-info-strip">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
                      Confira quantidade, condição e seriais de cada produto.
                    </div>
                    <div className="atel-v133-stats" aria-label="Resumo da devolução">
                      <div><span>SKUs</span><strong>{(atual.itens || []).length}</strong></div>
                      <div><span>ESPERADO</span><strong>{(atual.itens || []).reduce((s, i) => s + Number(i.recusado || 0), 0)}</strong></div>
                      <div><span>INFORMADO</span><strong>{(atual.itens || []).reduce((s, i) => s + Number(conferencias[i.chave]?.quantidade || 0), 0)}</strong></div>
                    </div>
                    <div className="atel-v133-products-caption">PRODUTOS DA DEVOLUÇÃO</div>
                    {(atual.itens || []).map((item, indice) => (
                      <div className="atel-v133-product" key={item.chave}>
                        <div className="atel-v133-product-heading">
                          <span className="atel-v133-product-number">{String(indice + 1).padStart(2, "0")}</span>
                          <div className="atel-v133-product-info">
                            <strong>{item.sku}</strong>
                            <p>{item.produto}</p>
                          </div>
                          <span className="atel-v133-product-quantity">{item.recusado} un.</span>
                        </div>
                        <div className="atel-v133-fields-grid">
                          <div className="atel-v133-field">
                            <label htmlFor={`atel-dev-qtd-${item.chave}`}>Qtd. conferida</label>
                            <input id={`atel-dev-qtd-${item.chave}`} type="number" min={0} max={item.recusado}
                              value={conferencias[item.chave]?.quantidade ?? 0}
                              onChange={(e) => editar(item.chave, { quantidade: Number(e.target.value) })} />
                          </div>
                          <div className="atel-v133-field atel-v134-condition-field">
                            <label id={`atel-dev-condicao-label-${item.chave}`}>Condição</label>
                            <div className="atel-v134-condition"
                              onBlur={(evento) => {
                                if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setCondicaoAberta(null);
                              }}
                              onKeyDown={(evento) => {
                                if (evento.key === "Escape") { setCondicaoAberta(null); }
                              }}>
                              <button type="button" className="atel-v134-condition-trigger"
                                data-condicao={conferencias[item.chave]?.condicao || "OK"}
                                disabled={ocupado}
                                aria-labelledby={`atel-dev-condicao-label-${item.chave}`}
                                aria-haspopup="listbox"
                                aria-expanded={condicaoAberta === item.chave}
                                aria-controls={`atel-dev-condicao-menu-${item.chave}`}
                                onClick={() => setCondicaoAberta((anterior) => anterior === item.chave ? null : item.chave)}
                                onKeyDown={(evento) => {
                                  if (evento.key === "ArrowDown") { evento.preventDefault(); setCondicaoAberta(item.chave); }
                                }}>
                                <span className="atel-v134-condition-indicator" aria-hidden="true" />
                                <span className="atel-v134-condition-label">{
                                  OPCOES_CONDICAO_DEV.find((opcao) => opcao.valor === (conferencias[item.chave]?.condicao || "OK"))?.titulo || "Material OK"
                                }</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                              </button>
                              {condicaoAberta === item.chave && (
                                <div className="atel-v134-condition-menu" role="listbox"
                                  id={`atel-dev-condicao-menu-${item.chave}`} aria-label="Condição do produto">
                                  {OPCOES_CONDICAO_DEV.map((opcao) => (
                                    <button type="button" key={opcao.valor} role="option" aria-selected={(conferencias[item.chave]?.condicao || "OK") === opcao.valor}
                                      className="atel-v134-condition-option" data-condicao={opcao.valor}
                                      onClick={() => { editar(item.chave, { condicao: opcao.valor }); setCondicaoAberta(null); }}>
                                      <span className="atel-v134-condition-indicator" aria-hidden="true" />
                                      <span className="atel-v134-option-text"><strong>{opcao.titulo}</strong><small>{opcao.legenda}</small></span>
                                      {(conferencias[item.chave]?.condicao || "OK") === opcao.valor && (
                                        <svg className="atel-v134-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="atel-v133-field atel-v133-field-full">
                          <label htmlFor={`atel-dev-seriais-${item.chave}`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M22 8v8" /></svg>
                            Seriais bipados <span>(um por linha)</span>
                          </label>
                          <textarea id={`atel-dev-seriais-${item.chave}`} rows={2} placeholder="Bipe ou informe cada serial"
                            value={(conferencias[item.chave]?.seriais || []).join("\n")}
                            onChange={(e) => editar(item.chave, { seriais: e.target.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) })} />
                        </div>
                        <div className="atel-v133-field atel-v133-field-full">
                          <label htmlFor={`atel-dev-obs-${item.chave}`}>Observação</label>
                          <input id={`atel-dev-obs-${item.chave}`} placeholder="Informações adicionais sobre o material"
                            value={conferencias[item.chave]?.observacao || ""}
                            onChange={(e) => editar(item.chave, { observacao: e.target.value })} />
                          {(conferencias[item.chave]?.condicao === "AVARIA" || conferencias[item.chave]?.condicao === "DIVERGENCIA") && (
                            <div className="atel-v133-requirement" role="note">Informe o motivo da avaria ou divergência na observação.</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </section>

                  <section className="atel-v133-panel atel-v134-address" aria-label="Bipagem do endereço físico de devolução">
                    <div className="atel-v134-address-heading">
                      <div>
                        <h2>Informações de Endereço</h2>
                        <p>Valide a localização de recebimento por bipagem</p>
                      </div>
                      <div className="atel-v134-address-actions">
                        <button type="button" aria-label="Focar campo de bipagem" title="Bipar endereço"
                          onClick={() => leituraEnderecoRef.current?.focus()}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" /></svg>
                        </button>
                        <button type="button" aria-label="Limpar endereço bipado" title="Limpar leitura"
                          onClick={limparBipagemEndereco}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9a7 7 0 0 1 12.4-2L20 12M4 12l2.1 5A7 7 0 0 0 18.5 15" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="atel-v134-address-tiles" aria-label="Rua, Prédio, Andar e Apartamento do endereço bipado" aria-live="polite">
                      {([
                        { sigla: "R", legenda: "Rua", valor: posicaoEndereco.rua },
                        { sigla: "P", legenda: "Prédio", valor: posicaoEndereco.predio },
                        { sigla: "A", legenda: "Andar", valor: posicaoEndereco.andar },
                        { sigla: "A", legenda: "Apto", valor: posicaoEndereco.apartamento },
                      ]).map((parte, indice) => (
                        <div className={"atel-v134-address-tile" + (indice % 2 === 0 ? " atel-v134-tile-primary" : "")}
                          key={`${parte.legenda}-${indice}`}>
                          <span className="atel-v134-tile-letter">{parte.sigla}</span>
                          <strong>{parte.valor}</strong>
                          <small>{parte.legenda}</small>
                        </div>
                      ))}
                    </div>
                    <label className="atel-v134-scan-label" htmlFor="atel-dev-bipagem-endereco">
                      ID do endereço <span aria-hidden="true">*</span>
                    </label>
                    <div className={"atel-v134-scan-box" + (erroBipagem ? " atel-v134-scan-error" : "") + (enderecoLido ? " atel-v134-scan-success" : "")}>
                      <svg className="atel-v134-scan-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5v14M6 5v14M10 5v14M13 5v14M17 5v14M20 5v14" /></svg>
                      <input id="atel-dev-bipagem-endereco" ref={leituraEnderecoRef} value={leituraEndereco}
                        autoComplete="off" autoCapitalize="off" spellCheck={false} inputMode="text"
                        placeholder="Bipe ou digite o código"
                        onFocus={(evento) => evento.currentTarget.select()}
                        aria-label="Bipe o código do endereço"
                        aria-invalid={!!erroBipagem}
                        onChange={(evento) => {
                          setLeituraEndereco(evento.target.value);
                          if (endereco) setEndereco("");
                          if (erroBipagem) setErroBipagem("");
                        }}
                        onKeyDown={(evento) => {
                          if (evento.key === "Enter") { evento.preventDefault(); validarEnderecoBipado(); }
                          else if (evento.key === "Tab" && leituraEndereco.trim()) validarEnderecoBipado();
                        }} />
                      <button type="button" aria-label="Validar endereço bipado" title="Validar leitura"
                        onClick={() => validarEnderecoBipado()}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                      </button>
                    </div>
                    {erroBipagem ? (
                      <p className="atel-v134-scan-feedback atel-v134-feedback-error" role="alert">{erroBipagem}</p>
                    ) : enderecoLido ? (
                      <div className="atel-v134-address-confirmed" role="status">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>
                        <div><strong>Endereço validado · {enderecoLido.codigo}</strong><span>{enderecoLido.descricao}</span></div>
                      </div>
                    ) : (
                      <p className="atel-v134-scan-feedback">Bipe o código e pressione <strong>Enter</strong> ou toque em confirmar.</p>
                    )}
                  </section>

                  <div className="atel-v133-actionbar">
                    <button type="button" disabled={!endereco || ocupado} onClick={() => void salvar()}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                      {ocupado ? "REGISTRANDO CONFERÊNCIA..." : "CONFIRMAR CONFERÊNCIA DEV"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div style={{ height: 30, minHeight: 30, flexShrink: 0, background: "#000000" }} aria-hidden="true" />
      </div>
    </div>
  );
}

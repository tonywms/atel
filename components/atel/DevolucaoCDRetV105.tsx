"use client";

import "@/app/coletor/retornos/atel-v47.css";
import "@/app/coletor/retornos/atel-v47-2.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", minWidth: 0, boxSizing: "border-box",
  padding: 11, border: "1px solid #cbd5e1", borderRadius: 10,
  background: "white", color: "#12324a", fontSize: 14,
};

export default function DevolucaoCDRetV105() {
  const router = useRouter();
  const aberturaAutomatica = useRef(false);
  const [lista, setLista] = useState<Dev[]>([]);
  const [atual, setAtual] = useState<Dev | null>(null);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [endereco, setEndereco] = useState("");
  const [conferencias, setConferencias] = useState<Record<string, Conferencia>>({});
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [informacao, setInformacao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);

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
    setInformacao(""); setErro(""); setEndereco(""); setEnderecos([]);
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

  function editar(chave: string, patch: Partial<Conferencia>) {
    setConferencias((anterior) => ({
      ...anterior,
      [chave]: { ...anterior[chave], ...patch },
    }));
  }

  async function salvar() {
    if (!atual || ocupado) return;
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
      await atualizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  const voltar = () => atual ? setAtual(null) : router.push("/coletor/expedicoes");

  return (
    <div className="collector-screen atel-v47-screen atel-v47-retornos">
      <div className="collector-phone" style={{ background: "#f4f8fb", position: "relative", overflow: "hidden" }}>
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
          padding: "4px 12px 16px", boxSizing: "border-box", background: "#f4f8fb",
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
              <div style={{ padding: "12px 2px" }}>
                <strong style={{ color: "#087da7", fontSize: 17 }}>{atual.codigo}</strong>
                <div style={{ fontSize: 11, color: "#667085", marginTop: 3 }}>Origem: {atual.ret_codigo}</div>
              </div>
              {atual.status !== "AGUARDANDO_CD" ? <p>Documento já conferido.</p> : (
                <>
                  {(atual.itens || []).map((item) => (
                    <section key={item.chave} style={{ padding: 12, background: "white", borderRadius: 12, marginBottom: 12, border: "1px solid #d9e5ec" }}>
                      <strong style={{ color: "#087da7" }}>{item.sku}</strong>
                      <p style={{ margin: "4px 0 12px", fontSize: 13 }}>{item.produto}</p>
                      <small>Quantidade esperada: {item.recusado}</small>
                      <label style={{ display: "block", marginTop: 10, fontSize: 12 }}>Quantidade bipada / conferida</label>
                      <input type="number" min={0} max={item.recusado} style={inputStyle}
                        value={conferencias[item.chave]?.quantidade ?? 0}
                        onChange={(e) => editar(item.chave, { quantidade: Number(e.target.value) })} />
                      <label style={{ display: "block", marginTop: 10, fontSize: 12 }}>Condição</label>
                      <select style={inputStyle} value={conferencias[item.chave]?.condicao || "OK"}
                        onChange={(e) => editar(item.chave, { condicao: e.target.value })}>
                        <option value="OK">Material OK</option><option value="AVARIA">Avariado</option><option value="DIVERGENCIA">Divergência</option>
                      </select>
                      <label style={{ display: "block", marginTop: 10, fontSize: 12 }}>Seriais bipados (um por linha)</label>
                      <textarea style={inputStyle} rows={3} placeholder="Bipe cada serial"
                        value={(conferencias[item.chave]?.seriais || []).join("\n")}
                        onChange={(e) => editar(item.chave, { seriais: e.target.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) })} />
                      <label style={{ display: "block", marginTop: 10, fontSize: 12 }}>Observação</label>
                      <input style={inputStyle} value={conferencias[item.chave]?.observacao || ""}
                        onChange={(e) => editar(item.chave, { observacao: e.target.value })} />
                    </section>
                  ))}
                  <label style={{ display: "block", marginBottom: 5, fontSize: 12 }}>Endereço físico de devolução</label>
                  <select style={inputStyle} value={endereco} onChange={(e) => setEndereco(e.target.value)}>
                    <option value="">Selecione um endereço</option>
                    {enderecos.map((e) => <option key={e.id} value={e.id}>{e.codigo} — {e.descricao}</option>)}
                  </select>
                  <button type="button" disabled={!endereco || ocupado} onClick={() => void salvar()}
                    style={{ ...inputStyle, background: !endereco ? "#a6c3d1" : "#058ca7", color: "white", fontWeight: 800, marginTop: 12, cursor: "pointer" }}>
                    {ocupado ? "Registrando..." : "CONFIRMAR CONFERÊNCIA DEV"}
                  </button>
                </>
              )}
            </>
          )}
        </div>
        <div style={{ height: 36, minHeight: 36, background: "#000000" }} aria-hidden="true" />
      </div>
    </div>
  );
}

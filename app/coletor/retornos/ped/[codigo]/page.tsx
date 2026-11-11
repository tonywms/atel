"use client";

// ATEL E1 V117: despacho de RET-PED exclusivamente no coletor do Mini-CD.
// Nao modifica as telas/rotinas de retorno de tecnico (RET local).
import "../../atel-v47.css";
import "../../atel-v47-2.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { atelSupabase } from "@/lib/atelSupabaseV08";

type ItemRet = {
  chave?: string;
  sku: string;
  produto: string;
  recusado: number;
  motivo?: string;
  observacao?: string;
  seriais?: string[];
};
type RetPed = {
  id: string;
  codigo: string;
  pedido_codigo: string;
  status: "AGUARDANDO_RETORNO" | "EM_TRANSITO_CD" | "AGUARDANDO_CONFERENCIA" | "FINALIZADO";
  itens: ItemRet[];
};

function erroTexto(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Falha ao consultar o retorno.";
}
function localizarRet(dados: unknown, codigo: string): RetPed | null {
  if (!Array.isArray(dados)) return null;
  const encontrado = dados.find((r: unknown) => {
    if (!r || typeof r !== "object") return false;
    return (r as { codigo?: unknown }).codigo === codigo;
  });
  return encontrado && typeof encontrado.id === "string" ? encontrado as RetPed : null;
}

export default function RetPedColetorPage() {
  const params = useParams();
  const router = useRouter();
  const codigo = String(Array.isArray(params.codigo) ? params.codigo[0] : params.codigo ?? "");
  const valido = /^RET-PED-[A-Z0-9]+$/.test(codigo);
  const [ret, setRet] = useState<RetPed | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [operando, setOperando] = useState(false);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregar = useCallback(async (mostrarCarga = false): Promise<RetPed | null> => {
    if (!valido) { setErro("Código RET-PED inválido."); setCarregando(false); return null; }
    if (mostrarCarga) setCarregando(true);
    const db = atelSupabase();
    if (!db) { setErro("Supabase indisponível. Verifique sua sessão."); setCarregando(false); return null; }
    try {
      const { data, error } = await db.rpc("atel_v3730_listar_rets");
      if (error) throw new Error(error.message);
      const encontrado = localizarRet(data, codigo);
      if (!encontrado) throw new Error("RET não encontrado ou sem permissão para consulta.");
      setRet(encontrado);
      setErro("");
      // ATEL E1 V120.2: reabertura segura de retorno com status remoto avancado.
      if (encontrado.status === "EM_TRANSITO_CD" || encontrado.status === "AGUARDANDO_CONFERENCIA" || encontrado.status === "FINALIZADO") {
        setSucesso("Este retorno ja foi enviado e seu estado foi confirmado no Supabase. Nenhum novo envio foi realizado.");
      } else {
        setSucesso("");
      }
      return encontrado;
    } catch (e) { setErro(erroTexto(e)); return null; }
    finally { setCarregando(false); }
  }, [codigo, valido]);

  useEffect(() => {
    void carregar(true);
    const atualizarVisivel = () => { if (document.visibilityState === "visible") void carregar(); };
    const timer = window.setInterval(atualizarVisivel, 15000);
    document.addEventListener("visibilitychange", atualizarVisivel);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", atualizarVisivel); };
  }, [carregar]);

  const total = useMemo(() => (ret?.itens ?? []).reduce((s, i) => s + Number(i.recusado ?? 0), 0), [ret]);
  const pendente = ret?.status === "AGUARDANDO_RETORNO";

  async function confirmarEnvio() {
    if (!ret || !pendente || !confirmacaoAberta || !Number.isFinite(total) || total <= 0 || operando) return;
    setOperando(true); setErro(""); setSucesso("");
    try {
      const db = atelSupabase();
      if (!db) throw new Error("Supabase indisponível. Nenhum envio foi confirmado.");
      // Revalida o documento antes de qualquer mutacao. Nunca usa dados locais para gravar o RET.
      const { data: lista, error: erroLista } = await db.rpc("atel_v3730_listar_rets");
      if (erroLista) throw new Error(erroLista.message);
      const atual = localizarRet(lista, ret.codigo);
      if (!atual) throw new Error("RET não encontrado no servidor.");
      // ATEL E1 V121: reabertura e revalidacao idempotente.
      if (["EM_TRANSITO_CD", "AGUARDANDO_CONFERENCIA", "FINALIZADO"].includes(atual.status)) {
        setRet(atual); setSucesso("Envio já confirmado anteriormente no Supabase. Não foi duplicado."); return;
      }
      if (atual.status !== "AGUARDANDO_RETORNO") {
        setRet(atual); throw new Error("O RET mudou de etapa. Atualize a tela antes de continuar.");
      }
      const { error: erroEnvio } = await db.rpc("atel_v3730_transicionar_ret", {
        p_id: atual.id, p_status: "EM_TRANSITO_CD", p_conferencia: null,
      });
      // Mesmo que a resposta da rede falhe, consulta o estado remoto antes de mostrar erro.
      const { data: confirmacao, error: erroConfirmacao } = await db.rpc("atel_v3730_listar_rets");
      const confirmado = !erroConfirmacao ? localizarRet(confirmacao, ret.codigo) : null;
      if (confirmado?.status === "EM_TRANSITO_CD" || confirmado?.status === "AGUARDANDO_CONFERENCIA" || confirmado?.status === "FINALIZADO") {
        setRet(confirmado); setSucesso("Envio confirmado no Supabase. RET em trânsito ao CD."); return;
      }
      if (erroEnvio) throw new Error(erroEnvio.message);
      if (erroConfirmacao) throw new Error("O servidor recebeu o comando, mas não foi possível comprovar o novo status. Não repita sem consultar o RET. " + erroConfirmacao.message);
      throw new Error("Não foi comprovada a transição para EM_TRÂNSITO. Consulte o RET antes de tentar novamente.");
    } catch (e) { setErro(erroTexto(e)); }
    finally { setOperando(false); }
  }

  return (
    <div className="collector-screen atel-v47-screen atel-v47-retornos">
      <div className="collector-phone" style={{ background: "#f4f6f8", minHeight: "100%", position: "relative" }}>
        <header style={{ height: 76, background: "#2193b5", color: "#fff", display: "flex", alignItems: "center", gap: 12, padding: "0 14px" }}>
          <button type="button" aria-label="Voltar aos retornos" onClick={() => router.push("/coletor/retornos")}
            style={{ background: "transparent", color: "#fff", border: 0, fontSize: 30, cursor: "pointer", padding: "4px 8px" }}>‹</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.15 }}>Envio de Retorno ao CD</div>
            <div style={{ fontSize: 11, opacity: .95, overflowWrap: "anywhere" }}>{codigo}</div>
          </div>
        </header>
        <main style={{ padding: 12, display: "grid", gap: 12, color: "#163a51" }}>
          {carregando && <div role="status" style={bloco}>Consultando retorno no Supabase...</div>}
          {/* ATEL-E1-V126-REFRESH-STATUS */}
          <button type="button" disabled={carregando || operando} onClick={() => void carregar(true)}
            aria-label="Atualizar status do retorno no Supabase"
            style={{ minHeight: 42, width: "100%", border: "1px solid #9ccfdd", borderRadius: 9, background: "#e9f6fa", color: "#164b62", fontWeight: 800, fontSize: 12, cursor: carregando || operando ? "wait" : "pointer", opacity: carregando || operando ? .6 : 1 }}>
            {carregando ? "CONSULTANDO STATUS..." : "ATUALIZAR STATUS"}
          </button>
          {erro && <div role="alert" style={{ ...bloco, background: "#fff3e5", borderColor: "#eab68d", color: "#8b3500", overflowWrap: "anywhere" }}>{erro}</div>}
          {ret && <>
            <section style={bloco}>
              <div style={rotulo}>DOCUMENTO DE RETORNO</div>
              <div style={{ fontSize: 17, fontWeight: 850, color: "#007fa9", overflowWrap: "anywhere" }}>{ret.codigo}</div>
              <div style={{ marginTop: 5, fontSize: 12 }}>Pedido de origem: <b>{ret.pedido_codigo}</b></div>
              <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: 8, background: pendente ? "#fff3cf" : "#e7f6fa", color: "#164b62", fontWeight: 800, fontSize: 12 }}>
                {pendente ? "AGUARDANDO ENVIO" : ret.status === "EM_TRANSITO_CD" ? "EM TRÂNSITO AO CD" : ret.status === "AGUARDANDO_CONFERENCIA" ? "AGUARDANDO CONFERÊNCIA NO CD" : "FINALIZADO"}
              </div>
            </section>
            <section style={bloco}>
              <div style={rotulo}>MATERIAIS QUE RETORNARÃO AO CD</div>
              {ret.itens.map((i, n) => <div key={i.chave ?? n} style={{ borderTop: "1px solid #e1eaf0", padding: "10px 0", display: "grid", gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{i.produto}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>SKU {i.sku}</span><strong>{Number(i.recusado)} UN</strong></div>
                {i.motivo && <div style={{ fontSize: 11, color: "#876011" }}>Motivo: {i.motivo.replaceAll("_", " ")}</div>}
                {i.observacao && <div style={{ fontSize: 11, color: "#5a7182" }}>{i.observacao}</div>}
              </div>)}
              <div style={{ borderTop: "1px solid #d6e4ec", paddingTop: 10, display: "flex", justifyContent: "space-between", fontWeight: 850 }}><span>TOTAL DO RETORNO</span><span>{total} UN</span></div>
            </section>
            {pendente ? <section style={bloco}>
              <div style={rotulo}>CONFIRMAÇÃO DO ENVIO</div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>Confira o material e a quantidade acima. O RET já está selecionado; não é necessário digitar seu código.</div>
              {!confirmacaoAberta ? (
                <button type="button" disabled={!Number.isFinite(total) || total <= 0 || operando}
                  onClick={() => { setErro(""); setSucesso(""); setConfirmacaoAberta(true); }}
                  style={{ width: "100%", marginTop: 16, minHeight: 47, border: 0, borderRadius: 9, background: "#148eaf", color: "white", fontSize: 13, fontWeight: 850, opacity: operando ? .48 : 1, cursor: operando ? "wait" : "pointer" }}>
                  CONFIRMAR ENVIO DE {total} UN AO CD
                </button>
              ) : (
                <div role="group" aria-label="Confirmação de despacho físico" style={{ marginTop: 14, padding: 12, background: "#e9f6fa", border: "1px solid #9ccfdd", borderRadius: 9 }}>
                  <div style={{ fontSize: 13, fontWeight: 850 }}>Confirmar saída física</div>
                  <p style={{ fontSize: 12, lineHeight: 1.5, margin: "8px 0 12px" }}>As {total} unidades deste retorno foram efetivamente despachadas do Mini-CD para o CD?</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button type="button" disabled={operando} onClick={() => setConfirmacaoAberta(false)}
                      style={{ minHeight: 45, borderRadius: 8, border: "1px solid #b4cbd7", background: "#fff", color: "#19435a", fontSize: 12, fontWeight: 800, cursor: operando ? "wait" : "pointer" }}>CANCELAR</button>
                    <button type="button" disabled={operando} onClick={() => void confirmarEnvio()}
                      style={{ minHeight: 45, borderRadius: 8, border: 0, background: "#148eaf", color: "#fff", fontSize: 12, fontWeight: 850, opacity: operando ? .6 : 1, cursor: operando ? "wait" : "pointer" }}>{operando ? "CONFIRMANDO..." : "SIM, CONFIRMAR"}</button>
                  </div>
                </div>
              )}
              <p style={{ margin: "10px 0 0", fontSize: 11, color: "#627b8c" }}>Esta ação altera apenas a etapa documental do RET. Não movimenta estoque nem finaliza a DEV.</p>
            </section> : <section style={bloco}>
              <button type="button" onClick={() => router.replace("/coletor/expedicoes")}
                style={{ minHeight: 46, border: 0, borderRadius: 9, background: "#148eaf", color: "#fff", fontWeight: 850, fontSize: 13, width: "100%", cursor: "pointer" }}>VOLTAR ÀS EXPEDIÇÕES</button>
              {ret.status === "AGUARDANDO_CONFERENCIA" && <button type="button" onClick={() => router.push("/coletor/devolucao-cd?ret=" + encodeURIComponent(ret.codigo))} style={{ marginTop: 12, border: 0, background: "#148eaf", color: "#fff", padding: "12px", borderRadius: 8, fontWeight: 800, width: "100%" }}>ABRIR DEV NO COLETOR</button>}
            </section>}
          </>}
        </main>
        {sucesso && (
          <div role="presentation" style={{ position: "absolute", inset: 0, zIndex: 30, background: "#0a2b3c80", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div role="dialog" aria-modal="true" aria-labelledby="atel-v119-sucesso-titulo" aria-describedby="atel-v119-sucesso-texto"
              style={{ background: "#fff", borderRadius: 14, border: "1px solid #b8d9e4", boxShadow: "0 14px 38px #12394d45", padding: 22, color: "#163a51", width: "100%", maxWidth: 340, boxSizing: "border-box", textAlign: "center" }}>
              <div aria-hidden="true" style={{ width: 50, height: 50, borderRadius: "50%", background: "#e4f7ed", color: "#16834f", fontSize: 30, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>✓</div>
              <h2 id="atel-v119-sucesso-titulo" style={{ margin: 0, fontSize: 17, fontWeight: 850 }}>Envio realizado com sucesso!</h2>
              <p id="atel-v119-sucesso-texto" style={{ fontSize: 13, lineHeight: 1.5, margin: "10px 0 18px" }}>O envio deste retorno está confirmado no Supabase. O acompanhamento continua no CD.</p>
              <button type="button" autoFocus onClick={() => router.replace("/coletor/expedicoes")}
                style={{ width: "100%", minHeight: 47, border: 0, borderRadius: 9, background: "#148eaf", color: "#fff", fontWeight: 850, fontSize: 13, cursor: "pointer" }}>OK — VOLTAR ÀS EXPEDIÇÕES</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const bloco: React.CSSProperties = {
  background: "#fff", border: "1px solid #c9dfe9", borderRadius: 12, padding: 13, boxShadow: "0 2px 8px #17435c0b",
};
const rotulo: React.CSSProperties = {
  color: "#357089", fontSize: 10, fontWeight: 850, letterSpacing: .35, marginBottom: 9,
};

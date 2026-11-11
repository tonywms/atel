"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import "./atel-recebimento-premium.css";

type Transferencia = {
  id: string;
  codigo: string;
  origem: string;
  destino: string;
  material: string;
  sku: string;
  quantidade: number;
  criada_em: string;
};

const org = "6ea04673-4deb-42cf-a001-dbb027120103";
const motivos = [
  { value: "QUANTIDADE_DIVERGENTE", label: "Quantidade divergente" },
  { value: "ITEM_NAO_RECEBIDO", label: "Item não recebido" },
  { value: "AVARIA", label: "Material avariado" },
  { value: "PRODUTO_DIVERGENTE", label: "Produto divergente" },
  { value: "OUTROS", label: "Outros" },
] as const;

type Acao = "total" | "parcial" | "recusa";

function Icon({ name, size = 20 }: { name: "arrow" | "package" | "check" | "alert" | "shield" | "truck" | "info" | "clipboard" | "chevron"; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    arrow: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
    package: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="M3 7v10l9 5 9-5V7M12 12v10" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    alert: <><path d="M12 3 2 21h20L12 3Z" /><path d="M12 9v5M12 17h.01" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    truck: <><path d="M2 6h12v11H2zM14 10h4l4 4v3h-8z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 11l2 2 4-4M9 17h6" /></>,
    chevron: <><path d="m6 9 6 6 6-6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function TransferenciaInternaAceite({ id }: { id: string }) {
  const router = useRouter();
  const [item, setItem] = useState<Transferencia | null>(null);
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acao, setAcao] = useState<Acao>("total");

  const token = useCallback(async () => {
    const db = atelSupabase();
    if (!db) throw Error("Supabase indisponível");
    const { data: { session } } = await db.auth.getSession();
    if (!session) throw Error("Sessão expirada");
    return session.access_token;
  }, []);

  useEffect(() => {
    let active = true;
    async function carregar() {
      try {
        const t = await token();
        const r = await fetch(`/api/estoque-wms/transferencia-interna?id=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${t}` }, cache: "no-store",
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.detalhe || d.error);
        const registro = d.transferencias?.find((x: Transferencia) => x.id === id);
        if (!registro) throw Error("Transferência não encontrada, já recebida ou sem permissão");
        if (active) {
          setItem(registro);
          setQtd(String(registro.quantidade));
        }
      } catch (e) {
        if (active) setErro(e instanceof Error ? e.message : "Erro ao consultar");
      } finally {
        if (active) setLoading(false);
      }
    }
    void carregar();
    return () => { active = false; };
  }, [id, token]);

  async function confirmar(valor: number) {
    if (!item || salvando) return;
    if (!Number.isFinite(valor) || valor < 0 || valor > item.quantidade) {
      setErro("Quantidade aceita inválida");
      return;
    }
    if (valor < item.quantidade && !motivo) {
      setErro("Informe o motivo da divergência ou recusa");
      return;
    }
    if (!window.confirm(valor === item.quantidade ? "Confirmar aceite total?" : valor === 0 ? "Confirmar recusa integral?" : "Confirmar aceite parcial?")) return;
    setSalvando(true);
    setErro("");
    try {
      const t = await token();
      const r = await fetch("/api/estoque-wms/transferencia-interna", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          acao: "aceitar", organizacao_id: org, transferencia_id: id,
          quantidade_aceita: valor,
          motivo: valor === item.quantidade ? "" : `${motivo}${detalhe ? " — " + detalhe : ""}`,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.detalhe || d.error);
      router.push("/coletor/recebimento");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao finalizar");
    } finally {
      setSalvando(false);
    }
  }

  const quantidade = Number(qtd);
  const parcialValido = !!item && qtd.trim() !== "" && Number.isFinite(quantidade) && quantidade > 0 && quantidade < item.quantidade;
  const exigeMotivo = !!item && (acao === "recusa" || acao === "parcial" || (qtd.trim() !== "" && quantidade < item.quantidade));
  const valorAcao = acao === "total" ? (item?.quantidade ?? 0) : acao === "recusa" ? 0 : quantidade;
  const podeConfirmar = !!item && !salvando && (
    acao === "total" || acao === "recusa" || parcialValido
  ) && (!exigeMotivo || !!motivo);

  function selecionarAcao(proxima: Acao) {
    setAcao(proxima);
    setErro("");
    if (proxima === "total" && item) setQtd(String(item.quantidade));
    if (proxima === "recusa") setQtd("0");
    if (proxima === "parcial" && item && Number(qtd) >= item.quantidade) setQtd("");
  }

  return (
    <main className="collector-screen atel-v47-screen atel-v47-recebimento atel-v135-recebimento">
      <div className="collector-phone">
        <header className="atel-v135-header">
          <button type="button" className="atel-v135-back" aria-label="Voltar ao recebimento" onClick={() => router.push("/coletor/recebimento")}> <Icon name="arrow" size={21} /> </button>
          <div><strong>Recebimento</strong><small>Transferência interna</small></div>
        </header>

        <div className="atel-v135-body">
          {loading && <div className="atel-v135-loading" role="status">Carregando transferência...</div>}
          {erro && <div className="atel-v135-error" role="alert"><Icon name="alert" size={18} /><span>{erro}</span></div>}
          {item && <>
            <section className="atel-v135-document" aria-label="Documento de transferência">
              <div className="atel-v135-doc-row">
                <span className="atel-v135-icon"><Icon name="clipboard" size={22} /></span>
                <div><small>DOCUMENTO DE TRANSFERÊNCIA</small><strong>{item.codigo}</strong></div>
              </div>
              <div className="atel-v135-route"><div><span>ORIGEM</span><strong>{item.origem}</strong></div><Icon name="truck" size={19}/><div><span>DESTINO</span><strong>{item.destino}</strong></div></div>
              <span className="atel-v135-badge"><Icon name="info" size={13}/> SEM BIPAGEM DE VOLUME</span>
            </section>

            <section className="atel-v135-panel" aria-label="Conferência de materiais">
              <div className="atel-v135-heading"><div><h2>Conferência de materiais</h2><p>Valide a quantidade fisicamente recebida</p></div><span className="atel-v135-round"><Icon name="package" size={21}/></span></div>
              <div className="atel-v135-strip"><Icon name="info" size={17}/><span>Confira o produto e registre a decisão de recebimento.</span></div>
              <div className="atel-v135-metrics">
                <div><small>SKUs</small><strong>1</strong></div>
                <div><small>ENVIADO</small><strong>{item.quantidade}</strong></div>
                <div><small>INFORMADO</small><strong>{qtd.trim() === "" ? "—" : qtd}</strong></div>
              </div>
              <div className="atel-v135-section-label">PRODUTO DA TRANSFERÊNCIA</div>
              <div className="atel-v135-product">
                <div className="atel-v135-product-head"><span className="atel-v135-number">01</span><div><strong>{item.sku}</strong><p>{item.material}</p></div><span className="atel-v135-qty">{item.quantidade} un.</span></div>
                <label htmlFor="atel-v135-qtd">Quantidade efetivamente recebida</label>
                <input id="atel-v135-qtd" type="number" min={0} max={item.quantidade} step="any" value={qtd}
                  onChange={(e) => { const novo = e.target.value; setQtd(novo); setErro(""); setAcao(novo !== "" && Number(novo) === item.quantidade ? "total" : novo !== "" && Number(novo) === 0 ? "recusa" : "parcial"); }} />
              </div>
            </section>

            <section className="atel-v135-panel atel-v135-decision" aria-label="Decisão do recebimento">
              <div className="atel-v135-heading"><div><h2>Decisão do recebimento</h2><p>Selecione o resultado da conferência</p></div><span className="atel-v135-round"><Icon name="shield" size={21}/></span></div>
              <div className="atel-v135-actions" role="group" aria-label="Tipo de aceite">
                <button type="button" disabled={salvando} className={acao === "total" ? "selected ok" : ""} aria-pressed={acao === "total"} onClick={() => selecionarAcao("total")}><Icon name="check" size={17}/><span>Aceite total</span></button>
                <button type="button" disabled={salvando} className={acao === "parcial" ? "selected partial" : ""} aria-pressed={acao === "parcial"} onClick={() => selecionarAcao("parcial")}><Icon name="info" size={17}/><span>Parcial</span></button>
                <button type="button" disabled={salvando} className={acao === "recusa" ? "selected reject" : ""} aria-pressed={acao === "recusa"} onClick={() => selecionarAcao("recusa")}><Icon name="alert" size={17}/><span>Recusa</span></button>
              </div>
              {exigeMotivo && <div className="atel-v135-reason">
                <label htmlFor="atel-v135-motivo">Motivo da divergência ou recusa <span>*</span></label>
                <div className="atel-v135-select-wrap"><select id="atel-v135-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                  <option value="">Selecione um motivo</option>
                  {motivos.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select><Icon name="chevron" size={17}/></div>
                <label htmlFor="atel-v135-obs">Observação</label>
                <textarea id="atel-v135-obs" maxLength={400} rows={3} placeholder="Descreva a ocorrência, se necessário" value={detalhe} onChange={(e) => setDetalhe(e.target.value)} />
              </div>}
              <p className="atel-v135-hint">{acao === "total" ? "Todas as unidades serão aceitas." : acao === "recusa" ? "Nenhuma unidade será aceita. Informe o motivo para continuar." : "Informe uma quantidade maior que zero e menor que a enviada."}</p>
            </section>
          </>}
        </div>

        {item && <div className="atel-v135-footer-action">
          <button type="button" disabled={!podeConfirmar} onClick={() => void confirmar(valorAcao)}><Icon name="check" size={19}/>{salvando ? "REGISTRANDO ACEITE..." : acao === "total" ? "CONFIRMAR ACEITE TOTAL" : acao === "recusa" ? "CONFIRMAR RECUSA" : "CONFIRMAR ACEITE PARCIAL"}</button>
        </div>}
        <div className="atel-v135-blackbar" aria-hidden="true" />
      </div>
    </main>
  );
}

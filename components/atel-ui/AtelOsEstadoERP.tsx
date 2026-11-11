"use client";
import "./atel-os-status-v142.css";

type Props = { carregando: boolean; erro?: string; titulo?: string; onRetry?: () => void; };
export default function AtelOsEstadoERP({ carregando, erro, titulo="Ordens de Serviço", onRetry }: Props) {
  return <section className="atel-os-v142-status" role={carregando ? "status" : erro ? "alert" : "status"} aria-live="polite" aria-busy={carregando}>
    <div className={"atel-os-v142-visual"+(carregando?" is-loading":" is-error")} aria-hidden="true">
      {carregando ? <>
        <svg className="atel-os-v142-spin" width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="19" stroke="currentColor" strokeOpacity=".16" strokeWidth="4"/><path d="M24 5A19 19 0 0 1 43 24" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
        <svg className="atel-os-v142-center-icon" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10"/><path d="M3 11h18M8 9h.01M7 19h10M10 15h4"/></svg>
      </> : <svg width="43" height="43" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d="M4.6 16a4 4 0 0 1 1.8-6.3 6.5 6.5 0 0 1 12.4 1.5A4.3 4.3 0 0 1 19 19H8"/><path d="M12 11v4M12 18h.01"/></svg>}
    </div>
    <div className="atel-os-v142-eyebrow">INTEGRAÇÃO ERP</div>
    <h2>{carregando ? "Consultando informações" : "Não foi possível consultar o ERP"}</h2>
    <p>{carregando ? `Buscando ${titulo.toLowerCase()} e verificando os dados do atendimento.` : "A consulta não foi concluída. Verifique a conexão com a integração e tente novamente."}</p>
    {carregando ? <div className="atel-os-v142-progress" aria-label="Consulta em andamento"><span/></div> : <>
      {erro && <div className="atel-os-v142-error-detail">{erro}</div>}
      {onRetry && <button type="button" className="atel-os-v142-retry" onClick={onRetry}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A8 8 0 0 1 19 7l1 5M4 12l1 5A8 8 0 0 0 18.5 15"/></svg> TENTAR NOVAMENTE</button>}
    </>}
    <span className="atel-os-v142-footnote">Nenhuma alteração de estoque ou de atendimento é executada nesta consulta.</span>
  </section>;
}

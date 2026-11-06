"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Database, ClipboardList, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";

type Result = { ok?: boolean; http?: number; tipo?: string; dados?: unknown; error?: string; persistencia?: {status:string; mensagem?:string} };
const options = [{ id: "os", title: "Ordens de Servico", icon: ClipboardList }, { id: "inventario", title: "Estoque do Tecnico", icon: Database }, { id: "detalhe", title: "Detalhe do Atendimento", icon: ShieldCheck }];
export default function AdapterHomologacao() {
  const [id, setId] = useState("4157");
  const [tipo, setTipo] = useState("os");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  async function consultar(selected: string) {
    setTipo(selected); setLoading(true); setResult(null);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error("Supabase nao configurado");
      const client = createClient(url, key);
      const { data } = await client.auth.getSession();
      if (!data.session?.access_token) throw new Error("Faca login com teste@wmsexpert.com.br antes de consultar");
      const response = await fetch(`/api/adapter-homologacao?tipo=${encodeURIComponent(selected)}&id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
      setResult(await response.json() as Result);
    } catch (error) { setResult({ error: error instanceof Error ? error.message : "Erro inesperado" }); }
    finally { setLoading(false); }
  }
  return <main style={{ minHeight: "100vh", background: "#edf3f8", padding: "clamp(18px,4vw,48px)", color: "#102b44", fontFamily: "Arial,sans-serif" }}>
    <section style={{ maxWidth: 1060, margin: "auto" }}>
      <div style={{ background: "linear-gradient(120deg,#073c60,#087eaa)", color: "white", borderRadius: 18, padding: 28 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, opacity: .8 }}>WMS ATEL / INTEGRACOES</div>
        <h1 style={{ fontSize: 28, margin: "12px 0 8px" }}>Adapter ERP · Homologacao</h1>
        <p style={{ opacity: .85, margin: 0 }}>Consultas reais ao ERP, com armazenamento de snapshots no Supabase quando configurado. Sem alterar estoque operacional.</p>
      </div>
      <div style={{ background: "white", border: "1px solid #d7e5ef", borderRadius: 16, padding: 22, marginTop: 18 }}>
        <label htmlFor="adapter-id" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>ID do tecnico (para OS/estoque) ou ID do atendimento (para detalhe)</label>
        <input id="adapter-id" value={id} onChange={e => setId(e.target.value.replace(/\D/g, ""))} maxLength={12} style={{ border: "1px solid #b6cddd", borderRadius: 9, padding: 12, width: "100%", maxWidth: 260, color: "#102b44" }} />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          {options.map(item => { const Icon = item.icon; return <button key={item.id} disabled={loading || !id} onClick={() => void consultar(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #b7d5e5", background: tipo === item.id ? "#e6f6fd" : "#fff", color: "#075d85", padding: "13px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}><Icon size={19}/>{item.title}</button>; })}
        </div>
      </div>
      <div style={{ background: "white", border: "1px solid #d7e5ef", borderRadius: 16, padding: 22, marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}><RefreshCw size={18}/><strong>Retorno do Adapter</strong></div>
        {loading ? <p>Consultando o Adapter...</p> : result ? <><p style={{ color: result.ok ? "#087c61" : "#b04430", fontWeight: 700 }}>{result.ok ? `HTTP ${result.http} · Dados recebidos` : result.error || `HTTP ${result.http} · Falha na consulta`}</p><p style={{ fontSize: 13, fontWeight: 700 }}>Persistencia: {result.persistencia?.status ?? "nao informada"} {result.persistencia?.mensagem ?? ""}</p><pre style={{ background: "#0d2338", color: "#d4f0ff", borderRadius: 10, padding: 18, overflow: "auto", maxHeight: 500, fontSize: 12 }}>{JSON.stringify(result.dados ?? result, null, 2)}</pre></> : <p style={{ color: "#62778a" }}><AlertTriangle size={16} style={{ display: "inline", verticalAlign: "middle" }}/> Selecione uma consulta. Os dados demonstrativos existentes permanecem intactos nesta etapa.</p>}
      </div>
    </section>
  </main>;
}
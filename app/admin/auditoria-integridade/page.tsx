"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

type Estado = "OK" | "VAZIO" | "INVALIDO" | "INACESSIVEL";
type Linha = { modulo: string; chave: string; estado: Estado; registros: number | null; detalhe: string };
type Relatorio = { geradoEm: string; origem: "NAVEGADOR_LOCAL"; linhas: Linha[] };

const fontes = [
  ["Requisições", "wms-expert-requisicoes"],
  ["Ordens de serviço", "wms-expert-ordens-servico"],
  ["Patrimônio cliente", "wms-expert-patrimonio-cliente"],
  ["Retornos", "wms-expert-retornos"],
  ["Estoque técnico", "wms-expert-estoque-tecnico"],
  ["Movimentos estoque técnico", "wms-expert-movimentacoes-estoque-tecnico"],
  ["Estoque de retornos", "wms-expert-estoque-retornos"],
  ["Movimentos de retornos", "wms-expert-movimentacoes-retornos"],
  ["Pendências de retornos", "wms-expert-pendencias-retornos"],
] as const;

function verificar(modulo: string, chave: string): Linha {
  try {
    const bruto = window.localStorage.getItem(chave);
    if (bruto === null) return { modulo, chave, estado: "VAZIO", registros: 0, detalhe: "Chave ainda não criada neste navegador" };
    let dado: unknown;
    try { dado = JSON.parse(bruto) as unknown; }
    catch { return { modulo, chave, estado: "INVALIDO", registros: null, detalhe: "JSON inválido; nenhum dado foi alterado" }; }
    if (dado === null || typeof dado !== "object") return { modulo, chave, estado: "INVALIDO", registros: null, detalhe: "Estrutura não é objeto nem lista" };
    const registros = Array.isArray(dado) ? dado.length : Object.keys(dado).length;
    return { modulo, chave, estado: "OK", registros, detalhe: Array.isArray(dado) ? "Lista legível" : "Objeto legível (contagem de propriedades)" };
  } catch {
    return { modulo, chave, estado: "INACESSIVEL", registros: null, detalhe: "Navegador bloqueou acesso ao armazenamento" };
  }
}

export default function AuditoriaIntegridadeAtel() {
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const executar = useCallback(() => {
    setRelatorio({ geradoEm: new Date().toISOString(), origem: "NAVEGADOR_LOCAL", linhas: fontes.map(([modulo, chave]) => verificar(modulo, chave)) });
  }, []);
  const exportar = useCallback(() => {
    if (!relatorio) return;
    const arquivo = new Blob([JSON.stringify(relatorio, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = `atel-auditoria-local-${relatorio.geradoEm.slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [relatorio]);
  const invalido = relatorio?.linhas.filter((x) => x.estado === "INVALIDO" || x.estado === "INACESSIVEL").length ?? 0;
  const presentes = relatorio?.linhas.filter((x) => x.estado === "OK").length ?? 0;
  return <main style={{ maxWidth: 1050, margin: "0 auto", padding: 28, color: "#172a3a" }}>
    <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>WMS ATEL / GOVERNANÇA / V10</p>
    <h1 style={{ fontSize: 30, marginBottom: 8 }}>Auditoria de integridade operacional</h1>
    <p>Diagnóstico <strong>somente leitura</strong> das informações locais deste navegador. Não altera estoques, requisições, OS, retornos ou banco de dados.</p>
    <p style={{ padding: 14, background: "#fff4db", borderRadius: 8 }}>Atenção: uma chave ausente pode ser normal em um navegador novo. JSON válido não comprova consistência de negócio. Este painel <strong>não verifica sincronização entre dispositivos</strong> nem substitui testes operacionais.</p>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "20px 0" }}>
      <button type="button" onClick={executar} style={{ padding: "12px 18px", background: "#075c7c", color: "white", border: 0, borderRadius: 8, cursor: "pointer" }}>Executar auditoria local</button>
      <button type="button" onClick={exportar} disabled={!relatorio} style={{ padding: "12px 18px", border: "1px solid #8ba1af", borderRadius: 8, cursor: relatorio ? "pointer" : "not-allowed" }}>Exportar diagnóstico JSON</button>
      <Link href="/admin/diagnostico-supabase" style={{ padding: "12px 18px" }}>Diagnóstico Supabase V08</Link>
    </div>
    {relatorio && <section aria-live="polite">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <strong>Fontes: {relatorio.linhas.length}</strong><strong>Legíveis: {presentes}</strong><strong>Com problema: {invalido}</strong>
      </div>
      <p style={{ fontSize: 13 }}>Executado em: {new Date(relatorio.geradoEm).toLocaleString("pt-BR")}</p>
      <div style={{ overflowX: "auto", background: "white", borderRadius: 10, border: "1px solid #d3dfe5" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}><thead><tr>{["Módulo", "Estado", "Itens / propriedades", "Diagnóstico"].map((t) => <th key={t} style={{ padding: 12, borderBottom: "1px solid #d3dfe5" }}>{t}</th>)}</tr></thead>
          <tbody>{relatorio.linhas.map((linha) => <tr key={linha.chave}><td style={{ padding: 12, borderBottom: "1px solid #e7edf2" }}>{linha.modulo}</td><td style={{ padding: 12, borderBottom: "1px solid #e7edf2" }}>{linha.estado}</td><td style={{ padding: 12, borderBottom: "1px solid #e7edf2" }}>{linha.registros ?? "—"}</td><td style={{ padding: 12, borderBottom: "1px solid #e7edf2" }}>{linha.detalhe}</td></tr>)}</tbody>
        </table>
      </div>
      <p style={{ fontSize: 12 }}>O arquivo exportado contém apenas estados e contagens, não inclui registros de clientes, materiais ou credenciais.</p>
    </section>}
  </main>;
}

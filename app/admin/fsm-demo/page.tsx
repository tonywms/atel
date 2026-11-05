"use client";

import { useState } from "react";
import { carregarOrdensServico, type OrdemServico, type MaterialPrevistoOS } from "@/lib/ordensServicoStore";
import { carregarEstoqueTecnico, carregarMovimentacoesEstoqueTecnico, type EstoqueTecnico, type MovimentoEstoqueTecnico } from "@/lib/estoqueTecnicoStore";

const K_EST = "wms-expert-estoque-tecnico";
const K_MOV = "wms-expert-movimentacoes-estoque-tecnico";
const K_OS = "wms-expert-ordens-servico";
const K_AUD = "atel-fsm-demo-v04-auditoria";
const K_BACK = "atel-fsm-demo-v04-backup";
const PRODUTOS = [
  { codigo: "TEL0004", nome: "ROTEADOR MESH WI-FI 6", qtd: 4, serial: true },
  { codigo: "TEL0005", nome: "ONT GPON DUAL BAND", qtd: 5, serial: true },
  { codigo: "TEL0007", nome: "CAIXA TERMINAÇÃO ÓPTICA PTO", qtd: 12, serial: false },
  { codigo: "TEL0008", nome: "SPLITTER ÓPTICO 1X8 SC/APC", qtd: 8, serial: false },
];
const TECNICOS = ["TEC-114", "TEC-136", "TEC-074", "TEC-060"];
function lerArray<T>(chave: string): T[] {
  const bruto = localStorage.getItem(chave);
  if (!bruto) return [];
  const valor: unknown = JSON.parse(bruto);
  if (!Array.isArray(valor)) throw new Error(`Dados inválidos em ${chave}; operação cancelada.`);
  return valor as T[];
}
function download(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export default function FsmDemoV04() {
  const [mensagem, setMensagem] = useState("Nenhuma alteração realizada.");
  const [resumo, setResumo] = useState("");
  function executar() {
    try {
      const ordens = carregarOrdensServico();
      const estoque = carregarEstoqueTecnico();
      const movimentos = carregarMovimentacoesEstoqueTecnico();
      if (!Array.isArray(ordens) || !Array.isArray(estoque) || !Array.isArray(movimentos)) throw new Error("Stores inválidos.");
      const tecnicoPorCodigo = new Map<string, OrdemServico>();
      for (const os of ordens) if (TECNICOS.includes(os.codigoTecnico) && !tecnicoPorCodigo.has(os.codigoTecnico)) tecnicoPorCodigo.set(os.codigoTecnico, os);
      if (!tecnicoPorCodigo.has("TEC-114")) throw new Error("Técnico TEC-114 não encontrado. Nenhum dado alterado.");
      const alvo = ordens.find(os => os.id === 2600001);
      if (!alvo || alvo.codigoTecnico !== "TEC-114") throw new Error("OS-2600001 não encontrada ou técnico divergente.");
      if (alvo.status === "FINALIZADA" || alvo.status === "CANCELADA") throw new Error("OS-2600001 encerrada: não será modificada.");
      const plano: { tecnico: OrdemServico; produto: typeof PRODUTOS[number] }[] = [];
      for (const codigo of TECNICOS) {
        const tecnico = tecnicoPorCodigo.get(codigo);
        if (tecnico) for (const produto of PRODUTOS) plano.push({ tecnico, produto });
      }
      const novosEstoque: EstoqueTecnico[] = [...estoque];
      const novosMovimentos: MovimentoEstoqueTecnico[] = [...movimentos];
      const agora = new Date().toISOString();
      let inseridos = 0;
      let ignorados = 0;
      for (const { tecnico, produto } of plano) {
        const chave = `ATEL-FSM-DEMO-V04|${tecnico.codigoTecnico}|${produto.codigo}`;
        const id = `${tecnico.codigoTecnico}|${produto.codigo}|DISPONIVEL`;
        if (novosMovimentos.some(m => m.chaveIdempotencia === chave)) { ignorados++; continue; }
        const seriais = produto.serial ? Array.from({ length: produto.qtd }, (_, i) => `DEMO-V04-${tecnico.codigoTecnico}-${produto.codigo}-${String(i+1).padStart(3,"0")}`) : [];
        if (novosEstoque.some(e => e.id === id && seriais.some(s => e.seriais.includes(s)))) throw new Error(`Serial DEMO já existe sem movimento correspondente em ${id}. Nenhum dado alterado.`);
        const pos = novosEstoque.findIndex(e => e.id === id);
        if (pos >= 0) {
          const e = novosEstoque[pos];
          novosEstoque[pos] = { ...e, quantidade: e.quantidade + produto.qtd, seriais: [...new Set([...e.seriais, ...seriais])], atualizadoEm: agora };
        } else novosEstoque.push({ id, codigoTecnico: tecnico.codigoTecnico, tecnico: tecnico.tecnico, base: tecnico.base, codigoProduto: produto.codigo, produto: produto.nome, unidade: "UN", quantidade: produto.qtd, seriais, situacao: "DISPONIVEL", atualizadoEm: agora });
        novosMovimentos.unshift({ id: `MOV-DEMO-V04-${tecnico.codigoTecnico}-${produto.codigo}`, chaveIdempotencia: chave, criadoEm: agora, tipo: "AJUSTE", documentoOrigem: "ATEL-FSM-DEMO-V04", codigoTecnico: tecnico.codigoTecnico, tecnico: tecnico.tecnico, base: tecnico.base, codigoProduto: produto.codigo, produto: produto.nome, unidade: "UN", quantidade: produto.qtd, seriais, origem: "CARGA FICTÍCIA DE HOMOLOGAÇÃO (SEM RECEBIMENTO CD)", destino: `${tecnico.codigoTecnico} - ${tecnico.tecnico}` });
        inseridos++;
      }
      const novasOS = ordens.map(os => {
        if (os.id !== 2600001) return os;
        const codigos = new Set(os.materiaisPrevistos.map(m => m.codigoProduto));
        const adicionais: MaterialPrevistoOS[] = PRODUTOS.filter(p => ["TEL0005", "TEL0007"].includes(p.codigo) && !codigos.has(p.codigo)).map((p, i) => ({ id: 260000190 + i, codigoProduto: p.codigo, produto: p.nome, unidade: "UN", quantidade: 1, serialObrigatorio: p.serial, seriaisPrevistos: [], statusConferencia: "PENDENTE" }));
        return { ...os, materiaisPrevistos: [...os.materiaisPrevistos, ...adicionais] };
      });
      const copia = { criadoEm: agora, valores: { [K_EST]: localStorage.getItem(K_EST), [K_MOV]: localStorage.getItem(K_MOV), [K_OS]: localStorage.getItem(K_OS) } };
      const textoBackup = JSON.stringify(copia, null, 2);
      if (!localStorage.getItem(K_BACK)) localStorage.setItem(K_BACK, textoBackup);
      download(`ATEL_FSM_V04_BACKUP_${new Date().toISOString().replace(/[:.]/g,"-")}.json`, textoBackup);
      // Preparar todos os valores antes de gravar e reverter em caso de erro de armazenamento.
      const atual = { [K_EST]: localStorage.getItem(K_EST), [K_MOV]: localStorage.getItem(K_MOV), [K_OS]: localStorage.getItem(K_OS), [K_AUD]: localStorage.getItem(K_AUD) };
      try {
        localStorage.setItem(K_EST, JSON.stringify(novosEstoque));
        localStorage.setItem(K_MOV, JSON.stringify(novosMovimentos));
        localStorage.setItem(K_OS, JSON.stringify(novasOS));
        localStorage.setItem(K_AUD, JSON.stringify({ versao: "V04", aplicadoEm: agora, inseridos, ignorados, modo: "DEMO" }));
      } catch (erro) {
        for (const [k, v] of Object.entries(atual)) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
        throw erro;
      }
      window.dispatchEvent(new CustomEvent("wms-estoque-tecnico-update"));
      window.dispatchEvent(new CustomEvent("wms-ordens-servico-update"));
      setResumo(`${inseridos} entradas DEMO criadas; ${ignorados} já existentes. OS-2600001 preparada com materiais previstos.`);
      setMensagem("Carga DEMO concluída. Backup JSON gerado no navegador. Atualize a OS-2600001 para continuar.");
    } catch (e) { setMensagem(`ERRO: ${e instanceof Error ? e.message : String(e)}`); }
  }
  function exportarBackup() {
    const texto = localStorage.getItem(K_BACK);
    if (!texto) { setMensagem("Nenhum backup V04 armazenado neste navegador."); return; }
    download("ATEL_FSM_V04_BACKUP_ORIGINAL.json", texto);
    setMensagem("Backup original exportado. Guarde o arquivo em local seguro.");
  }
  return <main style={{ maxWidth: 760, margin: "40px auto", padding: 24, fontFamily: "Arial, sans-serif", color: "#12324b" }}>
    <h1>ATEL FSM V04 · Estoques de homologação</h1>
    <p>Prepara saldos fictícios e rastreáveis para técnicos encontrados nas OS. Não altera estoque real do CD, não cria recebimentos reais e não consome materiais.</p>
    <div style={{ padding: 18, border: "1px solid #b8d6e2", borderRadius: 12, background: "#f0f9fc", marginBottom: 20 }}>
      <strong>Plano DEMO</strong><p>Técnicos: TEC-114, TEC-136, TEC-074 e TEC-060 (quando encontrados).</p>
      <p>Produtos: TEL0004, TEL0005, TEL0007 e TEL0008. Seriais fictícios exclusivos por técnico.</p>
      <p>OS-2600001: acrescenta ONT e PTO como materiais previstos, sem mudar o status NO LOCAL.</p>
      <p><strong>Atenção:</strong> os movimentos serão classificados como AJUSTE de homologação, nunca como aceite real de requisição.</p>
    </div>
    <button onClick={() => { if (window.confirm("Confirmar inclusão de estoques FICTÍCIOS no navegador atual? Um backup JSON será baixado antes da gravação.")) executar(); }} style={{ padding: "14px 22px", background: "#087fa0", color: "white", border: 0, borderRadius: 8, cursor: "pointer", marginRight: 12 }}>Preparar estoques DEMO</button>
    <button onClick={exportarBackup} style={{ padding: "14px 22px", background: "#e7f0f5", color: "#12324b", border: 0, borderRadius: 8, cursor: "pointer" }}>Exportar backup original</button>
    <p role="status" style={{ marginTop: 24, fontWeight: 600 }}>{mensagem}</p><p>{resumo}</p>
    <a href="/coletor/ordens-servico/2600001">Abrir OS-2600001</a>
  </main>;
}

"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  carregarEstoqueTecnico,
  carregarMovimentacoesEstoqueTecnico,
  ouvirEstoqueTecnico,
  type EstoqueTecnico,
  type MovimentoEstoqueTecnico,
} from "@/lib/estoqueTecnicoStore";

/* =========================================================
   TIPOS
========================================================= */

type TecnicoResumo = {
  codigoTecnico: string;
  tecnico: string;
  base: string;
  quantidade: number;
  skus: number;
  seriais: number;
};

/* =========================================================
   HELPERS
========================================================= */

function formatarData(data: string) {
  try {
    return new Date(data).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return data;
  }
}

function ehRetiradaCliente(movimento: MovimentoEstoqueTecnico) {
  /*
   * Retirada de patrimônio vinculada a OS é uma entrada no estoque móvel.
   * Não exigimos origem/destino para manter compatibilidade com movimentos
   * já gravados no localStorage antes desta identificação visual.
   */
  return (
    movimento.tipo === "AJUSTE" &&
    movimento.documentoOrigem?.startsWith("OS-")
  );
}

function descricaoMovimento(movimento: MovimentoEstoqueTecnico) {
  const tipo = movimento.tipo;

  if (ehRetiradaCliente(movimento)) {
    return "Retirada do cliente";
  }
  switch (tipo) {
    case "ENTRADA_ACEITE_TECNICO":
      return "Aceite do técnico";

    case "SAIDA_OS":
      return "Consumo em OS";

    case "AJUSTE":
      return "Ajuste de estoque";

    default:
      return tipo.replaceAll("_", " ");
  }
}

/* =========================================================
   PÁGINA
========================================================= */

export default function EstoqueTecnicoPage() {
  const [estoque, setEstoque] = useState<EstoqueTecnico[]>([]);
  const [movimentos, setMovimentos] = useState<
    MovimentoEstoqueTecnico[]
  >([]);

  const [busca, setBusca] = useState("");
  const [tecnicoSelecionado, setTecnicoSelecionado] =
    useState("");

  /* =======================================================
     CARREGAMENTO
  ======================================================= */

  function atualizar() {
    const novoEstoque = carregarEstoqueTecnico();
    const novosMovimentos =
      carregarMovimentacoesEstoqueTecnico();

    setEstoque(novoEstoque);
    setMovimentos(novosMovimentos);

    setTecnicoSelecionado((atual) => {
      if (
        atual &&
        novoEstoque.some(
          (item) =>
            item.codigoTecnico === atual &&
            item.quantidade > 0
        )
      ) {
        return atual;
      }

      return (
        novoEstoque.find(
          (item) => item.quantidade > 0
        )?.codigoTecnico ?? ""
      );
    });
  }

  useEffect(() => {
    atualizar();

    return ouvirEstoqueTecnico(atualizar);
  }, []);

  /* =======================================================
     RESUMO DOS TÉCNICOS
  ======================================================= */

  const tecnicos = useMemo<TecnicoResumo[]>(() => {
    const mapa = new Map<string, TecnicoResumo>();

    estoque.forEach((item) => {
      if (item.quantidade <= 0) {
        return;
      }

      const atual = mapa.get(item.codigoTecnico);

      if (!atual) {
        mapa.set(item.codigoTecnico, {
          codigoTecnico: item.codigoTecnico,
          tecnico: item.tecnico,
          base: item.base,
          quantidade: item.quantidade,
          skus: 1,
          seriais: item.seriais.length,
        });

        return;
      }

      atual.quantidade += item.quantidade;
      atual.skus += 1;
      atual.seriais += item.seriais.length;
    });

    return Array.from(mapa.values()).sort((a, b) =>
      a.tecnico.localeCompare(b.tecnico)
    );
  }, [estoque]);

  /* =======================================================
     KPIs
  ======================================================= */

  const totalTecnicos = tecnicos.length;

  const totalSkus = estoque.filter(
    (item) => item.quantidade > 0
  ).length;

  const totalQuantidade = estoque.reduce(
    (total, item) =>
      total +
      (item.quantidade > 0 ? item.quantidade : 0),
    0
  );

  const totalSeriais = estoque.reduce(
    (total, item) =>
      total +
      (item.quantidade > 0
        ? item.seriais.length
        : 0),
    0
  );

  /* =======================================================
     FILTRO
  ======================================================= */

  const tecnicosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) {
      return tecnicos;
    }

    return tecnicos.filter((tecnico) => {
      const produtosTecnico = estoque.filter(
        (item) =>
          item.codigoTecnico ===
          tecnico.codigoTecnico
      );

      return (
        tecnico.tecnico
          .toLowerCase()
          .includes(termo) ||
        tecnico.codigoTecnico
          .toLowerCase()
          .includes(termo) ||
        tecnico.base
          .toLowerCase()
          .includes(termo) ||
        produtosTecnico.some(
          (item) =>
            item.codigoProduto
              .toLowerCase()
              .includes(termo) ||
            item.produto
              .toLowerCase()
              .includes(termo) ||
            item.seriais.some((serial) =>
              serial
                .toLowerCase()
                .includes(termo)
            )
        )
      );
    });
  }, [busca, tecnicos, estoque]);

  /* =======================================================
     TÉCNICO ATUAL
  ======================================================= */

  const tecnicoAtual =
    tecnicos.find(
      (item) =>
        item.codigoTecnico ===
        tecnicoSelecionado
    ) ??
    tecnicos[0] ??
    null;

  /* =======================================================
     PRODUTOS DO TÉCNICO
  ======================================================= */

  const produtosTecnico = useMemo(() => {
    if (!tecnicoAtual) {
      return [];
    }

    return estoque
      .filter(
        (item) =>
          item.codigoTecnico ===
            tecnicoAtual.codigoTecnico &&
          item.quantidade > 0
      )
      .sort((a, b) =>
        a.codigoProduto.localeCompare(
          b.codigoProduto
        )
      );
  }, [estoque, tecnicoAtual]);

  /* =======================================================
     MOVIMENTAÇÕES
  ======================================================= */

  const movimentosTecnico = useMemo(() => {
    if (!tecnicoAtual) {
      return [];
    }

    return movimentos
      .filter(
        (movimento) =>
          movimento.codigoTecnico ===
          tecnicoAtual.codigoTecnico
      )
      .slice(0, 20);
  }, [movimentos, tecnicoAtual]);

  /* =======================================================
     EXPORTAÇÃO / IMPRESSÃO
  ======================================================= */

  function escaparCsv(valor: unknown) {
    const texto = String(valor ?? "");
    return `"${texto.replaceAll('"', '""')}"`;
  }

  function exportarExcelTecnico() {
    if (!tecnicoAtual) return;

    const cabecalho = [
      "Código Técnico", "Técnico", "Base", "Código Produto", "Descrição",
      "Unidade", "Estoque Atual", "Situação", "Seriais", "Atualizado em",
    ];

    const linhas = produtosTecnico.map((produto) => [
      tecnicoAtual.codigoTecnico,
      tecnicoAtual.tecnico,
      tecnicoAtual.base,
      produto.codigoProduto,
      produto.produto,
      produto.unidade,
      produto.quantidade,
      "DISPONÍVEL",
      produto.seriais.length > 0 ? produto.seriais.join(" | ") : "",
      produto.atualizadoEm ? formatarData(produto.atualizadoEm) : "",
    ]);

    const csv = [cabecalho, ...linhas]
      .map((linha) => linha.map(escaparCsv).join(";"))
      .join("\r\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `estoque-${tecnicoAtual.codigoTecnico}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function imprimirPdfTecnico() {
    if (!tecnicoAtual) return;

    const emissao = new Date().toLocaleString("pt-BR");
    const linhas = produtosTecnico.map((produto) => `
      <tr>
        <td>${produto.codigoProduto}</td>
        <td>${produto.produto}</td>
        <td>${produto.unidade}</td>
        <td class="numero">${produto.quantidade}</td>
        <td>${produto.seriais.length ? produto.seriais.join(", ") : "—"}</td>
        <td>DISPONÍVEL</td>
      </tr>`).join("");

    const janela = window.open("", "_blank", "width=1100,height=800");
    if (!janela) {
      alert("Permita pop-ups no navegador para imprimir o relatório.");
      return;
    }

    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>Estoque Técnico - ${tecnicoAtual.codigoTecnico}</title>
      <style>
        @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#24343c;margin:0;font-size:11px}
        .topo{border-bottom:3px solid #0797bd;padding-bottom:12px;margin-bottom:14px;display:flex;justify-content:space-between}.marca{color:#0797bd;font-size:10px;font-weight:900;letter-spacing:1px}h1{margin:3px 0 0;font-size:21px;color:#172b35}.emissao{text-align:right;color:#6f7e86}
        .dados{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}.box{border:1px solid #dce5e9;border-radius:6px;padding:8px 10px}.label{font-size:8px;color:#7d8b93;font-weight:bold}.valor{margin-top:3px;font-size:12px;font-weight:bold}
        table{width:100%;border-collapse:collapse}th{background:#0797bd;color:#fff;text-align:left;padding:8px;font-size:9px}td{border-bottom:1px solid #dfe7ea;padding:8px;vertical-align:top}.numero{text-align:right;font-weight:bold}tbody tr:nth-child(even){background:#f7fafb}
        .resumo{margin-top:12px;display:flex;gap:8px;justify-content:flex-end}.kpi{min-width:120px;border:1px solid #dce5e9;border-radius:6px;padding:8px 12px;text-align:center}.kpi strong{display:block;font-size:17px;color:#078eb3}.rodape{margin-top:18px;padding-top:8px;border-top:1px solid #dce5e9;color:#87949a;font-size:8px;display:flex;justify-content:space-between}
      </style></head><body>
      <div class="topo"><div><div class="marca">WMS EXPERT</div><h1>Estoque Móvel do Técnico</h1></div><div class="emissao"><strong>Emissão</strong><br>${emissao}</div></div>
      <div class="dados"><div class="box"><div class="label">TÉCNICO</div><div class="valor">${tecnicoAtual.tecnico}</div></div><div class="box"><div class="label">CÓDIGO</div><div class="valor">${tecnicoAtual.codigoTecnico}</div></div><div class="box"><div class="label">BASE</div><div class="valor">${tecnicoAtual.base}</div></div></div>
      <table><thead><tr><th>CÓDIGO</th><th>DESCRIÇÃO</th><th>UN</th><th>ESTOQUE</th><th>SERIAL(IS)</th><th>SITUAÇÃO</th></tr></thead><tbody>${linhas || '<tr><td colspan="6">Nenhum produto disponível.</td></tr>'}</tbody></table>
      <div class="resumo"><div class="kpi">SKUs<strong>${tecnicoAtual.skus}</strong></div><div class="kpi">SALDO<strong>${tecnicoAtual.quantidade}</strong></div><div class="kpi">SERIAIS<strong>${tecnicoAtual.seriais}</strong></div></div>
      <div class="rodape"><span>WMS Expert • Controle de estoque móvel</span><span>${tecnicoAtual.codigoTecnico} • ${tecnicoAtual.tecnico}</span></div>
      <script>window.onload=()=>window.print();<\/script></body></html>`);
    janela.document.close();
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main style={pagina}>
      {/* ===================================================
          CABEÇALHO
      =================================================== */}

      <section style={cabecalho}>
        <div>
          <div style={eyebrow}>
            RELATÓRIOS
          </div>

          <h1 style={titulo}>
            Estoque Móvel do Técnico
          </h1>

          <p style={subtitulo}>
            Visão consolidada dos materiais em posse
            da equipe de campo.
          </p>
        </div>

        <button
          type="button"
          style={botaoAtualizar}
          onClick={atualizar}
        >
          ↻ ATUALIZAR
        </button>
      </section>

      {/* ===================================================
          KPIs
      =================================================== */}

      <section style={gridKpis}>
        <Kpi
          icone="♟"
          label="TÉCNICOS"
          valor={totalTecnicos}
          descricao="com estoque em campo"
        />

        <Kpi
          icone="▦"
          label="SKUs"
          valor={totalSkus}
          descricao="posições de estoque"
        />

        <Kpi
          icone="▣"
          label="QUANTIDADE"
          valor={totalQuantidade}
          descricao="saldo total em campo"
        />

        <Kpi
          icone="#"
          label="SERIALIZADOS"
          valor={totalSeriais}
          descricao="seriais sob custódia"
        />
      </section>

      {/* ===================================================
          BUSCA
      =================================================== */}

      <section style={barraBusca}>
        <div style={iconeBusca}>⌕</div>

        <input
          value={busca}
          onChange={(event) =>
            setBusca(event.target.value)
          }
          placeholder="Buscar técnico, código, base, produto ou serial..."
          style={inputBusca}
        />

        <div style={contadorBusca}>
          {tecnicosFiltrados.length} técnico
          {tecnicosFiltrados.length === 1
            ? ""
            : "s"}
        </div>
      </section>

      {/* ===================================================
          CONTEÚDO PRINCIPAL
      =================================================== */}

      <section style={gridPrincipal}>
        {/* ===============================================
            LISTA DE TÉCNICOS
        =============================================== */}

        <div style={painelTecnicos}>
          <div style={cabecalhoPainel}>
            <div>
              <strong style={tituloPainel}>
                TÉCNICOS
              </strong>

              <span style={descricaoPainel}>
                Estoque em campo
              </span>
            </div>

            <span style={badgeQuantidade}>
              {tecnicosFiltrados.length}
            </span>
          </div>

          <div style={listaTecnicos}>
            {tecnicosFiltrados.map(
              (tecnico) => {
                const ativo =
                  tecnicoAtual?.codigoTecnico ===
                  tecnico.codigoTecnico;

                return (
                  <button
                    type="button"
                    key={tecnico.codigoTecnico}
                    onClick={() =>
                      setTecnicoSelecionado(
                        tecnico.codigoTecnico
                      )
                    }
                    style={{
                      ...cardTecnico,

                      background: ativo
                        ? "#edf8fb"
                        : "#ffffff",

                      borderColor: ativo
                        ? "#9ed9e8"
                        : "transparent",

                      boxShadow: ativo
                        ? "inset 3px 0 0 #0797bd"
                        : "none",
                    }}
                  >
                    <div style={avatarTecnico}>
                      {tecnico.tecnico
                        .split(" ")
                        .slice(0, 2)
                        .map((nome) => nome[0])
                        .join("")
                        .toUpperCase()}
                    </div>

                    <div style={dadosTecnico}>
                      <strong
                        style={{
                          ...nomeTecnico,
                          color: ativo
                            ? "#067fa3"
                            : "#1f2d35",
                        }}
                      >
                        {tecnico.tecnico}
                      </strong>

                      <span
                        style={codigoTecnico}
                      >
                        {tecnico.codigoTecnico}
                        {" • "}
                        {tecnico.base}
                      </span>

                      <div
                        style={miniIndicadores}
                      >
                        <span>
                          {tecnico.skus} SKU
                        </span>

                        <span>•</span>

                        <span>
                          {tecnico.seriais}{" "}
                          {tecnico.seriais === 1
                            ? "serial"
                            : "seriais"}
                        </span>
                      </div>
                    </div>

                    <div style={saldoTecnico}>
                      <strong
                        style={saldoTecnicoValor}
                      >
                        {tecnico.quantidade}
                      </strong>

                      <span
                        style={saldoTecnicoLabel}
                      >
                        saldo
                      </span>
                    </div>
                  </button>
                );
              }
            )}

            {tecnicosFiltrados.length ===
              0 && (
              <div style={vazio}>
                Nenhum técnico encontrado.
              </div>
            )}
          </div>
        </div>

        {/* ===============================================
            ESTOQUE DO TÉCNICO
        =============================================== */}

        <div style={painelEstoque}>
          {!tecnicoAtual ? (
            <div style={estadoVazioGrande}>
              <div style={iconeVazio}>
                ▦
              </div>

              <strong>
                Nenhum estoque móvel
              </strong>

              <span>
                O saldo aparecerá após o aceite
                do técnico.
              </span>
            </div>
          ) : (
            <>
              <div style={cabecalhoEstoque}>
                <div>
                  <div style={labelPequeno}>
                    ESTOQUE EM CAMPO
                  </div>

                  <h2
                    style={nomeTecnicoGrande}
                  >
                    {tecnicoAtual.tecnico}
                  </h2>

                  <div
                    style={identificacaoTecnico}
                  >
                    <span>
                      {
                        tecnicoAtual.codigoTecnico
                      }
                    </span>

                    <span>•</span>

                    <span>
                      {tecnicoAtual.base}
                    </span>
                  </div>


                  <div style={acoesRelatorio}>
                    <button type="button" style={botaoExcel} onClick={exportarExcelTecnico}>
                      ↓ EXCEL
                    </button>
                    <button type="button" style={botaoPdf} onClick={imprimirPdfTecnico}>
                      ▣ IMPRIMIR / PDF
                    </button>
                  </div>
                </div>

                <div style={resumoTecnico}>
                  <MiniKpi
                    label="SKUs"
                    valor={tecnicoAtual.skus}
                  />

                  <MiniKpi
                    label="SALDO"
                    valor={
                      tecnicoAtual.quantidade
                    }
                  />

                  <MiniKpi
                    label="SERIAIS"
                    valor={
                      tecnicoAtual.seriais
                    }
                  />
                </div>
              </div>

              <div style={listaProdutos}>
                {produtosTecnico.map(
                  (produto) => (
                    <ProdutoCard
                      key={produto.id}
                      produto={produto}
                    />
                  )
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ===================================================
          HISTÓRICO
      =================================================== */}

      {tecnicoAtual && (
        <section style={painelHistorico}>
          <div style={cabecalhoHistorico}>
            <div>
              <strong style={tituloPainel}>
                MOVIMENTAÇÕES RECENTES
              </strong>

              <span style={descricaoPainel}>
                Histórico de{" "}
                {tecnicoAtual.tecnico}
              </span>
            </div>

            <span style={badgeQuantidade}>
              {movimentosTecnico.length}
            </span>
          </div>

          <div style={timeline}>
            {movimentosTecnico.map(
                (movimento, index) => (
                    <Movimento
                    key={`${movimento.id}-${movimento.documentoOrigem}-${movimento.codigoProduto}-${index}`}
                    movimento={movimento}
                    />
                )
                )}

            {movimentosTecnico.length ===
              0 && (
              <div style={vazio}>
                Nenhuma movimentação para
                este técnico.
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

/* =========================================================
   KPI
========================================================= */

function Kpi({
  icone,
  label,
  valor,
  descricao,
}: {
  icone: string;
  label: string;
  valor: number;
  descricao: string;
}) {
  return (
    <div style={kpi}>
      <div style={kpiIcone}>
        {icone}
      </div>

      <div style={kpiConteudo}>
        <span style={kpiLabel}>
          {label}
        </span>

        <strong style={kpiValor}>
          {valor}
        </strong>

        <span style={kpiDescricao}>
          {descricao}
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   MINI KPI
========================================================= */

function MiniKpi({
  label,
  valor,
}: {
  label: string;
  valor: number;
}) {
  return (
    <div style={miniKpi}>
      <span style={miniKpiLabel}>
        {label}
      </span>

      <strong style={miniKpiValor}>
        {valor}
      </strong>
    </div>
  );
}

/* =========================================================
   PRODUTO
========================================================= */

function ProdutoCard({
  produto,
}: {
  produto: EstoqueTecnico;
}) {
  return (
    <div style={produtoCard}>
      <div style={produtoIcone}>
        ▣
      </div>

      <div style={produtoConteudo}>
        <div style={produtoTopo}>
          <div style={produtoInfo}>
            <strong
              style={produtoCodigo}
            >
              {produto.codigoProduto}
            </strong>

            <div style={produtoNome}>
              {produto.produto}
            </div>
          </div>

          <div style={quantidadeProduto}>
            <strong
              style={quantidadeProdutoValor}
            >
              {produto.quantidade}
            </strong>

            <span
              style={quantidadeProdutoUnidade}
            >
              {produto.unidade}
            </span>
          </div>
        </div>

        <div style={produtoRodape}>
          <span style={badgeDisponivel}>
            ● DISPONÍVEL
          </span>

          {produto.seriais.length > 0 ? (
            <div style={listaSeriais}>
              {produto.seriais.map(
                (serial) => (
                  <span
                    key={serial}
                    style={serialChip}
                  >
                    # {serial}
                  </span>
                )
              )}
            </div>
          ) : (
            <span style={semSerial}>
              Produto não serializado
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MOVIMENTO
========================================================= */

function Movimento({
  movimento,
}: {
  movimento: MovimentoEstoqueTecnico;
}) {
  const entrada =
    movimento.tipo === "ENTRADA_ACEITE_TECNICO" ||
    ehRetiradaCliente(movimento);

  return (
    <div style={movimentoLinha}>
      <div
        style={{
          ...movimentoIcone,

          background: entrada
            ? "#e7f7ee"
            : "#fff3df",

          color: entrada
            ? "#13854d"
            : "#b66a00",
        }}
      >
        {entrada ? "↓" : "↑"}
      </div>

      <div style={movimentoConteudo}>
        <div style={movimentoTopo}>
          <div>
            <strong
              style={movimentoTitulo}
            >
              {descricaoMovimento(movimento)}
            </strong>

            <span
              style={movimentoDocumento}
            >
              {movimento.documentoOrigem}
            </span>
          </div>

          <div
            style={{
              ...movimentoQuantidade,
              color: entrada
                ? "#16824a"
                : "#b66a00",
            }}
          >
            {entrada ? "+" : "-"}
            {movimento.quantidade}{" "}
            {movimento.unidade}
          </div>
        </div>

        <div style={movimentoDetalhe}>
          <strong>
            {movimento.codigoProduto}
          </strong>

          <span>•</span>

          <span>
            {movimento.produto}
          </span>

          <span>•</span>

          <span>
            {formatarData(
              movimento.criadoEm
            )}
          </span>
        </div>

        {movimento.seriais.length >
          0 && (
          <div style={movimentoSeriais}>
            {movimento.seriais.map(
              (serial) => (
                <span
                  key={serial}
                  style={serialChipPequeno}
                >
                  {serial}
                </span>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const pagina: React.CSSProperties = {
  minHeight: "100vh",
  padding: 18,
  background: "#f2f5f7",
  color: "#25343c",
  boxSizing: "border-box",
};

/* CABEÇALHO */

const cabecalho: React.CSSProperties = {
  minHeight: 86,
  padding: "16px 20px",
  background: "#ffffff",

  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dce5e9",

  borderRadius: 10,

  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,

  boxShadow:
    "0 2px 8px rgba(26, 52, 68, .04)",
};

const eyebrow: React.CSSProperties = {
  fontSize: 9,
  color: "#0097bd",
  fontWeight: 900,
  letterSpacing: 1.2,
  marginBottom: 3,
};

const titulo: React.CSSProperties = {
  margin: 0,
  color: "#172b35",
  fontSize: 23,
  lineHeight: 1.1,
  fontWeight: 900,
};

const subtitulo: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#78878f",
  fontSize: 11,
};

const botaoAtualizar: React.CSSProperties = {
  height: 38,
  padding: "0 17px",

  borderWidth: 0,
  borderStyle: "solid",
  borderColor: "transparent",

  borderRadius: 6,
  background: "#0797bd",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: 11,
  cursor: "pointer",
};

/* KPI */

const gridKpis: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: 12,
  marginTop: 12,
};

const kpi: React.CSSProperties = {
  minHeight: 82,
  padding: 14,
  background: "#ffffff",

  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dce5e9",

  borderRadius: 9,

  display: "flex",
  alignItems: "center",
  gap: 13,

  boxShadow:
    "0 2px 8px rgba(26, 52, 68, .03)",
};

const kpiIcone: React.CSSProperties = {
  width: 42,
  height: 42,
  flexShrink: 0,

  display: "grid",
  placeItems: "center",

  borderRadius: 10,

  background: "#e9f7fb",
  color: "#008eb5",

  fontSize: 18,
  fontWeight: 900,
};

const kpiConteudo: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const kpiLabel: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 900,
  color: "#7d8b93",
  letterSpacing: 0.5,
};

const kpiValor: React.CSSProperties = {
  color: "#078eb3",
  fontSize: 24,
  lineHeight: 1,
  marginTop: 3,
};

const kpiDescricao: React.CSSProperties = {
  color: "#9aa5ab",
  fontSize: 8,
  marginTop: 4,
};

/* BUSCA */

const barraBusca: React.CSSProperties = {
  minHeight: 54,
  padding: "8px 12px",
  marginTop: 12,

  background: "#ffffff",

  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dce5e9",

  borderRadius: 9,

  display: "flex",
  alignItems: "center",
  gap: 8,
};

const iconeBusca: React.CSSProperties = {
  width: 30,
  textAlign: "center",
  color: "#7a8991",
  fontSize: 19,
};

const inputBusca: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 36,

  borderWidth: 0,
  borderStyle: "solid",
  borderColor: "transparent",

  outline: "none",
  color: "#26363f",
  fontSize: 11,
  background: "transparent",
};

const contadorBusca: React.CSSProperties = {
  padding: "6px 10px",
  background: "#f1f5f7",
  borderRadius: 999,
  color: "#6d7b83",
  fontSize: 9,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

/* GRID */

const gridPrincipal: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(250px, 300px) minmax(0, 1fr)",
  gap: 12,
  marginTop: 12,
  alignItems: "start",
};

/* PAINEL TÉCNICOS */

const painelTecnicos: React.CSSProperties = {
  background: "#ffffff",

  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dce5e9",

  borderRadius: 10,
  overflow: "hidden",
};

const cabecalhoPainel: React.CSSProperties = {
  minHeight: 54,
  padding: "10px 13px",

  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",

  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "#e6ecef",

  background: "#f9fbfc",
};

const tituloPainel: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: "#24363f",
  fontWeight: 900,
  letterSpacing: 0.3,
};

const descricaoPainel: React.CSSProperties = {
  display: "block",
  color: "#8b989f",
  fontSize: 8,
  marginTop: 2,
};

const badgeQuantidade: React.CSSProperties = {
  minWidth: 25,
  height: 25,
  padding: "0 7px",

  display: "grid",
  placeItems: "center",

  borderRadius: 999,

  background: "#e8f6fa",
  color: "#078eb3",

  fontSize: 9,
  fontWeight: 900,
};

const listaTecnicos: React.CSSProperties = {
  padding: 8,
};

/*
  IMPORTANTE:
  NÃO usamos "border" shorthand aqui.
  Isso elimina o erro do React 19/Next 16.
*/

const cardTecnico: React.CSSProperties = {
  width: "100%",
  minHeight: 76,
  padding: "10px 9px",

  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "transparent",

  borderRadius: 8,
  background: "#ffffff",

  display: "grid",
  gridTemplateColumns:
    "38px minmax(0, 1fr) auto",

  alignItems: "center",
  gap: 9,

  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",

  marginBottom: 5,

  transition:
    "background .15s ease, border-color .15s ease, box-shadow .15s ease",
};

const avatarTecnico: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",

  display: "grid",
  placeItems: "center",

  background: "#0b91b5",
  color: "#ffffff",

  fontSize: 10,
  fontWeight: 900,
};

const dadosTecnico: React.CSSProperties = {
  minWidth: 0,
};

const nomeTecnico: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 900,

  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const codigoTecnico: React.CSSProperties = {
  display: "block",
  marginTop: 2,
  color: "#7c8990",
  fontSize: 8,
};

const miniIndicadores: React.CSSProperties = {
  marginTop: 5,
  display: "flex",
  gap: 5,
  color: "#85939a",
  fontSize: 8,
};

const saldoTecnico: React.CSSProperties = {
  minWidth: 42,
  textAlign: "right",
};

const saldoTecnicoValor: React.CSSProperties = {
  display: "block",
  color: "#078eb3",
  fontSize: 17,
  lineHeight: 1,
  fontWeight: 900,
};

const saldoTecnicoLabel: React.CSSProperties = {
  display: "block",
  color: "#96a2a8",
  fontSize: 7,
  marginTop: 3,
  textTransform: "uppercase",
};

/* PAINEL ESTOQUE */

const painelEstoque: React.CSSProperties = {
  background: "#ffffff",

  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dce5e9",

  borderRadius: 10,
  overflow: "hidden",
  minHeight: 300,
};

const cabecalhoEstoque: React.CSSProperties = {
  minHeight: 80,
  padding: "14px 16px",

  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "#e6ecef",

  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,

  background:
    "linear-gradient(90deg, #ffffff 0%, #f6fbfc 100%)",
};

const labelPequeno: React.CSSProperties = {
  color: "#0797bd",
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: 0.7,
};

const nomeTecnicoGrande: React.CSSProperties = {
  margin: "3px 0",
  color: "#20333c",
  fontSize: 17,
  fontWeight: 900,
};

const identificacaoTecnico: React.CSSProperties = {
  display: "flex",
  gap: 5,
  color: "#78868d",
  fontSize: 9,
};

const resumoTecnico: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

const acoesRelatorio: React.CSSProperties = {
  display: "flex",
  gap: 7,
  marginTop: 10,
  flexWrap: "wrap",
};

const botaoExcel: React.CSSProperties = {
  height: 31,
  padding: "0 11px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#168b52",
  borderRadius: 5,
  background: "#ffffff",
  color: "#168b52",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const botaoPdf: React.CSSProperties = {
  height: 31,
  padding: "0 11px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#0797bd",
  borderRadius: 5,
  background: "#0797bd",
  color: "#ffffff",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const miniKpi: React.CSSProperties = {
  minWidth: 65,
  padding: "8px 10px",
  background: "#ffffff",

  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#e1e8eb",

  borderRadius: 7,
  textAlign: "center",
};

const miniKpiLabel: React.CSSProperties = {
  display: "block",
  color: "#8a979e",
  fontSize: 7,
  fontWeight: 900,
};

const miniKpiValor: React.CSSProperties = {
  display: "block",
  color: "#078eb3",
  fontSize: 17,
  marginTop: 2,
};

const listaProdutos: React.CSSProperties = {
  padding: 10,

  display: "grid",

  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",

  gap: 8,
};

/* PRODUTO */

const produtoCard: React.CSSProperties = {
  minHeight: 105,
  padding: 11,

  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#e0e7ea",

  borderRadius: 8,

  display: "flex",
  gap: 10,

  background: "#ffffff",
};

const produtoIcone: React.CSSProperties = {
  width: 34,
  height: 34,
  flexShrink: 0,

  borderRadius: 7,

  display: "grid",
  placeItems: "center",

  background: "#edf7fa",
  color: "#078eb3",

  fontWeight: 900,
};

const produtoConteudo: React.CSSProperties = {
  minWidth: 0,
  flex: 1,
};

const produtoTopo: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
};

const produtoInfo: React.CSSProperties = {
  minWidth: 0,
};

const produtoCodigo: React.CSSProperties = {
  color: "#078eb3",
  fontSize: 9,
  fontWeight: 900,
};

const produtoNome: React.CSSProperties = {
  color: "#26373f",
  fontSize: 10,
  fontWeight: 800,
  marginTop: 3,
  lineHeight: 1.3,
};

const quantidadeProduto: React.CSSProperties = {
  minWidth: 52,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const quantidadeProdutoValor: React.CSSProperties = {
  display: "block",
  color: "#172f39",
  fontSize: 19,
  lineHeight: 1,
  fontWeight: 900,
};

const quantidadeProdutoUnidade: React.CSSProperties = {
  display: "block",
  marginTop: 3,
  color: "#849198",
  fontSize: 8,
  fontWeight: 900,
};

const produtoRodape: React.CSSProperties = {
  marginTop: 10,
};

const badgeDisponivel: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 7px",

  borderRadius: 999,

  background: "#e8f7ee",
  color: "#178149",

  fontSize: 7,
  fontWeight: 900,
};

const listaSeriais: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  marginTop: 7,
};

const serialChip: React.CSSProperties = {
  padding: "4px 6px",

  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#d5e2e7",

  borderRadius: 5,

  background: "#f5f8f9",
  color: "#4f6068",

  fontSize: 8,
  fontWeight: 800,
};

const semSerial: React.CSSProperties = {
  display: "block",
  marginTop: 7,
  color: "#a0abb0",
  fontSize: 8,
};

/* HISTÓRICO */

const painelHistorico: React.CSSProperties = {
  marginTop: 12,

  background: "#ffffff",

  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dce5e9",

  borderRadius: 10,
  overflow: "hidden",
};

const cabecalhoHistorico: React.CSSProperties = {
  minHeight: 54,
  padding: "10px 14px",

  background: "#f9fbfc",

  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "#e5ecef",

  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const timeline: React.CSSProperties = {
  padding: "3px 14px",
};

const movimentoLinha: React.CSSProperties = {
  minHeight: 62,

  display: "flex",
  alignItems: "center",
  gap: 11,

  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "#edf1f3",

  padding: "8px 0",
};

const movimentoIcone: React.CSSProperties = {
  width: 32,
  height: 32,
  flexShrink: 0,

  display: "grid",
  placeItems: "center",

  borderRadius: "50%",

  fontSize: 15,
  fontWeight: 900,
};

const movimentoConteudo: React.CSSProperties = {
  minWidth: 0,
  flex: 1,
};

const movimentoTopo: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const movimentoTitulo: React.CSSProperties = {
  color: "#26373f",
  fontSize: 10,
  fontWeight: 900,
};

const movimentoDocumento: React.CSSProperties = {
  marginLeft: 7,
  padding: "3px 6px",

  borderRadius: 4,

  background: "#edf3f5",
  color: "#62727a",

  fontSize: 8,
  fontWeight: 800,
};

const movimentoQuantidade: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const movimentoDetalhe: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 5,

  color: "#839097",
  fontSize: 8,

  marginTop: 4,
};

const movimentoSeriais: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  marginTop: 5,
};

const serialChipPequeno: React.CSSProperties = {
  padding: "2px 5px",

  borderRadius: 4,

  background: "#f0f4f5",
  color: "#62727a",

  fontSize: 7,
};

/* VAZIOS */

const vazio: React.CSSProperties = {
  padding: 25,
  textAlign: "center",
  color: "#89969d",
  fontSize: 10,
};

const estadoVazioGrande: React.CSSProperties = {
  minHeight: 300,

  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",

  color: "#85939a",
  gap: 5,
};

const iconeVazio: React.CSSProperties = {
  fontSize: 28,
  color: "#9fb0b8",
};
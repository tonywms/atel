"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  requisicoesTecnicasMock,
  RequisicaoTecnica,
} from "@/lib/requisicoesTecnicas";

import {
  carregarEstados,
  iniciarSeparacao,
  ouvirAlteracoes,
} from "@/lib/requisicoesStore";

/* =========================================================
   HELPERS
========================================================= */

function formatarQuantidade(
  quantidade: number,
  unidade: string
) {
  if (unidade === "MT") {
    return `${quantidade} m`;
  }

  return quantidade;
}

function classePrioridade(prioridade: string) {
  if (prioridade === "URGENTE") {
    return "req-priority urgent";
  }

  if (prioridade === "ALTA") {
    return "req-priority high";
  }

  return "req-priority normal";
}

function classeStatus(status: string) {
  switch (status) {
    case "PENDENTE":
      return "req-status pending";

    case "EM_SEPARACAO":
      return "req-status separating";

    case "SEPARADA":
      return "req-status separated";

    case "EM_CONFERENCIA":
      return "req-status separated";

    case "CONFERIDA":
      return "req-status checked";

    case "EMBARCADA":
    case "EM_TRANSITO":
      return "req-status transit";

    case "ACEITE_PENDENTE":
      return "req-status transit";

    case "RECEBIDA_TECNICO":
      return "req-status finished";
    case "RECUSA_PARCIAL":
      return "req-status checked";
    case "RECUSA_TOTAL":
      return "req-status pending";

    default:
      return "req-status";
  }
}

function nomeStatus(status: string) {
  return status.replaceAll("_", " ");
}

/* ATEL FSM V08.0.5 FIX — apuração por SKU, sem compensação entre itens. */
function coresIndicadoresPedido(itens: Array<{ solicitado: number; separado?: number; conferido?: number; embarcado?: number }>) {
  const iguais = (a: 'solicitado' | 'separado' | 'conferido', b: 'separado' | 'conferido' | 'embarcado') =>
    itens.length > 0 && itens.every(item => {
      const esperado = Number(item[a] ?? 0);
      const realizado = Number(item[b] ?? 0);
      return Number.isFinite(esperado) && Number.isFinite(realizado) && esperado > 0 && esperado === realizado;
    });
  const s = iguais('solicitado','separado');
  const c = s && iguais('separado','conferido');
  const e = c && iguais('conferido','embarcado');
  return { S: s ? 'stage-green' : 'stage-orange', C: !s ? 'stage-gray' : c ? 'stage-green' : 'stage-orange', E: !c ? 'stage-gray' : e ? 'stage-green' : 'stage-orange', F: 'stage-gray', R: 'stage-gray' };
}

function nivelEtapa(status: string) {
  const ordem: Record<string, number> = {
    PENDENTE: 0,
    EM_SEPARACAO: 1,
    SEPARADA: 1,
    EM_CONFERENCIA: 2,
    CONFERIDA: 2,
    EMBARCADA: 3,
    EM_TRANSITO: 3,
    ACEITE_PENDENTE: 4,
    RECEBIDA_TECNICO: 4,
    RECUSA_PARCIAL: 4,
    RECUSA_TOTAL: 4,
  };

  return ordem[status] ?? 0;
}

function etapaConcluida(
  status: string,
  etapa: number
) {
  return nivelEtapa(status) >= etapa;
}

/* =========================================================
   CONTROLE DA TIMELINE
========================================================= */

function etapaSeparacaoAtiva(status: string) {
  return [
    "EM_SEPARACAO",
    "SEPARADA",
    "EM_CONFERENCIA",
    "CONFERIDA",
    "EMBARCADA",
    "EM_TRANSITO",
    "ACEITE_PENDENTE",
    "RECEBIDA_TECNICO",
    "RECUSA_PARCIAL",
    "RECUSA_TOTAL",
  ].includes(status);
}

function etapaConferenciaAtiva(status: string) {
  return [
    "EM_CONFERENCIA",
    "CONFERIDA",
    "EMBARCADA",
    "EM_TRANSITO",
    "ACEITE_PENDENTE",
    "RECEBIDA_TECNICO",
    "RECUSA_PARCIAL",
    "RECUSA_TOTAL",
  ].includes(status);
}

function etapaEmbarqueAtiva(status: string) {
  return [
    "EMBARCADA",
    "EM_TRANSITO",
    "ACEITE_PENDENTE",
    "RECEBIDA_TECNICO",
    "RECUSA_PARCIAL",
    "RECUSA_TOTAL",
  ].includes(status);
}

function etapaTecnicoAtiva(status: string) {
  return [
    "ACEITE_PENDENTE",
    "RECEBIDA_TECNICO",
    "RECUSA_PARCIAL",
    "RECUSA_TOTAL",
  ].includes(status);
}

/* =========================================================
   PAGE
========================================================= */

export default function RequisicoesTecnicasPage() {
  const [requisicoes, setRequisicoes] =
    useState<RequisicaoTecnica[]>(
      requisicoesTecnicasMock
    );

  const [selecionadaId, setSelecionadaId] =
    useState<number>(1);

  const [busca, setBusca] = useState("");

  const [menuCardId, setMenuCardId] =
    useState<number | null>(null);

  const [menuCardPos, setMenuCardPos] =
    useState<{ top: number; left: number } | null>(null);

  const [modalVolumesAberto, setModalVolumesAberto] =
    useState(false);

  const [volumeSelecionadoId, setVolumeSelecionadoId] =
    useState<number | null>(null);

  /* =======================================================
     SINCRONIZA MOCK + STORE

     Aqui é onde:
     - status vem do Store
     - separado vem da Separação
     - conferido vem da Conferência
  ======================================================= */

  function sincronizarComStore() {
    const estados = carregarEstados();

    setRequisicoes(
      requisicoesTecnicasMock.map((req) => {
        const estado = estados[req.id];

        if (!estado) {
          return req;
        }

        return {
          ...req,

          status: estado.status,

          itens: req.itens.map((item) => {
            const itemSeparado =
              estado.itens?.[item.id];

            const itemConferido =
              estado.conferencia?.[item.id];

            /*
             * EMBARQUE POR VOLUME
             *
             * A quantidade embarcada do produto não é mais
             * gravada diretamente no item da requisição.
             *
             * Ela é derivada do conteúdo dos volumes que já
             * passaram pelo embarque.
             *
             * Se o mesmo produto estiver dividido em vários
             * volumes, as quantidades são somadas.
             */
            const quantidadeEmbarcada =
              (estado.volumes ?? []).reduce(
                (total, volume) => {
                  const volumeJaEmbarcado =
                    volume.status === "EMBARCADO" ||
                    volume.status === "EM_TRANSITO" ||
                    volume.status === "RECEBIDO";

                  if (!volumeJaEmbarcado) {
                    return total;
                  }

                  const itemNoVolume =
                    volume.itens?.[item.id];

                  return (
                    total +
                    (itemNoVolume?.quantidade ?? 0)
                  );
                },
                0
              );

            return {
              ...item,

              separado:
                itemSeparado?.quantidadeSeparada ??
                item.separado ??
                0,

              conferido:
                itemConferido?.quantidadeConferida ??
                item.conferido ??
                0,

              embarcado:
                quantidadeEmbarcada,
            };
          }),
        };
      })
    );
  }

  /* =======================================================
     ESCUTA ALTERAÇÕES DO STORE
  ======================================================= */

  useEffect(() => {
    sincronizarComStore();

    const pararDeOuvir =
      ouvirAlteracoes(() => {
        sincronizarComStore();
      });

    return pararDeOuvir;
  }, []);

  /* =======================================================
     FILTRO
  ======================================================= */

  const requisicoesFiltradas =
    useMemo(() => {
      const termo =
        busca.toLowerCase().trim();

      if (!termo) {
        return requisicoes;
      }

      return requisicoes.filter(
        (req) => {
          return (
            req.codigo
              .toLowerCase()
              .includes(termo) ||
            req.codigoExterno
              .toLowerCase()
              .includes(termo) ||
            req.tecnico
              .toLowerCase()
              .includes(termo) ||
            req.codigoTecnico
              .toLowerCase()
              .includes(termo) ||
            req.base
              .toLowerCase()
              .includes(termo) ||
            req.status
              .toLowerCase()
              .includes(termo) ||
            req.prioridade
              .toLowerCase()
              .includes(termo)
          );
        }
      );
    }, [requisicoes, busca]);

  /* =======================================================
     REQUISIÇÃO SELECIONADA
  ======================================================= */

  const selecionada =
    requisicoes.find(
      (req) =>
        req.id === selecionadaId
    ) ?? requisicoes[0];

  const quantidadeSolicitada =
    selecionada?.itens.reduce(
      (total, item) =>
        total + item.solicitado,
      0
    ) ?? 0;

  const totalSKUs =
    selecionada?.itens.length ?? 0;

  /* =======================================================
     VOLUMES DA REQUISIÇÃO SELECIONADA
  ======================================================= */

  const estadoSelecionada =
    selecionada
      ? carregarEstados()[selecionada.id]
      : undefined;

  const volumesSelecionada =
    estadoSelecionada?.volumes ?? [];

  const volumeSelecionado =
    volumesSelecionada.find(
      (volume) =>
        volume.id === volumeSelecionadoId
    ) ??
    volumesSelecionada[0];

  function volumesDoItem(itemId: number) {
    return volumesSelecionada.filter(
      (volume) =>
        Boolean(volume.itens?.[itemId])
    );
  }

  function abrirModalVolumes(
    itemId?: number
  ) {
    if (
      volumesSelecionada.length === 0
    ) {
      return;
    }

    const volumesItem =
      itemId !== undefined
        ? volumesDoItem(itemId)
        : volumesSelecionada;

    const primeiro =
      volumesItem[0] ??
      volumesSelecionada[0];

    setVolumeSelecionadoId(
      primeiro?.id ?? null
    );

    setModalVolumesAberto(true);
  }

  function formatarDataVolume(
    valor?: string
  ) {
    if (!valor) {
      return "-";
    }

    const data = new Date(valor);

    if (
      Number.isNaN(data.getTime())
    ) {
      return valor;
    }

    return data.toLocaleString(
      "pt-BR"
    );
  }

  function imprimirVolume(
    volume: any
  ) {
    if (
      !selecionada ||
      !volume
    ) {
      return;
    }

    const janela =
      window.open(
        "",
        "_blank",
        "width=850,height=620"
      );

    if (!janela) {
      alert(
        "Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups."
      );
      return;
    }

    const tipoOperacao =
      selecionada.tipo ||
      "ABASTECIMENTO";

    const origem =
      selecionada.origem ||
      "CD FORTALEZA";

    const indiceVolume =
      volumesSelecionada.findIndex(
        (item) =>
          item.id === volume.id
      ) + 1;

    const totalVolumes =
      volumesSelecionada.length;

    const conteudoQR = [
      `VOLUME=${volume.codigo}`,
      `REQUISICAO=${selecionada.codigo}`,
      `TIPO=${tipoOperacao}`,
      `DESTINO=${selecionada.codigoTecnico}`,
    ].join("|");

    const dataGeracao =
      formatarDataVolume(
        volume.criadoEm
      );

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${volume.codigo}</title>
<style>
  @page {
    size: 100mm 55mm;
    margin: 0;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: 100mm;
    height: 55mm;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    background: #fff;
  }

  body {
    display: flex;
    align-items: stretch;
  }

  .label {
    width: 100mm;
    height: 55mm;
    border: 1.5px solid #000;
    display: grid;
    grid-template-columns: 1fr 11mm;
    overflow: hidden;
  }

  .main {
    display: grid;
    grid-template-rows: 1fr 11mm;
    min-width: 0;
  }

  .content {
    display: grid;
    grid-template-columns: 1fr 28mm;
    min-height: 0;
  }

  .info {
    padding: 4mm 3mm 2mm 4mm;
    font-size: 8.5pt;
    line-height: 1.35;
  }

  .info strong {
    font-weight: 800;
  }

  .title {
    font-size: 11pt;
    font-weight: 900;
    margin-bottom: 2mm;
  }

  .qr-area {
    border-left: 1px solid #000;
    display: grid;
    place-items: center;
    padding: 2mm;
  }

  #qrcode {
    width: 24mm;
    height: 24mm;
    display: grid;
    place-items: center;
  }

  #qrcode img,
  #qrcode canvas {
    width: 24mm !important;
    height: 24mm !important;
  }

  .bottom {
    border-top: 1px solid #000;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    padding: 1.5mm 3mm 1.5mm 4mm;
    gap: 3mm;
  }

  .volume-code {
    font-size: 12pt;
    font-weight: 900;
  }

  .destination {
    font-size: 8pt;
    font-weight: 800;
    white-space: nowrap;
  }

  .brand {
    border-left: 1px solid #000;
    display: grid;
    place-items: center;
    font-size: 9pt;
    font-weight: 900;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    letter-spacing: .5px;
  }

  .counter {
    font-weight: 900;
  }

  @media print {
    html, body {
      width: 100mm;
      height: 55mm;
    }
  }
</style>
</head>
<body>
  <div class="label">
    <div class="main">
      <div class="content">
        <div class="info">
          <div class="title">VOLUME WMS EXPERT</div>
          <div><strong>Requisição:</strong> ${selecionada.codigo}</div>
          <div><strong>Tipo:</strong> ${tipoOperacao}</div>
          <div><strong>Técnico:</strong> ${selecionada.tecnico}</div>
          <div><strong>Cód. Técnico:</strong> ${selecionada.codigoTecnico}</div>
          <div><strong>Base:</strong> ${selecionada.base}</div>
          <div><strong>Origem:</strong> ${origem}</div>
          <div><strong>Gerado:</strong> ${dataGeracao}</div>
          <div class="counter"><strong>Volume:</strong> ${indiceVolume} / ${totalVolumes}</div>
        </div>

        <div class="qr-area">
          <div id="qrcode"></div>
        </div>
      </div>

      <div class="bottom">
        <div class="volume-code">${volume.codigo}</div>
        <div class="destination">DESTINO: ${selecionada.codigoTecnico}</div>
      </div>
    </div>

    <div class="brand">WMS EXPERT</div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <script>
    window.onload = function () {
      new QRCode(
        document.getElementById("qrcode"),
        {
          text: ${JSON.stringify(conteudoQR)},
          width: 180,
          height: 180,
          correctLevel: QRCode.CorrectLevel.M
        }
      );

      setTimeout(function () {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

    janela.document.open();
    janela.document.write(
      html
    );
    janela.document.close();
  }

  /* =======================================================
     GERAR SEPARAÇÃO
  ======================================================= */

  const gerarSeparacao = () => {
    if (!selecionada) {
      return;
    }

    iniciarSeparacao(selecionada);
  };

  /* =======================================================
     KPIs
  ======================================================= */

  const totalPendentes =
    requisicoes.filter(
      (r) =>
        r.status === "PENDENTE"
    ).length;

  const totalEmSeparacao =
    requisicoes.filter(
      (r) =>
        r.status ===
        "EM_SEPARACAO"
    ).length;

  const totalSeparadas =
    requisicoes.filter(
      (r) =>
        r.status === "SEPARADA"
    ).length;

  const totalEmTransito =
    requisicoes.filter(
      (r) =>
        r.status ===
          "EM_TRANSITO" ||
        r.status ===
          "ACEITE_PENDENTE"
    ).length;

  return (
    <>
      {/* ===================================================
          KPIs
      =================================================== */}

      <div className="stock-summary">

        <div className="summary-card c1">
          <div className="top">
            Pedidos
          </div>

          <div className="value">
            {requisicoes.length}
          </div>

          <div className="detail">
            recebidas via integração
          </div>
        </div>

        <div className="summary-card c2">
          <div className="top">
            Pendentes
          </div>

          <div className="value">
            {totalPendentes}
          </div>

          <div className="detail">
            aguardando separação
          </div>
        </div>

        <div className="summary-card c3">
          <div className="top">
            Em Separação
          </div>

          <div className="value">
            {totalEmSeparacao}
          </div>

          <div className="detail">
            em execução no CD
          </div>
        </div>

        <div className="summary-card c4">
          <div className="top">
            Separadas
          </div>

          <div className="value">
            {totalSeparadas}
          </div>

          <div className="detail">
            aguardando conferência
          </div>
        </div>

        <div className="summary-card c5">
          <div className="top">
            Em Trânsito
          </div>

          <div className="value">
            {totalEmTransito}
          </div>

          <div className="detail">
            aguardando aceite
          </div>
        </div>

      </div>

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="wms-page-header">

        <div className="wms-page-title">
          <span className="wms-check">
            ✓
          </span>

          Gestão de Pedidos
        </div>

        <div className="wms-header-actions">

          <div className="wms-search">

            <span>⌕</span>

            <input
              value={busca}
              onChange={(e) =>
                setBusca(
                  e.target.value
                )
              }
              placeholder="Pesquisar / Filtrar"
            />

            <span>☰</span>

          </div>

          <button className="wms-icon-button">
            ◉
          </button>

          <button className="wms-icon-button">
            ⚙
          </button>

        </div>

      </div>

      {/* ===================================================
          CONTEÚDO
      =================================================== */}

      <div className="req-layout">

        {/* =================================================
            PAINEL ESQUERDO
        ================================================= */}

        <section className="req-sidebar-panel">

          <div className="req-sidebar-title">

            <strong>
              Pedidos
            </strong>

            <span>
              {
                requisicoesFiltradas.length
              }
            </span>

          </div>

          <div className="req-list">

            {requisicoesFiltradas.map(
              (req) => (
                <div
                  key={req.id}
                  role="button"
                  tabIndex={0}
                  className={`req-card ${
                    selecionada?.id ===
                    req.id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setSelecionadaId(
                      req.id
                    )
                  }
                >

                  <div className="req-card-main">
                    <div className="req-card-content">
                      <div className="req-card-top">

                        <strong>
                          {req.codigo}
                        </strong>

                        <span
                          className={classePrioridade(
                            req.prioridade
                          )}
                        >
                          {req.prioridade}
                        </span>

                      </div>

                      <div className="req-card-tech">
                        {req.tecnico}
                      </div>

                      <div className="req-card-line">
                        <b>Técnico:</b>{" "}
                        {req.codigoTecnico}
                      </div>

                      <div className="req-card-line">
                        <b>Base:</b>{" "}
                        {req.base}
                      </div>

                      <div className="req-card-line">
                        <b>Tipo:</b>{" "}
                        {req.tipo}
                      </div>

                      <div className="req-card-line">
                        <b>Destino:</b>{" "}
                        {req.destino}
                      </div>

                      <div className="req-card-bottom">

                        <span
                          className={classeStatus(
                            req.status
                          )}
                        >
                          {nomeStatus(
                            req.status
                          )}
                        </span>

                        <span className="req-skus">
                          {req.itens.length}{" "}
                          SKUs
                        </span>

                      </div>
                    </div>

                    <div className="req-card-indicators" onClick={(e) => e.stopPropagation()}>
  <div className="req-indicator-row">
    <span className={`req-stage-dot ${coresIndicadoresPedido(req.itens).R}`} title="Retorno">R</span>
    <span className={`req-stage-dot ${coresIndicadoresPedido(req.itens).S}`} title="Separação">S</span>
  </div>
  <div className="req-indicator-row">
    <span className={`req-stage-dot ${coresIndicadoresPedido(req.itens).F}`} title="Faturamento">F</span>
    <span className={`req-stage-dot ${coresIndicadoresPedido(req.itens).C}`} title="Conferência">C</span>
  </div>
  <div className="req-indicator-row">
    <span className="req-alert-dot" title="Pendência / alerta">!</span>
    <span className={`req-stage-dot ${coresIndicadoresPedido(req.itens).E}`} title="Embarque">E</span>
  </div>
  <div className="req-gear-wrap">
                        <button
                          type="button"
                          className="req-card-gear"
                          title="Ações da requisição"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const rect =
                              e.currentTarget.getBoundingClientRect();

                            if (menuCardId === req.id) {
                              setMenuCardId(null);
                              setMenuCardPos(null);
                              return;
                            }

                            const menuWidth = 245;
                            const menuHeight = 322;
                            const gap = 10;

                            const cabeNaDireita =
                              rect.right +
                                gap +
                                menuWidth <=
                              window.innerWidth -
                                12;

                            const left =
                              cabeNaDireita
                                ? rect.right + gap
                                : Math.max(
                                    12,
                                    rect.left -
                                      menuWidth -
                                      gap
                                  );

                            const top =
                              Math.max(
                                12,
                                Math.min(
                                  rect.top,
                                  window.innerHeight -
                                    menuHeight -
                                    12
                                )
                              );

                            setMenuCardId(req.id);
                            setMenuCardPos({
                              top,
                              left,
                            });
                          }}
                        >
                          ⚙
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              )
            )}

          </div>

        </section>

        {/* =================================================
            DETALHE
        ================================================= */}

        {selecionada && (
          <section className="req-detail">

            {/* =============================================
                HEADER DETALHE
            ============================================= */}

            <div className="req-detail-header">

              <div>

                <div className="req-detail-code">
                  {
                    selecionada.codigo
                  }
                </div>

                <div className="req-detail-description">
                  Requisição de{" "}
                  {selecionada.tipo.toLowerCase()}
                </div>

              </div>

              <div className="req-detail-status">

                <span
                  className={classeStatus(
                    selecionada.status
                  )}
                >
                  {nomeStatus(
                    selecionada.status
                  )}
                </span>

              </div>

            </div>

            {/* =============================================
                ORIGEM API
            ============================================= */}

            <div className="integration-strip">

              <div className="integration-icon">
                API
              </div>

              <div>

                <strong>
                  Pedido recebido via API
                </strong>

                <span>
                  Sistema externo → WMS
                  Expert
                </span>

              </div>

              <div className="integration-info">

                <small>
                  CÓDIGO EXTERNO
                </small>

                <strong>
                  {
                    selecionada.codigoExterno
                  }
                </strong>

              </div>

              <div className="integration-info">

                <small>
                  RECEBIDO EM
                </small>

                <strong>
                  {
                    selecionada.dataRecebimento
                  }
                </strong>

              </div>

            </div>

            {/* =============================================
                INFORMAÇÕES
            ============================================= */}

            <div className="req-info-grid">

              <div className="req-info">

                <small>
                  TÉCNICO
                </small>

                <strong>
                  {
                    selecionada.tecnico
                  }
                </strong>

                <span>
                  {
                    selecionada.codigoTecnico
                  }
                </span>

              </div>

              <div className="req-info">

                <small>
                  ORIGEM
                </small>

                <strong>
                  {
                    selecionada.origem
                  }
                </strong>

                <span>
                  Estoque expedidor
                </span>

              </div>

              <div className="req-info">

                <small>
                  DESTINO
                </small>

                <strong>
                  {
                    selecionada.destino
                  }
                </strong>

                <span>
                  Estoque móvel
                </span>

              </div>

              <div className="req-info">

                <small>
                  PRIORIDADE
                </small>

                <strong>
                  {
                    selecionada.prioridade
                  }
                </strong>

                <span>
                  {
                    selecionada.dataSolicitacao
                  }
                </span>

              </div>

            </div>

            {/* =============================================
                RESUMO
            ============================================= */}

            <div className="req-mini-summary">

              <div>

                <small>
                  SKUs
                </small>

                <strong>
                  {totalSKUs}
                </strong>

              </div>

              <div>

                <small>
                  QTD. SOLICITADA
                </small>

                <strong>
                  {
                    quantidadeSolicitada
                  }
                </strong>

              </div>

              <div>

                <small>
                  BASE
                </small>

                <strong>
                  {
                    selecionada.base
                  }
                </strong>

              </div>

              <div>

                <small>
                  TIPO
                </small>

                <strong>
                  {
                    selecionada.tipo
                  }
                </strong>

              </div>

            </div>

            {/* =============================================
                TABELA DE PRODUTOS
            ============================================= */}

            <div className="req-products">

              <div className="req-products-title">
                Itens do Pedido
              </div>

              <div className="req-products-scroll">

                <table>

                  <thead>

                    <tr>
                      <th>STATUS</th>
                      <th>CÓDIGO</th>
                      <th>PRODUTO</th>
                      <th>UND</th>
                      <th>SOLICITADO</th>
                      <th>ESTOQUE CD</th>
                      <th>SEPARADO</th>
                      <th>CONFERIDO</th>
                      <th>EMBARCADO</th>
                      <th>VOLUMES</th>
                      <th>SÉRIE</th>
                    </tr>

                  </thead>

                  <tbody>

                    {selecionada.itens.map(
                      (item) => (
                        <tr key={item.id}>

                          <td>
                            <span className="item-status-dot" />
                          </td>

                          <td>
                            <strong>
                              {
                                item.codigoProduto
                              }
                            </strong>
                          </td>

                          <td className="req-product-name">
                            {
                              item.produto
                            }
                          </td>

                          <td>
                            {
                              item.unidade
                            }
                          </td>

                          <td>
                            {formatarQuantidade(
                              item.solicitado,
                              item.unidade
                            )}
                          </td>

                          <td>
                            {formatarQuantidade(
                              item.estoqueCD,
                              item.unidade
                            )}
                          </td>

                          <td>
                            {formatarQuantidade(
                              item.separado ??
                                0,
                              item.unidade
                            )}
                          </td>

                          <td>
                            {formatarQuantidade(
                              item.conferido ??
                                0,
                              item.unidade
                            )}
                          </td>

                          <td>
                            {formatarQuantidade(
                              item.embarcado ??
                                0,
                              item.unidade
                            )}
                          </td>

                          <td>
                            {(() => {
                              const qtdVolumes =
                                volumesDoItem(
                                  item.id
                                ).length;

                              if (
                                qtdVolumes === 0
                              ) {
                                return (
                                  <span
                                    style={{
                                      color:
                                        "#9ca3af",
                                    }}
                                  >
                                    0
                                  </span>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirModalVolumes(
                                      item.id
                                    )
                                  }
                                  title="Visualizar volumes"
                                  style={{
                                    minWidth:
                                      44,
                                    height:
                                      24,
                                    border:
                                      "1px solid #168bb2",
                                    borderRadius:
                                      14,
                                    background:
                                      "#eaf7fb",
                                    color:
                                      "#087da7",
                                    fontSize:
                                      10,
                                    fontWeight:
                                      800,
                                    cursor:
                                      "pointer",
                                  }}
                                >
                                  {qtdVolumes}{" "}
                                  ◉
                                </button>
                              );
                            })()}
                          </td>

                          <td>
                            {item.controlaSerie
                              ? "SIM"
                              : "NÃO"}
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>

            {/* =============================================
                RODAPÉ / FLUXO
            ============================================= */}

            <div className="req-footer">

              <div className="req-flow">

                {/* API */}

                <div className="req-flow-step active">
                  <span>1</span>
                  API
                </div>

                <div className="req-flow-line" />

                {/* SEPARAÇÃO */}

                <div
                  className={`req-flow-step ${
                    etapaSeparacaoAtiva(
                      selecionada.status
                    )
                      ? "active"
                      : ""
                  }`}
                >
                  <span>2</span>
                  Separação
                </div>

                <div className="req-flow-line" />

                {/* CONFERÊNCIA */}

                <div
                  className={`req-flow-step ${
                    etapaConferenciaAtiva(
                      selecionada.status
                    )
                      ? "active"
                      : ""
                  }`}
                >
                  <span>3</span>
                  Conferência
                </div>

                <div className="req-flow-line" />

                {/* EMBARQUE */}

                <div
                  className={`req-flow-step ${
                    etapaEmbarqueAtiva(
                      selecionada.status
                    )
                      ? "active"
                      : ""
                  }`}
                >
                  <span>4</span>
                  Embarque
                </div>

                <div className="req-flow-line" />

                {/* TÉCNICO */}

                <div
                  className={`req-flow-step ${
                    etapaTecnicoAtiva(
                      selecionada.status
                    )
                      ? "active"
                      : ""
                  }`}
                >
                  <span>5</span>
                  Técnico
                </div>

              </div>

              {/* ===========================================
                  AÇÕES / MENSAGENS
              =========================================== */}

              {selecionada.status ===
                "PENDENTE" && (
                <button
                  className="generate-separation"
                  onClick={
                    gerarSeparacao
                  }
                >
                  GERAR SEPARAÇÃO
                </button>
              )}

              {selecionada.status ===
                "EM_SEPARACAO" && (
                <div className="separation-generated">
                  ✓ Separação gerada
                </div>
              )}

              {selecionada.status ===
                "SEPARADA" && (
                <div className="separation-generated">
                  ✓ Separação finalizada —
                  aguardando conferência
                </div>
              )}

              {selecionada.status ===
                "EM_CONFERENCIA" && (
                <div className="separation-generated">
                  ◷ Conferência em andamento
                </div>
              )}

              {selecionada.status ===
                "CONFERIDA" && (
                <div className="separation-generated">
                  ✓ Conferência finalizada —
                  aguardando embarque
                </div>
              )}

              {selecionada.status ===
                "EMBARCADA" && (
                <div className="separation-generated">
                  ✓ Embarque finalizado
                </div>
              )}

              {selecionada.status ===
                "EM_TRANSITO" && (
                <div className="separation-generated">
                  🚚 Em trânsito para{" "}
                  {
                    selecionada.codigoTecnico
                  }
                </div>
              )}

              {selecionada.status ===
                "ACEITE_PENDENTE" && (
                <div className="separation-generated">
                  ◷ Aguardando aceite do
                  técnico
                </div>
              )}

              {selecionada.status ===
                "RECEBIDA_TECNICO" && (
                <div className="separation-generated">
                  ✓ Material recebido pelo
                  técnico
                </div>
              )}

            </div>

          </section>
        )}

      </div>

      {menuCardId !== null &&
        menuCardPos &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="req-menu-backdrop"
              onClick={() => {
                setMenuCardId(null);
                setMenuCardPos(null);
              }}
            />

            <div
              className="req-card-menu req-card-menu-floating"
              style={{
                top: menuCardPos.top,
                left: menuCardPos.left,
              }}
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <button type="button">
                <span>Prioridades</span>
                <b>›</b>
              </button>

              <button type="button">
                <span>Limpar Conferência</span>
                <b className="menu-red">◆</b>
              </button>

              <button type="button">
                <span>Limpar Embarque</span>
                <b className="menu-red">◆</b>
              </button>

              <button type="button">
                <span>Devolver Requisição</span>
                <b className="menu-red">▣</b>
              </button>

              <button type="button">
                <span>Cancelar Requisição</span>
                <b className="menu-red">▣</b>
              </button>

              <button type="button">
                <span>Limpar Usuário</span>
                <b className="menu-blue">●</b>
              </button>

              <button type="button">
                <span>Alterar Usuário</span>
                <b className="menu-blue">●</b>
              </button>
            </div>
          </>,
          document.body
        )}

      <style>{`
        /* =====================================================
           REQUISIÇÕES TÉCNICAS — ESCALA VISUAL WMS EXPERT
           Ajuste apenas de tipografia, densidade e legibilidade.
        ====================================================== */

        .req-layout {
          font-size: 14px;
        }

        .req-sidebar-title {
          font-size: 15px !important;
          font-weight: 800 !important;
        }

        .req-card {
          padding: 15px 14px !important;
        }

        .req-card-top strong,
        .req-card-top > span:first-child {
          font-size: 15px !important;
          font-weight: 900 !important;
        }

        .req-card-tech {
          font-size: 14px !important;
          font-weight: 800 !important;
          margin-top: 8px !important;
        }

        .req-card-line {
          font-size: 12px !important;
          line-height: 1.55 !important;
        }

        .req-card-bottom,
        .req-skus {
          font-size: 11px !important;
        }

        .req-priority,
        .req-status {
          font-size: 10px !important;
          padding: 5px 9px !important;
          font-weight: 900 !important;
        }

        .req-detail-header {
          min-height: 78px !important;
          padding: 15px 20px !important;
        }

        .req-detail-code {
          font-size: 25px !important;
          line-height: 1.05 !important;
          font-weight: 900 !important;
        }

        .req-detail-description {
          margin-top: 5px !important;
          font-size: 12px !important;
        }

        .req-detail-status {
          font-size: 10px !important;
          padding: 6px 10px !important;
        }

        .api-banner {
          min-height: 72px !important;
          padding: 12px 16px !important;
        }

        .api-title {
          font-size: 13px !important;
          font-weight: 900 !important;
        }

        .api-subtitle {
          font-size: 11px !important;
          margin-top: 3px !important;
        }

        .api-meta-label {
          font-size: 9px !important;
        }

        .api-meta-value {
          font-size: 12px !important;
          font-weight: 900 !important;
        }

        .req-info {
          min-height: 70px !important;
          padding: 12px 14px !important;
        }

        .req-info-label {
          font-size: 10px !important;
          font-weight: 800 !important;
          letter-spacing: .2px !important;
        }

        .req-info-value {
          margin-top: 5px !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          line-height: 1.1 !important;
        }

        .req-info-sub {
          margin-top: 4px !important;
          font-size: 10px !important;
        }

        .req-mini-summary > div {
          min-height: 54px !important;
          padding: 10px 14px !important;
        }

        .req-mini-summary-label {
          font-size: 10px !important;
          font-weight: 800 !important;
        }

        .req-mini-summary-value {
          margin-top: 4px !important;
          font-size: 15px !important;
          font-weight: 900 !important;
        }

        .req-products-title {
          min-height: 44px !important;
          padding: 0 14px !important;
          font-size: 13px !important;
          font-weight: 900 !important;
        }

        .req-products table {
          font-size: 13px !important;
        }

        .req-products th {
          height: 42px !important;
          padding: 9px 8px !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          white-space: nowrap !important;
        }

        .req-products td {
          height: 50px !important;
          padding: 10px 8px !important;
          font-size: 13px !important;
          vertical-align: middle !important;
        }

        .req-product-name {
          font-size: 13px !important;
          font-weight: 700 !important;
          line-height: 1.25 !important;
        }

        .req-products td button {
          min-width: 52px !important;
          height: 30px !important;
          font-size: 11px !important;
        }

        .req-flow {
          min-height: 64px !important;
        }

        .req-flow-step {
          font-size: 11px !important;
          font-weight: 800 !important;
        }

        .req-flow-step span:first-child {
          width: 24px !important;
          height: 24px !important;
          min-width: 24px !important;
          font-size: 11px !important;
        }

        .req-footer {
          padding: 12px 16px !important;
        }

        .req-flow-message {
          font-size: 11px !important;
          font-weight: 800 !important;
        }

        @media (max-width: 1450px) {
          .req-products table {
            font-size: 12px !important;
          }

          .req-products th {
            font-size: 10px !important;
            padding-left: 6px !important;
            padding-right: 6px !important;
          }

          .req-products td,
          .req-product-name {
            font-size: 12px !important;
          }
        }
      `}</style>

      <style>{`
        /* =====================================================
           CABEÇALHO COMPACTO
           Mantém os dados, mas devolve protagonismo à tabela
           e à linha do tempo.
        ====================================================== */

        .req-detail-header {
          min-height: 58px !important;
          padding: 9px 18px !important;
        }

        .req-detail-code {
          font-size: 22px !important;
          line-height: 1 !important;
        }

        .req-detail-description {
          margin-top: 3px !important;
          font-size: 10px !important;
        }

        .req-detail-status {
          font-size: 9px !important;
          padding: 5px 9px !important;
        }

        .api-banner {
          min-height: 54px !important;
          padding: 8px 13px !important;
        }

        .api-banner > div:first-child {
          width: 38px !important;
          height: 38px !important;
          min-width: 38px !important;
        }

        .api-title {
          font-size: 11px !important;
        }

        .api-subtitle {
          font-size: 9px !important;
          margin-top: 1px !important;
        }

        .api-meta-label {
          font-size: 8px !important;
        }

        .api-meta-value {
          font-size: 10px !important;
        }

        .req-info {
          min-height: 54px !important;
          padding: 8px 11px !important;
        }

        .req-info-label {
          font-size: 8px !important;
        }

        .req-info-value {
          margin-top: 3px !important;
          font-size: 12px !important;
          line-height: 1 !important;
        }

        .req-info-sub {
          margin-top: 2px !important;
          font-size: 8px !important;
        }

        .req-mini-summary > div {
          min-height: 42px !important;
          padding: 6px 11px !important;
        }

        .req-mini-summary-label {
          font-size: 8px !important;
        }

        .req-mini-summary-value {
          margin-top: 2px !important;
          font-size: 12px !important;
        }

        /* O contexto acima fica compacto.
           A operação abaixo continua grande e legível. */

        .req-products-title {
          min-height: 42px !important;
          font-size: 13px !important;
        }

        .req-products table {
          font-size: 13px !important;
        }

        .req-products th {
          height: 42px !important;
          font-size: 11px !important;
        }

        .req-products td {
          height: 50px !important;
          font-size: 13px !important;
        }

        .req-product-name {
          font-size: 13px !important;
          font-weight: 700 !important;
        }

        .req-flow {
          min-height: 66px !important;
        }

        .req-flow-step {
          font-size: 11px !important;
        }

        .req-flow-step span:first-child {
          width: 25px !important;
          height: 25px !important;
          min-width: 25px !important;
        }
      `}</style>

      <style>{`
        /* =====================================================
           MODO OPERACIONAL — PADRÃO PRÓXIMO AO WMS ORIGINAL

           O card lateral passa a ser o resumo da requisição.
           O painel direito fica focado em:
           1. produtos
           2. volumes
           3. andamento/timeline
        ====================================================== */

        .req-detail-header,
        .api-banner,
        .req-info-grid,
        .req-mini-summary {
          display: none !important;
        }

        .req-detail {
          min-height: 0 !important;
        }

        .req-detail-body {
          padding-top: 0 !important;
        }

        .req-products {
          margin-top: 0 !important;
          border-top-left-radius: 14px !important;
          border-top-right-radius: 14px !important;
        }

        .req-products-title {
          min-height: 48px !important;
          padding: 0 16px !important;
          font-size: 14px !important;
          letter-spacing: .1px !important;
        }

        .req-products table {
          font-size: 14px !important;
        }

        .req-products th {
          height: 46px !important;
          padding: 10px 8px !important;
          font-size: 11px !important;
          font-weight: 900 !important;
        }

        .req-products td {
          height: 54px !important;
          padding: 11px 8px !important;
          font-size: 14px !important;
        }

        .req-product-name {
          font-size: 14px !important;
          font-weight: 700 !important;
        }

        .req-products td button {
          min-width: 54px !important;
          height: 31px !important;
          font-size: 11px !important;
        }

        .req-flow {
          min-height: 72px !important;
          margin-top: auto !important;
        }

        .req-flow-step {
          font-size: 11px !important;
          font-weight: 800 !important;
        }

        .req-flow-step span:first-child {
          width: 25px !important;
          height: 25px !important;
          min-width: 25px !important;
        }

        /* Card lateral ganha um pouco mais de presença,
           já que agora ele é o cabeçalho/contexto da operação. */
        .req-card {
          padding: 15px 14px !important;
        }

        .req-card-top strong,
        .req-card-top > span:first-child {
          font-size: 15px !important;
        }

        .req-card-tech {
          font-size: 14px !important;
        }

        .req-card-line {
          font-size: 12px !important;
          line-height: 1.55 !important;
        }

        .req-card-bottom,
        .req-skus {
          font-size: 11px !important;
        }
      `}</style>

      <style>{`
        /* =====================================================
           STATUS OPERACIONAL NO CARD LATERAL
           O card da esquerda é o resumo principal, como no WMS.
        ====================================================== */

        .req-status {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          min-height: 25px !important;
          padding: 5px 10px !important;
          border-radius: 14px !important;
          font-size: 10px !important;
          line-height: 1 !important;
          font-weight: 900 !important;
          white-space: nowrap !important;
        }

        .req-card-bottom {
          margin-top: 11px !important;
          min-height: 28px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
        }

        .req-skus {
          font-size: 11px !important;
          font-weight: 800 !important;
          white-space: nowrap !important;
        }
      `}</style>

      <style>{`
        /* =====================================================
           CARD LATERAL — INDICADORES NO PADRÃO WMS ORIGINAL
        ====================================================== */

        .req-card {
          overflow: visible !important;
          position: relative !important;
        }

        .req-card-main {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 52px !important;
          gap: 8px !important;
          align-items: stretch !important;
        }

        .req-card-content {
          min-width: 0 !important;
        }

        .req-card-indicators {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          border-left: 1px solid #d8e3ea !important;
          padding-left: 7px !important;
          position: relative !important;
          z-index: 20 !important;
        }

        .req-indicator-row {
          width: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 5px !important;
        }

        .req-stage-dot {
          width: 21px !important;
          height: 21px !important;
          border-radius: 50% !important;
          display: inline-grid !important;
          place-items: center !important;
          color: #fff !important;
          font-size: 10px !important;
          line-height: 1 !important;
          font-weight: 900 !important;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,.08) !important;
        }

        .stage-blue {
          background: #1389b4 !important;
        }

        .stage-green {
          background: #0c9f1a !important;
        }

        .stage-orange { background: #e58a00 !important; }
        .stage-gray {
          background: #8d8d8d !important;
        }

        .req-alert-dot {
          width: 21px !important;
          height: 21px !important;
          border: 1.5px solid #f0a000 !important;
          border-radius: 50% !important;
          display: inline-grid !important;
          place-items: center !important;
          color: #e28e00 !important;
          background: #fff !important;
          font-size: 12px !important;
          font-weight: 900 !important;
        }

        .req-gear-wrap {
          position: relative !important;
          display: flex !important;
          justify-content: center !important;
          width: 100% !important;
        }

        .req-card-gear {
          width: 27px !important;
          height: 27px !important;
          min-width: 27px !important;
          border: 0 !important;
          background: transparent !important;
          color: #1d2935 !important;
          display: grid !important;
          place-items: center !important;
          padding: 0 !important;
          font-size: 20px !important;
          line-height: 1 !important;
          cursor: pointer !important;
        }

        .req-card-menu {
          position: absolute !important;
          width: 225px !important;
          padding: 7px 0 !important;
          background: #fff !important;
          border: 1px solid #d9e0e5 !important;
          border-radius: 7px !important;
          box-shadow: 0 5px 15px rgba(0,0,0,.18) !important;
          z-index: 99999 !important;
        }

        .req-card-menu button {
          width: 100% !important;
          min-height: 42px !important;
          border: 0 !important;
          background: #fff !important;
          padding: 0 12px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px !important;
          color: #17212b !important;
          font-size: 14px !important;
          text-align: left !important;
          cursor: pointer !important;
        }

        .req-card-menu button:hover {
          background: #f4f7f9 !important;
        }

        .req-card-menu b {
          font-size: 20px !important;
          line-height: 1 !important;
        }

        .menu-red {
          color: #ff1f2d !important;
        }

        .menu-blue {
          color: #2676b8 !important;
        }

        .req-card-top {
          padding-right: 0 !important;
        }

        .req-priority {
          transform: scale(.92) !important;
          transform-origin: right center !important;
        }

        /* O menu deve sair visualmente do card, como no WMS. */
        .req-list {
          overflow-x: visible !important;
        }

        .req-list-panel {
          overflow: visible !important;
        }
      `}</style>

      <style>{`
        /* =====================================================
           CORREÇÃO FINAL DOS CARDS — MAIS LEGÍVEL + MENU LIVRE
        ====================================================== */

        .req-layout {
          grid-template-columns: 385px minmax(0, 1fr) !important;
        }

        .req-sidebar-panel {
          overflow: hidden !important;
        }

        .req-list {
          overflow-y: auto !important;
          overflow-x: hidden !important;
          padding: 9px !important;
        }

        .req-card {
          padding: 14px 12px 13px 14px !important;
          cursor: pointer !important;
          overflow: visible !important;
        }

        .req-card-main {
          grid-template-columns: minmax(0, 1fr) 64px !important;
          gap: 10px !important;
        }

        .req-card-top strong {
          font-size: 16px !important;
          line-height: 1.2 !important;
        }

        .req-card-tech {
          font-size: 15px !important;
          line-height: 1.25 !important;
          margin: 9px 0 6px !important;
        }

        .req-card-line {
          font-size: 13px !important;
          line-height: 20px !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .req-card-bottom {
          margin-top: 10px !important;
        }

        .req-status {
          min-height: 25px !important;
          padding: 5px 10px !important;
          font-size: 10px !important;
        }

        .req-skus {
          font-size: 11px !important;
        }

        .req-priority {
          font-size: 9px !important;
          padding: 5px 9px !important;
        }

        .req-card-indicators {
          border-left: 1px solid #d6e0e6 !important;
          padding-left: 10px !important;
          gap: 7px !important;
        }

        .req-indicator-row {
          gap: 7px !important;
        }

        .req-stage-dot,
        .req-alert-dot {
          width: 24px !important;
          height: 24px !important;
          min-width: 24px !important;
          font-size: 11px !important;
        }

        .req-card-gear {
          width: 30px !important;
          height: 30px !important;
          min-width: 30px !important;
          font-size: 21px !important;
        }

        .req-menu-backdrop {
          position: fixed !important;
          inset: 0 !important;
          z-index: 99990 !important;
          background: transparent !important;
        }

        .req-card-menu-floating {
          position: fixed !important;
          width: 245px !important;
          z-index: 99999 !important;
          padding: 7px 0 !important;
          background: #fff !important;
          border: 1px solid #d6dde3 !important;
          border-radius: 8px !important;
          box-shadow: 0 8px 26px rgba(0,0,0,.22) !important;
        }

        .req-card-menu-floating button {
          min-height: 44px !important;
          padding: 0 13px !important;
          font-size: 14px !important;
        }

        @media (max-width: 1400px) {
          .req-layout {
            grid-template-columns: 355px minmax(0, 1fr) !important;
          }

          .req-card-main {
            grid-template-columns: minmax(0, 1fr) 60px !important;
          }

          .req-card-line {
            font-size: 12px !important;
          }
        }
      `}</style>

      <style>{`
        /* =====================================================
           AJUSTE FIEL AO CARD ORIGINAL
           R S
           F C
           ! E
           ⚙
        ====================================================== */

        .req-card-main {
          grid-template-columns: minmax(0, 1fr) 58px !important;
        }

        .req-card-indicators {
          padding-left: 8px !important;
          gap: 5px !important;
        }

        .req-indicator-row {
          gap: 6px !important;
        }

        .req-stage-dot,
        .req-alert-dot {
          width: 21px !important;
          height: 21px !important;
          min-width: 21px !important;
          font-size: 10px !important;
          font-weight: 900 !important;
        }

        .req-card-gear {
          width: 28px !important;
          height: 28px !important;
          min-width: 28px !important;
          font-size: 19px !important;
        }

        .req-menu-backdrop {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483600 !important;
          background: transparent !important;
        }

        .req-card-menu-floating {
          position: fixed !important;
          width: 245px !important;
          z-index: 2147483640 !important;
          margin: 0 !important;
          transform: none !important;
        }
      `}</style>

      <style>{`
        /* =====================================================
           CORREÇÃO DEFINITIVA — INDICADORES + MENU DA ENGRENAGEM
        ====================================================== */

        .req-card-main {
          grid-template-columns: minmax(0, 1fr) 72px !important;
          gap: 10px !important;
        }

        .req-card-indicators {
          width: 72px !important;
          padding-left: 10px !important;
          gap: 7px !important;
        }

        .req-indicator-row {
          gap: 8px !important;
        }

        .req-stage-dot,
        .req-alert-dot {
          width: 27px !important;
          height: 27px !important;
          min-width: 27px !important;
          border-radius: 50% !important;
          font-size: 13px !important;
          line-height: 27px !important;
          font-weight: 900 !important;
          text-align: center !important;
        }

        .req-alert-dot {
          line-height: 24px !important;
          border-width: 2px !important;
        }

        .req-card-gear {
          width: 34px !important;
          height: 34px !important;
          min-width: 34px !important;
          font-size: 23px !important;
          margin-top: 2px !important;
        }

        /* O menu é um Portal no body.
           Nenhum top/left antigo pode interferir. */
        .req-card-menu.req-card-menu-floating {
          position: fixed !important;
          width: 245px !important;
          z-index: 2147483640 !important;
          margin: 0 !important;
          transform: none !important;
        }

        .req-card-menu.req-card-menu-floating button {
          min-height: 44px !important;
          font-size: 14px !important;
        }

        @media (max-width: 1400px) {
          .req-card-main {
            grid-template-columns: minmax(0, 1fr) 68px !important;
          }

          .req-card-indicators {
            width: 68px !important;
          }

          .req-stage-dot,
          .req-alert-dot {
            width: 25px !important;
            height: 25px !important;
            min-width: 25px !important;
            font-size: 12px !important;
            line-height: 25px !important;
          }
        }
      `}</style>

      <style>{`
        /* =====================================================
           ESCALA HARMÔNICA — PAINEL DIREITO + KPIs
           Alinha a tipografia ao tamanho já usado nos cards.
        ====================================================== */

        /* KPIs superiores */
        .req-kpis {
          gap: 12px !important;
        }

        .req-kpi {
          min-height: 102px !important;
        }

        .req-kpi-title {
          min-height: 31px !important;
          padding: 7px 12px !important;
          font-size: 13px !important;
          font-weight: 800 !important;
        }

        .req-kpi-value {
          font-size: 25px !important;
          line-height: 1 !important;
        }

        .req-kpi-subtitle {
          font-size: 11px !important;
          line-height: 1.25 !important;
        }

        /* Barra Gestão de Pedidos */
        .req-toolbar-title {
          font-size: 21px !important;
          font-weight: 800 !important;
        }

        .req-search {
          font-size: 14px !important;
        }

        /* Faixa da integração/API */
        .api-banner {
          min-height: 68px !important;
          padding: 10px 14px !important;
        }

        .api-banner > div:first-child {
          width: 44px !important;
          height: 44px !important;
          min-width: 44px !important;
        }

        .api-title {
          font-size: 13px !important;
          font-weight: 900 !important;
        }

        .api-subtitle {
          margin-top: 3px !important;
          font-size: 10px !important;
        }

        .api-meta-label {
          font-size: 9px !important;
          font-weight: 800 !important;
        }

        .api-meta-value {
          font-size: 11px !important;
          font-weight: 900 !important;
        }

        /* Título da área operacional */
        .req-products-title {
          min-height: 48px !important;
          padding: 0 16px !important;
          font-size: 15px !important;
          font-weight: 900 !important;
        }

        /* Tabela */
        .req-products table {
          font-size: 14px !important;
        }

        .req-products th {
          height: 48px !important;
          padding: 10px 9px !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          letter-spacing: .15px !important;
        }

        .req-products td {
          height: 56px !important;
          padding: 11px 9px !important;
          font-size: 14px !important;
          line-height: 1.2 !important;
        }

        .req-product-name {
          font-size: 14px !important;
          font-weight: 800 !important;
          line-height: 1.25 !important;
        }

        .req-products td button {
          min-width: 56px !important;
          height: 32px !important;
          font-size: 12px !important;
          font-weight: 900 !important;
        }

        /* Timeline */
        .req-flow {
          min-height: 82px !important;
          padding: 0 14px !important;
        }

        .req-flow-step {
          font-size: 12px !important;
          font-weight: 900 !important;
        }

        .req-flow-step span:first-child {
          width: 27px !important;
          height: 27px !important;
          min-width: 27px !important;
          font-size: 12px !important;
        }

        .req-flow-message {
          min-height: 34px !important;
          padding: 7px 12px !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          white-space: nowrap !important;
        }

        /* Mantém o painel com boa densidade em telas menores */
        @media (max-width: 1450px) {
          .req-products th {
            font-size: 11px !important;
            padding-left: 6px !important;
            padding-right: 6px !important;
          }

          .req-products td,
          .req-product-name {
            font-size: 13px !important;
          }

          .req-flow-step {
            font-size: 11px !important;
          }
        }
      `}</style>

      <style>{`
        /* =====================================================
           FAIXA "DEMANDA RECEBIDA VIA API"
           O JSX real usa integration-strip / integration-info.
        ====================================================== */

        .integration-strip {
          min-height: 78px !important;
          padding: 12px 16px !important;
          gap: 14px !important;
        }

        .integration-icon {
          width: 48px !important;
          height: 48px !important;
          min-width: 48px !important;
          border-radius: 10px !important;
          font-size: 13px !important;
          font-weight: 900 !important;
        }

        .integration-strip > div:nth-child(2) {
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
        }

        .integration-strip > div:nth-child(2) > strong {
          font-size: 14px !important;
          line-height: 1.2 !important;
          font-weight: 900 !important;
        }

        .integration-strip > div:nth-child(2) > span {
          margin-top: 4px !important;
          font-size: 11px !important;
          line-height: 1.2 !important;
        }

        .integration-info {
          min-width: 135px !important;
          padding-left: 16px !important;
        }

        .integration-info small {
          font-size: 9px !important;
          line-height: 1.15 !important;
          font-weight: 800 !important;
        }

        .integration-info strong {
          margin-top: 4px !important;
          font-size: 12px !important;
          line-height: 1.15 !important;
          font-weight: 900 !important;
        }

        @media (max-width: 1450px) {
          .integration-strip > div:nth-child(2) > strong {
            font-size: 13px !important;
          }

          .integration-strip > div:nth-child(2) > span {
            font-size: 10px !important;
          }

          .integration-info strong {
            font-size: 11px !important;
          }
        }
      `}</style>

      {modalVolumesAberto &&
        selecionada && (
          <div
            onClick={() =>
              setModalVolumesAberto(
                false
              )
            }
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background:
                "rgba(0, 0, 0, 0.55)",
              display: "grid",
              placeItems: "center",
              padding: 18,
            }}
          >
            <div
              onClick={(e) =>
                e.stopPropagation()
              }
              style={{
                width:
                  "min(1120px, 96vw)",
                maxHeight:
                  "88vh",
                background: "#fff",
                border:
                  "2px solid #168bb2",
                borderRadius: 14,
                overflow: "hidden",
                boxShadow:
                  "0 20px 60px rgba(0,0,0,.28)",
                display: "flex",
                flexDirection:
                  "column",
              }}
            >
              <div
                style={{
                  minHeight: 66,
                  padding:
                    "0 18px",
                  background:
                    "#0e607a",
                  color: "#fff",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      border:
                        "2px solid #fff",
                      borderRadius: 8,
                      display: "grid",
                      placeItems:
                        "center",
                      fontWeight:
                        900,
                    }}
                  >
                    W
                  </div>

                  <strong
                    style={{
                      fontSize: 22,
                    }}
                  >
                    RELATÓRIO DE VOLUMES
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setModalVolumesAberto(
                      false
                    )
                  }
                  style={{
                    width: 36,
                    height: 36,
                    border:
                      "2px solid #fff",
                    borderRadius:
                      "50%",
                    background:
                      "transparent",
                    color: "#fff",
                    fontSize: 21,
                    cursor:
                      "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  padding:
                    "14px 18px",
                  overflowY:
                    "auto",
                }}
              >
                <div
                  style={{
                    border:
                      "1.5px solid #168bb2",
                    borderRadius: 7,
                    padding:
                      "12px 14px",
                    display: "grid",
                    gridTemplateColumns:
                      "1.2fr 1fr",
                    gap: 18,
                  }}
                >
                  <div
                    style={{
                      lineHeight: 1.55,
                    }}
                  >
                    <div>
                      <strong>
                        Requisição:
                      </strong>{" "}
                      {
                        selecionada.codigo
                      }
                    </div>

                    <div>
                      <strong>
                        Técnico:
                      </strong>{" "}
                      {
                        selecionada.tecnico
                      }
                    </div>

                    <div>
                      <strong>
                        Destino:
                      </strong>{" "}
                      {
                        selecionada.codigoTecnico
                      }{" "}
                      •{" "}
                      {
                        selecionada.base
                      }
                    </div>
                  </div>

                  <div
                    style={{
                      lineHeight: 1.55,
                    }}
                  >
                    <div>
                      <strong>
                        Tipo:
                      </strong>{" "}
                      {
                        selecionada.tipo
                      }
                    </div>

                    <div>
                      <strong>
                        Origem:
                      </strong>{" "}
                      {
                        selecionada.origem
                      }
                    </div>

                    <div>
                      <strong>
                        Total de volumes:
                      </strong>{" "}
                      {
                        volumesSelecionada.length
                      }
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    border:
                      "1px solid #d5dee5",
                    borderRadius: 7,
                    overflow:
                      "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "44px 1.5fr 1fr .7fr .8fr 1.2fr",
                      gap: 0,
                      padding:
                        "11px 12px",
                      background:
                        "#54a5c4",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight:
                        900,
                    }}
                  >
                    <span />
                    <span>
                      VOLUME
                    </span>
                    <span>
                      STATUS
                    </span>
                    <span>
                      SKUs
                    </span>
                    <span>
                      QTD.
                    </span>
                    <span>
                      DATA GERAÇÃO
                    </span>
                  </div>

                  {volumesSelecionada.map(
                    (volume) => {
                      const qtd =
                        Object.values(
                          volume.itens ??
                            {}
                        ).reduce(
                          (
                            total,
                            item
                          ) =>
                            total +
                            (item.quantidade ??
                              0),
                          0
                        );

                      const selecionado =
                        volumeSelecionado?.id ===
                        volume.id;

                      return (
                        <button
                          key={
                            volume.id
                          }
                          type="button"
                          onClick={() =>
                            setVolumeSelecionadoId(
                              volume.id
                            )
                          }
                          style={{
                            width:
                              "100%",
                            display:
                              "grid",
                            gridTemplateColumns:
                              "44px 1.5fr 1fr .7fr .8fr 1.2fr",
                            alignItems:
                              "center",
                            padding:
                              "11px 12px",
                            border: 0,
                            borderTop:
                              "1px solid #e4e9ed",
                            background:
                              selecionado
                                ? "#e8f6fb"
                                : "#fff",
                            textAlign:
                              "left",
                            cursor:
                              "pointer",
                            fontSize:
                              11,
                            color:
                              "#234",
                          }}
                        >
                          <span>
                            <span
                              style={{
                                width:
                                  16,
                                height:
                                  16,
                                border:
                                  "1px solid #168bb2",
                                borderRadius:
                                  "50%",
                                display:
                                  "grid",
                                placeItems:
                                  "center",
                                color:
                                  "#168bb2",
                                fontSize:
                                  10,
                              }}
                            >
                              {selecionado
                                ? "●"
                                : ""}
                            </span>
                          </span>

                          <strong>
                            {
                              volume.codigo
                            }
                          </strong>

                          <span>
                            {
                              volume.status
                            }
                          </span>

                          <span>
                            {
                              Object.keys(
                                volume.itens ??
                                  {}
                              ).length
                            }
                          </span>

                          <span>
                            {qtd}
                          </span>

                          <span>
                            {formatarDataVolume(
                              volume.criadoEm
                            )}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                {volumeSelecionado && (
                  <div
                    style={{
                      marginTop: 14,
                      border:
                        "1.5px solid #168bb2",
                      borderRadius: 7,
                      overflow:
                        "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding:
                          "10px 12px",
                        background:
                          "#0e607a",
                        color: "#fff",
                        fontSize:
                          12,
                        fontWeight:
                          900,
                      }}
                    >
                      Conteúdo —{" "}
                      {
                        volumeSelecionado.codigo
                      }
                    </div>

                    <table
                      style={{
                        width:
                          "100%",
                        borderCollapse:
                          "collapse",
                        fontSize:
                          11,
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background:
                              "#eef3f6",
                          }}
                        >
                          <th
                            style={{
                              padding:
                                9,
                              textAlign:
                                "left",
                            }}
                          >
                            CÓDIGO
                          </th>
                          <th
                            style={{
                              padding:
                                9,
                              textAlign:
                                "left",
                            }}
                          >
                            PRODUTO
                          </th>
                          <th
                            style={{
                              padding:
                                9,
                              textAlign:
                                "center",
                            }}
                          >
                            UND
                          </th>
                          <th
                            style={{
                              padding:
                                9,
                              textAlign:
                                "right",
                            }}
                          >
                            QTD.
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {Object.values(
                          volumeSelecionado.itens ??
                            {}
                        ).map(
                          (
                            itemVolume: any
                          ) => {
                            const produto =
                              selecionada.itens.find(
                                (
                                  item
                                ) =>
                                  item.id ===
                                  itemVolume.itemId
                              );

                            return (
                              <tr
                                key={
                                  itemVolume.itemId
                                }
                                style={{
                                  borderTop:
                                    "1px solid #e5e7eb",
                                }}
                              >
                                <td
                                  style={{
                                    padding:
                                      9,
                                  }}
                                >
                                  <strong>
                                    {produto?.codigoProduto ??
                                      itemVolume.itemId}
                                  </strong>
                                </td>

                                <td
                                  style={{
                                    padding:
                                      9,
                                  }}
                                >
                                  {produto?.produto ??
                                    "-"}
                                </td>

                                <td
                                  style={{
                                    padding:
                                      9,
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  {produto?.unidade ??
                                    "-"}
                                </td>

                                <td
                                  style={{
                                    padding:
                                      9,
                                    textAlign:
                                      "right",
                                    fontWeight:
                                      800,
                                  }}
                                >
                                  {
                                    itemVolume.quantidade
                                  }
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div
                style={{
                  flex:
                    "0 0 auto",
                  padding:
                    "12px 18px",
                  borderTop:
                    "1px solid #d5dee5",
                  display: "flex",
                  justifyContent:
                    "center",
                  gap: 12,
                  background:
                    "#f7f9fa",
                }}
              >
                <button
                  type="button"
                  disabled={
                    !volumeSelecionado
                  }
                  onClick={() =>
                    imprimirVolume(
                      volumeSelecionado
                    )
                  }
                  style={{
                    minWidth: 270,
                    minHeight: 44,
                    border: 0,
                    borderRadius: 6,
                    background:
                      volumeSelecionado
                        ? "#168bb2"
                        : "#b9dce8",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight:
                      900,
                    cursor:
                      volumeSelecionado
                        ? "pointer"
                        : "default",
                  }}
                >
                  🖨 REIMPRIMIR VOLUME SELECIONADO
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
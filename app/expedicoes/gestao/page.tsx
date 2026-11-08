"use client";

import {carregarPedidosV36,pedidoParaCardV36} from "@/lib/atelPedidosReaisV36";
import { pedidosComProgressoV364 } from "@/lib/atelGestaoProgressoV364";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./gestao.module.css";

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
  const [requisicoesMock, setRequisicoes] =
    useState<RequisicaoTecnica[]>(
      requisicoesTecnicasMock
    );

  const [pedidosReais,setPedidosReais]=useState<RequisicaoTecnica[]>([]);
  useEffect(()=>{let ativo=true;async function atualizar(){try{const pedidos=await carregarPedidosV36();const cards=pedidos.map(pedidoParaCardV36);const {sincronizarPedidosPedV366}=await import("@/lib/atelSyncPedV366");await sincronizarPedidosPedV366(pedidos,cards);if(ativo)setPedidosReais(pedidosComProgressoV364(cards));}catch(e){console.error("ATEL V36 pedidos reais:",e)}}void atualizar();const intervalo=setInterval(()=>void atualizar(),30000);return()=>{ativo=false;clearInterval(intervalo)}},[]);
  useEffect(() => {
    const atualizar = () => setPedidosReais((anteriores) => pedidosComProgressoV364(anteriores));
    const parar = ouvirAlteracoes(atualizar);
    const aoFocar = () => atualizar();
    window.addEventListener("focus", aoFocar);
    return () => { parar(); window.removeEventListener("focus", aoFocar); };
  }, []);
  const requisicoes=[...requisicoesMock,...pedidosReais];

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

    if(selecionada.origemIntegracao==="SUPABASE_V36"){alert("Pedido real aguardando integração da execução da separação. Não é permitido usar o store mockado.");return;}
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
    <main className={styles.root}>
      <header className={styles.heading}>
        <div>
          <div className={styles.eyebrow}>EXPEDIÇÕES / GESTÃO DE PEDIDOS</div>
          <h1>Gestão de Pedidos</h1>
          <p>Acompanhamento da separação, conferência, embarque e aceite técnico.</p>
        </div>
        <span className={styles.readonly}>Operação de homologação</span>
      </header>
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

      <div className="wms-page-header">
        <div className="wms-page-title">
          <strong>Acompanhamento de Pedidos</strong>
          <small>{requisicoesFiltradas.length} de {requisicoes.length} pedidos</small>
        </div>
        <div className="wms-header-actions">
          <div className="wms-search">
            <input aria-label="Pesquisar pedidos" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar pedido, técnico ou base..." />
          </div>
          <button type="button" className="wms-icon-button" title="Limpar pesquisa" onClick={() => setBusca("")}>Limpar</button>
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

              <div className="req-header-main">

                <div className="req-header-identity">
                  <div className="req-detail-code">
                    {selecionada.codigo}
                  </div>

                  <div className="req-detail-description">
                  Requisição de{" "}
                  {selecionada.tipo.toLowerCase()}
                  </div>
                </div>

                <div className="req-header-received">
                  <small>RECEBIDO EM</small>
                  <strong>{selecionada.dataRecebimento}</strong>
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

              {/* O status da requisicao ja aparece no cabecalho.
                  Mantemos somente a acao de gerar separacao quando pendente. */}

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
    </main>
  );
}

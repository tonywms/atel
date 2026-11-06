"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { requisicoesTecnicasMock } from "@/lib/requisicoesTecnicas";

import {
  adicionarItemAoVolume,
  criarVolume,
  fecharVolume,
  finalizarConferencia,
  iniciarConferencia,
  listarVolumes,
  obterEstado,
  registrarConferenciaItem,
  VolumeRequisicao,
} from "@/lib/requisicoesStore";

export default function ConferenciaDetalhePage() {
  const params = useParams();
  const router = useRouter();

  const idParam = params.id;

  const id = Number(
    Array.isArray(idParam)
      ? idParam[0]
      : idParam
  );

  const requisicao = useMemo(
    () =>
      requisicoesTecnicasMock.find(
        (req) => req.id === id
      ),
    [id]
  );

  /* =======================================================
     ESTADOS DA CONFERÊNCIA
  ======================================================= */

  const [itemAtual, setItemAtual] = useState(0);

  const [produtoLido, setProdutoLido] = useState("");

  const [produtoConfirmado, setProdutoConfirmado] =
    useState(false);

  const [quantidades, setQuantidades] =
    useState<Record<number, number>>({});

  const [quantidadesSeparadas, setQuantidadesSeparadas] =
    useState<Record<number, number>>({});

  const [seriais, setSeriais] =
    useState<Record<number, string[]>>({});

  const [seriaisSeparados, setSeriaisSeparados] =
    useState<Record<number, string[]>>({});

  const [serialDigitado, setSerialDigitado] =
    useState("");

  const [mensagem, setMensagem] = useState("");

  const [finalizando, setFinalizando] =
    useState(false);

  /* =======================================================
     ESTADOS DE VOLUME
  ======================================================= */

  const [modoVolume, setModoVolume] =
    useState(false);

  const [volumes, setVolumes] =
    useState<VolumeRequisicao[]>([]);

  const [volumeAtualId, setVolumeAtualId] =
    useState<number | null>(null);

  /* =======================================================
     CARREGAR CONFERÊNCIA
  ======================================================= */

  useEffect(() => {
    if (!requisicao) return;

    try {
      const estado =
        iniciarConferencia(requisicao);

      const qtdConferida: Record<number, number> = {};
      const qtdSeparada: Record<number, number> = {};

      const serialConferido: Record<number, string[]> = {};
      const serialSeparado: Record<number, string[]> = {};

      requisicao.itens.forEach((item) => {
        qtdSeparada[item.id] =
          estado.itens[item.id]?.quantidadeSeparada ?? 0;

        serialSeparado[item.id] =
          estado.itens[item.id]?.seriais ?? [];

        qtdConferida[item.id] =
          estado.conferencia[item.id]?.quantidadeConferida ?? 0;

        serialConferido[item.id] =
          estado.conferencia[item.id]?.seriais ?? [];
      });

      setQuantidadesSeparadas(qtdSeparada);

      setSeriaisSeparados(serialSeparado);

      setQuantidades(qtdConferida);

      setSeriais(serialConferido);

      setVolumes(estado.volumes ?? []);

      /*
       * Se já existe volume aberto,
       * recupera automaticamente.
       */
      const aberto =
        estado.volumes?.find(
          (volume) => volume.status === "ABERTO"
        );

      if (aberto) {
        setVolumeAtualId(aberto.id);
      }

      /*
       * Volta para o primeiro produto
       * ainda não conferido.
       */
      const primeiroPendente =
        requisicao.itens.findIndex((item) => {
          const separado =
            qtdSeparada[item.id] ?? 0;

          const conferido =
            qtdConferida[item.id] ?? 0;

          return conferido < separado;
        });

      /*
       * Se tudo já foi conferido,
       * entra na etapa de volumes.
       */
      if (primeiroPendente === -1) {
        setModoVolume(true);
      } else {
        setItemAtual(primeiroPendente);
      }
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a conferência."
      );
    }
  }, [requisicao]);

  /* =======================================================
     REQUISIÇÃO NÃO ENCONTRADA
  ======================================================= */

  if (!requisicao) {
    return (
      <div className="collector-screen">
        <div className="collector-phone collector-not-found">
          Requisição não encontrada.
        </div>
      </div>
    );
  }

  const requisicaoSeguro = requisicao;

  const item = requisicaoSeguro.itens[itemAtual];

  const separado =
    quantidadesSeparadas[item.id] ?? 0;

  const conferido =
    quantidades[item.id] ?? 0;

  const falta =
    Math.max(
      separado - conferido,
      0
    );

  /* =======================================================
     HELPERS
  ======================================================= */

  function atualizarVolumes() {
    setVolumes(
      listarVolumes(requisicaoSeguro)
    );
  }

  function quantidadeVolumada(itemId: number) {
    return volumes.reduce(
      (total, volume) =>
        total +
        (volume.itens[itemId]?.quantidade ?? 0),
      0
    );
  }

  function saldoParaVolume(itemId: number) {
    const qtdConferida =
      quantidades[itemId] ?? 0;

    const volumada =
      quantidadeVolumada(itemId);

    return Math.max(
      qtdConferida - volumada,
      0
    );
  }

  const todosConferidos =
    requisicaoSeguro.itens.every(
      (produto) =>
        (quantidades[produto.id] ?? 0) >=
        (quantidadesSeparadas[produto.id] ?? 0)
    );

  const todosVolumados =
    requisicaoSeguro.itens.every(
      (produto) =>
        saldoParaVolume(produto.id) === 0
    );

  const volumesFechados =
    volumes.length > 0 &&
    volumes.every(
      (volume) =>
        volume.status !== "ABERTO"
    );

  const volumeAtual =
    volumeAtualId !== null
      ? volumes.find(
          (volume) =>
            volume.id === volumeAtualId
        )
      : undefined;

  /* =======================================================
     VALIDAR PRODUTO
  ======================================================= */

  function validarProduto() {
    const codigo =
      produtoLido
        .trim()
        .toUpperCase();

    if (!codigo) {
      setProdutoConfirmado(false);

      setMensagem(
        "Informe ou leia o código do produto."
      );

      return;
    }

    if (
      codigo !==
      item.codigoProduto.toUpperCase()
    ) {
      setProdutoConfirmado(false);

      setMensagem(
        `Produto incorreto. Esperado: ${item.codigoProduto}.`
      );

      return;
    }

    setProdutoConfirmado(true);

    setMensagem(
      "Produto identificado. Realize a conferência."
    );
  }

  /* =======================================================
     ADICIONAR SERIAL
  ======================================================= */

  function adicionarSerial() {
    if (!produtoConfirmado) {
      setMensagem(
        "Primeiro confirme o código do produto."
      );

      return;
    }

    const serial =
      serialDigitado
        .trim()
        .toUpperCase();

    if (!serial) {
      setMensagem(
        "Informe ou leia o número de série."
      );

      return;
    }

    const separados =
      seriaisSeparados[item.id] ?? [];

    const atuais =
      seriais[item.id] ?? [];

    if (!separados.includes(serial)) {
      setMensagem(
        `Serial ${serial} não pertence à separação.`
      );

      return;
    }

    if (atuais.includes(serial)) {
      setMensagem(
        `Serial ${serial} já foi conferido.`
      );

      return;
    }

    if (atuais.length >= separado) {
      setMensagem(
        "A quantidade separada já foi totalmente conferida."
      );

      return;
    }

    const novos = [
      ...atuais,
      serial,
    ];

    setSeriais((anterior) => ({
      ...anterior,
      [item.id]: novos,
    }));

    setQuantidades((anterior) => ({
      ...anterior,
      [item.id]: novos.length,
    }));

    registrarConferenciaItem(
      requisicaoSeguro,
      item.id,
      novos.length,
      novos
    );

    setSerialDigitado("");

    setMensagem(
      `Serial ${serial} conferido com sucesso.`
    );
  }

  /* =======================================================
     CONFIRMAR ITEM
  ======================================================= */

  function confirmarItem() {
    if (!produtoConfirmado) {
      setMensagem(
        "Primeiro confirme o código do produto."
      );

      return;
    }

    /*
     * ITEM COM SERIAL
     */
    if (item.controlaSerie) {
      const lista =
        seriais[item.id] ?? [];

      if (lista.length < separado) {
        setMensagem(
          `Ainda faltam ${
            separado - lista.length
          } número(s) de série.`
        );

        return;
      }

      registrarConferenciaItem(
        requisicaoSeguro,
        item.id,
        lista.length,
        lista
      );

      setMensagem(
        "Produto conferido com sucesso."
      );

      return;
    }

    /*
     * ITEM SEM SERIAL
     */
    setQuantidades((anterior) => ({
      ...anterior,
      [item.id]: separado,
    }));

    registrarConferenciaItem(
      requisicaoSeguro,
      item.id,
      separado,
      []
    );

    setMensagem(
      `${separado} ${item.unidade} conferido(s) com sucesso.`
    );
  }

  /* =======================================================
     PRÓXIMO ITEM
  ======================================================= */

  function proximo() {
    const quantidadeConferida =
      quantidades[item.id] ?? 0;

    if (
      quantidadeConferida <
      separado
    ) {
      setMensagem(
        "Conclua a conferência do produto atual."
      );

      return;
    }

    registrarConferenciaItem(
      requisicaoSeguro,
      item.id,
      quantidadeConferida,
      seriais[item.id] ?? []
    );

    /*
     * Ainda possui produto.
     */
    if (
      itemAtual <
      requisicaoSeguro.itens.length - 1
    ) {
      setItemAtual(
        (atual) => atual + 1
      );

      setProdutoLido("");

      setProdutoConfirmado(false);

      setSerialDigitado("");

      setMensagem("");

      return;
    }

    /*
     * Último produto.
     *
     * NÃO FINALIZA MAIS A CONFERÊNCIA.
     * Agora vai para geração de volume.
     */
    setModoVolume(true);

    setProdutoLido("");

    setProdutoConfirmado(false);

    setSerialDigitado("");

    setMensagem(
      "Todos os produtos foram conferidos. Gere o volume para continuar."
    );
  }

  /* =======================================================
     GERAR VOLUME
  ======================================================= */

  function gerarVolume() {
    try {
      const volume =
        criarVolume(requisicaoSeguro);

      setVolumeAtualId(
        volume.id
      );

      atualizarVolumes();

      setMensagem(
        `Volume ${volume.codigo} criado.`
      );
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o volume."
      );
    }
  }

  /* =======================================================
     ADICIONAR PRODUTO AO VOLUME

     Nesta primeira versão:
     adiciona TODO o saldo conferido daquele produto
     ao volume atual.
  ======================================================= */

  function adicionarProdutoVolume(
    itemId: number
  ) {
    if (
      volumeAtualId === null
    ) {
      setMensagem(
        "Primeiro gere um volume."
      );

      return;
    }

    const produto =
      requisicaoSeguro.itens.find(
        (item) =>
          item.id === itemId
      );

    if (!produto) {
      return;
    }

    const saldo =
      saldoParaVolume(
        itemId
      );

    if (saldo <= 0) {
      setMensagem(
        "Este produto já está totalmente vinculado a volume."
      );

      return;
    }

    const listaSeriais =
      produto.controlaSerie
        ? seriais[itemId] ?? []
        : [];

    try {
      adicionarItemAoVolume(
        requisicaoSeguro,
        volumeAtualId,
        itemId,
        saldo,
        listaSeriais
      );

      atualizarVolumes();

      setMensagem(
        `${produto.codigoProduto} adicionado ao volume.`
      );
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar o produto ao volume."
      );
    }
  }

  /* =======================================================
     COLOCAR TODOS OS SALDOS NO VOLUME
  ======================================================= */

  function adicionarTodosAoVolume() {
    if (
      volumeAtualId === null
    ) {
      setMensagem(
        "Primeiro gere um volume."
      );

      return;
    }

    try {
      requisicaoSeguro.itens.forEach(
        (produto) => {
          const saldo =
            saldoParaVolume(
              produto.id
            );

          if (saldo <= 0) {
            return;
          }

          const listaSeriais =
            produto.controlaSerie
              ? seriais[
                  produto.id
                ] ?? []
              : [];

          adicionarItemAoVolume(
            requisicaoSeguro,
            volumeAtualId,
            produto.id,
            saldo,
            listaSeriais
          );
        }
      );

      atualizarVolumes();

      setMensagem(
        "Produtos adicionados ao volume."
      );
    } catch (error) {
      atualizarVolumes();

      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível montar o volume."
      );
    }
  }

  /* =======================================================
     FECHAR VOLUME
  ======================================================= */

  function concluirVolume() {
    if (
      volumeAtualId === null
    ) {
      setMensagem(
        "Nenhum volume aberto."
      );

      return;
    }

    try {
      const volume =
        fecharVolume(
          requisicaoSeguro,
          volumeAtualId
        );

      setVolumeAtualId(null);

      atualizarVolumes();

      setMensagem(
        `Volume ${volume.codigo} fechado com sucesso.`
      );
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível fechar o volume."
      );
    }
  }

  /* =======================================================
     IMPRIMIR ETIQUETA DO VOLUME
  ======================================================= */

  function imprimirEtiqueta(volume: VolumeRequisicao) {
    if (volume.status === "ABERTO") {
      setMensagem(
        "Feche o volume antes de imprimir a etiqueta."
      );
      return;
    }

    const indiceVolume =
      Math.max(
        volumes.findIndex(
          (itemVolume) =>
            itemVolume.id === volume.id
        ) + 1,
        1
      );

    const totalVolumes =
      Math.max(
        volumes.length,
        1
      );

    const tipoOperacao =
      requisicaoSeguro.tipo ||
      "ABASTECIMENTO";

    const origem =
      requisicaoSeguro.origem ||
      "CD FORTALEZA";

    /*
     * O QR identifica o VOLUME.
     * Os produtos NÃO são impressos na etiqueta.
     * Ao ler o volume no embarque/recebimento,
     * o WMS recupera internamente todo o conteúdo.
     */
    const conteudoQR = [
      `VOLUME=${volume.codigo}`,
      `REQUISICAO=${requisicaoSeguro.codigo}`,
      `TIPO=${tipoOperacao}`,
      `DESTINO=${requisicaoSeguro.codigoTecnico}`,
    ].join("|");

    const janela = window.open(
      "",
      "_blank",
      "width=760,height=520"
    );

    if (!janela) {
      setMensagem(
        "O navegador bloqueou a janela de impressão. Libere pop-ups e tente novamente."
      );
      return;
    }

    janela.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${volume.codigo}</title>

          <style>
            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #20242a;
              font-family: Arial, Helvetica, sans-serif;
            }

            body {
              padding: 5mm;
            }

            .etiqueta {
              width: 100mm;
              min-height: 50mm;
              display: grid;
              grid-template-columns:
                minmax(0, 1fr)
                31mm
                11mm;
              column-gap: 3mm;
              align-items: start;
              overflow: hidden;
            }

            .dados {
              min-width: 0;
            }

            .linha {
              display: grid;
              grid-template-columns:
                auto
                minmax(0, 1fr);
              gap: 1.2mm;
              align-items: start;
              margin-bottom: 1.4mm;
              font-size: 8.5pt;
              line-height: 1.15;
            }

            .label {
              font-weight: 800;
              white-space: nowrap;
            }

            .valor {
              min-width: 0;
              overflow-wrap: anywhere;
            }

            .requisicaoSeguro {
              padding-bottom: 1.5mm;
              margin-bottom: 1.8mm;
              border-bottom: 0.25mm solid #777;
            }

            .requisicaoSeguro .valor {
              font-weight: 900;
            }

            .tipo {
              font-weight: 900;
              text-transform: uppercase;
            }

            .centro {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
            }

            #qrcode {
              width: 29mm;
              height: 29mm;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 0.25mm solid #d1d5db;
              border-radius: 2mm;
              overflow: hidden;
              background: #fff;
            }

            #qrcode img,
            #qrcode canvas {
              width: 27mm !important;
              height: 27mm !important;
            }

            .data {
              margin-top: 1.2mm;
              font-size: 6.3pt;
              text-align: center;
              white-space: nowrap;
            }

            .contador {
              margin-top: 1.5mm;
              font-size: 18pt;
              line-height: 1;
              font-weight: 900;
              text-align: center;
            }

            .marca {
              min-height: 39mm;
              border-left: 0.25mm solid #d1d5db;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }

            .marca-texto {
              transform: rotate(90deg);
              white-space: nowrap;
              font-size: 10.5pt;
              font-weight: 900;
              letter-spacing: 0.25mm;
            }

            .rodape-volume {
              grid-column: 1 / -1;
              margin-top: 2.2mm;
              padding-top: 2mm;
              border-top: 0.35mm solid #20242a;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 4mm;
            }

            .codigo-volume {
              font-size: 11pt;
              font-weight: 900;
              white-space: nowrap;
            }

            .destino {
              font-size: 7.5pt;
              font-weight: 800;
              text-align: right;
            }

            @page {
              size: 100mm 55mm;
              margin: 0;
            }

            @media print {
              html,
              body {
                width: 100mm;
                height: 55mm;
              }

              body {
                padding: 4mm;
              }
            }
          </style>
        </head>

        <body>
          <div class="etiqueta">

            <div class="dados">

              <div class="linha requisicaoSeguro">
                <span class="label">
                  Requisição:
                </span>

                <span class="valor">
                  ${requisicaoSeguro.codigo}
                </span>
              </div>

              <div class="linha">
                <span class="label">
                  Tipo:
                </span>

                <span class="valor tipo">
                  ${tipoOperacao}
                </span>
              </div>

              <div class="linha">
                <span class="label">
                  Técnico:
                </span>

                <span class="valor">
                  ${requisicaoSeguro.tecnico}
                </span>
              </div>

              <div class="linha">
                <span class="label">
                  Cód. Técnico:
                </span>

                <span class="valor">
                  ${requisicaoSeguro.codigoTecnico}
                </span>
              </div>

              <div class="linha">
                <span class="label">
                  Base:
                </span>

                <span class="valor">
                  ${requisicaoSeguro.base}
                </span>
              </div>

              <div class="linha">
                <span class="label">
                  Origem:
                </span>

                <span class="valor">
                  ${origem}
                </span>
              </div>

            </div>

            <div class="centro">

              <div id="qrcode"></div>

              <div
                class="data"
                id="dataImpressao"
              ></div>

              <div class="contador">
                ${indiceVolume} / ${totalVolumes}
              </div>

            </div>

            <div class="marca">
              <div class="marca-texto">
                WMS EXPERT
              </div>
            </div>

            <div class="rodape-volume">

              <div class="codigo-volume">
                ${volume.codigo}
              </div>

              <div class="destino">
                DESTINO:
                ${requisicaoSeguro.codigoTecnico}
              </div>

            </div>

          </div>

          <script
            src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js">
          </script>

          <script>
            function iniciarEtiqueta() {
              var agora = new Date();

              document.getElementById(
                "dataImpressao"
              ).textContent =
                agora.toLocaleDateString(
                  "pt-BR"
                ) +
                " " +
                agora.toLocaleTimeString(
                  "pt-BR",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                );

              if (
                typeof QRCode !==
                "undefined"
              ) {
                new QRCode(
                  document.getElementById(
                    "qrcode"
                  ),
                  {
                    text: ${JSON.stringify(conteudoQR)},
                    width: 220,
                    height: 220,
                    correctLevel:
                      QRCode.CorrectLevel.M,
                  }
                );
              } else {
                document.getElementById(
                  "qrcode"
                ).innerHTML =
                  "<strong>QR</strong>";
              }

              window.setTimeout(
                function () {
                  window.print();
                },
                700
              );
            }

            window.addEventListener(
              "load",
              iniciarEtiqueta
            );
          </script>

        </body>
      </html>
    `);

    janela.document.close();

    setMensagem(
      `Etiqueta ${volume.codigo} enviada para impressão.`
    );
  }

  /* =======================================================
     FINALIZAR CONFERÊNCIA
  ======================================================= */

  function concluirConferencia() {
    try {
      setFinalizando(true);

      finalizarConferencia(
        requisicaoSeguro
      );

      setMensagem(
        "Conferência finalizada. Volumes liberados para embarque."
      );

      window.setTimeout(() => {
        router.push(
          "/coletor/conferencia"
        );
      }, 1000);
    } catch (error) {
      setFinalizando(false);

      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar a conferência."
      );
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="collector-screen">
      <div className="collector-phone">

        {/* ===============================================
            HEADER
        =============================================== */}

        <div className="collector-header">

          <div className="collector-header-title">

            <button
              type="button"
              className="collector-back-button"
              onClick={() =>
                router.push(
                  "/coletor/conferencia"
                )
              }
            >
              ‹
            </button>

            <div>
              <strong>
                #{requisicaoSeguro.codigo.replace(
                  "REQ-",
                  ""
                )}
              </strong>

              <div
                style={{
                  fontSize: 10,
                  fontWeight: 400,
                  marginTop: 2,
                }}
              >
                {requisicaoSeguro.tecnico.toUpperCase()}
              </div>

              <div
                style={{
                  fontSize: 9,
                  opacity: 0.9,
                  marginTop: 1,
                }}
              >
                {requisicaoSeguro.codigoTecnico}
                {" • "}
                {requisicaoSeguro.base}
              </div>
            </div>

          </div>

          <span
            style={{
              fontSize: 22,
            }}
          >
            ⋮
          </span>

        </div>

        {/* ===============================================
            CONFERÊNCIA DE PRODUTO
        =============================================== */}

        {!modoVolume && (
          <>
            <div
                className="collector-operation-body"
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    overflowX: "hidden",
                    WebkitOverflowScrolling: "touch",
                    paddingBottom: 120,
                }}
>

              <section className="collector-section">

                {/* TÍTULO */}

                <div className="collector-section-title">
                  <span>
                    Informações do Produto
                  </span>

                  <span>☷</span>
                </div>

                {/* PRODUTO / VOLUME */}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 22,
                    marginBottom: 14,
                    fontSize: 13,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <input
                      type="radio"
                      checked
                      readOnly
                    />

                    Produto
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <input
                      type="radio"
                      disabled
                    />

                    Volume
                  </label>
                </div>

                {/* POSIÇÃO */}

                <div className="collector-product-position">
                  Produto {itemAtual + 1} de{" "}
                  {requisicaoSeguro.itens.length}
                </div>

                {/* DESCRIÇÃO */}

                <div className="collector-product-description">
                  {item.produto}
                </div>

                <div className="collector-product-code">
                  Código:{" "}
                  <strong>
                    {item.codigoProduto}
                  </strong>
                </div>

                {/* LEITURA */}

                <div className="collector-input-action">

                  <input
                    value={produtoLido}
                    onChange={(e) => {
                      setProdutoLido(
                        e.target.value
                      );

                      setProdutoConfirmado(
                        false
                      );
                    }}
                    placeholder="Código do produto"
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter"
                      ) {
                        validarProduto();
                      }
                    }}
                  />

                  <button
                    type="button"
                    onClick={
                      validarProduto
                    }
                  >
                    ✓
                  </button>

                </div>

                <button
                  type="button"
                  className="collector-demo-fill"
                  onClick={() => {
                    setProdutoLido(
                      item.codigoProduto
                    );

                    setProdutoConfirmado(
                      false
                    );

                    setMensagem(
                      `Código ${item.codigoProduto} preenchido. Clique no ✓.`
                    );
                  }}
                >
                  Simular leitura:{" "}
                  {item.codigoProduto}
                </button>

                {/* PRODUTO VALIDADO */}

                {produtoConfirmado && (
                  <>

                    <div className="collector-quantity-grid">

                      <div>
                        <span>
                          Separado
                        </span>

                        <strong>
                          {separado}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Conferido
                        </span>

                        <strong>
                          {conferido}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Falta
                        </span>

                        <strong>
                          {falta}
                        </strong>
                      </div>

                    </div>

                    {/* SERIAL */}

                    {item.controlaSerie && (
                      <div className="collector-serial-area">

                        <label>
                          Número de série
                        </label>

                        <div className="collector-input-action">

                          <input
                            value={
                              serialDigitado
                            }
                            onChange={(e) =>
                              setSerialDigitado(
                                e.target.value
                              )
                            }
                            placeholder="Leia o número de série"
                            autoComplete="off"
                            onKeyDown={(e) => {
                              if (
                                e.key ===
                                "Enter"
                              ) {
                                adicionarSerial();
                              }
                            }}
                          />

                          <button
                            type="button"
                            onClick={
                              adicionarSerial
                            }
                          >
                            +
                          </button>

                        </div>

                        <div className="collector-serial-counter">
                          Conferidos:{" "}

                          <strong>
                            {seriais[item.id]
                              ?.length ?? 0}
                            /
                            {separado}
                          </strong>
                        </div>

                        {/* SERIAIS PARA TESTE */}

                        {(
                          seriaisSeparados[
                            item.id
                          ] ?? []
                        ).length > 0 && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: 10,
                              borderRadius: 6,
                              background:
                                "#f8fafc",
                              border:
                                "1px solid #d8e1e8",
                              fontSize: 11,
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 700,
                                marginBottom: 6,
                              }}
                            >
                              Seriais separados:
                            </div>

                            {(
                              seriaisSeparados[
                                item.id
                              ] ?? []
                            ).map(
                              (serial) => (
                                <button
                                  key={
                                    serial
                                  }
                                  type="button"
                                  onClick={() =>
                                    setSerialDigitado(
                                      serial
                                    )
                                  }
                                  style={{
                                    display:
                                      "block",
                                    width:
                                      "100%",
                                    marginTop:
                                      4,
                                    padding:
                                      "6px 8px",
                                    border:
                                      "1px solid #cbd5e1",
                                    borderRadius:
                                      5,
                                    background:
                                      "#fff",
                                    textAlign:
                                      "left",
                                    cursor:
                                      "pointer",
                                  }}
                                >
                                  {serial}
                                </button>
                              )
                            )}
                          </div>
                        )}

                      </div>
                    )}

                    {!item.controlaSerie && (
                      <div
                        style={{
                          marginTop: 14,
                          padding: 12,
                          borderRadius: 7,
                          background:
                            "#edf8fc",
                          fontSize: 13,
                        }}
                      >
                        Quantidade separada:

                        <strong
                          style={{
                            marginLeft: 5,
                          }}
                        >
                          {separado}{" "}
                          {item.unidade}
                        </strong>
                      </div>
                    )}

                  </>
                )}

                {mensagem && (
                  <div
                    className="collector-message"
                    style={{
                      marginTop: 12,
                    }}
                  >
                    {mensagem}
                  </div>
                )}

              </section>

            </div>

            {/* RODAPÉ CONFERÊNCIA */}

            <div
              style={{
                padding: "10px 12px",
                background: "#f4f4f4",
              }}
            >
              {conferido < separado ? (
                <button
                  type="button"
                  className="collector-confirm-item"
                  style={{
                    width: "100%",
                    minHeight: 48,
                    opacity: produtoConfirmado ? 1 : 0.45,
                  }}
                  onClick={confirmarItem}
                  disabled={!produtoConfirmado}
                >
                  CONFIRMAR
                </button>
              ) : (
                <button
                  type="button"
                  className="collector-next"
                  style={{
                    width: "100%",
                    minHeight: 48,
                  }}
                  onClick={proximo}
                >
                  {itemAtual === requisicaoSeguro.itens.length - 1
                    ? "FORMAR VOLUMES"
                    : "PRÓXIMO PRODUTO"}
                </button>
              )}
            </div>
          </>
        )}

        {/* ===============================================
            ETAPA DE VOLUMES
        =============================================== */}

        {modoVolume && (
          <>

            <div
  className="collector-operation-body"
  style={{
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    paddingBottom: 120,
  }}
>

              {/* RESUMO */}

              <section className="collector-section">

                <div className="collector-section-title">
                  <span>
                    Formação de Volumes
                  </span>

                  <span>▣</span>
                </div>

                <div
                  style={{
                    padding: 10,
                    borderRadius: 7,
                    background:
                      "#edf8fc",
                    color:
                      "#087da7",
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  Conferência concluída
                  dos produtos
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(3, 1fr)",
                    gap: 7,
                    marginBottom: 14,
                  }}
                >

                  <div
                    style={{
                      padding: 10,
                      textAlign:
                        "center",
                      border:
                        "1px solid #d8e2e8",
                      borderRadius: 6,
                    }}
                  >
                    <small>
                      SKUs
                    </small>

                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color:
                          "#087da7",
                      }}
                    >
                      {
                        requisicaoSeguro
                          .itens
                          .length
                      }
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 10,
                      textAlign:
                        "center",
                      border:
                        "1px solid #d8e2e8",
                      borderRadius: 6,
                    }}
                  >
                    <small>
                      VOLUMES
                    </small>

                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color:
                          "#087da7",
                      }}
                    >
                      {volumes.length}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 10,
                      textAlign:
                        "center",
                      border:
                        "1px solid #d8e2e8",
                      borderRadius: 6,
                    }}
                  >
                    <small>
                      DESTINO
                    </small>

                    <div
                      style={{
                        fontSize: 11,
                        marginTop: 5,
                        fontWeight: 800,
                        color:
                          "#087da7",
                      }}
                    >
                      {
                        requisicaoSeguro.codigoTecnico
                      }
                    </div>
                  </div>

                </div>

                {/* LISTA DOS PRODUTOS */}

                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    marginBottom: 7,
                  }}
                >
                  PRODUTOS CONFERIDOS
                </div>

                {requisicaoSeguro.itens.map(
                  (produto) => {
                    const qtdConferida =
                      quantidades[
                        produto.id
                      ] ?? 0;

                    const qtdVolumada =
                      quantidadeVolumada(
                        produto.id
                      );

                    const saldo =
                      saldoParaVolume(
                        produto.id
                      );

                    return (
                      <div
                        key={
                          produto.id
                        }
                        style={{
                          padding:
                            "10px",
                          marginBottom:
                            7,
                          border:
                            "1px solid #d8e2e8",
                          borderRadius:
                            7,
                          background:
                            "#fff",
                        }}
                      >

                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            gap: 8,
                          }}
                        >
                          <div>
                            <strong
                              style={{
                                fontSize:
                                  11,
                              }}
                            >
                              {
                                produto.codigoProduto
                              }
                            </strong>

                            <div
                              style={{
                                fontSize:
                                  10,
                                color:
                                  "#64748b",
                                marginTop:
                                  2,
                              }}
                            >
                              {
                                produto.produto
                              }
                            </div>
                          </div>

                          <div
                            style={{
                              textAlign:
                                "right",
                              fontSize:
                                10,
                            }}
                          >
                            Conferido{" "}
                            <strong>
                              {
                                qtdConferida
                              }
                            </strong>
                            <br />
                            Volumado{" "}
                            <strong>
                              {
                                qtdVolumada
                              }
                            </strong>
                            <br />
                            Saldo{" "}
                            <strong>
                              {saldo}
                            </strong>
                          </div>
                        </div>

                        {saldo > 0 &&
                          volumeAtualId !==
                            null && (
                            <button
                              type="button"
                              onClick={() =>
                                adicionarProdutoVolume(
                                  produto.id
                                )
                              }
                              style={{
                                width:
                                  "100%",
                                height:
                                  32,
                                marginTop:
                                  8,
                                border:
                                  "1px solid #168bb2",
                                borderRadius:
                                  5,
                                background:
                                  "#fff",
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
                              + ADICIONAR AO
                              VOLUME
                            </button>
                          )}

                        {saldo === 0 && (
                          <div
                            style={{
                              marginTop:
                                7,
                              fontSize:
                                10,
                              fontWeight:
                                800,
                              color:
                                "#07864c",
                            }}
                          >
                            ✓ TOTALMENTE
                            VOLUMADO
                          </div>
                        )}

                      </div>
                    );
                  }
                )}

              </section>

              {/* VOLUMES */}

              <section
                className="collector-section"
                style={{
                  marginTop: 10,
                }}
              >

                <div className="collector-section-title">
                  <span>
                    Volumes
                  </span>

                  <span>▦</span>
                </div>

                {volumes.length ===
                  0 && (
                  <div
                    style={{
                      padding: 14,
                      textAlign:
                        "center",
                      fontSize: 11,
                      color:
                        "#64748b",
                    }}
                  >
                    Nenhum volume
                    gerado.
                  </div>
                )}

                {volumes.map(
                  (volume) => (
                    <div
                      key={
                        volume.id
                      }
                      style={{
                        padding: 11,
                        marginBottom:
                          8,
                        border:
                          volume.status ===
                          "ABERTO"
                            ? "1.5px solid #168bb2"
                            : "1px solid #cbd5e1",
                        borderRadius:
                          7,
                        background:
                          volume.status ===
                          "ABERTO"
                            ? "#edf8fc"
                            : "#fff",
                      }}
                    >

                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "space-between",
                          gap: 8,
                        }}
                      >

                        <strong
                          style={{
                            fontSize:
                              12,
                          }}
                        >
                          {
                            volume.codigo
                          }
                        </strong>

                        <span
                          style={{
                            fontSize:
                              9,
                            padding:
                              "4px 7px",
                            borderRadius:
                              10,
                            background:
                              volume.status ===
                              "ABERTO"
                                ? "#d7f1fa"
                                : "#dff4e9",
                            color:
                              volume.status ===
                              "ABERTO"
                                ? "#087da7"
                                : "#07864c",
                            fontWeight:
                              800,
                          }}
                        >
                          {
                            volume.status
                          }
                        </span>

                      </div>

                      <div
                        style={{
                          marginTop:
                            7,
                          fontSize:
                            10,
                          color:
                            "#64748b",
                        }}
                      >
                        {
                          Object.keys(
                            volume.itens
                          ).length
                        }{" "}
                        SKU(s)
                      </div>

                      {Object.values(
                        volume.itens
                      ).map(
                        (
                          itemVolume
                        ) => {
                          const produto =
                            requisicaoSeguro.itens.find(
                              (produto) =>
                                produto.id ===
                                itemVolume.itemId
                            );

                          return (
                            <div
                              key={
                                itemVolume.itemId
                              }
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "space-between",
                                marginTop:
                                  5,
                                paddingTop:
                                  5,
                                borderTop:
                                  "1px solid #e2e8f0",
                                fontSize:
                                  10,
                              }}
                            >
                              <span>
                                {
                                  produto?.codigoProduto
                                }
                              </span>

                              <strong>
                                {
                                  itemVolume.quantidade
                                }{" "}
                                {
                                  produto?.unidade
                                }
                              </strong>
                            </div>
                          );
                        }
                      )}

                      {volume.status !== "ABERTO" && (
                        <button
                          type="button"
                          onClick={() =>
                            imprimirEtiqueta(volume)
                          }
                          style={{
                            width: "100%",
                            minHeight: 38,
                            marginTop: 10,
                            border: "1px solid #168bb2",
                            borderRadius: 6,
                            background: "#fff",
                            color: "#087da7",
                            fontSize: 10,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          🖨 IMPRIMIR ETIQUETA
                        </button>
                      )}

                    </div>
                  )
                )}

                {/* GERAR VOLUME */}

                {volumeAtualId ===
                  null &&
                  !todosVolumados && (
                    <button
                      type="button"
                      className="collector-confirm-item"
                      style={{
                        width:
                          "100%",
                        minHeight:
                          44,
                      }}
                      onClick={
                        gerarVolume
                      }
                    >
                      + GERAR NOVO VOLUME
                    </button>
                  )}

                {/* VOLUME ABERTO */}

                {volumeAtual && (
                  <>

                    {!todosVolumados && (
                      <button
                        type="button"
                        onClick={
                          adicionarTodosAoVolume
                        }
                        style={{
                          width:
                            "100%",
                          height:
                            40,
                          marginTop:
                            7,
                          border:
                            "1px solid #168bb2",
                          borderRadius:
                            6,
                          background:
                            "#fff",
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
                        ADICIONAR TODOS OS
                        SALDOS
                      </button>
                    )}

                    <button
                      type="button"
                      className="collector-confirm-item"
                      style={{
                        width:
                          "100%",
                        minHeight:
                          44,
                        marginTop:
                          7,
                      }}
                      onClick={
                        concluirVolume
                      }
                    >
                      FECHAR{" "}
                      {
                        volumeAtual.codigo
                      }
                    </button>

                  </>
                )}

                {mensagem && (
                  <div
                    className="collector-message"
                    style={{
                      marginTop: 10,
                    }}
                  >
                    {mensagem}
                  </div>
                )}

              </section>

            </div>

            {/* =============================================
                RODAPÉ VOLUME
            ============================================= */}

            <div
              style={{
                padding:
                  "10px 12px",
                background:
                  "#f4f4f4",
              }}
            >

              <button
                type="button"
                className="collector-next"
                style={{
                  width: "100%",
                  minHeight: 48,
                  opacity:
                    todosConferidos &&
                    todosVolumados &&
                    volumesFechados
                      ? 1
                      : 0.4,
                }}
                disabled={
                  !todosConferidos ||
                  !todosVolumados ||
                  !volumesFechados ||
                  finalizando
                }
                onClick={
                  concluirConferencia
                }
              >
                {finalizando
                  ? "FINALIZANDO..."
                  : "FINALIZAR CONFERÊNCIA"}
              </button>

            </div>

          </>
        )}

      </div>
    </div>
  );
}
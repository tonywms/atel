"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  adicionarMaterialOS,
  adicionarPatrimonioRetiradaOS,
  avaliarMaterialPrevistoOS,
  carregarPatrimonioDisponivelRetirada,
  finalizarOrdemServico,
  iniciarOrdemServico,
  obterOrdemServico,
  ouvirOrdensServico,
  removerMaterialOS,
  type DestinoMaterialOS,
  type OrdemServico,
  type PatrimonioCliente,
} from "@/lib/ordensServicoStore";

import {
  carregarEstoqueTecnico,
  ouvirEstoqueTecnico,
  type EstoqueTecnico,
} from "@/lib/estoqueTecnicoStore";

/* =========================================================
   HELPERS
========================================================= */

function statusNome(status: string) {
  if (status === "PENDENTE") return "PENDENTE";
  if (status === "EM_ATENDIMENTO") return "EM ATENDIMENTO";
  if (status === "FINALIZADA") return "FINALIZADA";
  if (status === "CANCELADA") return "CANCELADA";

  return status.replaceAll("_", " ");
}

function tipoNome(tipo: string) {
  if (tipo === "INSTALACAO") return "INSTALAÇÃO";
  if (tipo === "MANUTENCAO") return "MANUTENÇÃO";
  if (tipo === "TROCA") return "TROCA";
  if (tipo === "RETIRADA") return "RETIRADA";

  return tipo;
}

function destinoNome(
  destino: DestinoMaterialOS
) {
  if (destino === "COMODATO") return "COMODATO";
  if (destino === "VENDA") return "VENDA";

  return "CONSUMO";
}

/* =========================================================
   COMPONENTE
========================================================= */

export default function OrdemServicoDetalhePage() {
  const router = useRouter();
  const params = useParams();

  const ordemId = Number(params.id);

  const [ordem, setOrdem] =
    useState<OrdemServico | null>(null);

  const [estoque, setEstoque] =
    useState<EstoqueTecnico[]>([]);

  const [patrimoniosRetirada, setPatrimoniosRetirada] =
    useState<PatrimonioCliente[]>([]);

  const [patrimonioSelecionado, setPatrimonioSelecionado] =
    useState("");

  const [
    produtoSelecionado,
    setProdutoSelecionado,
  ] = useState("");

  const [
    quantidade,
    setQuantidade,
  ] = useState("1");

  const [
    destino,
    setDestino,
  ] = useState<DestinoMaterialOS>(
    "CONSUMO"
  );

  const [
    seriaisSelecionados,
    setSeriaisSelecionados,
  ] = useState<string[]>([]);

  const [erro, setErro] =
    useState("");

  type ModalDivergenciaOS = {
    materialId: number;
    codigoProduto: string;
    produto: string;
    unidade: string;
    esperado: number;
    seriaisPrevistos: string[];
  };

  const [modalDivergencia, setModalDivergencia] = useState<ModalDivergenciaOS | null>(null);
  const [tipoDivergencia, setTipoDivergencia] = useState("QUANTIDADE_DIVERGENTE");
  const [decisaoDivergencia, setDecisaoDivergencia] = useState<"USO_PARCIAL" | "NAO_UTILIZAR">("USO_PARCIAL");
  const [quantidadeUtilizada, setQuantidadeUtilizada] = useState("0");
  const [observacaoDivergencia, setObservacaoDivergencia] = useState("");

  const [materialConfirmacaoId, setMaterialConfirmacaoId] = useState<number | null>(null);
  const [quantidadesInformadas, setQuantidadesInformadas] = useState<Record<number, string>>({});

  const [
    modalFinalizar,
    setModalFinalizar,
  ] = useState(false);

  const [
    finalizando,
    setFinalizando,
  ] = useState(false);

  /* =======================================================
     CARREGAMENTO
  ======================================================= */

  function carregar() {
    const os =
      obterOrdemServico(ordemId);

    setOrdem(os ?? null);

    if (!os) {
      setEstoque([]);
      setPatrimoniosRetirada([]);
      return;
    }

    const lista =
      carregarEstoqueTecnico().filter(
        (item) =>
          item.codigoTecnico ===
            os.codigoTecnico &&
          item.situacao ===
            "DISPONIVEL" &&
          item.quantidade > 0
      );

    setEstoque(lista);

    if (os.tipo === "RETIRADA") {
      setPatrimoniosRetirada(
        carregarPatrimonioDisponivelRetirada(os.codigoCliente)
      );
    } else {
      setPatrimoniosRetirada([]);
    }
  }

  useEffect(() => {
    carregar();

    const offOS =
      ouvirOrdensServico(carregar);

    const offEstoque =
      ouvirEstoqueTecnico(carregar);

    return () => {
      offOS();
      offEstoque();
    };
  }, [ordemId]);

  /* =======================================================
     MATERIAL SELECIONADO
  ======================================================= */

  const itemEstoque =
    useMemo(() => {
      return estoque.find(
        (item) =>
          item.id ===
          produtoSelecionado
      );
    }, [
      estoque,
      produtoSelecionado,
    ]);

  /* =======================================================
     TOTAIS
  ======================================================= */

  const totalQuantidade =
    useMemo(() => {
      if (!ordem) return 0;

      return ordem.itens.reduce(
        (total, item) =>
          total + item.quantidade,
        0
      );
    }, [ordem]);

  const totalSkus =
    ordem?.itens.length ?? 0;

  const materiaisPrevistos = ordem?.materiaisPrevistos ?? [];
  const totalPrevistos = materiaisPrevistos.length;
  const totalAvaliados = materiaisPrevistos.filter(
    (item) => item.statusConferencia !== "PENDENTE"
  ).length;
  const totalOk = materiaisPrevistos.filter(
    (item) => item.statusConferencia === "OK"
  ).length;
  const totalDivergencias = materiaisPrevistos.filter(
    (item) => item.statusConferencia === "DIVERGENCIA"
  ).length;

  /* =======================================================
     INICIAR
  ======================================================= */

  function iniciarAtendimento() {
    if (!ordem) return;

    setErro("");

    // OS de RETIRADA trabalha com patrimônio do cliente e não depende
    // de materiais previstos no estoque móvel.
    if (ordem.tipo !== "RETIRADA") {
      const previstos = ordem.materiaisPrevistos ?? [];

      if (previstos.length === 0) {
        setErro(
          "Esta OS não possui materiais previstos. Solicite o envio dos materiais da OS antes de iniciar o atendimento."
        );
        return;
      }

      const possuiAlgumSaldo = previstos.some((material) => {
        const saldo = saldoDoMaterial(material.codigoProduto);
        return (saldo?.quantidade ?? 0) > 0;
      });

      if (!possuiAlgumSaldo) {
        setErro(
          "Nenhum dos materiais previstos está disponível no estoque móvel. Solicite abastecimento antes de iniciar o atendimento."
        );
        return;
      }
    }

    try {
      iniciarOrdemServico(ordem.id);
      carregar();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao iniciar atendimento."
      );
    }
  }

  /* =======================================================
     CONFERÊNCIA DOS MATERIAIS PREVISTOS
  ======================================================= */

  function saldoDoMaterial(codigoProduto: string) {
    return estoque.find((item) => item.codigoProduto === codigoProduto);
  }

  function quantidadeInformadaDoMaterial(materialId: number, quantidadePrevista: number) {
    return quantidadesInformadas[materialId] ?? String(quantidadePrevista);
  }

  function alterarQuantidadeInformada(materialId: number, valor: string) {
    setQuantidadesInformadas((atual) => ({ ...atual, [materialId]: valor }));
  }

  function abrirConfirmacaoPrevisto(materialId: number) {
    const material = materiaisPrevistos.find((item) => item.id === materialId);
    if (!material) return;

    setErro("");

    const valorDigitado = quantidadeInformadaDoMaterial(material.id, material.quantidade);
    const qtd = Number(valorDigitado.replace(",", "."));

    if (!Number.isFinite(qtd) || qtd <= 0) {
      setErro("Informe uma quantidade utilizada maior que zero.");
      return;
    }

    const saldo = saldoDoMaterial(material.codigoProduto);
    if (!saldo || qtd > saldo.quantidade) {
      setErro(`Estoque insuficiente. Quantidade informada: ${qtd} ${material.unidade}. Disponível: ${saldo?.quantidade ?? 0} ${saldo?.unidade ?? material.unidade}.`);
      return;
    }

    // Quantidade diferente do previsto é divergência e exige justificativa.
    if (qtd !== material.quantidade) {
      abrirDivergencia(material.id, qtd);
      return;
    }

    setMaterialConfirmacaoId(materialId);
  }

  function confirmarQuantidadePrevista() {
    if (!ordem || materialConfirmacaoId === null) return;
    const material = materiaisPrevistos.find((item) => item.id === materialConfirmacaoId);
    if (!material) return;
    setErro("");

    try {
      const qtd = Number(quantidadeInformadaDoMaterial(material.id, material.quantidade).replace(",", "."));
      const saldo = saldoDoMaterial(material.codigoProduto);

      if (!Number.isFinite(qtd) || qtd <= 0) throw new Error("Quantidade utilizada inválida.");
      if (!saldo) throw new Error(`Produto ${material.codigoProduto} não está disponível no estoque do técnico.`);
      if (qtd > saldo.quantidade) throw new Error(`Saldo insuficiente. Informado: ${qtd} ${material.unidade}. Disponível: ${saldo.quantidade} ${saldo.unidade}.`);

      const seriais = material.seriaisPrevistos.length > 0 ? material.seriaisPrevistos : [];
      if (seriais.some((serial) => !saldo.seriais.includes(serial))) {
        throw new Error("Um dos seriais previstos não está disponível no estoque do técnico.");
      }

      const itemExistente = ordem.itens.find((item) => item.codigoProduto === material.codigoProduto);
      if (itemExistente) removerMaterialOS(ordem.id, itemExistente.id);

      adicionarMaterialOS(ordem.id, {
        codigoProduto: material.codigoProduto,
        quantidade: qtd,
        seriais,
        destino: "CONSUMO",
      });

      avaliarMaterialPrevistoOS(
        ordem.id,
        material.id,
        "OK",
        `Quantidade confirmada: ${qtd} ${material.unidade}`
      );

      setQuantidadesInformadas((atual) => ({ ...atual, [material.id]: String(qtd) }));
      setMaterialConfirmacaoId(null);
      carregar();
    } catch (error) {
      setMaterialConfirmacaoId(null);
      setErro(error instanceof Error ? error.message : "Erro ao confirmar material.");
    }
  }

  function abrirDivergencia(materialId: number, quantidadeInicial?: number) {
    const material = materiaisPrevistos.find((item) => item.id === materialId);
    if (!material) return;
    const usado = ordem?.itens.find((item) => item.codigoProduto === material.codigoProduto);
    setModalDivergencia({
      materialId: material.id, codigoProduto: material.codigoProduto, produto: material.produto,
      unidade: material.unidade, esperado: material.quantidade, seriaisPrevistos: [...material.seriaisPrevistos],
    });
    setTipoDivergencia("QUANTIDADE_DIVERGENTE");
    setDecisaoDivergencia("USO_PARCIAL");
    setQuantidadeUtilizada(
      String(
        quantidadeInicial ??
        (Number.isFinite(Number(quantidadeInformadaDoMaterial(material.id, material.quantidade).replace(",", ".")))
          ? Number(quantidadeInformadaDoMaterial(material.id, material.quantidade).replace(",", "."))
          : usado?.quantidade) ??
        material.quantidade
      )
    );
    setObservacaoDivergencia(material.observacaoDivergencia ?? "");
  }

  function salvarDivergencia() {
    if (!ordem || !modalDivergencia) return;
    setErro("");
    try {
      const qtd = decisaoDivergencia === "NAO_UTILIZAR" ? 0 : Number(quantidadeUtilizada.replace(",", "."));
      if (!Number.isFinite(qtd) || qtd < 0) throw new Error("Quantidade utilizada inválida.");

      const saldo = saldoDoMaterial(modalDivergencia.codigoProduto);
      if (qtd > 0) {
        if (!saldo) throw new Error(`Produto ${modalDivergencia.codigoProduto} não está disponível no estoque do técnico.`);
        if (qtd > saldo.quantidade) throw new Error(`Estoque insuficiente. Você informou ${qtd} ${modalDivergencia.unidade}, mas possui ${saldo.quantidade} ${saldo.unidade} disponível.`);
      }

      const itemExistente = ordem.itens.find((item) => item.codigoProduto === modalDivergencia.codigoProduto);
      if (itemExistente) removerMaterialOS(ordem.id, itemExistente.id);

      if (qtd > 0) {
        const seriaisDisponiveis = saldo?.seriais ?? [];
        const qtdInteira = Number.isInteger(qtd) ? qtd : 0;
        const seriais = modalDivergencia.seriaisPrevistos
          .filter((serial) => seriaisDisponiveis.includes(serial))
          .slice(0, qtdInteira);
        if (seriaisDisponiveis.length > 0 && (!Number.isInteger(qtd) || seriais.length !== qtd)) {
          throw new Error(`Material serializado: são necessários ${qtd} serial(is) disponíveis.`);
        }
        adicionarMaterialOS(ordem.id, { codigoProduto: modalDivergencia.codigoProduto, quantidade: qtd, seriais, destino: "CONSUMO" });
      }

      const diferenca = qtd - modalDivergencia.esperado;
      const situacao = qtd === modalDivergencia.esperado ? "OK" : "DIVERGENCIA";
      const textoDiferenca = diferenca > 0
        ? `${diferenca} ${modalDivergencia.unidade} acima do previsto`
        : diferenca < 0
          ? `${Math.abs(diferenca)} ${modalDivergencia.unidade} abaixo do previsto`
          : "quantidade igual à prevista";
      const tipoNome = tipoDivergencia === "QUANTIDADE_DIVERGENTE" ? "Quantidade utilizada" : tipoDivergencia === "MATERIAL_INDISPONIVEL" ? "Material indisponível" : tipoDivergencia === "SERIAL_DIVERGENTE" ? "Serial divergente" : tipoDivergencia === "MATERIAL_DIFERENTE" ? "Material diferente" : "Material avariado";
      const observacao = `${tipoNome}: ${qtd} ${modalDivergencia.unidade} • ${textoDiferenca}${observacaoDivergencia.trim() ? ` • ${observacaoDivergencia.trim()}` : ""}`;
      avaliarMaterialPrevistoOS(ordem.id, modalDivergencia.materialId, situacao, observacao);
      setQuantidadesInformadas((atual) => ({ ...atual, [modalDivergencia.materialId]: String(qtd) }));
      setModalDivergencia(null);
      carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao registrar quantidade utilizada.");
    }
  }

  /* =======================================================
     SERIAL
  ======================================================= */

  function alternarSerial(
    serial: string
  ) {
    setSeriaisSelecionados(
      (atual) => {
        if (
          atual.includes(serial)
        ) {
          return atual.filter(
            (item) =>
              item !== serial
          );
        }

        return [
          ...atual,
          serial,
        ];
      }
    );
  }

  /* =======================================================
     ADICIONAR MATERIAL
  ======================================================= */

  function adicionarMaterial() {
    if (!ordem) return;

    setErro("");

    if (
      ordem.status !==
      "EM_ATENDIMENTO"
    ) {
      setErro(
        "Inicie o atendimento."
      );

      return;
    }

    if (!itemEstoque) {
      setErro(
        "Selecione um produto."
      );

      return;
    }

    const qtd =
      Number(quantidade);

    if (
      !Number.isFinite(qtd) ||
      qtd <= 0
    ) {
      setErro(
        "Quantidade inválida."
      );

      return;
    }

    if (
      qtd >
      itemEstoque.quantidade
    ) {
      setErro(
        `Saldo disponível: ${itemEstoque.quantidade} ${itemEstoque.unidade}`
      );

      return;
    }

    if (
      itemEstoque.seriais.length >
        0 &&
      seriaisSelecionados.length !==
        qtd
    ) {
      setErro(
        `Selecione ${qtd} serial(is).`
      );

      return;
    }

    try {
      adicionarMaterialOS(
        ordem.id,
        {
          codigoProduto:
            itemEstoque.codigoProduto,

          quantidade:
            qtd,

          seriais:
            seriaisSelecionados,

          destino,
        }
      );

      setProdutoSelecionado(
        ""
      );

      setQuantidade("1");

      setDestino(
        "CONSUMO"
      );

      setSeriaisSelecionados(
        []
      );

      carregar();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao adicionar material."
      );
    }
  }

  /* =======================================================
     ADICIONAR PATRIMÔNIO PARA RETIRADA
  ======================================================= */

  function adicionarPatrimonioRetirada() {
    if (!ordem) return;
    setErro("");

    if (ordem.status !== "EM_ATENDIMENTO") {
      setErro("Inicie o atendimento.");
      return;
    }

    if (!patrimonioSelecionado) {
      setErro("Selecione o patrimônio a retirar.");
      return;
    }

    try {
      adicionarPatrimonioRetiradaOS(ordem.id, patrimonioSelecionado);
      setPatrimonioSelecionado("");
      carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao adicionar patrimônio.");
    }
  }

  /* =======================================================
     REMOVER
  ======================================================= */

  function removerMaterial(
    itemId: number
  ) {
    if (!ordem) return;

    setErro("");

    try {
      removerMaterialOS(
        ordem.id,
        itemId
      );

      carregar();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao remover material."
      );
    }
  }

  /* =======================================================
     ABRIR MODAL DE FINALIZAÇÃO
  ======================================================= */

  function solicitarFinalizacao() {
    if (!ordem) return;

    setErro("");

    if (
      ordem.tipo !== "RETIRADA" &&
      ordem.materiaisPrevistos.length > 0 &&
      ordem.materiaisPrevistos.some((item) => item.statusConferencia === "PENDENTE")
    ) {
      setErro("Avalie todos os materiais previstos antes de finalizar.");
      return;
    }

    if (
      ordem.itens.length === 0
    ) {
      setErro(
        ordem.tipo === "RETIRADA"
          ? "Selecione pelo menos um patrimônio para retirada."
          : "Adicione pelo menos um material."
      );

      return;
    }

    setModalFinalizar(true);
  }

  /* =======================================================
     CANCELAR MODAL
  ======================================================= */

  function cancelarFinalizacao() {
    if (finalizando) return;

    setModalFinalizar(false);
  }

  /* =======================================================
     CONFIRMAR FINALIZAÇÃO
  ======================================================= */

  function confirmarFinalizacao() {
    if (
      !ordem ||
      finalizando
    ) {
      return;
    }

    setErro("");
    setFinalizando(true);

    try {
      finalizarOrdemServico(
        ordem.id
      );

      setModalFinalizar(false);

      router.push(
        "/coletor/ordens-servico"
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao finalizar OS."
      );

      setModalFinalizar(false);
    } finally {
      setFinalizando(false);
    }
  }

  /* =======================================================
     NÃO ENCONTRADA
  ======================================================= */

  if (!ordem) {
    return (
      <div className="collector-screen">
        <div
          className="collector-phone"
          style={phoneStyle}
        >
          <div style={headerStyle}>
            <button
              type="button"
              style={backButtonStyle}
              onClick={() =>
                router.push(
                  "/coletor/ordens-servico"
                )
              }
            >
              ‹
            </button>

            <strong>
              Ordem de Serviço
            </strong>
          </div>

          <div style={emptyPageStyle}>
            Ordem não encontrada.
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="collector-screen">
      <div
        className="collector-phone"
        style={phoneStyle}
      >
        {/* =================================================
            CABEÇALHO
        ================================================= */}

        <div style={headerStyle}>
          <button
            type="button"
            style={backButtonStyle}
            onClick={() =>
              router.push(
                "/coletor/ordens-servico"
              )
            }
          >
            ‹
          </button>

          <div style={headerInfoStyle}>
            <strong style={headerCodigoStyle}>
              {ordem.codigo}
            </strong>

            <span>
              {ordem.tecnico.toUpperCase()}
            </span>

            <span>
              {ordem.codigoTecnico} -{" "}
              {ordem.base}
            </span>
          </div>

          <button
            type="button"
            style={menuButtonStyle}
            aria-label="Mais opções"
          >
            ⋮
          </button>
        </div>

        {/* =================================================
            ÁREA ROLÁVEL
        ================================================= */}

        <div style={scrollStyle}>
          {/* ===============================================
              DADOS DA ORDEM
          =============================================== */}

          <section style={compactOsCardStyle}>
            <div style={compactOsHeaderStyle}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={compactOsLabelStyle}>ATENDIMENTO DA OS</div>
                <strong style={compactClientNameStyle}>{ordem.cliente}</strong>
                <div style={compactMetaStyle}>
                  <span>{ordem.codigoCliente}</span>
                  <span style={metaDotStyle}>•</span>
                  <span>{tipoNome(ordem.tipo)}</span>
                </div>
              </div>
              <span style={compactStatusStyle}>
                {ordem.status === "EM_ATENDIMENTO" ? "● EM ATENDIMENTO" : statusNome(ordem.status)}
              </span>
            </div>

            <div style={compactDetailsGridStyle}>
              <div style={compactDetailStyle}>
                <span style={compactDetailIconStyle}>⌖</span>
                <div>
                  <span style={compactDetailLabelStyle}>LOCAL</span>
                  <b style={compactDetailValueStyle}>{ordem.endereco} • {ordem.cidade}</b>
                </div>
              </div>
              <div style={compactDetailStyle}>
                <span style={compactDetailIconStyle}>●</span>
                <div>
                  <span style={compactDetailLabelStyle}>TÉCNICO</span>
                  <b style={compactDetailValueStyle}>{ordem.codigoTecnico} • {ordem.tecnico}</b>
                </div>
              </div>
            </div>

            {ordem.observacao && (
              <div style={compactObservationStyle}>
                <span style={compactObservationLabelStyle}>OBS</span>
                <span>{ordem.observacao}</span>
              </div>
            )}
          </section>

          {ordem.tipo !== "RETIRADA" && (
            <section style={receiptSectionStyle}>
              <div style={receiptTitleStyle}>
                <div>
                  <span style={sectionEyebrowStyle}>EXECUÇÃO</span>
                  <span style={sectionTitleTextStyle}>Materiais do Atendimento</span>
                </div>
                <span style={sectionCountStyle}>{totalPrevistos}</span>
              </div>

              <div style={receiptInfoStyle}>
                Confirme o previsto com um toque ou informe a quantidade realmente utilizada. A baixa ocorre somente ao finalizar a OS.
              </div>

              <div style={receiptContentHeaderStyle}>
                <span>MATERIAIS PREVISTOS</span>
                <span style={{ fontWeight: 700 }}>{totalAvaliados}/{totalPrevistos} avaliados</span>
              </div>

              {materiaisPrevistos.length === 0 && (
                <div style={emptyPlannedCardStyle}>
                  <div style={emptyPlannedIconStyle}>!</div>
                  <div style={{ flex: 1 }}>
                    <b style={emptyPlannedTitleStyle}>OS sem materiais previstos</b>
                    <div style={emptyPlannedTextStyle}>
                      Nenhum item foi enviado para esta Ordem de Serviço. Sem a relação de materiais o técnico não deve realizar consumo de estoque.
                    </div>
                    <div style={emptyPlannedHintStyle}>
                      Solicite o envio dos materiais da OS ou um abastecimento antes de continuar.
                    </div>
                  </div>
                </div>
              )}

              {materiaisPrevistos.map((material) => {
                const usado = ordem.itens.find((item) => item.codigoProduto === material.codigoProduto);
                const saldo = saldoDoMaterial(material.codigoProduto);
                const saldoQtd = saldo?.quantidade ?? 0;
                const semEstoque = saldoQtd <= 0;
                const estoqueInsuficiente = !semEstoque && saldoQtd < material.quantidade;
                const falta = Math.max(0, material.quantidade - saldoQtd);
                const isOk = material.statusConferencia === "OK";
                const isDiv = material.statusConferencia === "DIVERGENCIA";

                return (
                  <div
                    key={material.id}
                    style={{
                      ...premiumMaterialCardStyle,
                      ...(semEstoque ? premiumMaterialDisabledStyle : {}),
                      ...(isOk ? premiumMaterialOkStyle : {}),
                      ...(isDiv ? premiumMaterialWarningStyle : {}),
                    }}
                  >
                    <div style={materialCardAccentStyle} />

                    <div style={receiptProductTopStyle}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={materialCodePillStyle}>{material.codigoProduto}</div>
                        <b style={receiptProductNameStyle}>{material.produto}</b>
                      </div>
                      <div style={materialExpectedBadgeStyle}>
                        <span style={receiptLabelStyle}>PREVISTO</span>
                        <b>{material.quantidade} {material.unidade}</b>
                      </div>
                    </div>

                    <div style={materialStockRowStyle}>
                      <div style={materialStockCellStyle}>
                        <span style={materialMetricLabelStyle}>ESTOQUE MÓVEL</span>
                        <b style={{ ...materialMetricValueStyle, color: semEstoque ? "#9ca3af" : "#0f766e" }}>
                          {saldoQtd} {saldo?.unidade ?? material.unidade}
                        </b>
                      </div>
                      <div style={materialStockCellStyle}>
                        <span style={materialMetricLabelStyle}>SITUAÇÃO</span>
                        <b style={{ ...materialMetricValueStyle, color: semEstoque || estoqueInsuficiente ? "#b45309" : "#07864c" }}>
                          {semEstoque ? "SEM ESTOQUE" : estoqueInsuficiente ? `FALTAM ${falta} ${material.unidade}` : "DISPONÍVEL"}
                        </b>
                      </div>
                    </div>

                    {material.seriaisPrevistos.length > 0 && (
                      <div style={receiptSerialBoxStyle}>
                        <div style={receiptLabelStyle}>SERIAIS PREVISTOS</div>
                        {material.seriaisPrevistos.map((serial) => (
                          <div key={serial} style={{ fontSize: 10, marginTop: 4 }}>• {serial}</div>
                        ))}
                      </div>
                    )}

                    {(isOk || isDiv) && (
                      <div style={{ ...receiptResultStyle, background: isOk ? "#eaf8f0" : "#fff1cc", color: isOk ? "#07864c" : "#9a6700" }}>
                        {isOk
                          ? `✓ CONFIRMADO • Utilizado: ${usado?.quantidade ?? material.quantidade} ${material.unidade}`
                          : <>⚠ QUANTIDADE INFORMADA<br />{material.observacaoDivergencia || `Utilizado: ${usado?.quantidade ?? 0} ${material.unidade}`}</>}
                      </div>
                    )}

                    {semEstoque && !isOk && !isDiv && (
                      <div style={stockBlockedNoticeStyle}>
                        <span style={stockBlockedIconStyle}>!</span>
                        <div>
                          <b>Material indisponível no estoque móvel</b>
                          <span>Solicite abastecimento para conseguir atender este item.</span>
                        </div>
                      </div>
                    )}

                    {estoqueInsuficiente && !isOk && !isDiv && (
                      <div style={stockPartialNoticeStyle}>
                        <b>Estoque abaixo do previsto</b>
                        <span>Você pode informar o que realmente utilizou até o limite de {saldoQtd} {material.unidade}.</span>
                      </div>
                    )}

                    {ordem.status === "EM_ATENDIMENTO" && (
                      <div style={quantityExecutionBoxStyle}>
                        <div style={quantityExecutionHeaderStyle}>
                          <div>
                            <span style={receiptLabelStyle}>QUANTIDADE UTILIZADA</span>
                            <div style={quantityExecutionHintStyle}>
                              Digite o que foi realmente utilizado no cliente.
                            </div>
                          </div>
                          <div style={quantityReferenceStyle}>
                            Previsto <b>{material.quantidade} {material.unidade}</b>
                          </div>
                        </div>

                        <div style={quantityInputMainRowStyle}>
                          <div style={quantityInputShellStyle}>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              inputMode="decimal"
                              disabled={semEstoque}
                              value={quantidadeInformadaDoMaterial(material.id, material.quantidade)}
                              onChange={(e) => alterarQuantidadeInformada(material.id, e.target.value)}
                              style={{
                                ...quantityExposedInputStyle,
                                ...(semEstoque ? quantityExposedInputDisabledStyle : {}),
                              }}
                            />
                            <span style={quantityExposedUnitStyle}>{material.unidade}</span>
                          </div>

                          <button
                            type="button"
                            disabled={semEstoque}
                            onClick={() => abrirConfirmacaoPrevisto(material.id)}
                            style={{
                              ...quantityConfirmActionStyle,
                              ...(semEstoque ? premiumDisabledActionStyle : {}),
                            }}
                          >
                            ✓ CONFIRMAR USO
                          </button>
                        </div>

                        {(() => {
                          const real = Number(quantidadeInformadaDoMaterial(material.id, material.quantidade).replace(",", "."));
                          if (!Number.isFinite(real)) return null;
                          const diferenca = real - material.quantidade;
                          const acimaEstoque = real > saldoQtd;

                          return (
                            <div
                              style={{
                                ...quantityLiveFeedbackStyle,
                                color: acimaEstoque
                                  ? "#b42318"
                                  : diferenca > 0
                                    ? "#9a6700"
                                    : diferenca < 0
                                      ? "#087da7"
                                      : "#07864c",
                              }}
                            >
                              {acimaEstoque
                                ? `Estoque insuficiente • máximo disponível ${saldoQtd} ${material.unidade}`
                                : diferenca > 0
                                  ? `+${diferenca} ${material.unidade} acima do previsto • será registrada divergência`
                                  : diferenca < 0
                                    ? `${Math.abs(diferenca)} ${material.unidade} abaixo do previsto • será registrada divergência`
                                    : "Quantidade igual ao previsto"}
                            </div>
                          );
                        })()}

                        <button
                          type="button"
                          onClick={() => {
                            const valor = Number(quantidadeInformadaDoMaterial(material.id, material.quantidade).replace(",", "."));
                            abrirDivergencia(material.id, Number.isFinite(valor) ? valor : material.quantidade);
                          }}
                          style={divergenceActionStyle}
                        >
                          ⚠ REGISTRAR DIVERGÊNCIA / MOTIVO
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {totalPrevistos > 0 && (
                <div style={receiptSummaryBoxStyle}>
                  <b style={{fontSize:10}}>RESUMO DO ATENDIMENTO</b>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginTop:8}}>
                    <ResumoOS titulo="Avaliados" valor={`${totalAvaliados}/${totalPrevistos}`} />
                    <ResumoOS titulo="Materiais OK" valor={String(totalOk)} />
                    <ResumoOS titulo="Divergências" valor={String(totalDivergencias)} />
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginTop:6}}>
                    <ResumoOS titulo="SKUs utilizados" valor={String(totalSkus)} />
                    <ResumoOS titulo="Qtd. utilizada" valor={String(totalQuantidade)} />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ===============================================
              MATERIAIS / RETIRADA
          =============================================== */}

          {ordem.tipo === "RETIRADA" && (<section style={boxStyle}>
            <div style={boxHeaderStyle}>
              <strong style={boxTitleStyle}>
                Patrimônio para Retirada
              </strong>

              <div style={circleIconStyle}>
                {ordem.tipo === "RETIRADA" ? "↩" : "▦"}
              </div>
            </div>

            {ordem.status === "PENDENTE" && (
              <div style={emptyMaterialStyle}>
                Inicie o atendimento para {ordem.tipo === "RETIRADA"
                  ? "selecionar o patrimônio que será retirado."
                  : "informar os materiais utilizados."}
              </div>
            )}

            {ordem.status === "EM_ATENDIMENTO" && ordem.tipo === "RETIRADA" && (
              <>
                <label style={labelStyle}>PATRIMÔNIO DO CLIENTE</label>

                <select
                  value={patrimonioSelecionado}
                  onChange={(e) => setPatrimonioSelecionado(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Selecione o patrimônio</option>
                  {patrimoniosRetirada
                    .filter((pat) =>
                      !ordem.itens.some((item) =>
                        item.codigoProduto === pat.codigoProduto &&
                        (!pat.serial || item.seriais.includes(pat.serial))
                      )
                    )
                    .map((pat) => (
                      <option key={pat.id} value={pat.id}>
                        {pat.codigoProduto} - {pat.produto}
                        {pat.serial ? ` | ${pat.serial}` : ""}
                      </option>
                    ))}
                </select>

                {patrimoniosRetirada.length === 0 && (
                  <div style={stockInfoStyle}>
                    <span>PATRIMÔNIO</span>
                    <strong>NENHUM COMODATO INSTALADO</strong>
                  </div>
                )}

                {patrimonioSelecionado && (
                  <button type="button" onClick={adicionarPatrimonioRetirada} style={addMaterialStyle}>
                    ADICIONAR À RETIRADA
                  </button>
                )}
              </>
            )}

            {ordem.status === "EM_ATENDIMENTO" && ordem.tipo !== "RETIRADA" && (
              <>
                <label style={labelStyle}>PRODUTO</label>
                <select
                  value={produtoSelecionado}
                  onChange={(e) => {
                    setProdutoSelecionado(e.target.value);
                    setQuantidade("1");
                    setSeriaisSelecionados([]);
                  }}
                  style={inputStyle}
                >
                  <option value="">Selecione o produto</option>
                  {estoque.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.codigoProduto} - {item.produto} | {item.quantidade} {item.unidade}
                    </option>
                  ))}
                </select>

                {itemEstoque && (
                  <>
                    <div style={stockInfoStyle}>
                      <span>SALDO DISPONÍVEL</span>
                      <strong>{itemEstoque.quantidade} {itemEstoque.unidade}</strong>
                    </div>

                    <div style={twoColumnsStyle}>
                      <div>
                        <label style={labelStyle}>QUANTIDADE</label>
                        <input
                          type="number" min={1} max={itemEstoque.quantidade}
                          value={quantidade}
                          onChange={(e) => setQuantidade(e.target.value)}
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>DESTINO</label>
                        <select
                          value={destino}
                          onChange={(e) => setDestino(e.target.value as DestinoMaterialOS)}
                          style={inputStyle}
                        >
                          <option value="CONSUMO">CONSUMO</option>
                          <option value="COMODATO">COMODATO</option>
                          <option value="VENDA">VENDA</option>
                        </select>
                      </div>
                    </div>

                    {itemEstoque.seriais.length > 0 && (
                      <>
                        <label style={labelStyle}>SERIAIS</label>
                        <div style={serialContainerStyle}>
                          {itemEstoque.seriais.map((serial) => {
                            const selecionado = seriaisSelecionados.includes(serial);
                            return (
                              <button
                                type="button" key={serial}
                                onClick={() => alternarSerial(serial)}
                                style={{...serialStyle, ...(selecionado ? serialSelectedStyle : {})}}
                              >
                                {selecionado ? "✓ " : ""}{serial}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    <button type="button" onClick={adicionarMaterial} style={addMaterialStyle}>
                      ADICIONAR MATERIAL
                    </button>
                  </>
                )}
              </>
            )}

            <div style={subTitleStyle}>
              {ordem.tipo === "RETIRADA" ? "PATRIMÔNIOS DA RETIRADA" : "PRODUTOS DA OS"}
            </div>

            {ordem.itens.length === 0 && (
              <div style={emptyMaterialStyle}>
                {ordem.tipo === "RETIRADA" ? "Nenhum patrimônio selecionado." : "Nenhum material informado."}
              </div>
            )}

            {ordem.itens.map((item) => (
              <div key={item.id} style={productCardStyle}>
                <div style={productTopStyle}>
                  <div>
                    <strong style={productCodeStyle}>{item.codigoProduto}</strong>
                    <div style={productNameStyle}>{item.produto}</div>
                  </div>
                  <div style={productNumbersStyle}>
                    <div>Quantidade <b>{item.quantidade}</b></div>
                    <div>Unidade <b>{item.unidade}</b></div>
                  </div>
                </div>

                <div style={destinationLineStyle}>
                  ✓ {ordem.tipo === "RETIRADA" ? "RETIRADA DO CLIENTE" : destinoNome(item.destino)}
                </div>

                {item.seriais.length > 0 && (
                  <div style={productSerialStyle}>Serial: <strong>{item.seriais.join(", ")}</strong></div>
                )}

                {ordem.status === "EM_ATENDIMENTO" && (
                  <button type="button" onClick={() => removerMaterial(item.id)} style={removeStyle}>
                    REMOVER
                  </button>
                )}
              </div>
            ))}
          </section>)}

          {erro && (
            <div style={errorStyle}>
              {erro}
            </div>
          )}

          <div
            style={{
              height: 88,
            }}
          />
        </div>

        {/* =================================================
            RODAPÉ
        ================================================= */}

        <div style={footerStyle}>
          {ordem.status === "PENDENTE" && (() => {
            const previstos = ordem.materiaisPrevistos ?? [];

            const semMateriais =
              ordem.tipo !== "RETIRADA" &&
              previstos.length === 0;

            const possuiAlgumSaldo =
              ordem.tipo === "RETIRADA" ||
              previstos.some((material) => {
                const saldo = saldoDoMaterial(material.codigoProduto);
                return (saldo?.quantidade ?? 0) > 0;
              });

            const semEstoque =
              ordem.tipo !== "RETIRADA" &&
              previstos.length > 0 &&
              !possuiAlgumSaldo;

            const bloqueado = semMateriais || semEstoque;

            return (
              <button
                type="button"
                style={{
                  ...footerButtonStyle,
                  ...(bloqueado
                    ? {
                        background: "#d7dee3",
                        color: "#6b7680",
                        cursor: "not-allowed",
                        boxShadow: "none",
                      }
                    : {}),
                }}
                onClick={iniciarAtendimento}
                disabled={bloqueado}
                title={
                  semMateriais
                    ? "A OS não possui materiais previstos."
                    : semEstoque
                      ? "Nenhum material previsto possui saldo no estoque móvel."
                      : "Iniciar atendimento"
                }
              >
                {semMateriais
                  ? "🔒 AGUARDANDO MATERIAIS"
                  : semEstoque
                    ? "🔒 ABASTECIMENTO NECESSÁRIO"
                    : "INICIAR ATENDIMENTO"}
              </button>
            );
          })()}

          {ordem.status ===
            "EM_ATENDIMENTO" && (
            <button
              type="button"
              style={footerButtonStyle}
              onClick={
                solicitarFinalizacao
              }
            >
              {ordem.tipo === "RETIRADA"
                ? "FINALIZAR RETIRADA"
                : "FINALIZAR ORDEM DE SERVIÇO"}
            </button>
          )}

          {ordem.status ===
            "FINALIZADA" && (
            <button
              type="button"
              style={{
                ...footerButtonStyle,
                background:
                  "#8ec9d9",
              }}
              disabled
            >
              ORDEM FINALIZADA
            </button>
          )}
        </div>

        {materialConfirmacaoId !== null && (() => {
          const material = materiaisPrevistos.find((item) => item.id === materialConfirmacaoId);
          if (!material) return null;
          const saldo = saldoDoMaterial(material.codigoProduto);
          return (
            <div style={receiptOverlayStyle} onMouseDown={() => setMaterialConfirmacaoId(null)}>
              <div style={receiptModalStyle} onMouseDown={(e) => e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <b style={{fontSize:15}}>Confirmar quantidade utilizada?</b>
                    <div style={{fontSize:10,color:"#64748b",marginTop:3}}>{material.codigoProduto} • {material.produto}</div>
                  </div>
                  <button type="button" onClick={() => setMaterialConfirmacaoId(null)} style={receiptCloseStyle}>×</button>
                </div>

                <div style={{marginTop:14,padding:12,border:"1px solid #d8e2e8",borderRadius:7,background:"#f8fafc"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <ResumoOS titulo="Previsto" valor={`${material.quantidade} ${material.unidade}`} />
                    <ResumoOS titulo="Estoque disponível" valor={`${saldo?.quantidade ?? 0} ${saldo?.unidade ?? material.unidade}`} />
                  </div>
                </div>

                <div style={{marginTop:12,padding:10,background:"#edf8fc",color:"#087da7",borderRadius:7,fontSize:10,lineHeight:1.45}}>
                  Será registrado que o técnico utilizou <b>{material.quantidade} {material.unidade}</b> deste material. Essa quantidade será baixada do estoque móvel somente ao finalizar a Ordem de Serviço.
                </div>

                <div style={{marginTop:10,padding:10,background:"#fff8df",color:"#9a6700",borderRadius:7,fontSize:10,fontWeight:800,lineHeight:1.4}}>
                  ⚠ Confirme somente se a quantidade realmente utilizada foi {material.quantidade} {material.unidade}. Se a quantidade estiver diferente do previsto, o sistema exigirá o motivo da divergência antes de registrar.
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}>
                  <button type="button" onClick={() => setMaterialConfirmacaoId(null)} style={{height:44,border:"1px solid #087da7",borderRadius:6,background:"#fff",color:"#087da7",fontWeight:900}}>CANCELAR</button>
                  <button type="button" onClick={confirmarQuantidadePrevista} style={{height:44,border:0,borderRadius:6,background:"#1595ba",color:"#fff",fontWeight:900}}>CONFIRMAR {material.quantidade} {material.unidade}</button>
                </div>
              </div>
            </div>
          );
        })()}

        {modalDivergencia && (() => {
          const saldo = saldoDoMaterial(modalDivergencia.codigoProduto);
          const qtd = Number(quantidadeUtilizada.replace(",", "."));
          const diferenca = Number.isFinite(qtd) ? qtd - modalDivergencia.esperado : 0;
          const acimaEstoque = Number.isFinite(qtd) && qtd > (saldo?.quantidade ?? 0);

          return (
            <div style={receiptOverlayStyle} onMouseDown={() => setModalDivergencia(null)}>
              <div style={receiptModalStyle} onMouseDown={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <b style={{ fontSize: 15 }}>Registrar divergência</b>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>
                      {modalDivergencia.codigoProduto} • {modalDivergencia.produto}
                    </div>
                  </div>
                  <button type="button" onClick={() => setModalDivergencia(null)} style={receiptCloseStyle}>×</button>
                </div>

                <div style={divergenceMetricsStyle}>
                  <ResumoOS titulo="Previsto" valor={`${modalDivergencia.esperado} ${modalDivergencia.unidade}`} />
                  <ResumoOS titulo="Estoque" valor={`${saldo?.quantidade ?? 0} ${saldo?.unidade ?? modalDivergencia.unidade}`} />
                </div>

                <CampoOS titulo="QUANTIDADE REAL UTILIZADA" />
                <div style={divergenceQuantityRowStyle}>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={quantidadeUtilizada}
                    onChange={(e) => setQuantidadeUtilizada(e.target.value)}
                    style={divergenceQuantityInputStyle}
                  />
                  <span style={divergenceUnitStyle}>{modalDivergencia.unidade}</span>
                </div>

                {Number.isFinite(qtd) && (
                  <div style={{
                    ...divergenceDifferenceStyle,
                    color: acimaEstoque ? "#b42318" : diferenca > 0 ? "#9a6700" : diferenca < 0 ? "#087da7" : "#07864c",
                    background: acimaEstoque ? "#fff0ee" : "#f8fafc",
                  }}>
                    {acimaEstoque
                      ? `Estoque insuficiente. Disponível: ${saldo?.quantidade ?? 0} ${modalDivergencia.unidade}.`
                      : diferenca > 0
                        ? `Uso ${diferenca} ${modalDivergencia.unidade} acima do previsto.`
                        : diferenca < 0
                          ? `Uso ${Math.abs(diferenca)} ${modalDivergencia.unidade} abaixo do previsto.`
                          : "Quantidade igual ao previsto. Use divergência somente se houver outro motivo."}
                  </div>
                )}

                <CampoOS titulo="MOTIVO DA DIVERGÊNCIA" />
                <OpcaoOS ativo={tipoDivergencia === "QUANTIDADE_DIVERGENTE"} titulo="Quantidade diferente do previsto" descricao="Foi utilizado mais ou menos material do que o solicitado na OS." onClick={() => setTipoDivergencia("QUANTIDADE_DIVERGENTE")} />
                <OpcaoOS ativo={tipoDivergencia === "MATERIAL_INDISPONIVEL"} titulo="Material indisponível" descricao="O material previsto não estava disponível para utilização." onClick={() => setTipoDivergencia("MATERIAL_INDISPONIVEL")} />
                <OpcaoOS ativo={tipoDivergencia === "SERIAL_DIVERGENTE"} titulo="Serial divergente" descricao="O serial utilizado é diferente do serial previsto." onClick={() => setTipoDivergencia("SERIAL_DIVERGENTE")} />
                <OpcaoOS ativo={tipoDivergencia === "MATERIAL_DIFERENTE"} titulo="Material diferente" descricao="Foi necessário utilizar outro material durante o atendimento." onClick={() => setTipoDivergencia("MATERIAL_DIFERENTE")} />
                <OpcaoOS ativo={tipoDivergencia === "MATERIAL_AVARIADO"} titulo="Material avariado" descricao="O material apresentou avaria e não pôde ser utilizado normalmente." onClick={() => setTipoDivergencia("MATERIAL_AVARIADO")} />

                <CampoOS titulo="OBSERVAÇÃO / JUSTIFICATIVA" />
                <textarea
                  value={observacaoDivergencia}
                  onChange={(e) => setObservacaoDivergencia(e.target.value)}
                  placeholder="Ex.: foram necessários 10 metros adicionais devido ao trajeto da instalação."
                  style={divergenceTextareaStyle}
                />

                <div style={divergenceModalActionsStyle}>
                  <button type="button" onClick={() => setModalDivergencia(null)} style={modalCancelButtonStyle}>CANCELAR</button>
                  <button type="button" onClick={salvarDivergencia} disabled={acimaEstoque} style={{ ...modalConfirmButtonStyle, ...(acimaEstoque ? premiumDisabledActionStyle : {}) }}>
                    REGISTRAR DIVERGÊNCIA
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* =================================================
            MODAL PADRÃO
        ================================================= */}

        {modalFinalizar && (
          <div
            style={modalOverlayStyle}
            onMouseDown={
              cancelarFinalizacao
            }
          >
            <div
              style={modalStyle}
              onMouseDown={(e) =>
                e.stopPropagation()
              }
            >
              <div style={modalHeaderStyle}>
                <div style={modalIconStyle}>
                  ✓
                </div>

                <div style={modalHeaderTextStyle}>
                  <strong>
                    {ordem.tipo === "RETIRADA"
                      ? "Finalizar Retirada"
                      : "Finalizar Ordem de Serviço"}
                  </strong>

                  <span>
                    {ordem.codigo}
                  </span>
                </div>
              </div>

              <div style={modalBodyStyle}>
                <div style={modalMessageStyle}>
                  {ordem.tipo === "RETIRADA"
                    ? "Confirma a retirada do patrimônio deste cliente?"
                    : "Confirma a finalização desta Ordem de Serviço?"}
                </div>

                <div style={modalIndicatorsStyle}>
                  <div style={modalIndicatorStyle}>
                    <span>
                      SKUs
                    </span>

                    <strong>
                      {totalSkus}
                    </strong>
                  </div>

                  <div style={modalIndicatorStyle}>
                    <span>
                      ITENS
                    </span>

                    <strong>
                      {totalQuantidade}
                    </strong>
                  </div>

                  <div style={modalIndicatorStyle}>
                    <span>
                      TÉCNICO
                    </span>

                    <strong style={modalTechnicianStyle}>
                      {ordem.codigoTecnico}
                    </strong>
                  </div>
                </div>

                <div style={modalWarningStyle}>
                  <strong>
                    Atenção
                  </strong>

                  <span>
                    {ordem.tipo === "RETIRADA"
                      ? "O patrimônio será marcado como RETIRADO e retornará ao estoque móvel do técnico."
                      : "Os materiais serão baixados do estoque móvel do técnico após a finalização."}
                  </span>
                </div>

                <div style={modalButtonsStyle}>
                  <button
                    type="button"
                    style={modalCancelButtonStyle}
                    onClick={
                      cancelarFinalizacao
                    }
                    disabled={
                      finalizando
                    }
                  >
                    CANCELAR
                  </button>

                  <button
                    type="button"
                    style={modalConfirmButtonStyle}
                    onClick={
                      confirmarFinalizacao
                    }
                    disabled={
                      finalizando
                    }
                  >
                    {finalizando
                      ? "FINALIZANDO..."
                      : "FINALIZAR"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResumoOS({ titulo, valor }: { titulo: string; valor: string }) {
  return <div style={receiptSummaryItemStyle}><span style={{display:"block",fontSize:8,color:"#64748b",fontWeight:800}}>{titulo.toUpperCase()}</span><b style={{fontSize:14}}>{valor}</b></div>;
}

function CampoOS({ titulo }: { titulo: string }) {
  return <div style={{marginTop:13,marginBottom:5,fontSize:9,fontWeight:900}}>{titulo}</div>;
}

function OpcaoOS({ ativo, titulo, descricao, onClick }: { ativo: boolean; titulo: string; descricao: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{width:"100%",textAlign:"left",padding:10,marginBottom:7,borderRadius:7,border:ativo?"2px solid #087da7":"1px solid #cbd5e1",background:ativo?"#edf8fc":"#fff"}}><b style={{fontSize:10,color:"#111827"}}>{ativo?"● ":"○ "}{titulo}</b><div style={{fontSize:9,color:"#64748b",marginTop:4,lineHeight:1.35}}>{descricao}</div></button>;
}

/* =========================================================
   ESTILOS
========================================================= */

const phoneStyle: CSSProperties = {
  height: "100%",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "#f4f4f4",
  position: "relative",
};

const headerStyle: CSSProperties = {
  height: 74,
  flex: "0 0 74px",
  background: "#2093b7",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  padding: "0 14px 0 10px",
  boxSizing: "border-box",
};

const backButtonStyle: CSSProperties = {
  width: 32,
  height: 44,
  border: 0,
  background: "transparent",
  color: "#fff",
  fontSize: 38,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  marginRight: 5,
};

const headerInfoStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  color: "#fff",
  fontSize: 9,
  fontWeight: 700,
  lineHeight: 1.1,
  textTransform: "uppercase",
};

const headerCodigoStyle: CSSProperties = {
  fontSize: 21,
  lineHeight: 1.05,
  marginBottom: 3,
  color: "#fff",
};

const menuButtonStyle: CSSProperties = {
  width: 32,
  height: 40,
  border: 0,
  background: "transparent",
  color: "#fff",
  fontSize: 28,
  fontWeight: 700,
  cursor: "pointer",
};

const scrollStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  padding: "8px 8px 0",
  WebkitOverflowScrolling: "touch",
};

const boxStyle: CSSProperties = {
  background: "#fff",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#1499c7",
  borderRadius: 15,
  padding: "12px 16px 16px",
  marginBottom: 10,
};

const boxHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
};

const boxTitleStyle: CSSProperties = {
  color: "#007ba5",
  fontSize: 14,
  fontWeight: 800,
};

const circleIconStyle: CSSProperties = {
  width: 43,
  height: 43,
  borderRadius: "50%",
  background: "#1595ba",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontSize: 18,
  fontWeight: 700,
};

const statusMessageStyle: CSSProperties = {
  background: "#e7f6fb",
  color: "#007ba5",
  borderRadius: 7,
  padding: "9px 10px",
  marginBottom: 10,
  fontSize: 12,
  fontWeight: 700,
};

const indicatorsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 6,
  marginBottom: 14,
};

const indicatorStyle: CSSProperties = {
  minHeight: 62,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#d5dfe4",
  borderRadius: 6,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  color: "#111",
  fontSize: 11,
  textAlign: "center",
};

const subTitleStyle: CSSProperties = {
  color: "#000",
  fontSize: 11,
  fontWeight: 900,
  marginTop: 10,
  marginBottom: 7,
};

const clientCardStyle: CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#d8e1e5",
  borderRadius: 7,
  padding: "10px",
  marginBottom: 8,
};

const clientNameStyle: CSSProperties = {
  display: "block",
  color: "#007ba5",
  fontSize: 13,
  marginBottom: 7,
};

const dataRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "70px 1fr",
  gap: 4,
  fontSize: 10,
  color: "#5d6670",
  marginTop: 3,
};

const observationStyle: CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#d8e1e5",
  borderRadius: 7,
  padding: "10px",
  color: "#59636e",
  fontSize: 11,
};

const labelStyle: CSSProperties = {
  display: "block",
  color: "#000",
  fontSize: 10,
  fontWeight: 900,
  marginTop: 9,
  marginBottom: 4,
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: 39,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ccd9df",
  borderRadius: 6,
  background: "#fff",
  color: "#333",
  padding: "0 8px",
  fontSize: 11,
  boxSizing: "border-box",
};

const stockInfoStyle: CSSProperties = {
  marginTop: 7,
  background: "#e7f6fb",
  borderRadius: 6,
  padding: "8px 9px",
  display: "flex",
  justifyContent: "space-between",
  color: "#007ba5",
  fontSize: 10,
};

const twoColumnsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const serialContainerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const serialStyle: CSSProperties = {
  minHeight: 36,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ccd9df",
  borderRadius: 6,
  background: "#fff",
  color: "#4f5962",
  textAlign: "left",
  padding: "6px 9px",
  fontSize: 10,
  cursor: "pointer",
};

const serialSelectedStyle: CSSProperties = {
  borderColor: "#1595ba",
  background: "#e7f6fb",
  color: "#007ba5",
  fontWeight: 800,
};

const addMaterialStyle: CSSProperties = {
  width: "100%",
  height: 40,
  marginTop: 10,
  border: 0,
  borderRadius: 4,
  background: "#1595ba",
  color: "#fff",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};

const productCardStyle: CSSProperties = {
  position: "relative",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#d5dfe4",
  borderRadius: 7,
  padding: "10px",
  marginBottom: 7,
  background: "#fff",
};

const productTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
};

const productCodeStyle: CSSProperties = {
  color: "#111",
  fontSize: 11,
};

const productNameStyle: CSSProperties = {
  color: "#59636e",
  fontSize: 9,
  marginTop: 2,
  textTransform: "uppercase",
};

const productNumbersStyle: CSSProperties = {
  textAlign: "right",
  color: "#111",
  fontSize: 8,
  lineHeight: 1.2,
};

const destinationLineStyle: CSSProperties = {
  marginTop: 8,
  color: "#00994c",
  fontSize: 10,
  fontWeight: 900,
};

const productSerialStyle: CSSProperties = {
  marginTop: 5,
  color: "#59636e",
  fontSize: 9,
};

const removeStyle: CSSProperties = {
  marginTop: 8,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ff5b65",
  borderRadius: 4,
  background: "#fff",
  color: "#e74751",
  padding: "4px 8px",
  fontSize: 9,
  fontWeight: 800,
  cursor: "pointer",
};

const emptyMaterialStyle: CSSProperties = {
  minHeight: 54,
  display: "grid",
  placeItems: "center",
  color: "#7c8792",
  fontSize: 10,
  textAlign: "center",
};

const plannedButtonsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 6,
  marginTop: 9,
};

const plannedOkButtonStyle: CSSProperties = {
  minHeight: 38,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#1595ba",
  borderRadius: 5,
  background: "#fff",
  color: "#007ba5",
  fontSize: 9,
  fontWeight: 900,
  cursor: "pointer",
};

const plannedDivergenceButtonStyle: CSSProperties = {
  minHeight: 38,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#e4a338",
  borderRadius: 5,
  background: "#fff",
  color: "#b66f00",
  fontSize: 9,
  fontWeight: 900,
  cursor: "pointer",
};

const plannedActiveButtonStyle: CSSProperties = {
  background: "#1595ba",
  color: "#fff",
};

const plannedDivergenceActiveStyle: CSSProperties = {
  background: "#e4a338",
  color: "#fff",
};

const plannedOkCardStyle: CSSProperties = {
  borderColor: "#1595ba",
  background: "#f1fbfe",
};

const plannedDivergenceCardStyle: CSSProperties = {
  borderColor: "#e4a338",
  background: "#fffaf0",
};

const plannedStatusStyle: CSSProperties = {
  marginTop: 7,
  color: "#59636e",
  fontSize: 9,
};

const plannedObservationStyle: CSSProperties = {
  width: "100%",
  minHeight: 54,
  marginTop: 7,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ccd9df",
  borderRadius: 6,
  padding: 8,
  boxSizing: "border-box",
  resize: "vertical",
  fontSize: 10,
  fontFamily: "inherit",
};

const plannedObservationSavedStyle: CSSProperties = {
  marginTop: 7,
  padding: "7px 8px",
  borderRadius: 5,
  background: "#fff1d6",
  color: "#8b5a00",
  fontSize: 9,
  fontWeight: 700,
};

const plannedSummaryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 5,
  marginTop: 9,
  padding: "9px 7px",
  borderRadius: 6,
  background: "#e7f6fb",
  color: "#007ba5",
  fontSize: 9,
  textAlign: "center",
};

const receiptSectionStyle: CSSProperties = {background:"#fff",border:"1px solid #dbe4e9",borderRadius:10,marginBottom:10,overflow:"hidden",boxShadow:"0 2px 9px rgba(15,23,42,.045)"};
const receiptTitleStyle: CSSProperties = {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 11px 9px",color:"#087da7",fontSize:13,fontWeight:900};
const receiptInfoStyle: CSSProperties = {margin:"0 11px 10px",padding:"8px 9px",borderRadius:7,background:"#f0f9fc",color:"#087da7",fontSize:9,fontWeight:700,lineHeight:1.35};
const receiptContentHeaderStyle: CSSProperties = {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 11px",background:"#edf8fc",color:"#087da7",fontSize:8,fontWeight:900};
const receiptProductStyle: CSSProperties = {padding:11,borderBottom:"1px solid #e5e7eb"};
const receiptProductTopStyle: CSSProperties = {display:"flex",justifyContent:"space-between",gap:10};
const receiptProductNameStyle: CSSProperties = {fontSize:12,color:"#111"};
const receiptProductCodeStyle: CSSProperties = {color:"#087da7",fontSize:10,fontWeight:800,marginTop:2};
const receiptExpectedStyle: CSSProperties = {textAlign:"right",fontSize:14,color:"#111"};
const receiptLabelStyle: CSSProperties = {display:"block",color:"#64748b",fontSize:9,fontWeight:800};
const receiptSerialBoxStyle: CSSProperties = {marginTop:8,padding:8,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:5};
const receiptResultStyle: CSSProperties = {marginTop:8,padding:7,borderRadius:5,fontSize:10,fontWeight:800,lineHeight:1.4};
const receiptButtonsStyle: CSSProperties = {display:"flex",gap:7,marginTop:9};
const receiptOkButtonStyle: CSSProperties = {flex:1,height:36,border:"1px solid #22a06b",borderRadius:5,background:"#eaf8f0",color:"#07864c",fontSize:10,fontWeight:900,cursor:"pointer"};
const receiptDivergenceButtonStyle: CSSProperties = {flex:1,height:36,border:"1px solid #e0a000",borderRadius:5,background:"#fff8df",color:"#9a6700",fontSize:10,fontWeight:900,cursor:"pointer"};
const receiptSummaryBoxStyle: CSSProperties = {margin:11,padding:12,border:"1px solid #d8e2e8",borderRadius:7,background:"#fff"};
const receiptSummaryItemStyle: CSSProperties = {padding:8,border:"1px solid #e2e8f0",borderRadius:5,textAlign:"center"};
const compactOsCardStyle: CSSProperties = {position:"relative",margin:"10px 10px 12px 10px",padding:"14px 14px 12px 15px",border:"1px solid #d9e5eb",borderLeft:"7px solid #159fc5",borderRadius:16,background:"linear-gradient(180deg,#ffffff 0%,#fcfeff 100%)",boxShadow:"0 3px 9px rgba(15,23,42,.055)",overflow:"hidden"};
const compactOsHeaderStyle: CSSProperties = {display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10};
const compactOsLabelStyle: CSSProperties = {fontSize:10,fontWeight:900,color:"#64748b",letterSpacing:.35,marginBottom:3};
const compactClientNameStyle: CSSProperties = {display:"block",fontSize:18,color:"#0f172a",fontWeight:900,lineHeight:1.12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:-.2};
const compactMetaStyle: CSSProperties = {fontSize:11,fontWeight:900,color:"#087da7",marginTop:5};
const compactStatusStyle: CSSProperties = {fontSize:9,fontWeight:900,color:"#07864c",background:"#eaf8f0",border:"1px solid #bfe5d2",padding:"6px 9px",borderRadius:999,whiteSpace:"nowrap",boxShadow:"0 2px 5px rgba(7,134,76,.08)"};
const compactAddressStyle: CSSProperties = {fontSize:9,color:"#475569",marginTop:7,paddingTop:6,borderTop:"1px solid #eef2f6"};
const compactObservationStyle: CSSProperties = {display:"flex",alignItems:"center",fontSize:10,color:"#64748b",marginTop:9,paddingTop:8,borderTop:"1px solid #edf2f5",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.3};
const inlineQuantityStyle: CSSProperties = {marginTop:9,padding:10,border:"1.5px solid #1595ba",borderRadius:7,background:"#f4fbfd"};
const inlineQuantityTopStyle: CSSProperties = {display:"grid",gridTemplateColumns:"1fr 1fr",gap:8};
const inlineQuantityValueStyle: CSSProperties = {display:"block",fontSize:13,color:"#111827",marginTop:2};
const inlineInputLabelStyle: CSSProperties = {fontSize:9,fontWeight:900,color:"#111827",marginTop:9,marginBottom:5};
const inlineInputRowStyle: CSSProperties = {display:"flex",alignItems:"stretch"};
const inlineQuantityInputStyle: CSSProperties = {width:"100%",height:40,border:"1px solid #9fc5d3",borderRight:0,borderRadius:"6px 0 0 6px",padding:"0 10px",fontSize:16,fontWeight:800,boxSizing:"border-box"};
const inlineUnitStyle: CSSProperties = {minWidth:48,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #9fc5d3",borderRadius:"0 6px 6px 0",background:"#fff",fontSize:11,fontWeight:900,color:"#087da7"};
const inlineDifferenceStyle: CSSProperties = {fontSize:9,fontWeight:800,marginTop:5};
const inlineActionsStyle: CSSProperties = {display:"grid",gridTemplateColumns:"0.8fr 1.2fr",gap:7,marginTop:9};
const inlineCancelButtonStyle: CSSProperties = {height:36,border:"1px solid #94a3b8",borderRadius:5,background:"#fff",color:"#475569",fontSize:9,fontWeight:900,cursor:"pointer"};
const inlineConfirmButtonStyle: CSSProperties = {height:36,border:0,borderRadius:5,background:"#1595ba",color:"#fff",fontSize:9,fontWeight:900,cursor:"pointer"};

const receiptOverlayStyle: CSSProperties = {position:"absolute",inset:0,zIndex:10000,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"flex-end"};
const receiptModalStyle: CSSProperties = {width:"100%",maxHeight:"84%",overflowY:"auto",background:"#fff",borderRadius:"16px 16px 0 0",padding:16,boxSizing:"border-box"};
const receiptCloseStyle: CSSProperties = {border:0,background:"transparent",fontSize:24,cursor:"pointer"};
const receiptFieldStyle: CSSProperties = {width:"100%",minHeight:42,border:"1px solid #cbd5e1",borderRadius:6,background:"#fff",padding:"0 10px",fontSize:12,boxSizing:"border-box"};
const receiptSaveButtonStyle: CSSProperties = {width:"100%",height:46,marginTop:14,border:0,borderRadius:6,background:"#e39400",color:"#fff",fontWeight:900,cursor:"pointer"};

const metaDotStyle: CSSProperties = { color:"#94a3b8", margin:"0 5px" };
const compactDetailsGridStyle: CSSProperties = { display:"grid", gridTemplateColumns:"1fr", gap:7, marginTop:10, paddingTop:9, borderTop:"1px solid #e8eef2" };
const compactDetailStyle: CSSProperties = { display:"flex", alignItems:"flex-start", gap:9, minWidth:0 };
const compactDetailIconStyle: CSSProperties = { width:20, height:20, borderRadius:7, background:"#e8f6fb", color:"#087da7", display:"grid", placeItems:"center", fontSize:10, fontWeight:900, flex:"0 0 20px",boxShadow:"inset 0 0 0 1px rgba(8,125,167,.04)" };
const compactDetailLabelStyle: CSSProperties = { display:"block", fontSize:9, color:"#8391a2", fontWeight:900, lineHeight:1,letterSpacing:.25 };
const compactDetailValueStyle: CSSProperties = { display:"block", marginTop:3, fontSize:11, color:"#3f4d5e", lineHeight:1.3, fontWeight:800 };
const compactObservationLabelStyle: CSSProperties = { flex:"0 0 auto", fontSize:9, fontWeight:900, color:"#087da7", background:"#e8f6fb", borderRadius:6, padding:"3px 7px", marginRight:7 };
const sectionEyebrowStyle: CSSProperties = { display:"block", fontSize:7, letterSpacing:.8, color:"#94a3b8", fontWeight:900, marginBottom:2 };
const sectionTitleTextStyle: CSSProperties = { display:"block", fontSize:14, color:"#087da7", fontWeight:900 };
const sectionCountStyle: CSSProperties = { minWidth:28, height:28, padding:"0 7px", borderRadius:14, background:"#e8f6fb", color:"#087da7", display:"grid", placeItems:"center", fontSize:11, fontWeight:900 };
const emptyPlannedCardStyle: CSSProperties = { display:"flex", gap:10, margin:11, padding:12, border:"1px dashed #cbd5e1", borderRadius:10, background:"#f8fafc" };
const emptyPlannedIconStyle: CSSProperties = { width:28, height:28, flex:"0 0 28px", borderRadius:8, background:"#fff3cd", color:"#a16207", display:"grid", placeItems:"center", fontSize:15, fontWeight:900 };
const emptyPlannedTitleStyle: CSSProperties = { display:"block", color:"#334155", fontSize:11 };
const emptyPlannedTextStyle: CSSProperties = { color:"#64748b", fontSize:9, lineHeight:1.4, marginTop:4 };
const emptyPlannedHintStyle: CSSProperties = { color:"#9a6700", fontSize:9, fontWeight:800, lineHeight:1.35, marginTop:7 };
const premiumMaterialCardStyle: CSSProperties = { position:"relative", margin:"8px 9px", padding:"11px 11px 10px", border:"1px solid #dbe4e9", borderRadius:10, background:"#fff", boxShadow:"0 2px 8px rgba(15,23,42,.045)", overflow:"hidden" };
const premiumMaterialDisabledStyle: CSSProperties = { background:"#f6f7f8", borderColor:"#e2e5e8" };
const premiumMaterialOkStyle: CSSProperties = { borderColor:"#a7dfc4", background:"#fbfefc" };
const premiumMaterialWarningStyle: CSSProperties = { borderColor:"#f0cc7b", background:"#fffdf8" };
const materialCardAccentStyle: CSSProperties = { position:"absolute", left:0, top:0, bottom:0, width:3, background:"#1595ba" };
const materialCodePillStyle: CSSProperties = { display:"inline-block", marginBottom:5, padding:"3px 6px", borderRadius:4, background:"#edf8fc", color:"#087da7", fontSize:8, fontWeight:900, letterSpacing:.25 };
const materialExpectedBadgeStyle: CSSProperties = { minWidth:70, textAlign:"right", padding:"5px 7px", borderRadius:7, background:"#f8fafc", border:"1px solid #edf2f5", fontSize:13, color:"#111827" };
const materialStockRowStyle: CSSProperties = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:9 };
const materialStockCellStyle: CSSProperties = { padding:"7px 8px", borderRadius:7, background:"#f8fafc", border:"1px solid #edf2f5" };
const materialMetricLabelStyle: CSSProperties = { display:"block", fontSize:7, color:"#94a3b8", fontWeight:900, marginBottom:2 };
const materialMetricValueStyle: CSSProperties = { display:"block", fontSize:10, fontWeight:900 };
const stockBlockedNoticeStyle: CSSProperties = { display:"flex", gap:8, alignItems:"flex-start", marginTop:9, padding:"8px 9px", borderRadius:7, background:"#f1f3f5", color:"#64748b", fontSize:9, lineHeight:1.35 };
const stockBlockedIconStyle: CSSProperties = { width:18, height:18, flex:"0 0 18px", borderRadius:9, background:"#dfe3e7", color:"#64748b", display:"grid", placeItems:"center", fontWeight:900 };
const stockPartialNoticeStyle: CSSProperties = { display:"flex", flexDirection:"column", gap:2, marginTop:9, padding:"8px 9px", borderRadius:7, background:"#fff7df", color:"#9a6700", fontSize:9, lineHeight:1.35 };
const premiumPrimaryActionStyle: CSSProperties = { flex:1, minHeight:38, border:"1px solid #22a06b", borderRadius:7, background:"#eaf8f0", color:"#07864c", fontSize:9, fontWeight:900, cursor:"pointer", padding:"0 7px" };
const premiumSecondaryActionStyle: CSSProperties = { flex:1, minHeight:38, border:"1px solid #1595ba", borderRadius:7, background:"#fff", color:"#087da7", fontSize:9, fontWeight:900, cursor:"pointer", padding:"0 7px" };
const premiumDisabledActionStyle: CSSProperties = { borderColor:"#d7dce0", background:"#eceff1", color:"#9aa3aa", cursor:"not-allowed", opacity:.8 };

const quantityExecutionBoxStyle: CSSProperties = { marginTop:10, padding:10, borderRadius:9, background:"#f8fbfc", border:"1px solid #dce8ed" };
const quantityExecutionHeaderStyle: CSSProperties = { display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:8 };
const quantityExecutionHintStyle: CSSProperties = { marginTop:3, fontSize:8.5, color:"#64748b", lineHeight:1.3 };
const quantityReferenceStyle: CSSProperties = { flex:"0 0 auto", padding:"5px 7px", borderRadius:6, background:"#edf8fc", color:"#087da7", fontSize:8, whiteSpace:"nowrap" };
const quantityInputMainRowStyle: CSSProperties = { display:"grid", gridTemplateColumns:"minmax(0,1fr) 1.15fr", gap:7, alignItems:"stretch" };
const quantityInputShellStyle: CSSProperties = { display:"flex", alignItems:"stretch", minWidth:0, height:42, border:"1.5px solid #1595ba", borderRadius:7, overflow:"hidden", background:"#fff" };
const quantityExposedInputStyle: CSSProperties = { width:"100%", minWidth:0, border:0, outline:"none", padding:"0 9px", background:"#fff", color:"#111827", fontSize:16, fontWeight:900, boxSizing:"border-box" };
const quantityExposedInputDisabledStyle: CSSProperties = { background:"#eef1f3", color:"#9aa3aa" };
const quantityExposedUnitStyle: CSSProperties = { minWidth:38, padding:"0 8px", display:"grid", placeItems:"center", background:"#edf8fc", color:"#087da7", fontSize:10, fontWeight:900 };
const quantityConfirmActionStyle: CSSProperties = { minHeight:42, border:0, borderRadius:7, background:"#1595ba", color:"#fff", fontSize:9, fontWeight:900, cursor:"pointer", padding:"0 8px" };
const quantityLiveFeedbackStyle: CSSProperties = { marginTop:6, minHeight:15, fontSize:8.5, fontWeight:800, lineHeight:1.3 };
const divergenceActionStyle: CSSProperties = { width:"100%", minHeight:34, marginTop:7, border:"1px solid #e0a11b", borderRadius:7, background:"#fffaf0", color:"#9a6700", fontSize:8.5, fontWeight:900, cursor:"pointer" };
const divergenceMetricsStyle: CSSProperties = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:14 };
const divergenceQuantityRowStyle: CSSProperties = { height:44, display:"flex", border:"1.5px solid #1595ba", borderRadius:7, overflow:"hidden" };
const divergenceQuantityInputStyle: CSSProperties = { flex:1, minWidth:0, border:0, outline:"none", padding:"0 10px", fontSize:17, fontWeight:900, color:"#111827" };
const divergenceUnitStyle: CSSProperties = { minWidth:46, display:"grid", placeItems:"center", background:"#edf8fc", color:"#087da7", fontSize:11, fontWeight:900 };
const divergenceDifferenceStyle: CSSProperties = { marginTop:7, padding:"8px 9px", borderRadius:7, fontSize:9, fontWeight:800, lineHeight:1.35 };
const divergenceTextareaStyle: CSSProperties = { width:"100%", minHeight:72, resize:"vertical", border:"1px solid #cbd5e1", borderRadius:7, padding:9, boxSizing:"border-box", fontFamily:"inherit", fontSize:10, color:"#334155", outline:"none" };
const divergenceModalActionsStyle: CSSProperties = { display:"grid", gridTemplateColumns:"1fr 1.25fr", gap:8, marginTop:14 };

const errorStyle: CSSProperties = {
  background: "#ffe9eb",
  color: "#c83e48",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ffb8bd",
  borderRadius: 7,
  padding: "10px",
  marginBottom: 10,
  fontSize: 11,
  fontWeight: 700,
};

const footerStyle: CSSProperties = {
  flex: "0 0 auto",
  padding: "14px 8px",
  background: "#fff",
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "#e1e5e8",
};

const footerButtonStyle: CSSProperties = {
  width: "100%",
  height: 49,
  border: 0,
  background: "#1595ba",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const emptyPageStyle: CSSProperties = {
  flex: 1,
  display: "grid",
  placeItems: "center",
  color: "#7c8792",
  fontSize: 12,
};

/* =========================================================
   MODAL
========================================================= */

const modalOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 9999,
  background: "rgba(0, 0, 0, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  boxSizing: "border-box",
};

const modalStyle: CSSProperties = {
  width: "100%",
  maxWidth: 360,
  background: "#fff",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#1499c7",
  borderRadius: 15,
  overflow: "hidden",
  boxShadow: "0 10px 30px rgba(0,0,0,.30)",
};

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  padding: "14px 16px",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "#dce5e9",
};

const modalIconStyle: CSSProperties = {
  width: 40,
  height: 40,
  flex: "0 0 40px",
  borderRadius: "50%",
  background: "#1595ba",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontSize: 20,
  fontWeight: 900,
};

const modalHeaderTextStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  color: "#007ba5",
  fontSize: 14,
};

const modalBodyStyle: CSSProperties = {
  padding: 16,
};

const modalMessageStyle: CSSProperties = {
  color: "#333",
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 12,
};

const modalIndicatorsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 6,
  marginBottom: 12,
};

const modalIndicatorStyle: CSSProperties = {
  minHeight: 58,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#d5dfe4",
  borderRadius: 6,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 3,
  color: "#59636e",
  fontSize: 9,
  textAlign: "center",
};

const modalTechnicianStyle: CSSProperties = {
  fontSize: 11,
  color: "#007ba5",
};

const modalWarningStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  background: "#e7f6fb",
  color: "#007ba5",
  borderRadius: 7,
  padding: "10px",
  marginBottom: 14,
  fontSize: 10,
  lineHeight: 1.35,
};

const modalButtonsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const modalCancelButtonStyle: CSSProperties = {
  height: 42,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#1595ba",
  borderRadius: 4,
  background: "#fff",
  color: "#1595ba",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};

const modalConfirmButtonStyle: CSSProperties = {
  height: 42,
  border: 0,
  borderRadius: 4,
  background: "#1595ba",
  color: "#fff",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};
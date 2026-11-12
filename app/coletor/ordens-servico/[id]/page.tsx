"use client";
import AtelOsAprAcaoUnicaV1583 from "@/components/atel-ui/AtelOsAprAcaoUnicaV1583";
import AtelOsChecklistsV158 from "@/components/atel-ui/AtelOsChecklistsV158"; // ATEL_E1_V158
import "./atel-v145-os-erp-header.css";

import { consultarDetalheErpV52, consultarEstoqueErpV52, type EstoqueErpV52, type DetalheErpV52 } from "@/lib/erpOperacionalV52";
import { useSearchParams } from "next/navigation";
import AtelOsEstadoERP from "@/components/atel-ui/AtelOsEstadoERP"; // ATEL_OS_ESTADOS_V142
import { atelSupabase } from "@/lib/atelSupabaseV08";

import {
  useEffect,
  useMemo,
  useRef,
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
  obterEstadoFSMOS,
  transicionarEstadoFSMOS,
  registrarOcorrenciaFSMOS,
  listarHistoricoFSMOS,
  type TipoOcorrenciaFSMOS,
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

/** Formatação de apresentação; datas persistidas continuam ISO (AAAA-MM-DD). */
function dataBR(valor?: string | null): string {
  if (!valor) return "—";
  const correspondencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return correspondencia ? `${correspondencia[3]}/${correspondencia[2]}/${correspondencia[1]}` : valor;
}

/** Normaliza também textos históricos gravados antes desta correção. */
function textoComDatasBR(valor?: string | null): string {
  return (valor ?? "").replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_trecho, ano, mes, dia) => `${dia}/${mes}/${ano}`);
}

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

function OrdemServicoDetalheLocal() {
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
  const [alertaBloqueioFSM, setAlertaBloqueioFSM] = useState<string | null>(null);
  const [modalOcorrenciaFSM, setModalOcorrenciaFSM] = useState(false);
  const [tipoOcorrenciaFSM, setTipoOcorrenciaFSM] = useState<TipoOcorrenciaFSMOS>("CLIENTE_AUSENTE");
  const [motivoOcorrenciaFSM, setMotivoOcorrenciaFSM] = useState("");
  const [dataOcorrenciaFSM, setDataOcorrenciaFSM] = useState("");
  const [reagendarFSM, setReagendarFSM] = useState(false);
  const [mostrarHistoricoFSM, setMostrarHistoricoFSM] = useState(false);
  const [modalAntecipacaoFSM, setModalAntecipacaoFSM] = useState(false);
  const [justificativaAntecipacaoFSM, setJustificativaAntecipacaoFSM] = useState("");


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

  /* FSM V03: etapas logísticas sem movimentação de estoque. */
  function executarEtapaFSM(destino: "EM_DESLOCAMENTO" | "NO_LOCAL") {
    if (!ordem) return;
    setErro("");
    try {
      transicionarEstadoFSMOS(ordem.id, destino);
      carregar();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Falha ao atualizar etapa da OS.";
      if (destino === "EM_DESLOCAMENTO" && obterEstadoFSMOS(ordem) === "PENDENTE_REAGENDAMENTO") {
        setAlertaBloqueioFSM(mensagem);
      } else {
        setErro(mensagem);
      }
    }
  }

  function solicitarRetomadaFSM() {
    if (!ordem) return;
    const estado = obterEstadoFSMOS(ordem);
    const prevista = ordem.agendamentoFSM?.novaData ?? ordem.dataPrevista;
    const agora = new Date();
    const hoje = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,"0")}-${String(agora.getDate()).padStart(2,"0")}`;
    if (estado === "PENDENTE_REAGENDAMENTO" && /^\d{4}-\d{2}-\d{2}$/.test(prevista) && prevista > hoje) {
      setErro("");
      setJustificativaAntecipacaoFSM("");
      setModalAntecipacaoFSM(true);
      return;
    }
    executarEtapaFSM("EM_DESLOCAMENTO");
  }

  function confirmarAntecipacaoFSM() {
    if (!ordem) return;
    const justificativa = justificativaAntecipacaoFSM.trim();
    if (justificativa.length < 10) { setErro("Informe justificativa com pelo menos 10 caracteres."); return; }
    try {
      transicionarEstadoFSMOS(ordem.id, "EM_DESLOCAMENTO", { justificativaAntecipacao: justificativa });
      setModalAntecipacaoFSM(false);
      setJustificativaAntecipacaoFSM("");
      setErro("");
      carregar();
    } catch (error) { setErro(error instanceof Error ? error.message : "Falha ao antecipar atendimento."); }
  }

  function confirmarOcorrenciaFSM() {
    if (!ordem) return;
    setErro("");
    try {
      registrarOcorrenciaFSMOS(ordem.id, {
        tipo: tipoOcorrenciaFSM,
        motivo: motivoOcorrenciaFSM,
        ...(reagendarFSM ? { novaData: dataOcorrenciaFSM } : {}),
      });
      setModalOcorrenciaFSM(false);
      setMotivoOcorrenciaFSM("");
      setDataOcorrenciaFSM("");
      carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao registrar ocorrência.");
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
                {statusNome(obterEstadoFSMOS(ordem))}
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

        {/* FSM V05: histórico operacional, somente leitura. */}
        <section style={{margin: "12px 10px", padding: 12, background: "#fff", border: "1px solid #dbe6ec", borderRadius: 10}}>
          <button type="button" onClick={() => setMostrarHistoricoFSM(!mostrarHistoricoFSM)} style={{width:"100%",background:"#eff8fb",border:"1px solid #cce8f0",borderRadius:7,padding:12,color:"#087da7",fontWeight:800,cursor:"pointer"}}>
            {mostrarHistoricoFSM ? "OCULTAR HISTÓRICO" : "VER HISTÓRICO DA OS"} ({ordem.historicoFSM?.length ?? 0})
          </button>
          {mostrarHistoricoFSM && (
            <div style={{marginTop:10,display:"grid",gap:8}}>
              {listarHistoricoFSMOS(ordem.id).length === 0 && <div style={{fontSize:12}}>Sem eventos FSM registrados.</div>}
              {listarHistoricoFSMOS(ordem.id).map(evento => (
                <div key={evento.id} style={{padding:10,border:"1px solid #e3edf2",borderRadius:6,fontSize:11}}>
                  <b>{evento.estadoAnterior.replaceAll("_"," ")} → {evento.estadoNovo.replaceAll("_"," ")}</b>
                  <div>{new Date(evento.ocorridoEm).toLocaleString("pt-BR")} · {evento.tecnico}</div>
                  {evento.tipoOcorrencia && <div>Ocorrência: {evento.tipoOcorrencia.replaceAll("_"," ")}</div>}
                  {evento.motivo && <div>Motivo: {textoComDatasBR(evento.motivo)}</div>}
                  {evento.novaData && <div>Nova data: {dataBR(evento.novaData)}</div>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* =================================================
            RODAPÉ
        ================================================= */}

        <div style={footerStyle}>
          {(["EM_DESLOCAMENTO", "NO_LOCAL", "EM_ATENDIMENTO"].includes(obterEstadoFSMOS(ordem))) && (
            <button type="button" style={{...footerButtonStyle,background:"#b7791f",marginBottom:8}} onClick={() => {setErro("");setModalOcorrenciaFSM(true);}}>
              REGISTRAR OCORRÊNCIA / REAGENDAR
            </button>
          )}
          {(["PENDENTE_REAGENDAMENTO", "PENDENTE_TRATATIVA"].includes(obterEstadoFSMOS(ordem))) && (
            <div style={{display:"grid",gap:8}}>
              <div style={{padding:10,background:"#fff7e6",color:"#8b5c10",fontSize:12,fontWeight:700,textAlign:"center"}}>
                OS aguardando tratativa {ordem.agendamentoFSM?.novaData ? `· Nova data: ${dataBR(ordem.agendamentoFSM.novaData)}` : ""}
              </div>
              <button type="button" style={footerButtonStyle} onClick={solicitarRetomadaFSM}>
                RETOMAR DESLOCAMENTO
              </button>
            </div>
          )}
          {ordem.status === "PENDENTE" && obterEstadoFSMOS(ordem) === "PENDENTE" && (
            <button type="button" style={footerButtonStyle}
              onClick={() => executarEtapaFSM("EM_DESLOCAMENTO")}>
              INICIAR DESLOCAMENTO
            </button>
          )}

          {ordem.status === "PENDENTE" && obterEstadoFSMOS(ordem) === "EM_DESLOCAMENTO" && (
            <button type="button" style={footerButtonStyle}
              onClick={() => executarEtapaFSM("NO_LOCAL")}>
              CHEGUEI AO CLIENTE
            </button>
          )}

          {ordem.status === "PENDENTE" && obterEstadoFSMOS(ordem) === "NO_LOCAL" && (
            <div style={{fontSize: 12, marginBottom: 8, textAlign: "center", color: "#167c83", fontWeight: 700}}>
              Chegada registrada. Atendimento disponível após validação de materiais.
            </div>
          )}

          {ordem.status === "PENDENTE" && obterEstadoFSMOS(ordem) === "NO_LOCAL" && (() => {
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

        {alertaBloqueioFSM && (
          <div style={{...receiptOverlayStyle, alignItems:"center", justifyContent:"center", padding:16, boxSizing:"border-box"}} role="presentation" onMouseDown={() => setAlertaBloqueioFSM(null)}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="fsm-bloqueio-titulo" aria-describedby="fsm-bloqueio-texto" style={{width:"100%",maxWidth:380,background:"#fff",borderRadius:14,padding:20,boxSizing:"border-box",boxShadow:"0 16px 48px rgba(0,0,0,.25)"}} onMouseDown={e => e.stopPropagation()}>
              <div id="fsm-bloqueio-titulo" style={{fontSize:17,fontWeight:900,color:"#a33327",marginBottom:12}}>Deslocamento não autorizado</div>
              <div id="fsm-bloqueio-texto" style={{fontSize:13,lineHeight:1.55,color:"#334155",marginBottom:18}}>{alertaBloqueioFSM}</div>
              <button type="button" autoFocus onClick={() => setAlertaBloqueioFSM(null)} style={{width:"100%",padding:13,border:0,borderRadius:8,background:"#1595ba",color:"#fff",fontWeight:900,cursor:"pointer"}}>ENTENDI</button>
            </div>
          </div>
        )}

        {modalAntecipacaoFSM && (
          <div style={{...modalOverlayStyle,zIndex:9999}} role="presentation">
            <div role="dialog" aria-modal="true" aria-label="Antecipar atendimento reagendado" style={{...modalStyle,maxWidth:410,padding:20}}>
              <h3 style={{margin:"0 0 12px",color:"#087da7"}}>Antecipar atendimento</h3>
              <p style={{fontSize:13,lineHeight:1.5}}>Esta OS está reagendada para <strong>{dataBR(ordem.agendamentoFSM?.novaData ?? ordem.dataPrevista)}</strong>. Para retomar antes dessa data, informe o motivo. A antecipação ficará registrada no histórico.</p>
              <label style={{display:"block",fontWeight:700,fontSize:12,marginBottom:6}}>Justificativa obrigatória (mínimo 10 caracteres)</label>
              <textarea value={justificativaAntecipacaoFSM} onChange={e => setJustificativaAntecipacaoFSM(e.target.value)} rows={4} maxLength={500} style={{width:"100%",boxSizing:"border-box",border:"1px solid #cbd5e1",borderRadius:8,padding:10,color:"#17253b"}} placeholder="Explique por que o atendimento será antecipado" />
              {erro && <p role="alert" style={{color:"#b91c1c",fontSize:12}}>{erro}</p>}
              <div style={{display:"flex",gap:8,marginTop:12}}>
                <button type="button" style={{...modalCancelButtonStyle,flex:1}} onClick={() => {setModalAntecipacaoFSM(false);setErro("");}}>CANCELAR</button>
                <button type="button" style={{...modalConfirmButtonStyle,flex:1}} disabled={justificativaAntecipacaoFSM.trim().length < 10} onClick={confirmarAntecipacaoFSM}>CONFIRMAR</button>
              </div>
            </div>
          </div>
        )}
        {modalOcorrenciaFSM && (
          <div style={receiptOverlayStyle} onMouseDown={() => setModalOcorrenciaFSM(false)}>
            <div style={receiptModalStyle} onMouseDown={(e) => e.stopPropagation()}>
              <div style={{fontSize:16,fontWeight:900,color:"#087da7",marginBottom:10}}>Ocorrência de atendimento</div>
              <div style={{fontSize:12,marginBottom:12}}>Registre a situação real do cliente. Nenhum material será baixado por esta ação.</div>
              <label style={{display:"block",fontSize:12,fontWeight:800,marginBottom:5}}>Tipo de ocorrência</label>
              <select value={tipoOcorrenciaFSM} onChange={e=>setTipoOcorrenciaFSM(e.target.value as TipoOcorrenciaFSMOS)} style={{width:"100%",padding:10,border:"1px solid #ccdce4",borderRadius:6,marginBottom:12}}>
                <option value="CLIENTE_AUSENTE">Cliente ausente</option>
                <option value="IMPEDIMENTO_TECNICO">Impedimento técnico</option>
                <option value="OUTRO">Outro impedimento</option>
              </select>
              <label style={{display:"block",fontSize:12,fontWeight:800,marginBottom:5}}>Justificativa obrigatória (mínimo 10 caracteres)</label>
              <textarea value={motivoOcorrenciaFSM} onChange={e=>setMotivoOcorrenciaFSM(e.target.value)} rows={3} style={{width:"100%",padding:10,border:"1px solid #ccdce4",borderRadius:6,marginBottom:12,boxSizing:"border-box"}} placeholder="Descreva a tentativa e o motivo" />
              <label style={{display:"flex",gap:8,alignItems:"center",fontSize:12,fontWeight:800,marginBottom:10}}>
                <input type="checkbox" checked={reagendarFSM} onChange={e=>setReagendarFSM(e.target.checked)} /> Reagendar atendimento
              </label>
              {reagendarFSM && <><label style={{display:"block",fontSize:12,fontWeight:800,marginBottom:5}}>Nova data</label><input type="date" value={dataOcorrenciaFSM} onChange={e=>setDataOcorrenciaFSM(e.target.value)} style={{width:"100%",padding:10,border:"1px solid #ccdce4",borderRadius:6,marginBottom:12,boxSizing:"border-box"}} /></>}
              {erro && <div style={{padding:8,color:"#b91c1c",fontSize:12}}>{erro}</div>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <button type="button" onClick={() => {setModalOcorrenciaFSM(false);setErro("");}} style={{padding:12,border:"1px solid #087da7",background:"white",color:"#087da7",borderRadius:6,fontWeight:800}}>CANCELAR</button>
                <button type="button" onClick={confirmarOcorrenciaFSM} style={{padding:12,border:0,background:"#1595ba",color:"white",borderRadius:6,fontWeight:800}}>REGISTRAR</button>
              </div>
            </div>
          </div>
        )}

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


type EtapaAtel = "PENDENTE"|"DESLOCAMENTO"|"NO_CLIENTE"|"ATENDIMENTO";
type ItemAtel = {cod_produto:number;produto:string;quantidade:number;patrimonio:number|null;mac:string|null};
type ApontamentoAtel = {itens:ItemAtel[];versao:number;atualizado_em:string|null};
type AndamentoAtel = {etapa:EtapaAtel;versao:number;atualizado_em:string|null};
async function apiAtel<T>(path:string, body?:object):Promise<T> {
 const sb=atelSupabase();
 if(!sb)throw new Error("Supabase não configurado.");
 const {data:{session}}=await sb.auth.getSession();
 if(!session?.access_token)throw new Error("Faça login novamente.");
 const res=await fetch(path,{method:body?"PUT":"GET",headers:{Authorization:`Bearer ${session.access_token}`,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store"});
 const data=await res.json() as T & {error?:string};
 if(!res.ok)throw new Error(data.error||"Falha ao consultar servidor");
 return data;
}
type HistoricoErpV525D4 = {id:string;tipo:"ETAPA"|"OCORRENCIA"|"RETOMADA";etapa_anterior:string;etapa_nova:string;tipo_ocorrencia:string|null;motivo:string|null;nova_data:string|null;versao:number;ocorrido_em:string};
type PendenciaErpV525D4 = {id:string;tipo:string;motivo:string;nova_data:string|null;criado_em:string;ativa:boolean};
type RespostaEventosErpV525D4 = {eventos:HistoricoErpV525D4[];pendencia:PendenciaErpV525D4|null};
type RetornoAcaoErpV525D4 = RespostaEventosErpV525D4 & {andamento:AndamentoAtel};
function dataBrAtel(data:string){const partes=data.split("-");return partes.length===3?`${partes[2]}/${partes[1]}/${partes[0]}`:data;}
function rotuloEtapaAtel(etapa:string){return ({PENDENTE:"Pendente",DESLOCAMENTO:"Deslocamento",NO_CLIENTE:"No cliente",ATENDIMENTO:"Atendimento",FINALIZADA:"Finalizada"} as Record<string,string>)[etapa]||etapa.replaceAll("_"," ");}
function rotuloOcorrenciaAtel(tipo:string){return ({CLIENTE_AUSENTE:"Cliente ausente",IMPEDIMENTO_TECNICO:"Impedimento técnico",OUTRO:"Outro impedimento"} as Record<string,string>)[tipo]||tipo;}
async function acaoOsEventoAtel<T>(body:Record<string,unknown>):Promise<T>{
 const sb=atelSupabase();if(!sb)throw new Error("Supabase não configurado.");
 const {data:{session}}=await sb.auth.getSession();if(!session?.access_token)throw new Error("Faça login novamente.");
 const response=await fetch("/api/os-eventos",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
 const payload=await response.json() as T & {error?:string};
 if(!response.ok)throw new Error(payload.error||"Não foi possível registrar a ação.");return payload;
}
function DetalheOrdemErpSomenteLeitura() {
 const params=useParams(),router=useRouter(),id=Number(params.id);
 const [detalhe,setDetalhe]=useState<DetalheErpV52|null>(null);
 const [estoqueErp,setEstoqueErp]=useState<EstoqueErpV52[]>([]);
 const [andamento,setAndamento]=useState<AndamentoAtel|null>(null);
 const [apontamento,setApontamento]=useState<ApontamentoAtel|null>(null);
 const [itens,setItens]=useState<ItemAtel[]>([]);
 const [produto,setProduto]=useState("");
 const [buscaMaterial,setBuscaMaterial]=useState("");
 const [quantidade,setQuantidade]=useState("1");
 const [edicaoMaterial,setEdicaoMaterial]=useState<string|null>(null);
 const [erro,setErro]=useState(""),[aviso,setAviso]=useState("");
 const [falhasConsultaErp,setFalhasConsultaErp]=useState<string[]>([]); // ATEL_E1_V143
 const [ocupado,setOcupado]=useState(false),[carregando,setCarregando]=useState(true),[alterado,setAlterado]=useState(false);
 const [tentativaERP,setTentativaERP]=useState(0);
 const [eventos,setEventos]=useState<HistoricoErpV525D4[]>([]);
 const [pendencia,setPendencia]=useState<PendenciaErpV525D4|null>(null);
 const [mostrarHistorico,setMostrarHistorico]=useState(false);
 const [modalOcorrencia,setModalOcorrencia]=useState(false);
 const [tipoOcorrencia,setTipoOcorrencia]=useState("CLIENTE_AUSENTE");
 const [motivoOcorrencia,setMotivoOcorrencia]=useState("");
 const [reagendar,setReagendar]=useState(false);
 const [novaData,setNovaData]=useState("");
 const [modalRetomar,setModalRetomar]=useState(false);
 const [justificativaRetomada,setJustificativaRetomada]=useState("");
 const [erroModal,setErroModal]=useState("");
 const [preflightAberto,setPreflightAberto]=useState(false);
 const [preflightCarregando,setPreflightCarregando]=useState(false);
 const [preflightErro,setPreflightErro]=useState("");
 const [preflightDados,setPreflightDados]=useState<{atendimento:number;etapa:string;total_itens:number;total_unidades:number;conferencias:{cod_produto:number;produto:string;quantidade:number;saldo_erp:number;valido:boolean}[];motivos:string[];finalizacao_liberada:boolean}|null>(null);
 async function conferirFinalizacao() {
  setPreflightAberto(true);setPreflightCarregando(true);setPreflightErro("");setPreflightDados(null);
  try { const resultado=await apiAtel<{atendimento:number;etapa:string;total_itens:number;total_unidades:number;conferencias:{cod_produto:number;produto:string;quantidade:number;saldo_erp:number;valido:boolean}[];motivos:string[];finalizacao_liberada:boolean}>(`/api/os-finalizacao/preflight?atendimento=${encodeURIComponent(String(id))}`);setPreflightDados(resultado); }
  catch(e){setPreflightErro(e instanceof Error?e.message:"Falha na pré-conferência");}
  finally{setPreflightCarregando(false);}
 }
 const obsRef=useRef<HTMLSpanElement|null>(null);
 const [obsTruncada,setObsTruncada]=useState(false);
 const [obsAberta,setObsAberta]=useState(false);
 useEffect(()=>{
  const el=obsRef.current;
  if(!el)return;
  const verificar=()=>setObsTruncada(el.scrollWidth>el.clientWidth+1);
  verificar();
  const observer=new ResizeObserver(verificar);
  observer.observe(el);
  return()=>observer.disconnect();
 },[detalhe?.Descricao]);

 useEffect(()=>{
  let ativo=true;
  setCarregando(true);setErro("");setDetalhe(null);setFalhasConsultaErp([]);
  Promise.allSettled([
   consultarDetalheErpV52(id),
   consultarEstoqueErpV52(),
   apiAtel<AndamentoAtel>(`/api/os-andamento?atendimento=${id}`),
   apiAtel<ApontamentoAtel>(`/api/os-materiais?atendimento=${id}`),
   apiAtel<RespostaEventosErpV525D4>(`/api/os-eventos?atendimento=${id}`)
  ]).then(([d,e,a,m,h])=>{
   if(!ativo)return;
   const mensagem=(r:PromiseRejectedResult)=>r.reason instanceof Error?r.reason.message:String(r.reason??"Falha desconhecida");
   if(d.status==='rejected'){
    setErro('Detalhe da OS indisponível: '+mensagem(d));
    setEstoqueErp([]);setAndamento(null);setApontamento(null);setItens([]);
    return;
   }
   setDetalhe(d.value);
   const pendencias:string[]=[];
   if(e.status==='fulfilled')setEstoqueErp(e.value);
   else {setEstoqueErp([]);pendencias.push('Estoque do técnico: '+mensagem(e));}
   if(a.status==='fulfilled')setAndamento(a.value);
   else {setAndamento(null);pendencias.push('Andamento da OS: '+mensagem(a));}
   if(m.status==='fulfilled'){setApontamento(m.value);setItens(m.value.itens);}
   else {setApontamento(null);setItens([]);pendencias.push('Materiais apontados: '+mensagem(m));}
   if(h.status==='fulfilled'){setEventos(h.value.eventos);setPendencia(h.value.pendencia);}
   else {setEventos([]);setPendencia(null);pendencias.push('Histórico de eventos: '+mensagem(h));}
   setFalhasConsultaErp(pendencias);
   setErro('');
  }).catch(e=>{if(ativo)setErro(e instanceof Error?e.message:'Falha de consulta');})
  .finally(()=>{if(ativo)setCarregando(false);});
  return()=>{ativo=false;};
 },[id,tentativaERP]);
 const contrato=detalhe?.Contrato as {Cliente?:{Nome?:string};IDContrato?:number}|undefined;
 const enderecos=detalhe?.Enderecos as Array<{Endereco?:string;Numero?:number;NomeBairro?:string;NomeCidade?:string;Estado?:string}>|undefined;
 const endereco=enderecos?.[0];
 const local=endereco?[endereco.Endereco,endereco.Numero,endereco.NomeBairro,endereco.NomeCidade,endereco.Estado].filter(v=>v!=null&&v!=="").join(", "):"Endereço não informado";
 const etapa=andamento?.etapa??"PENDENTE";
 const pendenciaAtiva=Boolean(pendencia?.ativa);
 const prox=etapa==="PENDENTE"?"DESLOCAMENTO":etapa==="DESLOCAMENTO"?"NO_CLIENTE":etapa==="NO_CLIENTE"?"ATENDIMENTO":null;
 const rotulo=etapa==="PENDENTE"?"INICIAR DESLOCAMENTO":etapa==="DESLOCAMENTO"?"CHEGUEI AO CLIENTE":etapa==="NO_CLIENTE"?"INICIAR ATENDIMENTO":"FINALIZAR OS";
 async function atualizarEventos(){
  const res=await apiAtel<RespostaEventosErpV525D4>(`/api/os-eventos?atendimento=${id}`);
  setEventos(res.eventos);setPendencia(res.pendencia);
 }
 async function registrarOcorrencia(){
  if(!andamento||ocupado)return;
  if(alterado){setErroModal("Salve os materiais alterados antes de registrar a ocorrência.");return;}
  const motivo=motivoOcorrencia.trim();
  if(motivo.length<10||motivo.length>2000){setErroModal("Informe justificativa de 10 a 2000 caracteres.");return;}
  if(reagendar&&!novaData){setErroModal("Informe a nova data de atendimento.");return;}
  setOcupado(true);setErroModal("");
  try{
   const retorno=await acaoOsEventoAtel<RetornoAcaoErpV525D4>({acao:"REGISTRAR",atendimento:id,versao:andamento.versao,tipo:tipoOcorrencia,motivo,novaData:reagendar?novaData:null});
   setAndamento(retorno.andamento);setEventos(retorno.eventos);setPendencia(retorno.pendencia);
   setModalOcorrencia(false);setMotivoOcorrencia("");setNovaData("");setReagendar(false);
   setAviso("Ocorrência registrada. Aguardando tratativa, sem baixa de estoque.");
  }catch(e){setErroModal(e instanceof Error?e.message:"Não foi possível registrar a ocorrência.");}
  finally{setOcupado(false);}
 }
 async function retomar(){
  if(!andamento||ocupado)return;
  setOcupado(true);setErroModal("");
  try{
   const retorno=await acaoOsEventoAtel<RetornoAcaoErpV525D4>({acao:"RETOMAR",atendimento:id,versao:andamento.versao,justificativa:justificativaRetomada});
   setAndamento(retorno.andamento);setEventos(retorno.eventos);setPendencia(retorno.pendencia);
   setModalRetomar(false);setJustificativaRetomada("");setAviso("Deslocamento retomado. Histórico atualizado.");
  }catch(e){setErroModal(e instanceof Error?e.message:"Não foi possível retomar o atendimento.");}
  finally{setOcupado(false);}
 }
 async function avancar(){
  if(!prox||!andamento||ocupado||pendenciaAtiva)return;
  setOcupado(true);setErro("");
  try{
   const a=await apiAtel<AndamentoAtel>("/api/os-andamento",{atendimento:id,versao:andamento.versao,etapa:prox});
   setAndamento(a);setAviso("Etapa registrada no Supabase.");
   if(prox==="NO_CLIENTE"){router.push(`/coletor/ordens-servico/${id}/apr?origem=erp`);return;}
   try { await atualizarEventos(); } catch { setAviso("Etapa registrada. Atualize a OS para consultar o histórico."); }
  }catch(e){setErro(e instanceof Error?e.message:"Falha na transição");}
  finally{setOcupado(false);}
 }
 const chave=(p:{cod_produto:number;patrimonio?:number|null;mac?:string|null})=>`${p.cod_produto}:${p.patrimonio??""}:${p.mac??""}`;
 function adicionar(){
  if(produto===""){setErro("Selecione um produto do estoque ERP.");return;}
  const p=estoqueErp[Number(produto)],q=Number(quantidade);
  if(!p||!Number.isFinite(q)||q<=0||q>p.quantidade){setErro("Produto ou quantidade inválida.");return;}
  const anterior=itens.find(i=>chave(i)===chave(p));
  if((edicaoMaterial===chave(p)?q:(anterior?.quantidade??0)+q)>p.quantidade){setErro("Quantidade superior ao saldo ERP.");return;}
  const item:ItemAtel={cod_produto:p.cod_produto,produto:p.produto,quantidade:edicaoMaterial===chave(p)?q:q+(anterior?.quantidade??0),patrimonio:p.patrimonio,mac:p.mac};
  setItens(anterior?itens.map(i=>chave(i)===chave(p)?item:i):[...itens,item]);setEdicaoMaterial(null);setProduto("");setBuscaMaterial("");setQuantidade("1");setAlterado(true);setErro("");setAviso("");
 }
 async function salvar(){
  if(!apontamento||ocupado)return;
  setOcupado(true);setErro("");
  try{
   const m=await apiAtel<ApontamentoAtel>("/api/os-materiais",{atendimento:id,versao:apontamento.versao,itens});
   setApontamento(m);setItens(m.itens);setAlterado(false);setAviso("Materiais salvos. Nenhuma baixa realizada.");
  }catch(e){setErro(e instanceof Error?e.message:"Falha ao salvar");}
  finally{setOcupado(false);}
 }
 const btn:CSSProperties={width:"100%",minHeight:47,border:0,borderRadius:4,fontSize:12,fontWeight:900,background:"#0d7897",color:"#fff",cursor:"pointer"};
 return <div className="collector-screen atel-v145-erp"><div className="collector-phone" style={phoneStyle}>
  <div style={headerStyle} className="atel-v145-erp-header">
   <button type="button" style={backButtonStyle} onClick={()=>router.push("/coletor/ordens-servico")}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></button>
   <div style={headerInfoStyle} className="atel-v145-erp-title"><span className="atel-v145-erp-eyebrow">ORDEM DE SERVIÇO · ERP</span><strong style={headerCodigoStyle}>OS nº {id}</strong><span>{String(detalhe?.NomeTecnicoVisita??"TÉCNICO ERP").toUpperCase()}</span><span>ERP · {String(detalhe?.IdTecnicoVisita??"—")}</span></div>
   <span className="atel-v145-erp-header-icon" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 10h6M9 14h3m1 3 1.5 1.5L18 15"/></svg></span>
  </div>
  <div style={scrollStyle} className="atel-os-v142-detail-area">
   {!detalhe && (carregando || erro) && <AtelOsEstadoERP carregando={carregando} erro={carregando ? undefined : erro} titulo={`OS nº ${id}`} onRetry={() => setTentativaERP(n => n + 1)} />}
   {detalhe && erro && <div role="alert" style={{padding:12,margin:10,background:"#fff0ed",color:"#a12424",borderRadius:8,fontSize:12}}>{erro}</div>}
   {detalhe && falhasConsultaErp.length>0 && <div className="atel-os-v143-partial" role="status">
    <strong>Algumas informações da OS não foram carregadas</strong>
    <div>Os dados disponíveis foram mantidos, mas não conclua operações que dependam das consultas pendentes.</div>
    <ul>{falhasConsultaErp.map((falha,indice)=><li key={indice}>{falha}</li>)}</ul>
    <button type="button" onClick={()=>setTentativaERP(n=>n+1)}>TENTAR CONSULTAR NOVAMENTE</button>
   </div>}
   {aviso&&<div role="status" style={{padding:12,margin:10,background:"#e8f8ee",color:"#087b43",borderRadius:8,fontSize:12}}>{aviso}</div>}
   {detalhe&&<>
    <section style={compactOsCardStyle}>
     <div style={compactOsHeaderStyle}><div style={{minWidth:0,flex:1}}><div style={compactOsLabelStyle}>ATENDIMENTO DA OS</div>
      <strong style={compactClientNameStyle}>{contrato?.Cliente?.Nome??"Cliente ERP"}</strong>
      <div style={compactMetaStyle}><span>Protocolo {String(detalhe.NumeroProtocolo??"—")}</span></div></div>
      <span style={compactStatusStyle}>{pendenciaAtiva?(pendencia?.nova_data?"REAGENDAMENTO":"AGUARDANDO TRATATIVA"):etapa.replaceAll("_"," ")}</span></div>
     <div style={compactDetailsGridStyle}>
      <div style={compactDetailStyle}><span style={compactDetailIconStyle}>⌖</span><div><span style={compactDetailLabelStyle}>LOCAL</span><b style={compactDetailValueStyle}>{local}</b></div></div>
      <div style={compactDetailStyle}><span style={compactDetailIconStyle}>●</span><div><span style={compactDetailLabelStyle}>TÉCNICO</span><b style={compactDetailValueStyle}>{String(detalhe.NomeTecnicoVisita??detalhe.IdTecnicoVisita)}</b></div></div>
     </div>
     {detalhe.Descricao!=null&&<div style={{...compactObservationStyle,gap:0,minWidth:0}}>
      <span style={compactObservationLabelStyle}>OBS</span>
      <span ref={obsRef} style={{minWidth:0,flex:"1 1 auto",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{String(detalhe.Descricao)}</span>
      {obsTruncada&&<button type="button" aria-label="Ver observação completa" title="Ver observação completa" onClick={()=>setObsAberta(true)} style={{flex:"0 0 auto",border:0,background:"transparent",color:"#0788ad",padding:"2px 4px",cursor:"pointer",display:"grid",placeItems:"center"}}>
       <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6"/><path d="M12 17h.01"/></svg>
      </button>}
     </div>}
    </section>
    {etapa==="ATENDIMENTO"&&<section style={{margin:"0 10px 12px",padding:"9px 12px",border:"1px solid #d6e8ef",borderRadius:10,background:"#f8fbfd"}}>
      <button type="button" style={{border:0,background:"transparent",fontSize:11,fontWeight:850,color:"#087d9f",cursor:"pointer",padding:4}} onClick={()=>router.push(`/coletor/ordens-servico/${id}/apr?origem=erp`)}>▣ CONSULTAR APR REGISTRADA</button>
    </section>}
    {etapa==="ATENDIMENTO"&&<AtelOsChecklistsV158 atendimento={id} etapa={etapa} somenteEncerramento />}
    <section style={{...receiptSectionStyle,margin:"0 10px 12px"}}>
     <div style={receiptTitleStyle}><div><span style={sectionEyebrowStyle}>EXECUÇÃO</span><span style={sectionTitleTextStyle}>Materiais do Atendimento</span></div><span style={sectionCountStyle}>{itens.length}</span></div>
     <div style={receiptInfoStyle}>Nenhum material previsto pelo ERP. O técnico registra os produtos utilizados. A baixa ocorre somente na finalização.</div>
     {etapa==="ATENDIMENTO"&&!pendenciaAtiva?<>
      <div style={{padding:"0 11px 10px",display:"grid",gap:8}}>
       <div style={{border:"1px solid #d9e8ef",borderRadius:12,background:"#f7fbfd",padding:11,boxShadow:"0 2px 10px rgba(13,78,107,.035)"}}>
        <label htmlFor="atel-busca-material" style={{display:"block",fontSize:10,letterSpacing:".06em",fontWeight:900,color:"#164b65",marginBottom:8}}>PESQUISAR NO ESTOQUE DO TÉCNICO</label>
        <div style={{display:"flex",alignItems:"center",gap:8,border:"1px solid #b8d9e7",background:"#fff",borderRadius:12,padding:"2px 12px",boxShadow:"0 2px 8px rgba(10,91,125,.05)"}}>
         <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0b8db0" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
         <input id="atel-busca-material" type="search" autoComplete="off" placeholder="Código, nome, MAC ou patrimônio" value={buscaMaterial} onChange={e=>{setBuscaMaterial(e.target.value);setProduto("");setEdicaoMaterial(null);}} style={{flex:1,minWidth:0,padding:"12px 0",fontSize:12,outline:"none",border:0,background:"transparent",color:"#10394c"}}/>
        </div>
        {produto!==""&&estoqueErp[Number(produto)]&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:7,marginTop:9,fontSize:10}}>
         <span style={{color:"#087b61",fontWeight:850,display:"inline-flex",alignItems:"center",gap:5}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg> Material selecionado</span>
         <span style={{color:"#607d8d",whiteSpace:"nowrap"}}>Saldo: <strong>{estoqueErp[Number(produto)].quantidade}</strong></span>
        </div>}
        {buscaMaterial.trim()!==""&&produto===""&&<div style={{marginTop:7,display:"grid",gap:5,maxHeight:210,overflowY:"auto"}} role="listbox" aria-label="Materiais encontrados">
         {estoqueErp.map((p,i)=>({p,i})).filter(({p})=>[p.cod_produto,p.produto,p.mac,p.patrimonio].some(v=>String(v??"").toLocaleLowerCase("pt-BR").includes(buscaMaterial.trim().toLocaleLowerCase("pt-BR")))).slice(0,12).map(({p,i})=><button key={i} type="button" role="option" aria-selected={false} onClick={()=>{setProduto(String(i));setBuscaMaterial(`${p.cod_produto} · ${p.produto}`);}} style={{textAlign:"left",background:"#fff",border:"1px solid #d6e7ee",borderLeft:"4px solid #1298ba",borderRadius:11,padding:"12px 13px",boxShadow:"0 2px 7px rgba(9,70,100,.04)",cursor:"pointer",display:"grid",gap:4}}>
          <strong style={{fontSize:11,color:"#103e55",overflowWrap:"anywhere"}}>{p.cod_produto} · {p.produto}</strong>
          <span style={{fontSize:10,color:"#526c7b"}}>Saldo: {p.quantidade}{p.patrimonio!=null?` · Patrimônio: ${p.patrimonio}`:""}{p.mac?` · MAC: ${p.mac}`:""}</span>
         </button>)}
         {!estoqueErp.some(p=>[p.cod_produto,p.produto,p.mac,p.patrimonio].some(v=>String(v??"").toLocaleLowerCase("pt-BR").includes(buscaMaterial.trim().toLocaleLowerCase("pt-BR"))))&&<div style={{fontSize:11,color:"#64748b",padding:10}}>Nenhum material encontrado no estoque ERP.</div>}
        </div>}
       </div>
       <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:"#fff",border:"1px solid #d9e8ef",borderRadius:13,padding:10}}>
        <div style={{minWidth:0}}><span style={{display:"block",fontSize:10,fontWeight:900,color:"#46687b",marginBottom:3}}>QUANTIDADE</span><span style={{fontSize:10,color:"#7891a0"}}>Unidades utilizadas</span></div>
        <div style={{display:"flex",alignItems:"center",border:"1px solid #c7e2ed",borderRadius:11,overflow:"hidden",background:"#f3fafe"}}>
         <button type="button" aria-label="Diminuir quantidade" onClick={()=>setQuantidade(String(Math.max(1,Number(quantidade||1)-1)))} style={{width:38,height:40,border:0,background:"transparent",fontSize:20,fontWeight:800,color:"#087d9e",cursor:"pointer"}}>−</button>
         <input aria-label="Quantidade de material" type="number" min="0.001" step="any" value={quantidade} onChange={e=>setQuantidade(e.target.value)} style={{width:57,height:40,textAlign:"center",border:0,borderLeft:"1px solid #d8eaf1",borderRight:"1px solid #d8eaf1",background:"#fff",fontSize:16,fontWeight:900,color:"#103f56",outline:"none"}}/>
         <button type="button" aria-label="Aumentar quantidade" onClick={()=>setQuantidade(String(Math.max(0,Number(quantidade||0))+1))} style={{width:38,height:40,border:0,background:"transparent",fontSize:20,fontWeight:800,color:"#087d9e",cursor:"pointer"}}>+</button>
        </div>
       </div>
       <button type="button" onClick={adicionar} disabled={ocupado||produto===""} style={{...btn,borderRadius:11,minHeight:45,background:produto===""?"#a4c5d0":"#087e9f",boxShadow:produto===""?"none":"0 5px 12px rgba(6,122,158,.16)"}}>{edicaoMaterial?"✓ ATUALIZAR QUANTIDADE":"+ ADICIONAR À OS"}</button>
      </div>
     </>:<div style={{padding:"0 11px 10px",fontSize:11,color:"#64748b"}}>A inclusão de materiais será habilitada na etapa Atendimento.</div>}
     {itens.length>0&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",margin:"5px 12px 9px"}}><strong style={{fontSize:11,color:"#16465d"}}>MATERIAIS LANÇADOS</strong><span style={{fontSize:10,color:"#678293"}}>{itens.length} {itens.length===1?"item":"itens"}</span></div>}
     {itens.map(i=><div key={chave(i)} style={{margin:"0 11px 9px",border:"1px solid #d5e6ee",borderRadius:13,background:"#fff",overflow:"hidden",boxShadow:"0 3px 12px rgba(12,68,96,.05)"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"13px 12px 10px"}}>
       <div style={{display:"grid",placeItems:"center",width:34,height:34,flexShrink:0,background:"#eaf6fb",borderRadius:10,color:"#0789af"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 7 9 5 9-5M3 7v10l9 5 9-5V7M12 12v10"/></svg></div>
       <div style={{minWidth:0,flex:1}}><span style={{fontSize:9,fontWeight:900,letterSpacing:".06em",color:"#7290a0"}}>SKU {i.cod_produto}</span><strong style={{display:"block",fontSize:12,lineHeight:1.4,color:"#123e54",marginTop:3,overflowWrap:"anywhere"}}>{i.produto}</strong><div style={{fontSize:10,color:"#617d8b",marginTop:5,overflowWrap:"anywhere"}}>{i.patrimonio!=null?`Patrimônio ${i.patrimonio}`:""}{i.mac?` · MAC ${i.mac}`:""}</div><span style={{display:"inline-block",fontSize:10,color:"#0b866b",marginTop:5}}>● Registrado no apontamento</span></div>
       <div style={{flexShrink:0,minWidth:37,textAlign:"center",background:"#eaf6fb",borderRadius:9,padding:"8px 7px",fontSize:16,color:"#087fa5",fontWeight:900}}>{i.quantidade}</div>
      </div>
      {etapa==="ATENDIMENTO"&&!pendenciaAtiva&&<div style={{display:"flex",justifyContent:"flex-end",gap:9,padding:"8px 11px",borderTop:"1px solid #edf2f5"}}>
       <button type="button" disabled={ocupado} onClick={()=>{const p=estoqueErp.find(p=>chave(p)===chave(i));if(!p){setErro("Material não localizado no estoque atual do técnico.");return;}setEdicaoMaterial(chave(i));setQuantidade(String(i.quantidade));setProduto(String(estoqueErp.indexOf(p)));setBuscaMaterial(`${p.cod_produto} · ${p.produto}`);}} style={{border:0,background:"transparent",padding:"5px 4px",color:"#087e9f",fontWeight:850,fontSize:10,cursor:"pointer"}}>✎ EDITAR QTD.</button>
       <button type="button" disabled={ocupado} onClick={()=>{setItens(itens.filter(x=>chave(x)!==chave(i)));setAlterado(true);if(edicaoMaterial===chave(i))setEdicaoMaterial(null);}} style={{border:0,background:"transparent",padding:"5px 4px",color:"#b0444a",fontWeight:850,fontSize:10,cursor:"pointer"}}>♧ REMOVER</button>
      </div>}
     </div>)}
     <div style={{margin:"13px 11px 11px",padding:12,border:"1px solid #d8eaf1",borderRadius:13,background:"#f1f8fc"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:10}}><strong style={{fontSize:11,color:"#12435b"}}>RESUMO DO ATENDIMENTO</strong><span style={{fontSize:9,color:"#638397"}}>Apontamento</span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:5}}>
       {[ ["SKUs",String(itens.length).padStart(2,"0")],["UNIDADES",String(itens.reduce((n,i)=>n+i.quantidade,0))],["ITENS OK",String(itens.length).padStart(2,"0")],["DIVERG.","00"] ].map(([k,v])=><div key={k} style={{border:"1px solid #dceaf1",borderRadius:10,padding:"10px 3px",textAlign:"center",background:"#fff"}}><b style={{display:"block",fontSize:17,fontWeight:900,color:"#075b79",fontVariantNumeric:"tabular-nums"}}>{v}</b><span style={{fontSize:8,color:"#637f90",fontWeight:800}}>{k}</span></div>)}
      </div>
     </div>
     {etapa==="ATENDIMENTO"&&!pendenciaAtiva&&<div style={{padding:"0 11px 13px"}}><button type="button" style={{...btn,borderRadius:11,minHeight:48,background:alterado?"#087f9f":"#a6c6d1"}} disabled={!alterado||ocupado} onClick={()=>void salvar()}>{ocupado?"SALVANDO...":alterado?"▣ SALVAR APONTAMENTOS":"✓ APONTAMENTOS SALVOS"}</button></div>}
    </section>
    <section style={{...receiptSectionStyle,margin:"0 10px 12px",padding:12}}>
     <button type="button" onClick={()=>setMostrarHistorico(v=>!v)} aria-expanded={mostrarHistorico}
       style={{width:"100%",background:"#eff8fb",border:"1px solid #cce8f0",borderRadius:7,padding:13,color:"#087da7",fontWeight:900,cursor:"pointer",fontSize:13}}>
       {mostrarHistorico?"OCULTAR HISTÓRICO DA OS":"VER HISTÓRICO DA OS"} ({eventos.length})
     </button>
     {mostrarHistorico&&<div style={{display:"grid",gap:8,marginTop:12}}>
      {eventos.length===0&&<p style={{fontSize:12,color:"#64748b",textAlign:"center",margin:8}}>Nenhuma movimentação registrada no WMS para esta OS.</p>}
      {eventos.map(ev=><article key={ev.id} style={{border:"1px solid #dce8ef",borderLeft:`3px solid ${ev.tipo==="OCORRENCIA"?"#b7791f":"#1198ba"}`,borderRadius:9,background:"#fff",padding:12}}>
       <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"start"}}>
        <strong style={{fontSize:11,color:"#073d57"}}>{ev.tipo==="OCORRENCIA"?"Ocorrência de atendimento":ev.tipo==="RETOMADA"?"Deslocamento retomado":`${rotuloEtapaAtel(ev.etapa_anterior)} → ${rotuloEtapaAtel(ev.etapa_nova)}`}</strong>
        <span style={{fontSize:10,color:"#64748b",whiteSpace:"nowrap"}}>{new Date(ev.ocorrido_em).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</span>
       </div>
       {ev.tipo_ocorrencia&&<p style={{fontSize:11,margin:"6px 0 2px",fontWeight:800}}>Tipo: {rotuloOcorrenciaAtel(ev.tipo_ocorrencia)}</p>}
       {ev.motivo&&<p style={{fontSize:11,margin:"4px 0",lineHeight:1.5,overflowWrap:"anywhere",whiteSpace:"pre-wrap"}}>{ev.motivo}</p>}
       {ev.nova_data&&<p style={{fontSize:11,margin:"4px 0",fontWeight:800}}>Reagendado para: {dataBrAtel(ev.nova_data)}</p>}
      </article>)}
      <button type="button" onClick={()=>{void atualizarEventos().catch(e=>setErro(e instanceof Error?e.message:"Histórico indisponível"));}} style={{border:0,background:"transparent",color:"#087da7",fontWeight:800,fontSize:11,cursor:"pointer"}}>ATUALIZAR HISTÓRICO</button>
     </div>}
    </section>
   </>}
  </div>
  {obsAberta&&<div
   role="presentation"
   onClick={()=>setObsAberta(false)}
   onKeyDown={e=>{if(e.key==="Escape")setObsAberta(false);}}
   style={{
    position:"absolute",inset:0,zIndex:200,
    display:"flex",alignItems:"center",justifyContent:"center",
    padding:"20px 16px",boxSizing:"border-box",
    background:"rgba(8,32,49,.66)",backdropFilter:"blur(4px)",
    WebkitBackdropFilter:"blur(4px)"
   }}
  >
   <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="atel-obs-titulo"
    aria-describedby="atel-obs-conteudo"
    onClick={e=>e.stopPropagation()}
    style={{
     width:"100%",maxWidth:372,maxHeight:"100%",boxSizing:"border-box",
     borderRadius:20,overflow:"hidden",background:"#ffffff",
     border:"1px solid rgba(195,225,236,.9)",
     boxShadow:"0 25px 70px rgba(3,24,41,.32), 0 5px 18px rgba(5,41,62,.16)",
     display:"flex",flexDirection:"column"
    }}
   >
    <div style={{height:5,flex:"0 0 5px",background:"linear-gradient(90deg,#087da7,#1ca9c8)"}} />
    <div style={{padding:"21px 20px 14px",display:"flex",alignItems:"flex-start",gap:12,flex:"0 0 auto"}}>
     <div aria-hidden="true" style={{
      width:44,height:44,flex:"0 0 44px",borderRadius:13,
      display:"grid",placeItems:"center",background:"#e9f7fc",color:"#0786aa",
      border:"1px solid #ccecf5"
     }}>
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
       <path d="M12 16v-4"/><path d="M12 8h.01"/><circle cx="12" cy="12" r="9.2"/>
      </svg>
     </div>
     <div style={{minWidth:0,flex:1,paddingTop:2}}>
      <div style={{fontSize:10,letterSpacing:".10em",fontWeight:850,color:"#6c8495",marginBottom:4}}>ORDEM DE SERVIÇO</div>
      <h2 id="atel-obs-titulo" style={{fontSize:18,lineHeight:1.2,letterSpacing:"-.025em",color:"#073d57",fontWeight:900,margin:0}}>Observação da OS</h2>
     </div>
     <button
      type="button" autoFocus aria-label="Fechar observação"
      onClick={()=>setObsAberta(false)}
      style={{width:34,height:34,flex:"0 0 34px",border:"1px solid #dcebf1",borderRadius:10,background:"#f7fafc",color:"#436477",display:"grid",placeItems:"center",cursor:"pointer",padding:0}}
     >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
     </button>
    </div>
    <div style={{padding:"0 20px 18px",overflowY:"auto",overscrollBehavior:"contain",minHeight:0,flex:"1 1 auto"}}>
     <div style={{
      border:"1px solid #d7eaf1",borderLeft:"3px solid #1298bd",borderRadius:12,
      padding:"17px 15px",background:"#f7fbfd"
     }}>
      <div style={{fontSize:10,color:"#36809a",fontWeight:850,letterSpacing:".08em",marginBottom:10}}>DESCRIÇÃO COMPLETA</div>
      <p id="atel-obs-conteudo" style={{fontSize:13,color:"#294456",lineHeight:1.7,whiteSpace:"pre-wrap",overflowWrap:"anywhere",margin:0,fontWeight:500}}>{String(detalhe?.Descricao??"")}</p>
     </div>
    </div>
    <div style={{padding:"14px 20px 20px",borderTop:"1px solid #eaf1f5",flex:"0 0 auto",background:"#fff"}}>
     <button
      type="button" onClick={()=>setObsAberta(false)}
      style={{width:"100%",minHeight:46,border:0,borderRadius:11,padding:"12px 16px",fontSize:12,letterSpacing:".045em",fontWeight:900,
       background:"linear-gradient(115deg,#0783ac,#159cbd)",color:"#fff",boxShadow:"0 6px 16px rgba(14,141,179,.2)",cursor:"pointer"}}
     >FECHAR OBSERVAÇÃO</button>
    </div>
   </div>
  </div>}
  {modalOcorrencia&&<div role="presentation" onClick={()=>{if(!ocupado)setModalOcorrencia(false);}}
    style={{position:"absolute",inset:0,zIndex:210,display:"flex",justifyContent:"center",alignItems:"center",padding:"14px",boxSizing:"border-box",background:"rgba(8,32,49,.68)",backdropFilter:"blur(4px)"}}>
    <div role="dialog" aria-modal="true" aria-labelledby="titulo-ocorrencia-erp" onClick={e=>e.stopPropagation()}
      style={{width:"100%",maxWidth:372,maxHeight:"95%",display:"flex",flexDirection:"column",background:"white",border:"1px solid #d4e9f1",borderRadius:18,boxShadow:"0 25px 70px rgba(3,24,41,.3)",overflow:"hidden"}}>
      <div style={{height:5,background:"linear-gradient(90deg,#b7791f,#e8a63b)",flexShrink:0}} />
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"18px 18px 10px"}}>
       <div style={{width:39,height:39,background:"#fff3dc",color:"#9c6615",border:"1px solid #f6dfb4",borderRadius:11,display:"grid",placeItems:"center",flexShrink:0}}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>
       </div>
       <div style={{flex:1,minWidth:0}}><div style={{fontSize:9,letterSpacing:".1em",fontWeight:900,color:"#8794a3"}}>ORDEM DE SERVIÇO</div><h2 id="titulo-ocorrencia-erp" style={{fontSize:16,margin:"2px 0 0",color:"#073d57",lineHeight:1.2}}>Ocorrência de atendimento</h2></div>
       <button type="button" aria-label="Fechar ocorrência" onClick={()=>{if(!ocupado)setModalOcorrencia(false);}} style={{width:32,height:32,borderRadius:10,border:"1px solid #dcebf1",background:"#f7fafc",cursor:"pointer",color:"#436477",fontSize:20}}>×</button>
      </div>
      <div style={{overflowY:"auto",padding:"4px 18px 14px",flex:1,minHeight:0}}>
       <div style={{padding:11,background:"#f4faff",border:"1px solid #d9eef6",borderRadius:9,fontSize:11,color:"#34586b",lineHeight:1.5,marginBottom:14}}>Registre a situação real do cliente. Esta ação não baixa materiais nem finaliza a OS.</div>
       <label style={{display:"block",fontSize:11,fontWeight:900,color:"#304f61",marginBottom:5}}>TIPO DE OCORRÊNCIA</label>
       <select value={tipoOcorrencia} onChange={e=>setTipoOcorrencia(e.target.value)} style={{width:"100%",border:"1px solid #cbdce5",borderRadius:8,padding:11,marginBottom:13,background:"white",fontSize:13}}>
        <option value="CLIENTE_AUSENTE">Cliente ausente</option><option value="IMPEDIMENTO_TECNICO">Impedimento técnico</option><option value="OUTRO">Outro impedimento</option>
       </select>
       <label style={{display:"block",fontSize:11,fontWeight:900,color:"#304f61",marginBottom:5}}>JUSTIFICATIVA OBRIGATÓRIA <span style={{fontWeight:500}}>(mín. 10 caracteres)</span></label>
       <textarea value={motivoOcorrencia} onChange={e=>setMotivoOcorrencia(e.target.value)} rows={3} maxLength={2000} placeholder="Descreva o que ocorreu com o cliente..." style={{width:"100%",boxSizing:"border-box",border:"1px solid #cbdce5",borderRadius:8,padding:11,resize:"vertical",fontSize:12,marginBottom:12}} />
       <label style={{display:"flex",alignItems:"center",gap:9,fontSize:12,fontWeight:850,marginBottom:12,color:"#304f61"}}><input type="checkbox" checked={reagendar} onChange={e=>setReagendar(e.target.checked)} />Reagendar atendimento</label>
       {reagendar&&<><label style={{display:"block",fontSize:11,fontWeight:900,color:"#304f61",marginBottom:5}}>NOVA DATA</label><input type="date" value={novaData} onChange={e=>setNovaData(e.target.value)} style={{width:"100%",boxSizing:"border-box",border:"1px solid #cbdce5",borderRadius:8,padding:11,marginBottom:12,fontSize:12}}/></>}
       {erroModal&&<p role="alert" style={{padding:10,background:"#fff0ee",borderRadius:8,color:"#a12121",fontSize:11,fontWeight:700}}>{erroModal}</p>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"14px 18px 18px",borderTop:"1px solid #edf2f6"}}>
       <button type="button" disabled={ocupado} onClick={()=>setModalOcorrencia(false)} style={{minHeight:44,borderRadius:9,border:"1px solid #b7d8e5",background:"#fff",color:"#087da7",fontWeight:900,fontSize:11}}>CANCELAR</button>
       <button type="button" disabled={ocupado} onClick={()=>void registrarOcorrencia()} style={{minHeight:44,borderRadius:9,border:0,background:"linear-gradient(110deg,#0988b0,#159fbd)",color:"white",fontWeight:900,fontSize:11}}>{ocupado?"SALVANDO...":"REGISTRAR"}</button>
      </div>
    </div>
  </div>}
  {modalRetomar&&<div role="presentation" onClick={()=>{if(!ocupado)setModalRetomar(false);}}
   style={{position:"absolute",inset:0,zIndex:210,display:"flex",justifyContent:"center",alignItems:"center",padding:16,boxSizing:"border-box",background:"rgba(8,32,49,.68)",backdropFilter:"blur(4px)"}}>
   <div role="dialog" aria-modal="true" aria-labelledby="titulo-retomada-erp" onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:372,maxHeight:"90%",overflowY:"auto",background:"white",borderRadius:18,boxShadow:"0 25px 70px rgba(3,24,41,.3)",border:"1px solid #d5eaf1"}}>
    <div style={{height:5,background:"linear-gradient(90deg,#0784ab,#1caac7)"}}/>
    <div style={{padding:"20px 18px 8px"}}><div style={{fontSize:10,color:"#688496",fontWeight:900,letterSpacing:".08em"}}>ORDEM DE SERVIÇO</div><h2 id="titulo-retomada-erp" style={{fontSize:17,color:"#073d57",margin:"5px 0 10px"}}>Retomar deslocamento</h2>
     <p style={{fontSize:12,color:"#52697b",lineHeight:1.5,margin:"0 0 12px"}}>{pendencia?.nova_data?`Atendimento reagendado para ${dataBrAtel(pendencia.nova_data)}. Se antecipar a visita, justifique.`:"A ocorrência será encerrada e o deslocamento poderá ser retomado."}</p>
     <label style={{display:"block",fontSize:11,fontWeight:850,marginBottom:5}}>Justificativa da retomada</label>
     <textarea value={justificativaRetomada} onChange={e=>setJustificativaRetomada(e.target.value)} rows={3} maxLength={2000} placeholder="Obrigatória para antecipar reagendamentos futuros" style={{width:"100%",boxSizing:"border-box",padding:11,border:"1px solid #cbdce5",borderRadius:8,resize:"vertical"}}/>
     {erroModal&&<p role="alert" style={{fontSize:11,color:"#ac1d1d",background:"#fff3f1",padding:9,borderRadius:8}}>{erroModal}</p>}
    </div>
    <div style={{padding:"13px 18px 18px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button type="button" disabled={ocupado} onClick={()=>setModalRetomar(false)} style={{minHeight:44,border:"1px solid #b7d8e5",borderRadius:9,background:"#fff",color:"#087da7",fontWeight:900,fontSize:11}}>CANCELAR</button><button type="button" disabled={ocupado} onClick={()=>void retomar()} style={{minHeight:44,border:0,borderRadius:9,background:"#0b92b6",color:"#fff",fontWeight:900,fontSize:11}}>{ocupado?"SALVANDO...":"RETOMAR"}</button></div>
   </div>
  </div>}
  {preflightAberto&&<div role="presentation" onClick={()=>setPreflightAberto(false)} style={{position:"fixed",inset:0,zIndex:11000,background:"rgba(7,28,45,.64)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
   <div role="dialog" aria-modal="true" aria-labelledby="titulo-preflight-atel" onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:390,maxHeight:"85vh",overflowY:"auto",background:"#fff",borderRadius:16,boxShadow:"0 20px 65px rgba(0,0,0,.3)",padding:18,color:"#113b50"}}>
    <div style={{fontSize:10,fontWeight:900,color:"#1483a6",letterSpacing:1}}>CONFERÊNCIA OPERACIONAL</div>
    <h2 id="titulo-preflight-atel" style={{fontSize:17,margin:"7px 0 5px"}}>Pré-finalização · OS nº {id}</h2>
    <p style={{fontSize:11,color:"#617a88",lineHeight:1.5}}>Consulta somente leitura. Nenhuma baixa ou finalização será executada.</p>
    {preflightCarregando&&<p role="status" style={{fontSize:12}}>Consultando apontamentos e validacao WMS...</p>}
    {preflightErro&&<p role="alert" style={{fontSize:12,color:"#a32d2d",background:"#fff2f0",padding:10,borderRadius:8}}>{preflightErro}</p>}
    {preflightDados&&<>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"12px 0"}}><div style={{background:"#eef7fb",padding:12,borderRadius:10,fontSize:11}}>SKUs<br/><strong style={{fontSize:22}}>{preflightDados.total_itens}</strong></div><div style={{background:"#eef7fb",padding:12,borderRadius:10,fontSize:11}}>Unidades<br/><strong style={{fontSize:22}}>{preflightDados.total_unidades}</strong></div></div>
     <div style={{display:"grid",gap:7}}>{preflightDados.conferencias.map((item,i)=><div key={`${item.cod_produto}-${i}`} style={{border:"1px solid #d9e9f0",borderRadius:9,padding:10,fontSize:11}}><strong>SKU {item.cod_produto} · {item.produto}</strong><div style={{marginTop:5,color:item.valido?"#167b55":"#a62f2f"}}>Apontado: {item.quantidade} · Saldo WMS: {item.saldo_erp == null ? "Nao conciliado" : item.saldo_erp} · {item.valido?"Conferido":"Pendente de conciliacao"}</div></div>)}</div>
     <div style={{background:"#fff7e8",border:"1px solid #f0d6a6",borderRadius:9,padding:11,marginTop:12,fontSize:11}}><strong>Finalização indisponível</strong>{preflightDados.motivos.map((m,i)=><div key={i} style={{marginTop:5}}>• {m}</div>)}</div>
    </>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:15}}><button type="button" onClick={()=>setPreflightAberto(false)} style={{minHeight:43,border:"1px solid #c7dce6",background:"white",borderRadius:9,color:"#17627c",fontWeight:800}}>FECHAR</button><button type="button" disabled={preflightCarregando} onClick={()=>void conferirFinalizacao()} style={{minHeight:43,border:0,background:"#087fa3",borderRadius:9,color:"white",fontWeight:800}}>RECONSULTAR</button></div>
   </div>
  </div>}
  {detalhe && <div style={footerStyle}>
   {pendenciaAtiva?<>
    <div style={{fontSize:11,textAlign:"center",background:"#fff7e6",color:"#885b18",padding:"10px 8px",fontWeight:850,marginBottom:8}}>
     OS aguardando tratativa{pendencia?.nova_data?` · Nova data: ${dataBrAtel(pendencia.nova_data)}`:""}
    </div>
    <button type="button" disabled={ocupado} onClick={()=>{setErroModal("");setModalRetomar(true);}} style={footerButtonStyle}>RETOMAR DESLOCAMENTO</button>
   </>:<>
    {(["DESLOCAMENTO","NO_CLIENTE","ATENDIMENTO"] as EtapaAtel[]).includes(etapa)&&<button type="button" disabled={ocupado} style={{...footerButtonStyle,background:"#b7791f",marginBottom:8}} onClick={()=>{setErroModal("");setModalOcorrencia(true);}}>REGISTRAR OCORRÊNCIA / REAGENDAR</button>}
    {prox?<AtelOsAprAcaoUnicaV1583 atendimento={id} destino={prox} rotulo={rotulo} disabled={ocupado||carregando||!andamento} style={footerButtonStyle} onAvancar={()=>void avancar()} onAbrirApr={()=>router.push(`/coletor/ordens-servico/${id}/apr?origem=erp`)} />:<button type="button" onClick={()=>void conferirFinalizacao()} disabled={ocupado||carregando||!andamento} style={{...footerButtonStyle,background:"#147e9f"}}>CONFERIR FINALIZAÇÃO</button>}
   </>}
  </div>}
 </div></div>;
}

export default function OrdemServicoDetalhePage() {
  const search = useSearchParams();
  return search.get("origem") === "erp" ? <DetalheOrdemErpSomenteLeitura /> : <OrdemServicoDetalheLocal />;
}

"use client";

import type { RequisicaoTecnica } from "@/lib/requisicoesTecnicas";
import { processarEntradaRetornoNoEstoque } from "@/lib/estoqueRetornoStore";

export type TipoRetorno =
  | "RECUSA_TOTAL"
  | "RECUSA_PARCIAL"
  | "TROCA"
  | "AVARIA"
  | "CANCELAMENTO"
  | "DEVOLUCAO";

export type OrigemRetorno =
  | "REQUISICAO"
  | "ABASTECIMENTO"
  | "ORDEM_SERVICO"
  | "CLIENTE"
  | "TECNICO";

export type StatusRetorno =
  | "AGUARDANDO_RETORNO"
  | "COM_TECNICO"
  | "EM_TRANSITO_CD"
  | "AGUARDANDO_CONFERENCIA"
  | "EM_CONFERENCIA"
  | "RECEBIDO"
  | "FINALIZADO";

export type DestinoItemRetorno =
  | "DISPONIVEL"
  | "QUARENTENA"
  | "DIVERGENCIA";

export type ItemRetorno = {
  id: number;
  itemIdOrigem?: number;
  codigoProduto: string;
  produto: string;
  unidade: string;
  quantidade: number;
  quantidadeEsperada?: number;
  quantidadeRecebida?: number;
  quantidadeAceita?: number;
  motivo?: string;
  observacao?: string;
  seriais: string[];
};

export type ConferenciaItemRetorno = {
  itemId: number;
  destino: DestinoItemRetorno;
  quantidadeRecebida: number;
  quantidadeDisponivel: number;
  quantidadeQuarentena: number;
  quantidadeDivergente: number;
  seriaisRecebidos: string[];
  observacao?: string;
  conferidoEm: string;
};

export type RecebimentoRetorno = {
  iniciadoEm?: string;
  codigoLido?: string;
  lidoEm?: string;
  finalizadoEm?: string;
  itensConferidos: Record<number, ConferenciaItemRetorno>;
};

export type RetornoDevolucao = {
  id: number;
  codigo: string;
  tipo: TipoRetorno;
  origem: OrigemRetorno;
  status: StatusRetorno;
  documentoOrigem: string;
  requisicaoId?: number;

  tecnico: string;
  codigoTecnico: string;
  base: string;

  origemFisica: string;
  destinoFisico: string;

  criadoEm: string;
  atualizadoEm: string;

  observacao?: string;

  itens: ItemRetorno[];

  recebimentoCD?: RecebimentoRetorno;
};

const STORAGE_KEY = "wms-expert-retornos";
const UPDATE_EVENT = "wms-retornos-update";

function isBrowser() {
  return typeof window !== "undefined";
}

/* =========================================================
   NORMALIZAÇÃO
========================================================= */

function normalizarRetorno(
  retorno: RetornoDevolucao
): RetornoDevolucao {
  return {
    ...retorno,

    itens: Array.isArray(retorno.itens)
      ? retorno.itens.map((item) => ({
          ...item,
          seriais: Array.isArray(item.seriais)
            ? item.seriais
            : [],
        }))
      : [],

    recebimentoCD: {
      iniciadoEm: retorno.recebimentoCD?.iniciadoEm,
      codigoLido: retorno.recebimentoCD?.codigoLido,
      lidoEm: retorno.recebimentoCD?.lidoEm,
      finalizadoEm: retorno.recebimentoCD?.finalizadoEm,

      itensConferidos:
        retorno.recebimentoCD?.itensConferidos ?? {},
    },
  };
}

/* =========================================================
   STORAGE
========================================================= */

export function carregarRetornos(): RetornoDevolucao[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const dados = JSON.parse(raw);

    if (!Array.isArray(dados)) {
      return [];
    }

    return dados.map((retorno) =>
      normalizarRetorno(retorno)
    );
  } catch {
    return [];
  }
}

function salvarRetornos(
  retornos: RetornoDevolucao[]
) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(retornos)
  );

  window.dispatchEvent(
    new CustomEvent(UPDATE_EVENT)
  );
}

export function ouvirRetornos(
  callback: () => void
) {
  if (!isBrowser()) {
    return () => {};
  }

  const onUpdate = () => {
    callback();
  };

  const onStorage = (
    event: StorageEvent
  ) => {
    if (event.key === STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener(
    UPDATE_EVENT,
    onUpdate
  );

  window.addEventListener(
    "storage",
    onStorage
  );

  return () => {
    window.removeEventListener(
      UPDATE_EVENT,
      onUpdate
    );

    window.removeEventListener(
      "storage",
      onStorage
    );
  };
}

/* =========================================================
   CÓDIGO RET
========================================================= */

function gerarCodigoRetorno(
  retornos: RetornoDevolucao[]
) {
  const ano = String(
    new Date().getFullYear()
  ).slice(-2);

  const maiorNumero = retornos.reduce(
    (maior, retorno) => {
      const match =
        retorno.codigo.match(
          /RET-\d{2}(\d+)/
        );

      const numero = Number(
        match?.[1] ?? 0
      );

      return Math.max(
        maior,
        numero
      );
    },
    0
  );

  return `RET-${ano}${String(
    maiorNumero + 1
  ).padStart(5, "0")}`;
}

/* =========================================================
   CONSULTAS
========================================================= */

export function obterRetorno(
  id: number
) {
  return (
    carregarRetornos().find(
      (retorno) =>
        retorno.id === id
    ) ?? null
  );
}

export function obterRetornoPorRequisicao(
  requisicaoId: number
) {
  return carregarRetornos().find(
    (retorno) =>
      retorno.requisicaoId ===
      requisicaoId
  );
}

/* =========================================================
   GERAR RETORNO DA REQUISIÇÃO
========================================================= */

export function gerarRetornoDaRequisicao(
  requisicao: RequisicaoTecnica,
  avaliacoes: Record<string, any>,
  volumes: Array<{
    id: number;
    itens: Record<number, any>;
  }>
) {
  const retornos =
    carregarRetornos();

  const existente =
    retornos.find(
      (retorno) =>
        retorno.requisicaoId ===
          requisicao.id &&
        (
          retorno.tipo ===
            "RECUSA_TOTAL" ||
          retorno.tipo ===
            "RECUSA_PARCIAL"
        )
    );

  if (existente) {
    return existente;
  }

  const itensRetorno: ItemRetorno[] = [];

  let houveAceite = false;
  let houveRecusa = false;

  for (const volume of volumes) {
    const itensVolume =
      Object.values(
        volume.itens ?? {}
      );

    for (
      const itemVolume of itensVolume
    ) {
      const avaliacao =
        avaliacoes[
          `${volume.id}:${itemVolume.itemId}`
        ];

      if (!avaliacao) {
        continue;
      }

      const produto =
        requisicao.itens.find(
          (item) =>
            item.id ===
            itemVolume.itemId
        );

      if (!produto) {
        continue;
      }

      const quantidadeEsperada =
        Number(
          itemVolume.quantidade ?? 0
        );

      const quantidadeRecebida =
        Number(
          avaliacao.quantidadeRecebida ??
            quantidadeEsperada
        );

      const quantidadeAceita =
        Number(
          avaliacao.quantidadeAceita ??
            (
              avaliacao.situacao ===
              "OK"
                ? quantidadeRecebida
                : (
                    avaliacao.decisao ===
                      "RECUSA_ITEM" ||
                    avaliacao.decisao ===
                      "RECUSA_VOLUME"
                  )
                ? 0
                : quantidadeRecebida
            )
        );

      const quantidadeFaltante =
        Math.max(
          quantidadeEsperada -
            quantidadeRecebida,
          0
        );

      const quantidadeRecusadaFisica =
        Math.max(
          quantidadeRecebida -
            quantidadeAceita,
          0
        );

      const quantidadeRetorno =
        quantidadeFaltante +
        quantidadeRecusadaFisica;

      if (quantidadeAceita > 0) {
        houveAceite = true;
      }

      if (quantidadeRetorno <= 0) {
        continue;
      }

      houveRecusa = true;

      const seriaisRecusados =
        avaliacao.seriaisRecusados ??
        (
          avaliacao.decisao ===
            "RECUSA_ITEM" ||
          avaliacao.decisao ===
            "RECUSA_VOLUME"
            ? (
                avaliacao.seriaisRecebidos ??
                itemVolume.seriais ??
                []
              )
            : []
        );

      itensRetorno.push({
        id:
          itensRetorno.length + 1,

        itemIdOrigem:
          itemVolume.itemId,

        codigoProduto:
          produto.codigoProduto,

        produto:
          produto.produto,

        unidade:
          produto.unidade,

        quantidade:
          quantidadeRetorno,

        quantidadeEsperada,

        quantidadeRecebida,

        quantidadeAceita,

        motivo:
          avaliacao.tipoDivergencia,

        observacao:
          avaliacao.observacao,

        seriais: [
          ...seriaisRecusados,
        ],
      });
    }
  }

  if (
    !houveRecusa ||
    itensRetorno.length === 0
  ) {
    return null;
  }

  const agora =
    new Date().toISOString();

  const retorno: RetornoDevolucao = {
    id: Date.now(),

    codigo:
      gerarCodigoRetorno(
        retornos
      ),

    tipo: houveAceite
      ? "RECUSA_PARCIAL"
      : "RECUSA_TOTAL",

    origem: "ABASTECIMENTO",

    status:
      "AGUARDANDO_RETORNO",

    documentoOrigem:
      requisicao.codigo,

    requisicaoId:
      requisicao.id,

    tecnico:
      requisicao.tecnico,

    codigoTecnico:
      requisicao.codigoTecnico,

    base:
      requisicao.base,

    origemFisica:
      `${requisicao.codigoTecnico} - ${requisicao.tecnico}`,

    destinoFisico:
      requisicao.origem ??
      "CD Fortaleza",

    criadoEm: agora,

    atualizadoEm: agora,

    itens: itensRetorno,

    recebimentoCD: {
      itensConferidos: {},
    },
  };

  retornos.unshift(
    retorno
  );

  salvarRetornos(
    retornos
  );

  return retorno;
}

/* =========================================================
   CRIAÇÃO MANUAL
========================================================= */

export function criarRetornoManual(
  dados: Omit<
    RetornoDevolucao,
    | "id"
    | "codigo"
    | "criadoEm"
    | "atualizadoEm"
  >
) {
  const retornos =
    carregarRetornos();

  const agora =
    new Date().toISOString();

  const retorno =
    normalizarRetorno({
      ...dados,

      id: Date.now(),

      codigo:
        gerarCodigoRetorno(
          retornos
        ),

      criadoEm: agora,

      atualizadoEm: agora,
    });

  retornos.unshift(
    retorno
  );

  salvarRetornos(
    retornos
  );

  return retorno;
}

/* =========================================================
   ALTERAR STATUS
========================================================= */

export function alterarStatusRetorno(
  id: number,
  status: StatusRetorno
) {
  const retornos =
    carregarRetornos();

  const retorno =
    retornos.find(
      (item) =>
        item.id === id
    );

  if (!retorno) {
    throw new Error(
      "Retorno não encontrado."
    );
  }

  retorno.status =
    status;

  retorno.atualizadoEm =
    new Date().toISOString();

  salvarRetornos(
    retornos
  );

  return retorno;
}

/* =========================================================
   RECEBIMENTO DO RETORNO NO CD
========================================================= */

export function iniciarRecebimentoRetorno(
  id: number
) {
  const retornos =
    carregarRetornos();

  const retorno =
    retornos.find(
      (item) =>
        item.id === id
    );

  if (!retorno) {
    throw new Error(
      "Retorno não encontrado."
    );
  }

  const statusPermitidos:
    StatusRetorno[] = [
      "EM_TRANSITO_CD",
      "AGUARDANDO_CONFERENCIA",
      "EM_CONFERENCIA",
    ];

  if (
    !statusPermitidos.includes(
      retorno.status
    )
  ) {
    throw new Error(
      "Este retorno ainda não está disponível para recebimento no CD."
    );
  }

  retorno.recebimentoCD = {
    ...retorno.recebimentoCD,

    iniciadoEm:
      retorno.recebimentoCD
        ?.iniciadoEm ??
      new Date().toISOString(),

    itensConferidos:
      retorno.recebimentoCD
        ?.itensConferidos ??
      {},
  };

  retorno.atualizadoEm =
    new Date().toISOString();

  salvarRetornos(
    retornos
  );

  return retorno;
}

/* =========================================================
   LEITURA DO RETORNO
========================================================= */

export function registrarLeituraRetorno(
  id: number,
  codigoDigitado: string
) {
  const retornos =
    carregarRetornos();

  const retorno =
    retornos.find(
      (item) =>
        item.id === id
    );

  if (!retorno) {
    throw new Error(
      "Retorno não encontrado."
    );
  }

  const codigo =
    codigoDigitado
      .trim()
      .toUpperCase();

  if (!codigo) {
    throw new Error(
      "Informe ou leia o código do retorno."
    );
  }

  const codigoEsperado =
    retorno.codigo.toUpperCase();

  const codigoValido =
    codigo === codigoEsperado ||
    codigo.includes(
      `RETORNO=${codigoEsperado}`
    ) ||
    codigo.includes(
      codigoEsperado
    );

  if (!codigoValido) {
    throw new Error(
      `Código inválido. Esperado: ${retorno.codigo}`
    );
  }

  retorno.recebimentoCD = {
    ...retorno.recebimentoCD,

    iniciadoEm:
      retorno.recebimentoCD
        ?.iniciadoEm ??
      new Date().toISOString(),

    codigoLido:
      retorno.codigo,

    lidoEm:
      new Date().toISOString(),

    itensConferidos:
      retorno.recebimentoCD
        ?.itensConferidos ??
      {},
  };

  retorno.status =
    "EM_CONFERENCIA";

  retorno.atualizadoEm =
    new Date().toISOString();

  salvarRetornos(
    retornos
  );

  return retorno;
}

/* =========================================================
   CONFERÊNCIA DO ITEM
========================================================= */

export function registrarConferenciaItemRetorno(
  retornoId: number,
  itemId: number,
  dados: {
    destino:
      DestinoItemRetorno;

    quantidadeRecebida:
      number;

    seriaisRecebidos?:
      string[];

    observacao?:
      string;
  }
) {
  const retornos =
    carregarRetornos();

  const retorno =
    retornos.find(
      (item) =>
        item.id ===
        retornoId
    );

  if (!retorno) {
    throw new Error(
      "Retorno não encontrado."
    );
  }

  if (
    !retorno.recebimentoCD
      ?.codigoLido
  ) {
    throw new Error(
      "Leia o código do retorno antes de conferir os itens."
    );
  }

  const item =
    retorno.itens.find(
      (produto) =>
        produto.id === itemId
    );

  if (!item) {
    throw new Error(
      "Item do retorno não encontrado."
    );
  }

  const quantidadeRecebida =
    Number(
      dados.quantidadeRecebida
    );

  const quantidadeEsperada =
    Number(
      item.quantidade ?? 0
    );

  if (
    !Number.isFinite(
      quantidadeRecebida
    ) ||
    quantidadeRecebida < 0
  ) {
    throw new Error(
      "Quantidade recebida inválida."
    );
  }

  if (
    quantidadeRecebida >
    quantidadeEsperada
  ) {
    throw new Error(
      `A quantidade recebida não pode ser maior que ${quantidadeEsperada} ${item.unidade}.`
    );
  }

  let quantidadeDisponivel = 0;
  let quantidadeQuarentena = 0;
  let quantidadeDivergente = 0;

  if (
    dados.destino ===
    "DISPONIVEL"
  ) {
    quantidadeDisponivel =
      quantidadeRecebida;

    quantidadeDivergente =
      Math.max(
        quantidadeEsperada -
          quantidadeRecebida,
        0
      );
  }

  if (
    dados.destino ===
    "QUARENTENA"
  ) {
    quantidadeQuarentena =
      quantidadeRecebida;

    quantidadeDivergente =
      Math.max(
        quantidadeEsperada -
          quantidadeRecebida,
        0
      );
  }

  if (
    dados.destino ===
    "DIVERGENCIA"
  ) {
    quantidadeDivergente =
      quantidadeEsperada;
  }

  retorno.recebimentoCD
    .itensConferidos[itemId] = {
      itemId,

      destino:
        dados.destino,

      quantidadeRecebida,

      quantidadeDisponivel,

      quantidadeQuarentena,

      quantidadeDivergente,

      seriaisRecebidos:
        dados.seriaisRecebidos ??
        [],

      observacao:
        dados.observacao,

      conferidoEm:
        new Date().toISOString(),
    };

  retorno.status =
    "EM_CONFERENCIA";

  retorno.atualizadoEm =
    new Date().toISOString();

  salvarRetornos(
    retornos
  );

  return retorno;
}

/* =========================================================
   FINALIZAR RECEBIMENTO
========================================================= */

export function finalizarRecebimentoRetorno(
  id: number
) {
  const retornos =
    carregarRetornos();

  const retorno =
    retornos.find(
      (item) =>
        item.id === id
    );

  if (!retorno) {
    throw new Error(
      "Retorno não encontrado."
    );
  }

  if (
    !retorno.recebimentoCD
      ?.codigoLido
  ) {
    throw new Error(
      "O retorno ainda não foi lido."
    );
  }

  const itensConferidos =
    retorno.recebimentoCD
      .itensConferidos ??
    {};

  const itensPendentes =
    retorno.itens.filter(
      (item) =>
        !itensConferidos[
          item.id
        ]
    );

  if (
    itensPendentes.length > 0
  ) {
    throw new Error(
      `Existem ${itensPendentes.length} item(ns) sem conferência.`
    );
  }

  // A movimentação de estoque só acontece depois da conferência completa.
  // A função é idempotente: o mesmo RET não duplica saldo/movimentação.
  processarEntradaRetornoNoEstoque(retorno);

  retorno.recebimentoCD
    .finalizadoEm =
    new Date().toISOString();

  retorno.status =
    "FINALIZADO";

  retorno.atualizadoEm =
    new Date().toISOString();

  salvarRetornos(
    retornos
  );

  return retorno;
}
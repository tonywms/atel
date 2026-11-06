"use client";

import type {
  ConferenciaItemRetorno,
  RetornoDevolucao,
} from "@/lib/retornosStore";

/* =========================================================
   TIPOS
========================================================= */

export type SituacaoEstoqueRetorno =
  | "DISPONIVEL"
  | "QUARENTENA";

export type TipoMovimentacaoRetorno =
  | "ENTRADA_RETORNO"
  | "ENTRADA_RETORNO_AVARIA"
  | "PENDENCIA_DIVERGENCIA";

/* =========================================================
   SALDO DE ESTOQUE

   IMPORTANTE:
   Agora o saldo também mantém os seriais existentes
   naquele produto/local/situação.
========================================================= */

export type SaldoEstoqueRetorno = {
  id: string;

  local: string;

  codigoProduto: string;

  produto: string;

  unidade: string;

  situacao: SituacaoEstoqueRetorno;

  quantidade: number;

  /*
   * Seriais atualmente existentes neste saldo.
   *
   * Produto não serializado:
   * []
   *
   * Produto serializado:
   * ["SN-001", "SN-002", ...]
   */
  seriais: string[];

  atualizadoEm: string;
};

/* =========================================================
   MOVIMENTAÇÃO
========================================================= */

export type MovimentacaoEstoqueRetorno = {
  id: string;

  chaveIdempotencia: string;

  tipo: TipoMovimentacaoRetorno;

  retornoId: number;

  retornoCodigo: string;

  documentoOrigem: string;

  itemRetornoId: number;

  itemIdOrigem?: number;

  codigoProduto: string;

  produto: string;

  unidade: string;

  quantidade: number;

  /*
   * Seriais envolvidos especificamente nesta movimentação.
   */
  seriais: string[];

  origem: string;

  destino: string;

  tecnico: string;

  codigoTecnico: string;

  base: string;

  observacao?: string;

  criadoEm: string;
};

/* =========================================================
   PENDÊNCIA
========================================================= */

export type PendenciaRetorno = {
  id: string;

  chaveIdempotencia: string;

  retornoId: number;

  retornoCodigo: string;

  documentoOrigem: string;

  itemRetornoId: number;

  codigoProduto: string;

  produto: string;

  unidade: string;

  quantidade: number;

  /*
   * Também guardamos os seriais envolvidos na divergência.
   */
  seriais: string[];

  tecnico: string;

  codigoTecnico: string;

  base: string;

  motivo: string;

  observacao?: string;

  status:
    | "ABERTA"
    | "RESOLVIDA";

  criadoEm: string;

  atualizadoEm: string;
};

/* =========================================================
   STORAGE
========================================================= */

const STORAGE_SALDOS =
  "wms-expert-estoque-retornos";

const STORAGE_MOVIMENTACOES =
  "wms-expert-movimentacoes-retornos";

const STORAGE_PENDENCIAS =
  "wms-expert-pendencias-retornos";

const UPDATE_EVENT =
  "wms-estoque-retornos-update";

/* =========================================================
   BROWSER
========================================================= */

function browser() {
  return (
    typeof window !==
    "undefined"
  );
}

/* =========================================================
   NORMALIZAÇÃO DE SERIAL
========================================================= */

function normalizarSerial(
  serial: string
) {
  return serial
    .trim()
    .toUpperCase();
}

function normalizarSeriais(
  seriais?: string[]
) {
  if (
    !Array.isArray(seriais)
  ) {
    return [];
  }

  return Array.from(
    new Set(
      seriais
        .map(normalizarSerial)
        .filter(Boolean)
    )
  );
}

/* =========================================================
   LEITURA GENÉRICA
========================================================= */

function ler<T>(
  chave: string
): T[] {
  if (!browser()) {
    return [];
  }

  try {
    const raw =
      localStorage.getItem(
        chave
      );

    if (!raw) {
      return [];
    }

    const dados =
      JSON.parse(raw);

    return Array.isArray(
      dados
    )
      ? dados
      : [];
  } catch {
    return [];
  }
}

/* =========================================================
   SALVAR
========================================================= */

function salvar<T>(
  chave: string,
  dados: T[]
) {
  if (!browser()) {
    return;
  }

  localStorage.setItem(
    chave,
    JSON.stringify(dados)
  );
}

/* =========================================================
   EVENTO
========================================================= */

function dispararEvento() {
  if (!browser()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      UPDATE_EVENT
    )
  );
}

/* =========================================================
   NORMALIZAR SALDOS ANTIGOS

   Isso é importante porque você já possui registros
   criados antes da existência do campo "seriais".

   Exemplo antigo:
   {
     codigoProduto: "TEL0001",
     quantidade: 1
   }

   Depois desta função:
   {
     codigoProduto: "TEL0001",
     quantidade: 1,
     seriais: []
   }
========================================================= */

function normalizarSaldo(
  saldo: SaldoEstoqueRetorno
): SaldoEstoqueRetorno {
  return {
    ...saldo,

    quantidade: Number(
      saldo.quantidade ?? 0
    ),

    seriais:
      normalizarSeriais(
        saldo.seriais
      ),
  };
}

/* =========================================================
   NORMALIZAR MOVIMENTAÇÃO ANTIGA
========================================================= */

function normalizarMovimentacao(
  movimentacao: MovimentacaoEstoqueRetorno
): MovimentacaoEstoqueRetorno {
  return {
    ...movimentacao,

    quantidade: Number(
      movimentacao.quantidade ??
        0
    ),

    seriais:
      normalizarSeriais(
        movimentacao.seriais
      ),
  };
}

/* =========================================================
   NORMALIZAR PENDÊNCIA ANTIGA
========================================================= */

function normalizarPendencia(
  pendencia: PendenciaRetorno
): PendenciaRetorno {
  return {
    ...pendencia,

    quantidade: Number(
      pendencia.quantidade ??
        0
    ),

    seriais:
      normalizarSeriais(
        pendencia.seriais
      ),
  };
}

/* =========================================================
   CARREGAR SALDOS
========================================================= */

export function carregarSaldosRetorno():
  SaldoEstoqueRetorno[] {
  return ler<SaldoEstoqueRetorno>(
    STORAGE_SALDOS
  ).map(normalizarSaldo);
}

/* =========================================================
   CARREGAR MOVIMENTAÇÕES
========================================================= */

export function carregarMovimentacoesRetorno():
  MovimentacaoEstoqueRetorno[] {
  return ler<MovimentacaoEstoqueRetorno>(
    STORAGE_MOVIMENTACOES
  ).map(
    normalizarMovimentacao
  );
}

/* =========================================================
   CARREGAR PENDÊNCIAS
========================================================= */

export function carregarPendenciasRetorno():
  PendenciaRetorno[] {
  return ler<PendenciaRetorno>(
    STORAGE_PENDENCIAS
  ).map(normalizarPendencia);
}

/* =========================================================
   OUVIR ALTERAÇÕES
========================================================= */

export function ouvirEstoqueRetorno(
  callback: () => void
) {
  if (!browser()) {
    return () => {};
  }

  const atualizar = () =>
    callback();

  const storage = (
    event: StorageEvent
  ) => {
    if (
      [
        STORAGE_SALDOS,
        STORAGE_MOVIMENTACOES,
        STORAGE_PENDENCIAS,
      ].includes(
        event.key ?? ""
      )
    ) {
      callback();
    }
  };

  window.addEventListener(
    UPDATE_EVENT,
    atualizar
  );

  window.addEventListener(
    "storage",
    storage
  );

  return () => {
    window.removeEventListener(
      UPDATE_EVENT,
      atualizar
    );

    window.removeEventListener(
      "storage",
      storage
    );
  };
}

/* =========================================================
   CHAVE DE IDEMPOTÊNCIA
========================================================= */

function chave(
  retorno: RetornoDevolucao,
  itemId: number,
  destino: string
) {
  return [
    "RET",
    retorno.id,
    itemId,
    destino,
  ].join("|");
}

/* =========================================================
   FILTRAR SERIAIS PARA UMA QUANTIDADE

   Exemplo:
   seriais = ["SN01", "SN02"]
   quantidade = 1

   resultado:
   ["SN01"]

   Normalmente a quantidade e a quantidade de seriais
   serão iguais.
========================================================= */

function limitarSeriais(
  seriais: string[],
  quantidade: number
) {
  const lista =
    normalizarSeriais(
      seriais
    );

  if (
    quantidade <= 0
  ) {
    return [];
  }

  /*
   * Não truncamos quando existem menos seriais que quantidade.
   * Isso permite produtos não serializados ou cadastros antigos.
   */
  if (
    lista.length <=
    quantidade
  ) {
    return lista;
  }

  return lista.slice(
    0,
    quantidade
  );
}

/* =========================================================
   SOMAR SALDO

   Agora acumula:
   - quantidade
   - seriais

   E nunca duplica o mesmo serial dentro do mesmo saldo.
========================================================= */

function somarSaldo(
  saldos:
    SaldoEstoqueRetorno[],

  local: string,

  item:
    RetornoDevolucao["itens"][number],

  situacao:
    SituacaoEstoqueRetorno,

  quantidade: number,

  seriais: string[]
) {
  if (
    quantidade <= 0
  ) {
    return;
  }

  const agora =
    new Date().toISOString();

  const seriaisEntrada =
    limitarSeriais(
      seriais,
      quantidade
    );

  const existente =
    saldos.find(
      (saldo) =>
        saldo.local ===
          local &&
        saldo.codigoProduto ===
          item.codigoProduto &&
        saldo.situacao ===
          situacao
    );

  /* =======================================================
     SALDO JÁ EXISTE
  ======================================================= */

  if (existente) {
    existente.quantidade =
      Number(
        existente.quantidade ??
          0
      ) + quantidade;

    existente.seriais =
      Array.from(
        new Set([
          ...normalizarSeriais(
            existente.seriais
          ),

          ...seriaisEntrada,
        ])
      );

    existente.atualizadoEm =
      agora;

    return;
  }

  /* =======================================================
     NOVO SALDO
  ======================================================= */

  saldos.push({
    id: [
      local,
      item.codigoProduto,
      situacao,
    ].join("|"),

    local,

    codigoProduto:
      item.codigoProduto,

    produto:
      item.produto,

    unidade:
      item.unidade,

    situacao,

    quantidade,

    seriais:
      seriaisEntrada,

    atualizadoEm:
      agora,
  });
}

/* =========================================================
   PROCESSAR ITEM
========================================================= */

function processarItem(
  retorno:
    RetornoDevolucao,

  conferencia:
    ConferenciaItemRetorno,

  saldos:
    SaldoEstoqueRetorno[],

  movimentacoes:
    MovimentacaoEstoqueRetorno[],

  pendencias:
    PendenciaRetorno[]
) {
  const item =
    retorno.itens.find(
      (produto) =>
        produto.id ===
        conferencia.itemId
    );

  if (!item) {
    throw new Error(
      `Item ${conferencia.itemId} não encontrado no ${retorno.codigo}.`
    );
  }

  const itemSeguro = item;

  const agora =
    new Date().toISOString();

  /*
   * Seriais realmente lidos/conferidos no CD.
   */
  const seriaisRecebidos =
    normalizarSeriais(
      conferencia.seriaisRecebidos
    );

  const quantidadeDisponivel =
    Number(
      conferencia.quantidadeDisponivel ??
        0
    );

  const quantidadeQuarentena =
    Number(
      conferencia.quantidadeQuarentena ??
        0
    );

  const quantidadeDivergente =
    Number(
      conferencia.quantidadeDivergente ??
        0
    );

  const cd =
    retorno.destinoFisico ||
    "CD Fortaleza";

  /* =======================================================
     ADICIONAR MOVIMENTAÇÃO
  ======================================================= */

  function adicionarMovimentacao(
    destinoTipo: string,

    tipo:
      TipoMovimentacaoRetorno,

    quantidade: number,

    destino: string,

    seriais: string[]
  ) {
    if (
      quantidade <= 0
    ) {
      return false;
    }

    const chaveIdempotencia =
      chave(
        retorno,
        itemSeguro.id,
        destinoTipo
      );

    /*
     * Impede processar novamente o mesmo itemSeguro/destino.
     */
    const jaExiste =
      movimentacoes.some(
        (movimentacao) =>
          movimentacao
            .chaveIdempotencia ===
          chaveIdempotencia
      );

    if (jaExiste) {
      return false;
    }

    const seriaisMovimento =
      limitarSeriais(
        seriais,
        quantidade
      );

    movimentacoes.unshift({
      id: [
        "MOV",
        Date.now(),
        retorno.id,
        itemSeguro.id,
        destinoTipo,
      ].join("-"),

      chaveIdempotencia,

      tipo,

      retornoId:
        retorno.id,

      retornoCodigo:
        retorno.codigo,

      documentoOrigem:
        retorno.documentoOrigem,

      itemRetornoId:
        itemSeguro.id,

      itemIdOrigem:
        itemSeguro.itemIdOrigem,

      codigoProduto:
        itemSeguro.codigoProduto,

      produto:
        itemSeguro.produto,

      unidade:
        itemSeguro.unidade,

      quantidade,

      seriais:
        seriaisMovimento,

      origem:
        retorno.origemFisica,

      destino,

      tecnico:
        retorno.tecnico,

      codigoTecnico:
        retorno.codigoTecnico,

      base:
        retorno.base,

      observacao:
        conferencia.observacao,

      criadoEm:
        agora,
    });

    return true;
  }

  /* =======================================================
     DISPONÍVEL
  ======================================================= */

  if (
    quantidadeDisponivel >
    0
  ) {
    /*
     * Se todo o material recebido foi considerado disponível,
     * os seriais recebidos pertencem ao estoque disponível.
     */
    const seriaisDisponiveis =
      limitarSeriais(
        seriaisRecebidos,
        quantidadeDisponivel
      );

    const adicionou =
      adicionarMovimentacao(
        "DISPONIVEL",

        "ENTRADA_RETORNO",

        quantidadeDisponivel,

        cd,

        seriaisDisponiveis
      );

    if (adicionou) {
      somarSaldo(
        saldos,

        cd,

        itemSeguro,

        "DISPONIVEL",

        quantidadeDisponivel,

        seriaisDisponiveis
      );
    }
  }

  /* =======================================================
     QUARENTENA
  ======================================================= */

  if (
    quantidadeQuarentena >
    0
  ) {
    const localQuarentena =
      `QUARENTENA - ${cd}`;

    /*
     * No modelo atual o itemSeguro inteiro recebe um único destino
     * na conferência. Portanto, quando é QUARENTENA, os
     * seriais recebidos pertencem à quarentena.
     */
    const seriaisQuarentena =
      limitarSeriais(
        seriaisRecebidos,
        quantidadeQuarentena
      );

    const adicionou =
      adicionarMovimentacao(
        "QUARENTENA",

        "ENTRADA_RETORNO_AVARIA",

        quantidadeQuarentena,

        localQuarentena,

        seriaisQuarentena
      );

    if (adicionou) {
      somarSaldo(
        saldos,

        localQuarentena,

        itemSeguro,

        "QUARENTENA",

        quantidadeQuarentena,

        seriaisQuarentena
      );
    }
  }

  /* =======================================================
     DIVERGÊNCIA

     Divergência NÃO aumenta saldo disponível.
     Divergência NÃO aumenta quarentena.

     Apenas:
     - movimentação de pendência
     - pendência operacional
  ======================================================= */

  if (
    quantidadeDivergente >
    0
  ) {
    const chaveIdempotencia =
      chave(
        retorno,
        itemSeguro.id,
        "DIVERGENCIA"
      );

    const jaExiste =
      movimentacoes.some(
        (movimentacao) =>
          movimentacao
            .chaveIdempotencia ===
          chaveIdempotencia
      );

    if (!jaExiste) {
      const seriaisDivergentes =
        limitarSeriais(
          seriaisRecebidos,
          quantidadeDivergente
        );

      adicionarMovimentacao(
        "DIVERGENCIA",

        "PENDENCIA_DIVERGENCIA",

        quantidadeDivergente,

        "PENDÊNCIA DE RETORNO",

        seriaisDivergentes
      );

      const pendenciaExiste =
        pendencias.some(
          (pendencia) =>
            pendencia
              .chaveIdempotencia ===
            chaveIdempotencia
        );

      if (!pendenciaExiste) {
        pendencias.unshift({
          id: [
            "PEND",
            Date.now(),
            retorno.id,
            itemSeguro.id,
          ].join("-"),

          chaveIdempotencia,

          retornoId:
            retorno.id,

          retornoCodigo:
            retorno.codigo,

          documentoOrigem:
            retorno.documentoOrigem,

          itemRetornoId:
            itemSeguro.id,

          codigoProduto:
            itemSeguro.codigoProduto,

          produto:
            itemSeguro.produto,

          unidade:
            itemSeguro.unidade,

          quantidade:
            quantidadeDivergente,

          seriais:
            seriaisDivergentes,

          tecnico:
            retorno.tecnico,

          codigoTecnico:
            retorno.codigoTecnico,

          base:
            retorno.base,

          motivo:
            itemSeguro.motivo ||
            "DIVERGÊNCIA NO RECEBIMENTO DO RETORNO",

          observacao:
            conferencia.observacao ||
            itemSeguro.observacao,

          status:
            "ABERTA",

          criadoEm:
            agora,

          atualizadoEm:
            agora,
        });
      }
    }
  }
}

/* =========================================================
   PROCESSAR ENTRADA DO RETORNO NO ESTOQUE
========================================================= */

export function processarEntradaRetornoNoEstoque(
  retorno:
    RetornoDevolucao
) {
  if (!browser()) {
    return {
      saldos: [],
      movimentacoes: [],
      pendencias: [],
    };
  }

  /* =======================================================
     RETORNO PRECISA TER SIDO LIDO
  ======================================================= */

  if (
    !retorno.recebimentoCD
      ?.codigoLido
  ) {
    throw new Error(
      "O retorno precisa ser lido antes da entrada no estoque."
    );
  }

  const conferencias =
    retorno.recebimentoCD
      .itensConferidos ??
    {};

  /* =======================================================
     TODOS OS ITENS PRECISAM ESTAR CONFERIDOS
  ======================================================= */

  const faltam =
    retorno.itens.filter(
      (itemSeguro) =>
        !conferencias[
          itemSeguro.id
        ]
    );

  if (
    faltam.length > 0
  ) {
    throw new Error(
      `Existem ${faltam.length} itemSeguro(ns) sem conferência.`
    );
  }

  /* =======================================================
     CARREGAR ESTADO ATUAL
  ======================================================= */

  const saldos =
    carregarSaldosRetorno();

  const movimentacoes =
    carregarMovimentacoesRetorno();

  const pendencias =
    carregarPendenciasRetorno();

  /* =======================================================
     PROCESSAR CONFERÊNCIAS
  ======================================================= */

  Object.values(
    conferencias
  ).forEach(
    (conferencia) => {
      processarItem(
        retorno,

        conferencia,

        saldos,

        movimentacoes,

        pendencias
      );
    }
  );

  /* =======================================================
     PERSISTIR
  ======================================================= */

  salvar(
    STORAGE_SALDOS,
    saldos
  );

  salvar(
    STORAGE_MOVIMENTACOES,
    movimentacoes
  );

  salvar(
    STORAGE_PENDENCIAS,
    pendencias
  );

  dispararEvento();

  return {
    saldos,
    movimentacoes,
    pendencias,
  };
}
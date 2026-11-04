"use client";

/* =========================================================
   TIPOS
========================================================= */

export type StatusPendenciaRetorno =
  | "ABERTA"
  | "EM_ANALISE"
  | "RESOLVIDA";

export type SolucaoPendenciaRetorno =
  | "DISPONIVEL"
  | "QUARENTENA"
  | "BAIXA";

export type PendenciaRetorno = {
  id: string;
  chaveIdempotencia: string;

  retornoId: number;
  retornoCodigo: string;

  itemRetornoId: number;

  documentoOrigem: string;

  codigoProduto: string;
  produto: string;
  unidade: string;

  quantidade: number;

  motivo?: string;
  observacao?: string;

  seriais: string[];

  tecnico: string;
  codigoTecnico: string;
  base: string;

  status: StatusPendenciaRetorno;

  criadoEm: string;
  atualizadoEm: string;

  solucao?: SolucaoPendenciaRetorno;
  resolvidoEm?: string;
  observacaoResolucao?: string;

  chaveResolucao?: string;
};

export type EstoqueRetorno = {
  id: string;
  local: string;

  codigoProduto: string;
  produto: string;

  quantidade: number;

  unidade: string;

  situacao:
    | "DISPONIVEL"
    | "QUARENTENA";

  seriais: string[];

  atualizadoEm: string;
};

export type MovimentoPendenciaRetorno = {
  id: string;

  tipo:
    | "ENTRADA_PENDENCIA_RESOLVIDA"
    | "BAIXA_PENDENCIA";

  retornoId: number;
  retornoCodigo: string;

  pendenciaId: string;

  documentoOrigem: string;

  codigoProduto: string;
  produto: string;

  quantidade: number;
  unidade: string;

  origem: string;
  destino: string;

  tecnico: string;

  situacao?: "DISPONIVEL" | "QUARENTENA";

  seriais: string[];

  chaveIdempotencia: string;

  criadoEm: string;
};

/* =========================================================
   STORAGE
========================================================= */

const PENDENCIAS_KEY =
  "wms-expert-pendencias-retornos";

const ESTOQUE_KEY =
  "wms-expert-estoque-retornos";

const MOVIMENTACOES_KEY =
  "wms-expert-movimentacoes-retornos";

const UPDATE_EVENT =
  "wms-pendencias-retornos-update";

/* =========================================================
   HELPERS
========================================================= */

function isBrowser() {
  return typeof window !== "undefined";
}

function agora() {
  return new Date().toISOString();
}

function lerArray<T>(
  chave: string
): T[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw =
      localStorage.getItem(chave);

    if (!raw) {
      return [];
    }

    const dados =
      JSON.parse(raw);

    return Array.isArray(dados)
      ? dados
      : [];
  } catch {
    return [];
  }
}

function salvarArray<T>(
  chave: string,
  dados: T[]
) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(
    chave,
    JSON.stringify(dados)
  );
}

function emitirAtualizacao() {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      UPDATE_EVENT
    )
  );
}

function limparSeriais(
  seriais?: string[]
) {
  return Array.from(
    new Set(
      (seriais ?? [])
        .map((serial) =>
          String(serial).trim()
        )
        .filter(Boolean)
    )
  );
}

/* =========================================================
   CONSULTAS
========================================================= */

export function carregarPendenciasRetorno():
  PendenciaRetorno[] {
  return lerArray<PendenciaRetorno>(
    PENDENCIAS_KEY
  ).map((pendencia) => ({
    ...pendencia,

    seriais:
      limparSeriais(
        pendencia.seriais
      ),

    status:
      pendencia.status ??
      "ABERTA",
  }));
}

export function obterPendenciaRetorno(
  id: string
) {
  return (
    carregarPendenciasRetorno().find(
      (pendencia) =>
        pendencia.id === id
    ) ?? null
  );
}

export function carregarEstoqueRetorno():
  EstoqueRetorno[] {
  return lerArray<EstoqueRetorno>(
    ESTOQUE_KEY
  );
}

export function carregarMovimentacoesRetorno():
  MovimentoPendenciaRetorno[] {
  return lerArray<MovimentoPendenciaRetorno>(
    MOVIMENTACOES_KEY
  );
}

/* =========================================================
   EVENTOS
========================================================= */

export function ouvirPendenciasRetorno(
  callback: () => void
) {
  if (!isBrowser()) {
    return () => {};
  }

  const atualizar = () => {
    callback();
  };

  const storage = (
    event: StorageEvent
  ) => {
    if (
      event.key ===
        PENDENCIAS_KEY ||
      event.key ===
        ESTOQUE_KEY ||
      event.key ===
        MOVIMENTACOES_KEY
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
   EM ANÁLISE
========================================================= */

export function iniciarAnalisePendencia(
  id: string
) {
  const pendencias =
    carregarPendenciasRetorno();

  const pendencia =
    pendencias.find(
      (item) =>
        item.id === id
    );

  if (!pendencia) {
    throw new Error(
      "Pendência não encontrada."
    );
  }

  if (
    pendencia.status ===
    "RESOLVIDA"
  ) {
    throw new Error(
      "Esta pendência já foi resolvida."
    );
  }

  pendencia.status =
    "EM_ANALISE";

  pendencia.atualizadoEm =
    agora();

  salvarArray(
    PENDENCIAS_KEY,
    pendencias
  );

  emitirAtualizacao();

  return pendencia;
}

/* =========================================================
   DEVOLVER PARA ABERTA
========================================================= */

export function reabrirAnalisePendencia(
  id: string
) {
  const pendencias =
    carregarPendenciasRetorno();

  const pendencia =
    pendencias.find(
      (item) =>
        item.id === id
    );

  if (!pendencia) {
    throw new Error(
      "Pendência não encontrada."
    );
  }

  if (
    pendencia.status ===
    "RESOLVIDA"
  ) {
    throw new Error(
      "Pendência resolvida não pode voltar para aberta."
    );
  }

  pendencia.status =
    "ABERTA";

  pendencia.atualizadoEm =
    agora();

  salvarArray(
    PENDENCIAS_KEY,
    pendencias
  );

  emitirAtualizacao();

  return pendencia;
}

/* =========================================================
   SOMAR ESTOQUE
========================================================= */

function adicionarAoEstoque(
  pendencia: PendenciaRetorno,
  situacao:
    | "DISPONIVEL"
    | "QUARENTENA",
  data: string
) {
  const estoque =
    carregarEstoqueRetorno();

  const local =
    situacao === "QUARENTENA"
      ? "QUARENTENA - CD Fortaleza"
      : "CD Fortaleza";

  const idEstoque =
    `${local}|${pendencia.codigoProduto}|${situacao}`;

  const existente =
    estoque.find(
      (item) =>
        item.id === idEstoque
    );

  if (existente) {
    existente.quantidade =
      Number(
        existente.quantidade ?? 0
      ) +
      Number(
        pendencia.quantidade ?? 0
      );

    existente.seriais =
      limparSeriais([
        ...(existente.seriais ??
          []),
        ...(pendencia.seriais ??
          []),
      ]);

    existente.atualizadoEm =
      data;
  } else {
    estoque.push({
      id: idEstoque,

      local,

      codigoProduto:
        pendencia.codigoProduto,

      produto:
        pendencia.produto,

      quantidade:
        Number(
          pendencia.quantidade ??
            0
        ),

      unidade:
        pendencia.unidade,

      situacao,

      seriais:
        limparSeriais(
          pendencia.seriais
        ),

      atualizadoEm: data,
    });
  }

  salvarArray(
    ESTOQUE_KEY,
    estoque
  );
}

/* =========================================================
   MOVIMENTAÇÃO
========================================================= */

function registrarMovimentacaoResolucao(
  pendencia: PendenciaRetorno,
  solucao: SolucaoPendenciaRetorno,
  chaveResolucao: string,
  data: string
) {
  const movimentacoes =
    carregarMovimentacoesRetorno();

  const jaExiste =
    movimentacoes.some(
      (movimento) =>
        movimento.chaveIdempotencia ===
        chaveResolucao
    );

  if (jaExiste) {
    return;
  }

  let destino =
    "BAIXA / AJUSTE";

  let situacao:
    | "DISPONIVEL"
    | "QUARENTENA"
    | undefined;

  if (
    solucao ===
    "DISPONIVEL"
  ) {
    destino =
      "CD Fortaleza";

    situacao =
      "DISPONIVEL";
  }

  if (
    solucao ===
    "QUARENTENA"
  ) {
    destino =
      "QUARENTENA - CD Fortaleza";

    situacao =
      "QUARENTENA";
  }

  const movimento:
    MovimentoPendenciaRetorno = {
    id:
      `MOV-PEND-${Date.now()}-${pendencia.itemRetornoId}`,

    tipo:
      solucao === "BAIXA"
        ? "BAIXA_PENDENCIA"
        : "ENTRADA_PENDENCIA_RESOLVIDA",

    retornoId:
      pendencia.retornoId,

    retornoCodigo:
      pendencia.retornoCodigo,

    pendenciaId:
      pendencia.id,

    documentoOrigem:
      pendencia.documentoOrigem,

    codigoProduto:
      pendencia.codigoProduto,

    produto:
      pendencia.produto,

    quantidade:
      pendencia.quantidade,

    unidade:
      pendencia.unidade,

    origem:
      `PENDÊNCIA ${pendencia.id}`,

    destino,

    tecnico:
      pendencia.tecnico,

    situacao,

    seriais:
      limparSeriais(
        pendencia.seriais
      ),

    chaveIdempotencia:
      chaveResolucao,

    criadoEm:
      data,
  };

  movimentacoes.unshift(
    movimento
  );

  salvarArray(
    MOVIMENTACOES_KEY,
    movimentacoes
  );
}

/* =========================================================
   RESOLVER
========================================================= */

export function resolverPendenciaRetorno(
  id: string,
  dados: {
    solucao:
      SolucaoPendenciaRetorno;

    observacao: string;
  }
) {
  const pendencias =
    carregarPendenciasRetorno();

  const pendencia =
    pendencias.find(
      (item) =>
        item.id === id
    );

  if (!pendencia) {
    throw new Error(
      "Pendência não encontrada."
    );
  }

  if (
    pendencia.status ===
    "RESOLVIDA"
  ) {
    throw new Error(
      "Esta pendência já foi resolvida."
    );
  }

  if (
    !dados.observacao.trim()
  ) {
    throw new Error(
      "Informe a justificativa da resolução."
    );
  }

  if (
    !Number.isFinite(
      Number(
        pendencia.quantidade
      )
    ) ||
    Number(
      pendencia.quantidade
    ) <= 0
  ) {
    throw new Error(
      "A pendência possui quantidade inválida."
    );
  }

  /*
   * A chave é específica da resolução.
   *
   * A pendência original possui:
   * RET|retorno|item|DIVERGENCIA
   *
   * A resolução passa a possuir:
   * PEND|id|RESOLUCAO
   *
   * Assim não conflita com a geração original
   * e impede resolver duas vezes.
   */
  const chaveResolucao =
    `PEND|${pendencia.id}|RESOLUCAO`;

  const movimentacoes =
    carregarMovimentacoesRetorno();

  const jaMovimentado =
    movimentacoes.some(
      (movimento) =>
        movimento.chaveIdempotencia ===
        chaveResolucao
    );

  /*
   * Se não houve movimentação anterior,
   * executamos a solução.
   */
  if (!jaMovimentado) {
    const data =
      agora();

    if (
      dados.solucao ===
      "DISPONIVEL"
    ) {
      adicionarAoEstoque(
        pendencia,
        "DISPONIVEL",
        data
      );
    }

    if (
      dados.solucao ===
      "QUARENTENA"
    ) {
      adicionarAoEstoque(
        pendencia,
        "QUARENTENA",
        data
      );
    }

    /*
     * BAIXA não adiciona saldo.
     *
     * Apenas gera movimentação
     * de encerramento.
     */

    registrarMovimentacaoResolucao(
      pendencia,
      dados.solucao,
      chaveResolucao,
      data
    );
  }

  const dataResolucao =
    agora();

  pendencia.status =
    "RESOLVIDA";

  pendencia.solucao =
    dados.solucao;

  pendencia.resolvidoEm =
    dataResolucao;

  pendencia.atualizadoEm =
    dataResolucao;

  pendencia.observacaoResolucao =
    dados.observacao.trim();

  pendencia.chaveResolucao =
    chaveResolucao;

  salvarArray(
    PENDENCIAS_KEY,
    pendencias
  );

  emitirAtualizacao();

  return pendencia;
}
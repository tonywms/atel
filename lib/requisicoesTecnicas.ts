/* =========================================================
   STATUS / TIPOS
========================================================= */

export type StatusRequisicao = import("./requisicoesStore").StatusRequisicao;

export type PrioridadeRequisicao =
  | "NORMAL"
  | "ALTA"
  | "URGENTE";

/* =========================================================
   ITEM
========================================================= */

export type ItemRequisicaoTecnica = {
  id: number;
  codigoProduto: string;
  produto: string;
  unidade: string;
  solicitado: number;
  estoqueCD: number;
  separado: number;
  conferido: number;
  embarcado: number;
  controlaSerie: boolean;
};

/* =========================================================
   REQUISIÇÃO
========================================================= */

export type RequisicaoTecnica = {
  id: number;
  codigo: string;
  codigoExterno: string;

  tecnico: string;
  codigoTecnico: string;

  base: string;
  origem: string;
  destino: string;

  tipo: string;
  prioridade: PrioridadeRequisicao;
  status: StatusRequisicao;

  dataSolicitacao: string;
  dataRecebimento: string;

  origemIntegracao: string;

  itens: ItemRequisicaoTecnica[];
};

/* =========================================================
   CATÁLOGO DE PRODUTOS PARA TESTE
========================================================= */

type ProdutoTeste = {
  codigoProduto: string;
  produto: string;
  unidade: string;
  estoqueCD: number;
  controlaSerie: boolean;
  quantidades: number[];
};

const produtosTeste: ProdutoTeste[] = [
  {
    codigoProduto: "TEL0001",
    produto: "ONT GPON WI-FI 6 AX3000",
    unidade: "UN",
    estoqueCD: 148,
    controlaSerie: true,
    quantidades: [1, 2, 3],
  },
  {
    codigoProduto: "TEL0002",
    produto: "CABO DROP ÓPTICO 1FO",
    unidade: "MT",
    estoqueCD: 2450,
    controlaSerie: false,
    quantidades: [50, 80, 100, 120],
  },
  {
    codigoProduto: "TEL0003",
    produto: "CONECTOR FAST SC/APC",
    unidade: "UN",
    estoqueCD: 730,
    controlaSerie: false,
    quantidades: [5, 10, 12, 20],
  },
  {
    codigoProduto: "TEL0004",
    produto: "ROTEADOR MESH WI-FI 6",
    unidade: "UN",
    estoqueCD: 85,
    controlaSerie: true,
    quantidades: [1, 2, 3],
  },
  {
    codigoProduto: "TEL0005",
    produto: "ONT GPON DUAL BAND",
    unidade: "UN",
    estoqueCD: 112,
    controlaSerie: true,
    quantidades: [1, 2, 4],
  },
  {
    codigoProduto: "TEL0006",
    produto: "PATCH CORD SC/APC 2M",
    unidade: "UN",
    estoqueCD: 480,
    controlaSerie: false,
    quantidades: [5, 10, 15],
  },
  {
    codigoProduto: "TEL0007",
    produto: "CAIXA TERMINAÇÃO ÓPTICA PTO",
    unidade: "UN",
    estoqueCD: 320,
    controlaSerie: false,
    quantidades: [2, 5, 8],
  },
  {
    codigoProduto: "TEL0008",
    produto: "SPLITTER ÓPTICO 1X8 SC/APC",
    unidade: "UN",
    estoqueCD: 95,
    controlaSerie: false,
    quantidades: [1, 2, 4],
  },
  {
    codigoProduto: "TEL0009",
    produto: "SPLITTER ÓPTICO 1X16 SC/APC",
    unidade: "UN",
    estoqueCD: 72,
    controlaSerie: false,
    quantidades: [1, 2, 3],
  },
  {
    codigoProduto: "TEL0010",
    produto: "CORDÃO ÓPTICO SC/APC",
    unidade: "UN",
    estoqueCD: 650,
    controlaSerie: false,
    quantidades: [5, 10, 20],
  },
  {
    codigoProduto: "TEL0011",
    produto: "PATCH CORD SC/APC 3M",
    unidade: "UN",
    estoqueCD: 380,
    controlaSerie: false,
    quantidades: [5, 10, 15],
  },
  {
    codigoProduto: "TEL0012",
    produto: "CONECTOR ÓPTICO SC/APC",
    unidade: "UN",
    estoqueCD: 900,
    controlaSerie: false,
    quantidades: [10, 20, 30],
  },
  {
    codigoProduto: "TEL0013",
    produto: "ROTEADOR WI-FI 6 DUAL BAND",
    unidade: "UN",
    estoqueCD: 96,
    controlaSerie: true,
    quantidades: [1, 2, 3],
  },
  {
    codigoProduto: "TEL0014",
    produto: "ONU GPON 1GE",
    unidade: "UN",
    estoqueCD: 175,
    controlaSerie: true,
    quantidades: [1, 2, 4],
  },
  {
    codigoProduto: "TEL0015",
    produto: "FONTE 12V 2A",
    unidade: "UN",
    estoqueCD: 240,
    controlaSerie: false,
    quantidades: [2, 5, 10],
  },
];

/* =========================================================
   TÉCNICOS PARA TESTE
========================================================= */

type TecnicoTeste = {
  tecnico: string;
  codigoTecnico: string;
  base: string;
};

const tecnicosTeste: TecnicoTeste[] = [
  {
    tecnico: "Tony Moreira",
    codigoTecnico: "TEC-060",
    base: "Fortaleza",
  },
  {
    tecnico: "Carlos Lima",
    codigoTecnico: "TEC-074",
    base: "Caucaia",
  },
  {
    tecnico: "Rafael Souza",
    codigoTecnico: "TEC-081",
    base: "Maracanaú",
  },
  {
    tecnico: "Amanda Costa",
    codigoTecnico: "TEC-092",
    base: "Eusébio",
  },
  {
    tecnico: "Bruno Alves",
    codigoTecnico: "TEC-103",
    base: "Aquiraz",
  },
  {
    tecnico: "Lucas Ferreira",
    codigoTecnico: "TEC-114",
    base: "Fortaleza",
  },
  {
    tecnico: "Marcos Silva",
    codigoTecnico: "TEC-125",
    base: "Caucaia",
  },
  {
    tecnico: "Daniel Oliveira",
    codigoTecnico: "TEC-136",
    base: "Maracanaú",
  },
  {
    tecnico: "Felipe Santos",
    codigoTecnico: "TEC-147",
    base: "Eusébio",
  },
  {
    tecnico: "André Gomes",
    codigoTecnico: "TEC-158",
    base: "Fortaleza",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function quantidadeProduto(
  produto: ProdutoTeste,
  indice: number
) {
  return produto.quantidades[
    indice % produto.quantidades.length
  ];
}

function criarItem(
  produto: ProdutoTeste,
  itemId: number,
  indice: number
): ItemRequisicaoTecnica {
  return {
    id: itemId,
    codigoProduto: produto.codigoProduto,
    produto: produto.produto,
    unidade: produto.unidade,
    solicitado: quantidadeProduto(produto, indice),
    estoqueCD: produto.estoqueCD,
    separado: 0,
    conferido: 0,
    embarcado: 0,
    controlaSerie: produto.controlaSerie,
  };
}

/* =========================================================
   REQUISIÇÕES BASE

   Mantemos os exemplos que já estavam sendo usados
   nos testes anteriores.
========================================================= */

const requisicoesBase: RequisicaoTecnica[] = [
  {
    id: 1,
    codigo: "REQ-2600187",
    codigoExterno: "SOL-983771",

    tecnico: "Tony Moreira",
    codigoTecnico: "TEC-060",

    base: "Fortaleza",
    origem: "CD Fortaleza",
    destino: "TEC-060",

    tipo: "ABASTECIMENTO",
    prioridade: "URGENTE",
    status: "PENDENTE",

    dataSolicitacao: "18/10/2026 14:30",
    dataRecebimento: "18/10/2026 14:32",

    origemIntegracao: "API",

    itens: [
      {
        id: 1,
        codigoProduto: "TEL0001",
        produto: "ONT GPON WI-FI 6 AX3000",
        unidade: "UN",
        solicitado: 2,
        estoqueCD: 148,
        separado: 0,
        conferido: 0,
        embarcado: 0,
        controlaSerie: true,
      },
      {
        id: 2,
        codigoProduto: "TEL0002",
        produto: "CABO DROP ÓPTICO 1FO",
        unidade: "MT",
        solicitado: 80,
        estoqueCD: 2450,
        separado: 0,
        conferido: 0,
        embarcado: 0,
        controlaSerie: false,
      },
      {
        id: 3,
        codigoProduto: "TEL0003",
        produto: "CONECTOR FAST SC/APC",
        unidade: "UN",
        solicitado: 12,
        estoqueCD: 730,
        separado: 0,
        conferido: 0,
        embarcado: 0,
        controlaSerie: false,
      },
    ],
  },

  {
    id: 2,
    codigo: "REQ-2600188",
    codigoExterno: "SOL-983784",

    tecnico: "Carlos Lima",
    codigoTecnico: "TEC-074",

    base: "Caucaia",
    origem: "CD Fortaleza",
    destino: "TEC-074",

    tipo: "ABASTECIMENTO",
    prioridade: "ALTA",
    status: "PENDENTE",

    dataSolicitacao: "18/10/2026 13:52",
    dataRecebimento: "18/10/2026 13:53",

    origemIntegracao: "API",

    itens: [
      {
        id: 1,
        codigoProduto: "TEL0004",
        produto: "ROTEADOR MESH WI-FI 6",
        unidade: "UN",
        solicitado: 3,
        estoqueCD: 85,
        separado: 0,
        conferido: 0,
        embarcado: 0,
        controlaSerie: true,
      },
      {
        id: 2,
        codigoProduto: "TEL0005",
        produto: "ONT GPON DUAL BAND",
        unidade: "UN",
        solicitado: 4,
        estoqueCD: 112,
        separado: 0,
        conferido: 0,
        embarcado: 0,
        controlaSerie: true,
      },
      {
        id: 3,
        codigoProduto: "TEL0011",
        produto: "PATCH CORD SC/APC 3M",
        unidade: "UN",
        solicitado: 10,
        estoqueCD: 380,
        separado: 0,
        conferido: 0,
        embarcado: 0,
        controlaSerie: false,
      },
    ],
  },

  {
    id: 3,
    codigo: "REQ-2600189",
    codigoExterno: "SOL-983801",

    tecnico: "Rafael Souza",
    codigoTecnico: "TEC-081",

    base: "Maracanaú",
    origem: "CD Fortaleza",
    destino: "TEC-081",

    tipo: "REPOSICAO",
    prioridade: "NORMAL",
    status: "PENDENTE",

    dataSolicitacao: "18/10/2026 13:10",
    dataRecebimento: "18/10/2026 13:12",

    origemIntegracao: "API",

    itens: [
      {
        id: 1,
        codigoProduto: "TEL0006",
        produto: "PATCH CORD SC/APC 2M",
        unidade: "UN",
        solicitado: 10,
        estoqueCD: 480,
        separado: 0,
        conferido: 0,
        embarcado: 0,
        controlaSerie: false,
      },
      {
        id: 2,
        codigoProduto: "TEL0007",
        produto: "CAIXA TERMINAÇÃO ÓPTICA PTO",
        unidade: "UN",
        solicitado: 5,
        estoqueCD: 320,
        separado: 0,
        conferido: 0,
        embarcado: 0,
        controlaSerie: false,
      },
    ],
  },

  {
    id: 4,
    codigo: "REQ-2600190",
    codigoExterno: "SOL-983815",

    tecnico: "Amanda Costa",
    codigoTecnico: "TEC-092",

    base: "Eusébio",
    origem: "CD Fortaleza",
    destino: "TEC-092",

    tipo: "ABASTECIMENTO",
    prioridade: "ALTA",
    status: "PENDENTE",

    dataSolicitacao: "18/10/2026 12:45",
    dataRecebimento: "18/10/2026 12:47",

    origemIntegracao: "API",

    itens: [
      {
        id: 1,
        codigoProduto: "TEL0008",
        produto: "SPLITTER ÓPTICO 1X8 SC/APC",
        unidade: "UN",
        solicitado: 2,
        estoqueCD: 95,
        separado: 0,
        conferido: 0,
        embarcado: 0,
        controlaSerie: false,
      },
      {
        id: 2,
        codigoProduto: "TEL0013",
        produto: "ROTEADOR WI-FI 6 DUAL BAND",
        unidade: "UN",
        solicitado: 2,
        estoqueCD: 96,
        separado: 0,
        conferido: 0,
        embarcado: 0,
        controlaSerie: true,
      },
    ],
  },

  {
    id: 5,
    codigo: "REQ-2600191",
    codigoExterno: "SOL-983829",

    tecnico: "Bruno Alves",
    codigoTecnico: "TEC-103",

    base: "Aquiraz",
    origem: "CD Fortaleza",
    destino: "TEC-103",

    tipo: "REPOSICAO",
    prioridade: "URGENTE",
    status: "PENDENTE",

    dataSolicitacao: "18/10/2026 11:55",
    dataRecebimento: "18/10/2026 11:57",

    origemIntegracao: "API",

    itens: [
      {
        id: 1,
        codigoProduto: "TEL0009",
        produto: "SPLITTER ÓPTICO 1X16 SC/APC",
        unidade: "UN",
        solicitado: 2,
        estoqueCD: 72,
        separado: 0,
        conferido: 0,
        embarcado: 0,
        controlaSerie: false,
      },
      {
        id: 2,
        codigoProduto: "TEL0010",
        produto: "CORDÃO ÓPTICO SC/APC",
        unidade: "UN",
        solicitado: 10,
        estoqueCD: 650,
        separado: 0,
        conferido: 0,
        embarcado: 0,
        controlaSerie: false,
      },
      {
        id: 3,
        codigoProduto: "TEL0014",
        produto: "ONU GPON 1GE",
        unidade: "UN",
        solicitado: 2,
        estoqueCD: 175,
        separado: 0,
        conferido: 0,
        embarcado: 0,
        controlaSerie: true,
      },
    ],
  },
];

/* =========================================================
   GERADOR DE 20 REQUISIÇÕES

   REQ-2600220 até REQ-2600239
========================================================= */

function gerarRequisicoesTeste(
  quantidade: number
): RequisicaoTecnica[] {
  const resultado: RequisicaoTecnica[] = [];

  for (let i = 0; i < quantidade; i++) {
    const tecnico =
      tecnicosTeste[i % tecnicosTeste.length];

    const numeroRequisicao = 220 + i;

    const codigo =
      `REQ-26${String(numeroRequisicao).padStart(5, "0")}`;

    const codigoExterno =
      `SOL-TESTE-${String(i + 21).padStart(3, "0")}`;

    const tipos = [
      "ABASTECIMENTO",
      "REPOSICAO",
      "ABASTECIMENTO",
      "ABASTECIMENTO",
      "REPOSICAO",
    ];

    const prioridades: PrioridadeRequisicao[] = [
      "NORMAL",
      "ALTA",
      "URGENTE",
      "NORMAL",
      "ALTA",
    ];

    /*
      Gera entre 2 e 5 SKUs.
    */
    const quantidadeItens =
      2 + (i % 4);

    const itens: ItemRequisicaoTecnica[] = [];

    for (
      let itemIndex = 0;
      itemIndex < quantidadeItens;
      itemIndex++
    ) {
      const produtoIndex =
        (i * 3 + itemIndex) %
        produtosTeste.length;

      const produto =
        produtosTeste[produtoIndex];

      itens.push(
        criarItem(
          produto,
          itemIndex + 1,
          i + itemIndex
        )
      );
    }

    const hora =
      8 + (i % 9);

    const minuto =
      (i * 7) % 60;

    const horaRecebimento =
      String(hora).padStart(2, "0");

    const minutoSolicitacao =
      String(minuto).padStart(2, "0");

    const minutoRecebimento =
      String((minuto + 2) % 60).padStart(
        2,
        "0"
      );

    resultado.push({
      /*
        IDs 100+ para não colidir com
        os IDs 1,2,3,4,5 já existentes.
      */
      id: 120 + i,

      codigo,

      codigoExterno,

      tecnico: tecnico.tecnico,

      codigoTecnico:
        tecnico.codigoTecnico,

      base: tecnico.base,

      origem: "CD Fortaleza",

      destino:
        tecnico.codigoTecnico,

      tipo:
        tipos[i % tipos.length],

      prioridade:
        prioridades[
          i % prioridades.length
        ],

      status: "PENDENTE",

      dataSolicitacao:
        `19/10/2026 ${horaRecebimento}:${minutoSolicitacao}`,

      dataRecebimento:
        `19/10/2026 ${horaRecebimento}:${minutoRecebimento}`,

      origemIntegracao: "API",

      itens,
    });
  }

  return resultado;
}

/* =========================================================
   20 NOVAS REQUISIÇÕES AUTOMÁTICAS
========================================================= */

export const requisicoesTeste20 =
  gerarRequisicoesTeste(20);

/* =========================================================
   LISTA UTILIZADA PELO SISTEMA

   5 originais
   +
   20 para testes
   =
   25 requisições
========================================================= */

export const requisicoesTecnicasMock:
  RequisicaoTecnica[] = [
    ...requisicoesBase,
    ...requisicoesTeste20,
  ];
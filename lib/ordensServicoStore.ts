"use client";

import {
  baixarEstoqueTecnico,
  carregarEstoqueTecnico,
} from "@/lib/estoqueTecnicoStore";

/* =========================================================
   TIPOS
========================================================= */

export type TipoOrdemServico =
  | "INSTALACAO"
  | "MANUTENCAO"
  | "TROCA"
  | "RETIRADA";

export type StatusOrdemServico =
  | "PENDENTE"
  | "EM_ATENDIMENTO"
  | "FINALIZADA"
  | "CANCELADA";

export type DestinoMaterialOS =
  | "COMODATO"
  | "VENDA"
  | "CONSUMO";

export type StatusConferenciaMaterialOS =
  | "PENDENTE"
  | "OK"
  | "DIVERGENCIA";

export type MaterialPrevistoOS = {
  id: number;
  codigoProduto: string;
  produto: string;
  unidade: string;
  quantidade: number;
  serialObrigatorio: boolean;
  seriaisPrevistos: string[];
  statusConferencia: StatusConferenciaMaterialOS;
  observacaoDivergencia?: string;
};

export type ItemOrdemServico = {
  id: number;

  codigoProduto: string;
  produto: string;
  unidade: string;

  quantidade: number;

  serialObrigatorio: boolean;
  seriais: string[];

  destino: DestinoMaterialOS;
};

export type OrdemServico = {
  id: number;
  codigo: string;

  tipo: TipoOrdemServico;
  status: StatusOrdemServico;

  codigoTecnico: string;
  tecnico: string;
  base: string;

  codigoCliente: string;
  cliente: string;

  endereco: string;
  cidade: string;

  dataPrevista: string;

  observacao?: string;

  iniciadoEm?: string;
  finalizadoEm?: string;

  materiaisPrevistos: MaterialPrevistoOS[];
  itens: ItemOrdemServico[];

  estadoFSM?: EstadoFSMOS;
  historicoFSM?: EventoFSMOS[];
  agendamentoFSM?: { novaData: string; motivo: string; registradoEm: string };
  antecipacaoFSM?: { dataOriginal: string; justificativa: string; registradoEm: string; codigoTecnico: string; tecnico: string };
  ocorrenciaFSM?: { tipo: "CLIENTE_AUSENTE" | "IMPEDIMENTO_TECNICO" | "OUTRO"; motivo: string; registradoEm: string };
};


/* FSM V02: estados operacionais independentes do estoque. */
export type EstadoFSMOS =
  | "PENDENTE" | "EM_DESLOCAMENTO" | "NO_LOCAL"
  | "EM_ATENDIMENTO" | "PENDENTE_REAGENDAMENTO"
  | "PENDENTE_TRATATIVA" | "FINALIZADA" | "CANCELADA";

export type EventoFSMOS = {
  id: string;
  estadoAnterior: EstadoFSMOS;
  estadoNovo: EstadoFSMOS;
  ocorridoEm: string;
  codigoTecnico: string;
  tecnico: string;
  motivo?: string;
  observacao?: string;
  tipoOcorrencia?: string;
  novaData?: string;
};

export type PatrimonioCliente = {
  id: string;

  codigoCliente: string;
  cliente: string;

  ordemServico: string;

  codigoProduto: string;
  produto: string;

  serial: string;

  quantidade: number;

  tipo: "COMODATO" | "VENDA";

  tecnico: string;
  codigoTecnico: string;

  instaladoEm: string;

  retiradoEm?: string;
  ordemRetirada?: string;
  retiradoPorTecnico?: string;
  retiradoPorCodigoTecnico?: string;

  status:
    | "INSTALADO"
    | "VENDIDO"
    | "RETIRADO";
};

/* =========================================================
   STORAGE
========================================================= */

const STORAGE_OS =
  "wms-expert-ordens-servico";

const STORAGE_PATRIMONIO =
  "wms-expert-patrimonio-cliente";

const EVENTO_OS =
  "wms-ordens-servico-update";

/* =========================================================
   HELPERS
========================================================= */

function podeUsarStorage() {
  return typeof window !== "undefined";
}

function ler<T>(
  chave: string,
  padrao: T
): T {
  if (!podeUsarStorage()) {
    return padrao;
  }

  try {
    const valor =
      localStorage.getItem(chave);

    return valor
      ? (JSON.parse(valor) as T)
      : padrao;
  } catch {
    return padrao;
  }
}

function salvar<T>(
  chave: string,
  valor: T
) {
  if (!podeUsarStorage()) {
    return;
  }

  localStorage.setItem(
    chave,
    JSON.stringify(valor)
  );
}

function disparar() {
  if (!podeUsarStorage()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(EVENTO_OS)
  );
}

/* =========================================================
   MOCK INICIAL
========================================================= */

function criarMockInicial(): OrdemServico[] {
  return [
    {
      id: 2600001,

      codigo: "OS-2600001",

      tipo: "INSTALACAO",

      status: "PENDENTE",

      codigoTecnico: "TEC-114",
      tecnico: "Lucas Ferreira",
      base: "Fortaleza",

      codigoCliente: "CLI-260001",
      cliente:
        "Cliente Teste Fortaleza",

      endereco:
        "Rua das Flores, 150 - Aldeota",

      cidade:
        "Fortaleza - CE",

      dataPrevista:
        new Date().toISOString(),

      observacao:
        "Instalação de internet fibra.",

      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600002,

      codigo: "OS-2600002",

      tipo: "MANUTENCAO",

      status: "PENDENTE",

      codigoTecnico: "TEC-136",
      tecnico: "Daniel Oliveira",
      base: "Maracanaú",

      codigoCliente: "CLI-260002",
      cliente:
        "Cliente Teste Maracanaú",

      endereco:
        "Av. Central, 820",

      cidade:
        "Maracanaú - CE",

      dataPrevista:
        new Date().toISOString(),

      observacao:
        "Atendimento técnico.",

      materiaisPrevistos: [
        {
          id: 260000201,
          codigoProduto: "TEL0007",
          produto: "CAIXA TERMINAÇÃO ÓPTICA PTO",
          unidade: "UN",
          quantidade: 1,
          serialObrigatorio: false,
          seriaisPrevistos: [],
          statusConferencia: "PENDENTE",
        },
        {
          id: 260000202,
          codigoProduto: "TEL0008",
          produto: "SPLITTER ÓPTICO 1X8 SC/APC",
          unidade: "UN",
          quantidade: 1,
          serialObrigatorio: false,
          seriaisPrevistos: [],
          statusConferencia: "PENDENTE",
        },
      ],
      itens: [],
    },

    {
      id: 2600003,
      codigo: "OS-2600003",
      tipo: "RETIRADA",
      status: "PENDENTE",
      codigoTecnico: "TEC-114",
      tecnico: "Lucas Ferreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260001",
      cliente: "Cliente Teste Fortaleza",
      endereco: "Rua das Flores, 150 - Aldeota",
      cidade: "Fortaleza - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Retirada de equipamento em comodato do cliente.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600004,
      codigo: "OS-2600004",
      tipo: "INSTALACAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-060",
      tecnico: "Tony Moreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260004",
      cliente: "Residencial Beira Mar",
      endereco: "Av. Beira Mar, 2450 - Meireles",
      cidade: "Fortaleza - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Instalação de internet fibra - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600005,
      codigo: "OS-2600005",
      tipo: "MANUTENCAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-114",
      tecnico: "Lucas Ferreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260005",
      cliente: "Mercado Central Norte",
      endereco: "Rua São Paulo, 640 - Centro",
      cidade: "Fortaleza - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Manutenção técnica - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600006,
      codigo: "OS-2600006",
      tipo: "TROCA",
      status: "PENDENTE",
      codigoTecnico: "TEC-136",
      tecnico: "Daniel Oliveira",
      base: "Maracanaú",
      codigoCliente: "CLI-260006",
      cliente: "Clínica Aldeota",
      endereco: "Av. Santos Dumont, 1880 - Aldeota",
      cidade: "Fortaleza - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Troca de equipamento - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600007,
      codigo: "OS-2600007",
      tipo: "INSTALACAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-060",
      tecnico: "Tony Moreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260007",
      cliente: "Condomínio Parque Sul",
      endereco: "Rua das Acácias, 320",
      cidade: "Maracanaú - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Instalação de internet fibra - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600008,
      codigo: "OS-2600008",
      tipo: "MANUTENCAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-114",
      tecnico: "Lucas Ferreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260008",
      cliente: "Loja Eusébio Center",
      endereco: "Av. Eusébio de Queiroz, 900",
      cidade: "Eusébio - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Manutenção técnica - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600009,
      codigo: "OS-2600009",
      tipo: "TROCA",
      status: "PENDENTE",
      codigoTecnico: "TEC-136",
      tecnico: "Daniel Oliveira",
      base: "Maracanaú",
      codigoCliente: "CLI-260009",
      cliente: "Empresa Caucaia Telecom",
      endereco: "Av. Dom Almeida Lustosa, 500",
      cidade: "Caucaia - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Troca de equipamento - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600010,
      codigo: "OS-2600010",
      tipo: "INSTALACAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-060",
      tecnico: "Tony Moreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260010",
      cliente: "Farmácia Fortaleza",
      endereco: "Av. Washington Soares, 3100",
      cidade: "Fortaleza - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Instalação de internet fibra - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600011,
      codigo: "OS-2600011",
      tipo: "MANUTENCAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-114",
      tecnico: "Lucas Ferreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260011",
      cliente: "Escritório Messejana",
      endereco: "Rua Padre Pedro de Alencar, 1200",
      cidade: "Fortaleza - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Manutenção técnica - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600012,
      codigo: "OS-2600012",
      tipo: "TROCA",
      status: "PENDENTE",
      codigoTecnico: "TEC-136",
      tecnico: "Daniel Oliveira",
      base: "Maracanaú",
      codigoCliente: "CLI-260012",
      cliente: "Academia Maracanaú",
      endereco: "Av. I, 450",
      cidade: "Maracanaú - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Troca de equipamento - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600013,
      codigo: "OS-2600013",
      tipo: "INSTALACAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-060",
      tecnico: "Tony Moreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260013",
      cliente: "Restaurante Varjota",
      endereco: "Rua Ana Bilhar, 880 - Varjota",
      cidade: "Fortaleza - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Instalação de internet fibra - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600014,
      codigo: "OS-2600014",
      tipo: "MANUTENCAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-114",
      tecnico: "Lucas Ferreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260004",
      cliente: "Residencial Beira Mar",
      endereco: "Av. Beira Mar, 2450 - Meireles",
      cidade: "Fortaleza - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Manutenção técnica - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600015,
      codigo: "OS-2600015",
      tipo: "TROCA",
      status: "PENDENTE",
      codigoTecnico: "TEC-136",
      tecnico: "Daniel Oliveira",
      base: "Maracanaú",
      codigoCliente: "CLI-260005",
      cliente: "Mercado Central Norte",
      endereco: "Rua São Paulo, 640 - Centro",
      cidade: "Fortaleza - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Troca de equipamento - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600016,
      codigo: "OS-2600016",
      tipo: "INSTALACAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-060",
      tecnico: "Tony Moreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260006",
      cliente: "Clínica Aldeota",
      endereco: "Av. Santos Dumont, 1880 - Aldeota",
      cidade: "Fortaleza - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Instalação de internet fibra - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600017,
      codigo: "OS-2600017",
      tipo: "MANUTENCAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-114",
      tecnico: "Lucas Ferreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260007",
      cliente: "Condomínio Parque Sul",
      endereco: "Rua das Acácias, 320",
      cidade: "Maracanaú - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Manutenção técnica - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600018,
      codigo: "OS-2600018",
      tipo: "TROCA",
      status: "PENDENTE",
      codigoTecnico: "TEC-136",
      tecnico: "Daniel Oliveira",
      base: "Maracanaú",
      codigoCliente: "CLI-260008",
      cliente: "Loja Eusébio Center",
      endereco: "Av. Eusébio de Queiroz, 900",
      cidade: "Eusébio - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Troca de equipamento - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600019,
      codigo: "OS-2600019",
      tipo: "INSTALACAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-060",
      tecnico: "Tony Moreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260009",
      cliente: "Empresa Caucaia Telecom",
      endereco: "Av. Dom Almeida Lustosa, 500",
      cidade: "Caucaia - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Instalação de internet fibra - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600020,
      codigo: "OS-2600020",
      tipo: "MANUTENCAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-114",
      tecnico: "Lucas Ferreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260010",
      cliente: "Farmácia Fortaleza",
      endereco: "Av. Washington Soares, 3100",
      cidade: "Fortaleza - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Manutenção técnica - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600021,
      codigo: "OS-2600021",
      tipo: "TROCA",
      status: "PENDENTE",
      codigoTecnico: "TEC-136",
      tecnico: "Daniel Oliveira",
      base: "Maracanaú",
      codigoCliente: "CLI-260011",
      cliente: "Escritório Messejana",
      endereco: "Rua Padre Pedro de Alencar, 1200",
      cidade: "Fortaleza - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Troca de equipamento - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600022,
      codigo: "OS-2600022",
      tipo: "INSTALACAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-060",
      tecnico: "Tony Moreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260012",
      cliente: "Academia Maracanaú",
      endereco: "Av. I, 450",
      cidade: "Maracanaú - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Instalação de internet fibra - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600023,
      codigo: "OS-2600023",
      tipo: "MANUTENCAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-114",
      tecnico: "Lucas Ferreira",
      base: "Fortaleza",
      codigoCliente: "CLI-260013",
      cliente: "Restaurante Varjota",
      endereco: "Rua Ana Bilhar, 880 - Varjota",
      cidade: "Fortaleza - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Manutenção técnica - cenário de demonstração.",
      materiaisPrevistos: [],
      itens: [],
    },

    {
      id: 2600024,
      codigo: "OS-2600024",
      tipo: "INSTALACAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-074",
      tecnico: "Carlos Lima",
      base: "Caucaia",
      codigoCliente: "CLI-260024",
      cliente: "Residencial Caucaia Norte",
      endereco: "Av. Central, 1450 - Centro",
      cidade: "Caucaia - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Instalação com roteador Mesh Wi-Fi 6.",
      materiaisPrevistos: [
        {
          id: 260002401,
          codigoProduto: "TEL0004",
          produto: "ROTEADOR MESH WI-FI 6",
          unidade: "UN",
          quantidade: 1,
          serialObrigatorio: true,
          seriaisPrevistos: [],
          statusConferencia: "PENDENTE",
        },
      ],
      itens: [],
    },

    {
      id: 2600025,
      codigo: "OS-2600025",
      tipo: "INSTALACAO",
      status: "PENDENTE",
      codigoTecnico: "TEC-074",
      tecnico: "Carlos Lima",
      base: "Caucaia",
      codigoCliente: "CLI-260025",
      cliente: "Condomínio Icaraí Residence",
      endereco: "Av. Litorânea, 780 - Icaraí",
      cidade: "Caucaia - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Instalação com ONT GPON Dual Band.",
      materiaisPrevistos: [
        {
          id: 260002501,
          codigoProduto: "TEL0005",
          produto: "ONT GPON DUAL BAND",
          unidade: "UN",
          quantidade: 1,
          serialObrigatorio: true,
          seriaisPrevistos: [],
          statusConferencia: "PENDENTE",
        },
      ],
      itens: [],
    },

    {
      id: 2600026,
      codigo: "OS-2600026",
      tipo: "TROCA",
      status: "PENDENTE",
      codigoTecnico: "TEC-074",
      tecnico: "Carlos Lima",
      base: "Caucaia",
      codigoCliente: "CLI-260026",
      cliente: "Empresa Jurema Telecom",
      endereco: "Rua das Palmeiras, 420 - Jurema",
      cidade: "Caucaia - CE",
      dataPrevista: new Date().toISOString(),
      observacao: "Troca de equipamento utilizando material disponível no estoque móvel.",
      materiaisPrevistos: [
        {
          id: 260002601,
          codigoProduto: "TEL0004",
          produto: "ROTEADOR MESH WI-FI 6",
          unidade: "UN",
          quantidade: 1,
          serialObrigatorio: true,
          seriaisPrevistos: [],
          statusConferencia: "PENDENTE",
        },
        {
          id: 260002602,
          codigoProduto: "TEL0005",
          produto: "ONT GPON DUAL BAND",
          unidade: "UN",
          quantidade: 1,
          serialObrigatorio: true,
          seriaisPrevistos: [],
          statusConferencia: "PENDENTE",
        },
      ],
      itens: [],
    },
  ];
}

/* =========================================================
   GARANTIR MOCK
========================================================= */

function garantirDados() {
  if (!podeUsarStorage()) {
    return;
  }

  const mocks = criarMockInicial();
  const existente = localStorage.getItem(STORAGE_OS);

  if (!existente) {
    salvar(STORAGE_OS, mocks);
    return;
  }

  try {
    const atuais = JSON.parse(existente) as OrdemServico[];
    let alterou = false;

    for (const mock of mocks) {
      const indice = atuais.findIndex((item) => item.id === mock.id);

      if (indice < 0) {
        atuais.push(mock);
        alterou = true;
        continue;
      }

      const atual = atuais[indice] as OrdemServico & {
        materiaisPrevistos?: MaterialPrevistoOS[];
      };

      if (!Array.isArray(atual.materiaisPrevistos)) {
        atuais[indice] = {
          ...atual,
          materiaisPrevistos: (mock.materiaisPrevistos ?? []).map((material) => ({
            ...material,
            seriaisPrevistos: [...(material.seriaisPrevistos ?? [])],
            statusConferencia: material.statusConferencia ?? "PENDENTE",
          })),
        };
        alterou = true;
      }
    }

    if (alterou) {
      salvar(STORAGE_OS, atuais);
    }
  } catch {
    salvar(STORAGE_OS, mocks);
  }
}

/* =========================================================
   CARREGAR
========================================================= */

export function carregarOrdensServico() {
  garantirDados();

  return ler<OrdemServico[]>(
    STORAGE_OS,
    []
  );
}

/* =========================================================
   OBTER OS
========================================================= */

export function obterOrdemServico(
  id: number
) {
  return carregarOrdensServico().find(
    (os) => os.id === id
  );
}

/* =========================================================
   FSM V02 - MOTOR DE ESTADOS E AUDITORIA
   Nao altera estoque, patrimonio nem materiais.
========================================================= */

const TRANSICOES_FSM: Record<EstadoFSMOS, readonly EstadoFSMOS[]> = {
  PENDENTE: ["EM_DESLOCAMENTO", "EM_ATENDIMENTO", "CANCELADA"],
  EM_DESLOCAMENTO: ["NO_LOCAL", "PENDENTE_REAGENDAMENTO", "PENDENTE_TRATATIVA"],
  NO_LOCAL: ["EM_ATENDIMENTO", "PENDENTE_REAGENDAMENTO", "PENDENTE_TRATATIVA"],
  EM_ATENDIMENTO: ["PENDENTE_REAGENDAMENTO", "PENDENTE_TRATATIVA"],
  PENDENTE_REAGENDAMENTO: ["EM_DESLOCAMENTO", "CANCELADA"],
  PENDENTE_TRATATIVA: ["EM_DESLOCAMENTO", "CANCELADA"],
  FINALIZADA: [],
  CANCELADA: [],
};

function criarEventoFSM(
  ordem: OrdemServico,
  anterior: EstadoFSMOS,
  novo: EstadoFSMOS,
  observacao?: string,
  motivo?: string
): EventoFSMOS {
  const ocorridoEm = new Date().toISOString();
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${ordem.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id, estadoAnterior: anterior, estadoNovo: novo, ocorridoEm,
    codigoTecnico: ordem.codigoTecnico, tecnico: ordem.tecnico,
    ...(motivo ? { motivo } : {}),
    ...(observacao ? { observacao } : {}),
  };
}

export function obterEstadoFSMOS(ordem: OrdemServico): EstadoFSMOS {
  return ordem.estadoFSM ?? ordem.status;
}

export function listarHistoricoFSMOS(id: number): EventoFSMOS[] {
  const ordem = obterOrdemServico(id);
  if (!ordem) throw new Error("Ordem de serviço não encontrada.");
  return [...(ordem.historicoFSM ?? [])];
}

/**
 * V02: altera apenas o estado operacional e registra auditoria.
 * FINALIZADA nao e permitida aqui: a finalizacao real deve passar por
 * finalizarOrdemServico, que valida e movimenta estoque/patrimonio.
 */
export function transicionarEstadoFSMOS(
  id: number,
  destino: EstadoFSMOS,
  dados: { motivo?: string; observacao?: string; justificativaAntecipacao?: string } = {}
): OrdemServico {
  const ordem = obterOrdemServico(id);
  if (!ordem) throw new Error("Ordem de serviço não encontrada.");
  const atual = obterEstadoFSMOS(ordem);
  if (atual === destino) throw new Error("A OS ja esta neste estado.");
  if (destino === "FINALIZADA") {
    throw new Error("Para concluir a OS, utilize a finalizacao com validacao de materiais.");
  }
  if (!TRANSICOES_FSM[atual].includes(destino)) {
    throw new Error(`Transicao invalida: ${atual} -> ${destino}.`);
  }
  // V06: uma OS reagendada nao pode voltar ao deslocamento antes da data prevista.
  // A data e comparada em calendario local, evitando deslocamentos por fuso horario.
  if (atual === "PENDENTE_REAGENDAMENTO" && destino === "EM_DESLOCAMENTO") {
    const dataPrevista = ordem.agendamentoFSM?.novaData ?? ordem.dataPrevista;
    if (!dataPrevista || !/^\d{4}-\d{2}-\d{2}$/.test(dataPrevista)) {
      throw new Error("A OS reagendada nao possui uma data valida. Regularize o agendamento antes de retomar.");
    }
    const hoje = new Date();
    const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    if (dataPrevista > dataHoje && (dados.justificativaAntecipacao?.trim().length ?? 0) < 10) {
      throw new Error(`Antecipacao da OS reagendada para ${formatarDataBRFSM(dataPrevista)}: informe justificativa de pelo menos 10 caracteres.`);
    }
  }
  if (["PENDENTE_REAGENDAMENTO", "PENDENTE_TRATATIVA", "CANCELADA"].includes(destino)
    && !dados.motivo?.trim()) {
    throw new Error("Informe o motivo da transicao.");
  }
  const proxima: OrdemServico = {
    ...ordem,
    estadoFSM: destino,
    ...(atual === "PENDENTE_REAGENDAMENTO" && destino === "EM_DESLOCAMENTO" && dados.justificativaAntecipacao?.trim()
      ? { antecipacaoFSM: { dataOriginal: ordem.agendamentoFSM?.novaData ?? ordem.dataPrevista, justificativa: dados.justificativaAntecipacao.trim(), registradoEm: new Date().toISOString(), codigoTecnico: ordem.codigoTecnico, tecnico: ordem.tecnico } }
      : {}),
    historicoFSM: [
      ...(ordem.historicoFSM ?? []),
      { ...criarEventoFSM(ordem, atual, destino,
          dados.justificativaAntecipacao?.trim()
            ? `ANTECIPACAO JUSTIFICADA: ${dados.justificativaAntecipacao.trim()} | Data originalmente agendada: ${formatarDataBRFSM(ordem.agendamentoFSM?.novaData ?? ordem.dataPrevista)}`
            : dados.observacao?.trim(),
          dados.justificativaAntecipacao?.trim() ? "ANTECIPACAO_REAGENDAMENTO" : dados.motivo?.trim()),
        ...(dados.justificativaAntecipacao?.trim() ? { novaData: ordem.agendamentoFSM?.novaData ?? ordem.dataPrevista } : {}) },
    ],
    // Estado legado permanece coerente, sem concluir nem baixar estoque.
    status: destino === "CANCELADA" ? "CANCELADA" :
      destino === "EM_ATENDIMENTO" ? "EM_ATENDIMENTO" : "PENDENTE",
    iniciadoEm: destino === "EM_ATENDIMENTO"
      ? (ordem.iniciadoEm ?? new Date().toISOString()) : ordem.iniciadoEm,
  };
  // O historico ja foi registrado; evita evento duplicado na camada de salvamento.
  return salvarOrdemServico(proxima);
}

/* FSM V05: ocorrencias de campo sem consumo de materiais. */
export type TipoOcorrenciaFSMOS = "CLIENTE_AUSENTE" | "IMPEDIMENTO_TECNICO" | "OUTRO";

export function registrarOcorrenciaFSMOS(
  id: number,
  dados: { tipo: TipoOcorrenciaFSMOS; motivo: string; novaData?: string }
): OrdemServico {
  const ordem = obterOrdemServico(id);
  if (!ordem) throw new Error("Ordem de serviço não encontrada.");
  const atual = obterEstadoFSMOS(ordem);
  if (atual !== "NO_LOCAL" && atual !== "EM_DESLOCAMENTO" && atual !== "EM_ATENDIMENTO") {
    throw new Error("Registre ocorrências somente durante deslocamento, chegada ou atendimento.");
  }
  const motivo = dados.motivo.trim();
  if (motivo.length < 10) throw new Error("Informe uma justificativa com pelo menos 10 caracteres.");
  // Não permitir encerramento por ocorrência quando já há materiais registrados.
  // Evita deixar consumo/patrimônio pendentes sem uma tratativa específica.
  if ((ordem.itens ?? []).length > 0) {
    throw new Error("Esta OS já possui materiais registrados. Resolva os materiais antes de registrar a ocorrência.");
  }
  const reagendar = Boolean(dados.novaData);
  if (reagendar) {
    const novaData = dados.novaData!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novaData) || Number.isNaN(new Date(`${novaData}T12:00:00`).getTime())) {
      throw new Error("Informe uma data válida para o reagendamento.");
    }
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    if (new Date(`${novaData}T12:00:00`) < hoje) throw new Error("A nova data não pode ser anterior a hoje.");
  }
  const destino: EstadoFSMOS = reagendar ? "PENDENTE_REAGENDAMENTO" : "PENDENTE_TRATATIVA";
  const ocorridoEm = new Date().toISOString();
  const evento = criarEventoFSM(ordem, atual, destino, motivo, dados.tipo);
  return salvarOrdemServico({
    ...ordem,
    estadoFSM: destino,
    status: "PENDENTE",
    ocorrenciaFSM: { tipo: dados.tipo, motivo, registradoEm: ocorridoEm },
    ...(reagendar ? { agendamentoFSM: { novaData: dados.novaData!, motivo, registradoEm: ocorridoEm }, dataPrevista: dados.novaData! } : {}),
    historicoFSM: [...(ordem.historicoFSM ?? []), { ...evento, tipoOcorrencia: dados.tipo, ...(reagendar ? { novaData: dados.novaData } : {}) }],
  });
}

/* =========================================================
   SALVAR OS
========================================================= */

function salvarOrdemServico(
  ordem: OrdemServico
) {
  const ordens =
    carregarOrdensServico();

  const indice =
    ordens.findIndex(
      (item) =>
        item.id === ordem.id
    );

  // Compatibilidade: registra transicoes feitas pelo fluxo legado.
  const anterior = indice >= 0 ? ordens[indice] : undefined;
  let proxima = ordem;
  if (anterior && anterior.status !== ordem.status &&
      (ordem.historicoFSM?.length ?? 0) === (anterior.historicoFSM?.length ?? 0)) {
    const novoEstado: EstadoFSMOS = ordem.status;
    const anteriorEstado: EstadoFSMOS = anterior.estadoFSM ?? anterior.status;
    const historico = Array.isArray(ordem.historicoFSM)
      ? ordem.historicoFSM
      : (Array.isArray(anterior.historicoFSM) ? anterior.historicoFSM : []);
    proxima = {
      ...ordem,
      estadoFSM: novoEstado,
      historicoFSM: [...historico, criarEventoFSM(anterior, anteriorEstado, novoEstado, "Transicao pelo fluxo existente")],
    };
  }

  if (indice >= 0) {
    ordens[indice] = proxima;
  } else {
    ordens.push(proxima);
  }

  salvar(
    STORAGE_OS,
    ordens
  );

  disparar();

  return proxima;
}

/* =========================================================
   INICIAR OS
========================================================= */

export function iniciarOrdemServico(
  id: number
) {
  const ordem =
    obterOrdemServico(id);

  if (!ordem) {
    throw new Error(
      "Ordem de serviço não encontrada."
    );
  }

  if (ordem.status === "FINALIZADA" || ordem.status === "CANCELADA") {
    throw new Error("Nao e possivel iniciar uma OS finalizada ou cancelada.");
  }

  const estadoAtual = obterEstadoFSMOS(ordem);
  if (!["PENDENTE", "NO_LOCAL", "EM_ATENDIMENTO"].includes(estadoAtual)) {
    throw new Error(`Nao e possivel iniciar atendimento no estado ${estadoAtual}.`);
  }

  const atualizada: OrdemServico = {
    ...ordem,

    status:
      "EM_ATENDIMENTO",

    iniciadoEm:
      ordem.iniciadoEm ??
      new Date().toISOString(),
    estadoFSM: "EM_ATENDIMENTO",
    historicoFSM: estadoAtual === "EM_ATENDIMENTO"
      ? (ordem.historicoFSM ?? [])
      : [...(ordem.historicoFSM ?? []), criarEventoFSM(ordem, estadoAtual, "EM_ATENDIMENTO", "Inicio de atendimento")],
  };

  return salvarOrdemServico(
    atualizada
  );
}

/* =========================================================
   AVALIAR MATERIAL PREVISTO
========================================================= */

export function avaliarMaterialPrevistoOS(
  ordemId: number,
  materialId: number,
  status: "OK" | "DIVERGENCIA",
  observacaoDivergencia = ""
) {
  const ordem = obterOrdemServico(ordemId);

  if (!ordem) {
    throw new Error("Ordem de serviço não encontrada.");
  }

  if (ordem.status !== "EM_ATENDIMENTO") {
    throw new Error("Inicie o atendimento antes de avaliar os materiais previstos.");
  }

  const material = ordem.materiaisPrevistos.find((item) => item.id === materialId);

  if (!material) {
    throw new Error("Material previsto não encontrado.");
  }

  const atualizada: OrdemServico = {
    ...ordem,
    materiaisPrevistos: ordem.materiaisPrevistos.map((item) =>
      item.id === materialId
        ? {
            ...item,
            statusConferencia: status,
            observacaoDivergencia:
              status === "DIVERGENCIA" ? observacaoDivergencia.trim() : undefined,
          }
        : item
    ),
  };

  return salvarOrdemServico(atualizada);
}

/* =========================================================
   ADICIONAR MATERIAL
========================================================= */

export function adicionarMaterialOS(
  ordemId: number,
  dados: {
    codigoProduto: string;
    quantidade: number;
    seriais: string[];
    destino: DestinoMaterialOS;
  }
) {
  const ordem =
    obterOrdemServico(ordemId);

  if (!ordem) {
    throw new Error(
      "Ordem de serviço não encontrada."
    );
  }

  if (
    ordem.status !==
    "EM_ATENDIMENTO"
  ) {
    throw new Error(
      "Inicie a ordem de serviço antes de informar materiais."
    );
  }

  const estoque =
    carregarEstoqueTecnico();

  const saldo =
    estoque.find(
      (item) =>
        item.codigoTecnico ===
          ordem.codigoTecnico &&
        item.codigoProduto ===
          dados.codigoProduto &&
        item.quantidade > 0
    );

  if (!saldo) {
    throw new Error(
      "Produto não disponível no estoque do técnico."
    );
  }

  if (
    dados.quantidade <= 0
  ) {
    throw new Error(
      "Informe uma quantidade válida."
    );
  }

  if (
    dados.quantidade >
    saldo.quantidade
  ) {
    throw new Error(
      `Saldo insuficiente. Disponível: ${saldo.quantidade} ${saldo.unidade}.`
    );
  }

  let seriais =
    Array.from(
      new Set(
        dados.seriais.filter(Boolean)
      )
    );

  /*
    Nas OS com materiais previstos, o serial pode não vir
    previamente amarrado à OS. Nesse caso, se o produto é
    serializado e a tela confirmou a quantidade, usamos os
    primeiros seriais disponíveis do estoque móvel do técnico.

    Isso mantém a validação: quantidade e seriais continuam
    obrigatoriamente compatíveis com o estoque real.
  */
  if (
    saldo.seriais.length > 0 &&
    seriais.length === 0 &&
    Number.isInteger(dados.quantidade)
  ) {
    seriais = saldo.seriais.slice(0, dados.quantidade);
  }

  if (
    seriais.some(
      (serial) =>
        !saldo.seriais.includes(
          serial
        )
    )
  ) {
    throw new Error(
      "Um dos seriais informados não pertence ao estoque deste técnico."
    );
  }

  /*
    Se o produto possui serial no estoque,
    a quantidade selecionada deve ter a
    mesma quantidade de seriais.
  */

  if (
    saldo.seriais.length > 0 &&
    seriais.length !==
      dados.quantidade
  ) {
    throw new Error(
      `Selecione ${dados.quantidade} serial(is) para este produto.`
    );
  }

  const itensSemMesmoProduto =
    ordem.itens.filter(
      (item) =>
        item.codigoProduto !==
        saldo.codigoProduto
    );

  const novoItem: ItemOrdemServico = {
    id: Date.now(),

    codigoProduto:
      saldo.codigoProduto,

    produto:
      saldo.produto,

    unidade:
      saldo.unidade,

    quantidade:
      dados.quantidade,

    serialObrigatorio:
      saldo.seriais.length > 0,

    seriais,

    destino:
      dados.destino,
  };

  const atualizada: OrdemServico = {
    ...ordem,

    itens: [
      ...itensSemMesmoProduto,
      novoItem,
    ],
  };

  return salvarOrdemServico(
    atualizada
  );
}

/* =========================================================
   REMOVER MATERIAL
========================================================= */

export function removerMaterialOS(
  ordemId: number,
  itemId: number
) {
  const ordem =
    obterOrdemServico(ordemId);

  if (!ordem) {
    throw new Error(
      "Ordem de serviço não encontrada."
    );
  }

  const atualizada: OrdemServico = {
    ...ordem,

    itens:
      ordem.itens.filter(
        (item) =>
          item.id !== itemId
      ),
  };

  return salvarOrdemServico(
    atualizada
  );
}

/* =========================================================
   PATRIMÔNIO CLIENTE
========================================================= */

export function carregarPatrimonioCliente() {
  return ler<PatrimonioCliente[]>(
    STORAGE_PATRIMONIO,
    []
  );
}

/* =========================================================
   PATRIMÔNIO DISPONÍVEL PARA RETIRADA
========================================================= */

export function carregarPatrimonioDisponivelRetirada(
  codigoCliente: string
) {
  return carregarPatrimonioCliente().filter(
    (item) =>
      item.codigoCliente === codigoCliente &&
      item.tipo === "COMODATO" &&
      item.status === "INSTALADO"
  );
}

/* =========================================================
   ADICIONAR PATRIMÔNIO À OS DE RETIRADA
========================================================= */

export function adicionarPatrimonioRetiradaOS(
  ordemId: number,
  patrimonioId: string
) {
  const ordem = obterOrdemServico(ordemId);

  if (!ordem) {
    throw new Error("Ordem de serviço não encontrada.");
  }

  if (ordem.tipo !== "RETIRADA") {
    throw new Error("Esta ordem não é do tipo RETIRADA.");
  }

  if (ordem.status !== "EM_ATENDIMENTO") {
    throw new Error("Inicie o atendimento antes de selecionar o patrimônio.");
  }

  const patrimonio = carregarPatrimonioCliente();
  const ativo = patrimonio.find(
    (item) =>
      item.id === patrimonioId &&
      item.codigoCliente === ordem.codigoCliente &&
      item.tipo === "COMODATO" &&
      item.status === "INSTALADO"
  );

  if (!ativo) {
    throw new Error("Patrimônio não encontrado, já retirado ou não pertence a este cliente.");
  }

  const jaIncluido = ordem.itens.some(
    (item) =>
      item.codigoProduto === ativo.codigoProduto &&
      (!ativo.serial || item.seriais.includes(ativo.serial))
  );

  if (jaIncluido) {
    throw new Error("Este patrimônio já foi incluído nesta retirada.");
  }

  const novoItem: ItemOrdemServico = {
    id: Date.now(),
    codigoProduto: ativo.codigoProduto,
    produto: ativo.produto,
    unidade: "UN",
    quantidade: ativo.quantidade,
    serialObrigatorio: Boolean(ativo.serial),
    seriais: ativo.serial ? [ativo.serial] : [],
    destino: "COMODATO",
  };

  return salvarOrdemServico({
    ...ordem,
    itens: [...ordem.itens, novoItem],
  });
}

/* =========================================================
   DEVOLVER PATRIMÔNIO AO ESTOQUE MÓVEL DO TÉCNICO
========================================================= */

function devolverPatrimonioAoEstoqueTecnico(
  ordem: OrdemServico,
  item: ItemOrdemServico,
  agora: string
) {
  if (!podeUsarStorage()) return;

  const STORAGE_ESTOQUE = "wms-expert-estoque-tecnico";
  const STORAGE_MOVIMENTOS = "wms-expert-movimentacoes-estoque-tecnico";

  type EstoqueLocal = {
    id: string; codigoTecnico: string; tecnico: string; base: string;
    codigoProduto: string; produto: string; unidade: string; quantidade: number;
    seriais: string[]; situacao: "DISPONIVEL" | "RESERVADO"; atualizadoEm: string;
  };

  type MovimentoLocal = {
    id: string; chaveIdempotencia: string; criadoEm: string;
    tipo: "ENTRADA_ACEITE_TECNICO" | "SAIDA_OS" | "AJUSTE";
    requisicaoId?: number; documentoOrigem: string; codigoTecnico: string;
    tecnico: string; base: string; codigoProduto: string; produto: string;
    unidade: string; quantidade: number; seriais: string[]; origem: string; destino: string;
  };

  const estoque = ler<EstoqueLocal[]>(STORAGE_ESTOQUE, []);
  const indice = estoque.findIndex(
    (saldo) =>
      saldo.codigoTecnico === ordem.codigoTecnico &&
      saldo.codigoProduto === item.codigoProduto &&
      saldo.situacao === "DISPONIVEL"
  );

  if (indice >= 0) {
    const atual = estoque[indice];
    estoque[indice] = {
      ...atual,
      quantidade: atual.quantidade + item.quantidade,
      seriais: Array.from(new Set([...(atual.seriais ?? []), ...item.seriais])),
      atualizadoEm: agora,
    };
  } else {
    estoque.push({
      id: `EST-${ordem.codigoTecnico}-${item.codigoProduto}`,
      codigoTecnico: ordem.codigoTecnico, tecnico: ordem.tecnico, base: ordem.base,
      codigoProduto: item.codigoProduto, produto: item.produto, unidade: item.unidade || "UN",
      quantidade: item.quantidade, seriais: [...item.seriais], situacao: "DISPONIVEL", atualizadoEm: agora,
    });
  }

  salvar(STORAGE_ESTOQUE, estoque);

  const movimentos = ler<MovimentoLocal[]>(STORAGE_MOVIMENTOS, []);
  const chave = `RETIRADA-CLIENTE-${ordem.codigo}-${item.codigoProduto}-${item.seriais.join("-") || item.id}`;

  if (!movimentos.some((mov) => mov.chaveIdempotencia === chave)) {
    movimentos.unshift({
      id: `MOV-RET-${ordem.id}-${item.id}-${Date.now()}`,
      chaveIdempotencia: chave, criadoEm: agora, tipo: "AJUSTE", documentoOrigem: ordem.codigo,
      codigoTecnico: ordem.codigoTecnico, tecnico: ordem.tecnico, base: ordem.base,
      codigoProduto: item.codigoProduto, produto: item.produto, unidade: item.unidade || "UN",
      quantidade: item.quantidade, seriais: [...item.seriais], origem: ordem.cliente,
      destino: `Estoque móvel - ${ordem.tecnico}`,
    });
    salvar(STORAGE_MOVIMENTOS, movimentos);
  }

  window.dispatchEvent(new CustomEvent("wms-estoque-tecnico-update"));
}

/* =========================================================
   FINALIZAR OS DE RETIRADA
========================================================= */

function finalizarOrdemRetirada(ordem: OrdemServico) {
  if (ordem.itens.length === 0) {
    throw new Error("Selecione pelo menos um patrimônio para retirada.");
  }

  const patrimonio = carregarPatrimonioCliente();
  const agora = new Date().toISOString();

  for (const item of ordem.itens) {
    const ativo = patrimonio.find(
      (pat) =>
        pat.codigoCliente === ordem.codigoCliente &&
        pat.codigoProduto === item.codigoProduto &&
        pat.tipo === "COMODATO" &&
        pat.status === "INSTALADO" &&
        (item.seriais.length === 0 || item.seriais.includes(pat.serial))
    );
    if (!ativo) {
      throw new Error(`O patrimônio ${item.codigoProduto} não está mais disponível para retirada.`);
    }
  }

  for (const item of ordem.itens) {
    patrimonio.forEach((pat, index) => {
      const corresponde =
        pat.codigoCliente === ordem.codigoCliente &&
        pat.codigoProduto === item.codigoProduto &&
        pat.tipo === "COMODATO" &&
        pat.status === "INSTALADO" &&
        (item.seriais.length === 0 || item.seriais.includes(pat.serial));

      if (!corresponde) return;

      patrimonio[index] = {
        ...pat, status: "RETIRADO", retiradoEm: agora, ordemRetirada: ordem.codigo,
        retiradoPorTecnico: ordem.tecnico, retiradoPorCodigoTecnico: ordem.codigoTecnico,
      };
    });

    devolverPatrimonioAoEstoqueTecnico(ordem, item, agora);
  }

  salvar(STORAGE_PATRIMONIO, patrimonio);

  const finalizada: OrdemServico = {
    ...ordem, status: "FINALIZADA", finalizadoEm: agora,
  };

  salvarOrdemServico(finalizada);
  return finalizada;
}

/* =========================================================
   FINALIZAR OS
========================================================= */

export function finalizarOrdemServico(
  id: number
) {
  const ordem =
    obterOrdemServico(id);

  if (!ordem) {
    throw new Error(
      "Ordem de serviço não encontrada."
    );
  }

  if (
    ordem.status === "FINALIZADA"
  ) {
    return ordem;
  }

  if (
    ordem.status !==
    "EM_ATENDIMENTO"
  ) {
    throw new Error(
      "A ordem de serviço precisa estar em atendimento."
    );
  }

  if (obterEstadoFSMOS(ordem) !== "EM_ATENDIMENTO") {
    throw new Error("A OS deve estar em atendimento para finalizar.");
  }

  if (ordem.tipo === "RETIRADA") {
    return finalizarOrdemRetirada(ordem);
  }

  if (
    ordem.materiaisPrevistos.length > 0 &&
    ordem.materiaisPrevistos.some((item) => item.statusConferencia === "PENDENTE")
  ) {
    throw new Error(
      "Avalie todos os materiais previstos antes de finalizar a OS."
    );
  }

  if (
    ordem.itens.length === 0
  ) {
    throw new Error(
      "Informe pelo menos um material utilizado."
    );
  }

  /*
    Primeiro valida TODOS os saldos.
    Só depois começa a baixar.
  */

  const estoque =
    carregarEstoqueTecnico();

  for (
    const item of ordem.itens
  ) {
    const saldo =
      estoque.find(
        (produto) =>
          produto.codigoTecnico ===
            ordem.codigoTecnico &&
          produto.codigoProduto ===
            item.codigoProduto
      );

    if (!saldo) {
      throw new Error(
        `Produto ${item.codigoProduto} não encontrado no estoque do técnico.`
      );
    }

    if (
      saldo.quantidade <
      item.quantidade
    ) {
      throw new Error(
        `Saldo insuficiente para ${item.codigoProduto}.`
      );
    }

    for (
      const serial of item.seriais
    ) {
      if (
        !saldo.seriais.includes(
          serial
        )
      ) {
        throw new Error(
          `Serial ${serial} não está mais disponível no estoque do técnico.`
        );
      }
    }
  }

  /*
    BAIXA ESTOQUE
  */

  for (
    const item of ordem.itens
  ) {
    baixarEstoqueTecnico({
      codigoTecnico:
        ordem.codigoTecnico,

      codigoProduto:
        item.codigoProduto,

      quantidade:
        item.quantidade,

      documentoOrigem:
        ordem.codigo,

      seriais:
        item.seriais,
    });
  }

  /*
    COMODATO / VENDA
  */

  const patrimonio =
    carregarPatrimonioCliente();

  const agora =
    new Date().toISOString();

  for (
    const item of ordem.itens
  ) {
    if (
      item.destino !==
        "COMODATO" &&
      item.destino !==
        "VENDA"
    ) {
      continue;
    }

    /*
      Serializados
    */

    if (
      item.seriais.length > 0
    ) {
      item.seriais.forEach(
        (serial) => {
          patrimonio.push({
            id:
              `PAT-${ordem.id}-${item.id}-${serial}`,

            codigoCliente:
              ordem.codigoCliente,

            cliente:
              ordem.cliente,

            ordemServico:
              ordem.codigo,

            codigoProduto:
              item.codigoProduto,

            produto:
              item.produto,

            serial,

            quantidade: 1,

            tipo:
              item.destino,

            tecnico:
              ordem.tecnico,

            codigoTecnico:
              ordem.codigoTecnico,

            instaladoEm:
              agora,

            status:
              item.destino ===
              "COMODATO"
                ? "INSTALADO"
                : "VENDIDO",
          });
        }
      );

      continue;
    }

    /*
      Não serializados:
      registra vínculo do consumo com cliente.
    */

    patrimonio.push({
      id:
        `PAT-${ordem.id}-${item.id}`,

      codigoCliente:
        ordem.codigoCliente,

      cliente:
        ordem.cliente,

      ordemServico:
        ordem.codigo,

      codigoProduto:
        item.codigoProduto,

      produto:
        item.produto,

      serial: "",

      quantidade:
        item.quantidade,

      tipo:
        item.destino,

      tecnico:
        ordem.tecnico,

      codigoTecnico:
        ordem.codigoTecnico,

      instaladoEm:
        agora,

      status:
        item.destino ===
        "COMODATO"
          ? "INSTALADO"
          : "VENDIDO",
    });
  }

  salvar(
    STORAGE_PATRIMONIO,
    patrimonio
  );

  const finalizada: OrdemServico = {
    ...ordem,

    status:
      "FINALIZADA",

    finalizadoEm:
      agora,
  };

  salvarOrdemServico(
    finalizada
  );

  return finalizada;
}

/* =========================================================
   OUVIR ALTERAÇÕES
========================================================= */

export function ouvirOrdensServico(
  callback: () => void
) {
  if (!podeUsarStorage()) {
    return () => {};
  }

  const evento = () =>
    callback();

  const storage = (
    event: StorageEvent
  ) => {
    if (
      !event.key ||
      event.key === STORAGE_OS ||
      event.key ===
        STORAGE_PATRIMONIO
    ) {
      callback();
    }
  };

  window.addEventListener(
    EVENTO_OS,
    evento
  );

  window.addEventListener(
    "storage",
    storage
  );

  return () => {
    window.removeEventListener(
      EVENTO_OS,
      evento
    );

    window.removeEventListener(
      "storage",
      storage
    );
  };
}
/** Formata datas ISO para mensagens e histórico em português brasileiro. */
function formatarDataBRFSM(valor?: string): string {
  if (!valor) return "—";
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : valor;
}


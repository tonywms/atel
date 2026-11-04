"use client";



import {

  requisicoesTecnicasMock,

  RequisicaoTecnica,

} from "@/lib/requisicoesTecnicas";



import { gerarRetornoDaRequisicao } from "@/lib/retornosStore";
import { registrarAceiteEstoqueTecnico } from "@/lib/estoqueTecnicoStore";



/* =========================================================

   STATUS DA REQUISIÇÃO

========================================================= */



export type StatusRequisicao =

  | "PENDENTE"

  | "EM_SEPARACAO"

  | "SEPARADA"

  | "EM_CONFERENCIA"

  | "CONFERIDA"

  | "EMBARCADA"

  | "EM_TRANSITO"

  | "ACEITE_PENDENTE"

  | "RECEBIDA_TECNICO"

  | "RECUSA_PARCIAL"

  | "RECUSA_TOTAL";



/* =========================================================

   SEPARAÇÃO

========================================================= */



export type ItemSeparacao = {

  itemId: number;

  quantidadeSeparada: number;

  seriais: string[];

};



/* =========================================================

   CONFERÊNCIA

========================================================= */



export type ItemConferencia = {

  itemId: number;

  quantidadeConferida: number;

  seriais: string[];

};



/* =========================================================

   VOLUMES

========================================================= */



export type StatusVolume =

  | "ABERTO"

  | "FECHADO"

  | "EMBARCADO"

  | "EM_TRANSITO"

  | "RECEBIDO";



export type ItemVolume = {

  itemId: number;

  quantidade: number;

  seriais: string[];

};



export type VolumeRequisicao = {

  id: number;



  codigo: string;



  status: StatusVolume;



  itens: Record<number, ItemVolume>;



  criadoEm: string;



  fechadoEm?: string;



  embarcadoEm?: string;



  recebidoEm?: string;

};



export type TipoDivergenciaRecebimento = "FALTANTE" | "QUANTIDADE_DIVERGENTE" | "AVARIADO" | "PRODUTO_ERRADO" | "SERIAL_DIVERGENTE";

export type SituacaoItemRecebimento = "OK" | "DIVERGENCIA";

export type DecisaoRecebimento = "ACEITE_TOTAL" | "ACEITE_PARCIAL" | "RECUSA_ITEM" | "RECUSA_VOLUME";

export type ConferenciaItemRecebimento = { volumeId:number; itemId:number; situacao:SituacaoItemRecebimento; decisao:DecisaoRecebimento; quantidadeEsperada:number; quantidadeRecebida:number; quantidadeAceita:number; quantidadeRecusada:number; tipoDivergencia?:TipoDivergenciaRecebimento; observacao?:string; seriaisEsperados:string[]; seriaisRecebidos:string[]; seriaisAceitos:string[]; seriaisRecusados:string[]; conferidoEm:string; };



/* =========================================================

   ESTADO COMPLETO DA REQUISIÇÃO

========================================================= */



export type EstadoRequisicao = {

  requisicaoId: number;



  status: StatusRequisicao;



  itens: Record<number, ItemSeparacao>;



  conferencia: Record<number, ItemConferencia>;



  volumes: VolumeRequisicao[];



  iniciadoEm?: string;



  separadoEm?: string;



  conferenciaIniciadaEm?: string;



  conferidoEm?: string;



  embarcadoEm?: string;



  transitoEm?: string;



  recebidoTecnicoEm?: string;

  recebimentoTecnico?: {

    iniciadoEm?: string;

    finalizadoEm?: string;

    volumesLidos: Record<number, string>;

    itensConferidos: Record<string, ConferenciaItemRecebimento>;

  };

};



/* =========================================================

   STORAGE

========================================================= */



const STORAGE_KEY =

  "wms-expert-requisicoes";



const EVENTO_ATUALIZACAO =

  "wms-requisicoes-update";



/* =========================================================

   HELPERS

========================================================= */



function podeUsarStorage() {

  return typeof window !== "undefined";

}



function criarEstadoInicial(

  requisicao: RequisicaoTecnica

): EstadoRequisicao {

  return {

    requisicaoId: requisicao.id,



    status:

      (requisicao.status as StatusRequisicao) ||

      "PENDENTE",



    itens: {},



    conferencia: {},



    volumes: [],

  };

}



function normalizarEstado(

  estado: EstadoRequisicao

): EstadoRequisicao {

  return {

    ...estado,



    itens:

      estado.itens ?? {},



    conferencia:

      estado.conferencia ?? {},



    volumes:

      estado.volumes ?? [],

    recebimentoTecnico: {

      ...(estado.recebimentoTecnico ?? {}),

      volumesLidos: estado.recebimentoTecnico?.volumesLidos ?? {},

    },

  };

}



/* =========================================================

   CARREGAR ESTADOS

========================================================= */



export function carregarEstados(): Record<

  number,

  EstadoRequisicao

> {

  if (!podeUsarStorage()) {

    return {};

  }



  try {

    const valor =

      localStorage.getItem(

        STORAGE_KEY

      );



    if (!valor) {

      return {};

    }



    const dados =

      JSON.parse(valor) as Record<

        number,

        EstadoRequisicao

      >;



    const normalizados: Record<

      number,

      EstadoRequisicao

    > = {};



    Object.entries(dados).forEach(

      ([id, estado]) => {

        normalizados[

          Number(id)

        ] = normalizarEstado(

          estado

        );

      }

    );



    return normalizados;

  } catch (error) {

    console.error(

      "Erro ao carregar estado das requisições:",

      error

    );



    return {};

  }

}



/* =========================================================

   SALVAR ESTADOS

========================================================= */



function salvarEstados(

  estados: Record<

    number,

    EstadoRequisicao

  >

) {

  if (!podeUsarStorage()) {

    return;

  }



  localStorage.setItem(

    STORAGE_KEY,

    JSON.stringify(estados)

  );



  window.dispatchEvent(

    new CustomEvent(

      EVENTO_ATUALIZACAO

    )

  );

}



/* =========================================================

   OBTER ESTADO

========================================================= */



export function obterEstado(

  requisicao: RequisicaoTecnica

): EstadoRequisicao {

  const estados =

    carregarEstados();



  const estado =

    estados[requisicao.id];



  if (estado) {

    return normalizarEstado(

      estado

    );

  }



  return criarEstadoInicial(

    requisicao

  );

}



/* =========================================================

   SEPARAÇÃO

========================================================= */



export function iniciarSeparacao(

  requisicao: RequisicaoTecnica

) {

  const estados =

    carregarEstados();



  const atual =

    estados[requisicao.id] ??

    criarEstadoInicial(

      requisicao

    );



  /*

   * Não deixa uma requisição já avançada

   * voltar para EM_SEPARACAO.

   */

  if (

    [

      "SEPARADA",

      "EM_CONFERENCIA",

      "CONFERIDA",

      "EMBARCADA",

      "EM_TRANSITO",

      "ACEITE_PENDENTE",

      "RECEBIDA_TECNICO",

    ].includes(atual.status)

  ) {

    return normalizarEstado(

      atual

    );

  }



  const novo: EstadoRequisicao =

    {

      ...normalizarEstado(

        atual

      ),



      status:

        "EM_SEPARACAO",



      iniciadoEm:

        atual.iniciadoEm ??

        new Date().toISOString(),

    };



  estados[requisicao.id] =

    novo;



  salvarEstados(estados);



  return novo;

}



/* =========================================================

   REGISTRAR ITEM DA SEPARAÇÃO

========================================================= */



export function registrarSeparacaoItem(

  requisicao: RequisicaoTecnica,

  itemId: number,

  quantidade: number,

  seriais: string[] = []

) {

  const estados =

    carregarEstados();



  const atual =

    normalizarEstado(

      estados[

        requisicao.id

      ] ??

        criarEstadoInicial(

          requisicao

        )

    );



  atual.itens[itemId] = {

    itemId,



    quantidadeSeparada:

      quantidade,



    seriais: [

      ...seriais,

    ],

  };



  if (

    atual.status ===

      "PENDENTE" ||

    atual.status ===

      "EM_SEPARACAO"

  ) {

    atual.status =

      "EM_SEPARACAO";

  }



  atual.iniciadoEm =

    atual.iniciadoEm ??

    new Date().toISOString();



  estados[requisicao.id] =

    atual;



  salvarEstados(estados);



  return atual;

}



/* =========================================================

   ITEM ESTÁ SEPARADO?

========================================================= */



export function itemEstaSeparado(

  requisicao: RequisicaoTecnica,

  itemId: number

) {

  const estado =

    obterEstado(requisicao);



  const original =

    requisicao.itens.find(

      (item) =>

        item.id === itemId

    );



  const separado =

    estado.itens[itemId];



  if (

    !original ||

    !separado

  ) {

    return false;

  }



  return (

    separado.quantidadeSeparada >=

    original.solicitado

  );

}



/* =========================================================

   TODOS SEPARADOS?

========================================================= */



export function todosItensSeparados(

  requisicao: RequisicaoTecnica

) {

  return requisicao.itens.every(

    (item) =>

      itemEstaSeparado(

        requisicao,

        item.id

      )

  );

}



/* =========================================================

   FINALIZAR SEPARAÇÃO

========================================================= */



export function finalizarSeparacao(

  requisicao: RequisicaoTecnica

) {

  if (

    !todosItensSeparados(

      requisicao

    )

  ) {

    throw new Error(

      "Todos os itens precisam estar separados antes da finalização."

    );

  }



  const estados =

    carregarEstados();



  const atual =

    normalizarEstado(

      estados[

        requisicao.id

      ] ??

        criarEstadoInicial(

          requisicao

        )

    );



  atual.status =

    "SEPARADA";



  atual.separadoEm =

    atual.separadoEm ??

    new Date().toISOString();



  estados[requisicao.id] =

    atual;



  salvarEstados(estados);



  return atual;

}



/* =========================================================

   CONFERÊNCIA

========================================================= */



export function iniciarConferencia(

  requisicao: RequisicaoTecnica

) {

  const estados =

    carregarEstados();



  const atual =

    normalizarEstado(

      estados[

        requisicao.id

      ] ??

        criarEstadoInicial(

          requisicao

        )

    );



  if (

    [

      "CONFERIDA",

      "EMBARCADA",

      "EM_TRANSITO",

      "ACEITE_PENDENTE",

      "RECEBIDA_TECNICO",

    ].includes(atual.status)

  ) {

    return atual;

  }



  if (

    atual.status !==

      "SEPARADA" &&

    atual.status !==

      "EM_CONFERENCIA"

  ) {

    throw new Error(

      "A requisição precisa estar separada antes de iniciar a conferência."

    );

  }



  atual.status =

    "EM_CONFERENCIA";



  atual.conferenciaIniciadaEm =

    atual.conferenciaIniciadaEm ??

    new Date().toISOString();



  estados[requisicao.id] =

    atual;



  salvarEstados(estados);



  return atual;

}



/* =========================================================

   REGISTRAR ITEM DA CONFERÊNCIA

========================================================= */



export function registrarConferenciaItem(

  requisicao: RequisicaoTecnica,

  itemId: number,

  quantidade: number,

  seriais: string[] = []

) {

  const estados =

    carregarEstados();



  const atual =

    normalizarEstado(

      estados[

        requisicao.id

      ] ??

        criarEstadoInicial(

          requisicao

        )

    );



  const separado =

    atual.itens[itemId];



  if (!separado) {

    throw new Error(

      "O produto não possui separação registrada."

    );

  }



  if (

    quantidade >

    separado.quantidadeSeparada

  ) {

    throw new Error(

      "A quantidade conferida não pode ser maior que a quantidade separada."

    );

  }



  atual.conferencia[

    itemId

  ] = {

    itemId,



    quantidadeConferida:

      quantidade,



    seriais: [

      ...seriais,

    ],

  };



  if (

    atual.status ===

      "SEPARADA" ||

    atual.status ===

      "EM_CONFERENCIA"

  ) {

    atual.status =

      "EM_CONFERENCIA";

  }



  atual.conferenciaIniciadaEm =

    atual.conferenciaIniciadaEm ??

    new Date().toISOString();



  estados[requisicao.id] =

    atual;



  salvarEstados(estados);



  return atual;

}



/* =========================================================

   ITEM ESTÁ CONFERIDO?

========================================================= */



export function itemEstaConferido(

  requisicao: RequisicaoTecnica,

  itemId: number

) {

  const estado =

    obterEstado(requisicao);



  const separado =

    estado.itens[itemId];



  const conferido =

    estado.conferencia[

      itemId

    ];



  if (

    !separado ||

    !conferido

  ) {

    return false;

  }



  return (

    conferido.quantidadeConferida >=

    separado.quantidadeSeparada

  );

}



/* =========================================================

   TODOS CONFERIDOS?

========================================================= */



export function todosItensConferidos(

  requisicao: RequisicaoTecnica

) {

  return requisicao.itens.every(

    (item) =>

      itemEstaConferido(

        requisicao,

        item.id

      )

  );

}



/* =========================================================

   VOLUME - HELPERS

========================================================= */



function numeroRequisicao(

  requisicao: RequisicaoTecnica

) {

  return requisicao.codigo.replace(

    /^REQ-/i,

    ""

  );

}



function gerarCodigoVolume(

  requisicao: RequisicaoTecnica,

  sequencia: number

) {

  return `VOL-${numeroRequisicao(

    requisicao

  )}-${String(

    sequencia

  ).padStart(3, "0")}`;

}



function proximoIdVolume(

  estado: EstadoRequisicao

) {

  if (

    estado.volumes.length ===

    0

  ) {

    return 1;

  }



  return (

    Math.max(

      ...estado.volumes.map(

        (volume) =>

          volume.id

      )

    ) + 1

  );

}



/* =========================================================

   LISTAR VOLUMES

========================================================= */



export function listarVolumes(

  requisicao: RequisicaoTecnica

) {

  return obterEstado(

    requisicao

  ).volumes;

}



/* =========================================================

   OBTER VOLUME

========================================================= */



export function obterVolume(

  requisicao: RequisicaoTecnica,

  volumeId: number

) {

  const estado =

    obterEstado(requisicao);



  return estado.volumes.find(

    (volume) =>

      volume.id ===

      volumeId

  );

}



/* =========================================================

   OBTER VOLUME PELO CÓDIGO

========================================================= */



export function obterVolumePorCodigo(

  requisicao: RequisicaoTecnica,

  codigo: string

) {

  const estado =

    obterEstado(requisicao);



  const codigoNormalizado =

    codigo

      .trim()

      .toUpperCase();



  return estado.volumes.find(

    (volume) =>

      volume.codigo.toUpperCase() ===

      codigoNormalizado

  );

}



/* =========================================================

   CRIAR VOLUME

========================================================= */



export function criarVolume(

  requisicao: RequisicaoTecnica

) {

  const estados =

    carregarEstados();



  const atual =

    normalizarEstado(

      estados[

        requisicao.id

      ] ??

        criarEstadoInicial(

          requisicao

        )

    );



  if (

    atual.status !==

      "EM_CONFERENCIA" &&

    atual.status !==

      "CONFERIDA"

  ) {

    throw new Error(

      "O volume somente pode ser criado durante a conferência."

    );

  }



  /*

   * Não deixa criar outro volume

   * enquanto existir um aberto.

   */

  const volumeAberto =

    atual.volumes.find(

      (volume) =>

        volume.status ===

        "ABERTO"

    );



  if (volumeAberto) {

    return volumeAberto;

  }



  const id =

    proximoIdVolume(

      atual

    );



  const volume: VolumeRequisicao =

    {

      id,



      codigo:

        gerarCodigoVolume(

          requisicao,

          id

        ),



      status: "ABERTO",



      itens: {},



      criadoEm:

        new Date().toISOString(),

    };



  atual.volumes.push(

    volume

  );



  estados[requisicao.id] =

    atual;



  salvarEstados(estados);



  return volume;

}



/* =========================================================

   ADICIONAR ITEM AO VOLUME

========================================================= */



export function adicionarItemAoVolume(

  requisicao: RequisicaoTecnica,

  volumeId: number,

  itemId: number,

  quantidade: number,

  seriais: string[] = []

) {

  const estados =

    carregarEstados();



  const atual =

    normalizarEstado(

      estados[

        requisicao.id

      ] ??

        criarEstadoInicial(

          requisicao

        )

    );



  const volume =

    atual.volumes.find(

      (item) =>

        item.id ===

        volumeId

    );



  if (!volume) {

    throw new Error(

      "Volume não encontrado."

    );

  }



  if (

    volume.status !==

    "ABERTO"

  ) {

    throw new Error(

      "O volume já está fechado."

    );

  }



  const conferencia =

    atual.conferencia[

      itemId

    ];



  if (!conferencia) {

    throw new Error(

      "O produto precisa estar conferido antes de ser colocado no volume."

    );

  }



  if (quantidade <= 0) {

    throw new Error(

      "Informe uma quantidade válida para o volume."

    );

  }



  /*

   * Soma quanto deste produto já foi colocado

   * em OUTROS volumes.

   */

  const quantidadeEmOutrosVolumes =

    atual.volumes.reduce(

      (

        total,

        volumeAtual

      ) => {

        if (

          volumeAtual.id ===

          volumeId

        ) {

          return total;

        }



        return (

          total +

          (volumeAtual.itens[

            itemId

          ]?.quantidade ??

            0)

        );

      },

      0

    );



  const disponivel =

    conferencia.quantidadeConferida -

    quantidadeEmOutrosVolumes;



  if (

    quantidade >

    disponivel

  ) {

    throw new Error(

      `Quantidade maior que o saldo conferido disponível para volume. Disponível: ${disponivel}.`

    );

  }



  /*

   * Para produto serializado:

   * impede serial duplicado entre volumes.

   */

  if (

    seriais.length > 0

  ) {

    const seriaisConferidos =

      conferencia.seriais ?? [];



    for (

      const serial of seriais

    ) {

      if (

        !seriaisConferidos.includes(

          serial

        )

      ) {

        throw new Error(

          `O serial ${serial} não foi conferido.`

        );

      }



      const serialJaUsado =

        atual.volumes.some(

          (volumeAtual) =>

            volumeAtual.id !==

              volumeId &&

            Object.values(

              volumeAtual.itens

            ).some((item) =>

              item.seriais.includes(

                serial

              )

            )

        );



      if (serialJaUsado) {

        throw new Error(

          `O serial ${serial} já pertence a outro volume.`

        );

      }

    }

  }



  volume.itens[itemId] = {

    itemId,



    quantidade,



    seriais: [

      ...seriais,

    ],

  };



  estados[requisicao.id] =

    atual;



  salvarEstados(estados);



  return volume;

}



/* =========================================================

   REMOVER ITEM DO VOLUME

========================================================= */



export function removerItemDoVolume(

  requisicao: RequisicaoTecnica,

  volumeId: number,

  itemId: number

) {

  const estados =

    carregarEstados();



  const atual =

    normalizarEstado(

      estados[

        requisicao.id

      ] ??

        criarEstadoInicial(

          requisicao

        )

    );



  const volume =

    atual.volumes.find(

      (item) =>

        item.id ===

        volumeId

    );



  if (!volume) {

    throw new Error(

      "Volume não encontrado."

    );

  }



  if (

    volume.status !==

    "ABERTO"

  ) {

    throw new Error(

      "Não é possível alterar um volume fechado."

    );

  }



  delete volume.itens[

    itemId

  ];



  estados[requisicao.id] =

    atual;



  salvarEstados(estados);



  return volume;

}



/* =========================================================

   FECHAR VOLUME

========================================================= */



export function fecharVolume(

  requisicao: RequisicaoTecnica,

  volumeId: number

) {

  const estados =

    carregarEstados();



  const atual =

    normalizarEstado(

      estados[

        requisicao.id

      ] ??

        criarEstadoInicial(

          requisicao

        )

    );



  const volume =

    atual.volumes.find(

      (item) =>

        item.id ===

        volumeId

    );



  if (!volume) {

    throw new Error(

      "Volume não encontrado."

    );

  }



  if (

    volume.status ===

    "FECHADO"

  ) {

    return volume;

  }



  if (

    volume.status !==

    "ABERTO"

  ) {

    throw new Error(

      "O volume não pode mais ser fechado."

    );

  }



  if (

    Object.keys(

      volume.itens

    ).length === 0

  ) {

    throw new Error(

      "O volume precisa possuir pelo menos um produto."

    );

  }



  volume.status =

    "FECHADO";



  volume.fechadoEm =

    new Date().toISOString();



  estados[requisicao.id] =

    atual;



  salvarEstados(estados);



  return volume;

}



/* =========================================================

   QUANTIDADE DO ITEM JÁ VOLUMADA

========================================================= */



export function quantidadeItemVolumada(

  requisicao: RequisicaoTecnica,

  itemId: number

) {

  const estado =

    obterEstado(requisicao);



  return estado.volumes.reduce(

    (total, volume) =>

      total +

      (volume.itens[

        itemId

      ]?.quantidade ??

        0),

    0

  );

}



/* =========================================================

   TODOS OS ITENS ESTÃO EM VOLUMES?

========================================================= */



export function todosItensVolumados(

  requisicao: RequisicaoTecnica

) {

  const estado =

    obterEstado(requisicao);



  return requisicao.itens.every(

    (item) => {

      const conferencia =

        estado.conferencia[

          item.id

        ];



      if (!conferencia) {

        return false;

      }



      const volumado =

        estado.volumes.reduce(

          (total, volume) =>

            total +

            (volume.itens[

              item.id

            ]?.quantidade ??

              0),

          0

        );



      return (

        volumado >=

        conferencia.quantidadeConferida

      );

    }

  );

}



/* =========================================================

   TODOS OS VOLUMES ESTÃO FECHADOS?

========================================================= */



export function todosVolumesFechados(

  requisicao: RequisicaoTecnica

) {

  const estado =

    obterEstado(requisicao);



  if (

    estado.volumes.length ===

    0

  ) {

    return false;

  }



  return estado.volumes.every(

    (volume) =>

      volume.status ===

        "FECHADO" ||

      volume.status ===

        "EMBARCADO" ||

      volume.status ===

        "EM_TRANSITO" ||

      volume.status ===

        "RECEBIDO"

  );

}



/* =========================================================

   FINALIZAR CONFERÊNCIA



   NOVA REGRA:

   1 - tudo conferido

   2 - tudo dentro de volume

   3 - todos os volumes fechados

========================================================= */



export function finalizarConferencia(

  requisicao: RequisicaoTecnica

) {

  if (

    !todosItensConferidos(

      requisicao

    )

  ) {

    throw new Error(

      "Todos os itens precisam estar conferidos antes da finalização."

    );

  }



  if (

    !todosItensVolumados(

      requisicao

    )

  ) {

    throw new Error(

      "Todos os produtos conferidos precisam estar vinculados a um volume."

    );

  }



  if (

    !todosVolumesFechados(

      requisicao

    )

  ) {

    throw new Error(

      "Todos os volumes precisam estar fechados antes da finalização da conferência."

    );

  }



  const estados =

    carregarEstados();



  const atual =

    normalizarEstado(

      estados[

        requisicao.id

      ] ??

        criarEstadoInicial(

          requisicao

        )

    );



  atual.status =

    "CONFERIDA";



  atual.conferidoEm =

    atual.conferidoEm ??

    new Date().toISOString();



  estados[requisicao.id] =

    atual;



  salvarEstados(estados);



  return atual;

}



/* =========================================================

   EMBARQUE POR VOLUME



   REGRA:

   - somente requisição CONFERIDA entra no embarque;

   - somente volume FECHADO pode ser bipado;

   - cada leitura marca o volume como EMBARCADO;

   - a requisição só vai para EM_TRANSITO quando TODOS

     os volumes tiverem sido bipados.

========================================================= */



export function iniciarEmbarque(

  requisicao: RequisicaoTecnica

) {

  const estado =

    obterEstado(requisicao);



  if (

    estado.status !== "CONFERIDA" &&

    estado.status !== "EMBARCADA" &&

    estado.status !== "EM_TRANSITO"

  ) {

    throw new Error(

      "Somente requisições conferidas podem entrar no embarque."

    );

  }



  if (

    estado.volumes.length === 0

  ) {

    throw new Error(

      "A requisição não possui volumes para embarque."

    );

  }



  const volumeInvalido =

    estado.volumes.find(

      (volume) =>

        volume.status === "ABERTO"

    );



  if (volumeInvalido) {

    throw new Error(

      `O volume ${volumeInvalido.codigo} ainda está aberto.`

    );

  }



  return estado;

}



/* =========================================================

   REGISTRAR LEITURA DE VOLUME NO EMBARQUE

========================================================= */



export function registrarVolumeEmbarque(

  requisicao: RequisicaoTecnica,

  codigoVolume: string

) {

  const codigo =

    codigoVolume

      .trim()

      .toUpperCase();



  if (!codigo) {

    throw new Error(

      "Leia ou informe o código do volume."

    );

  }



  const estados =

    carregarEstados();



  const atual =

    normalizarEstado(

      estados[

        requisicao.id

      ] ??

        criarEstadoInicial(

          requisicao

        )

    );



  if (

    atual.status !== "CONFERIDA" &&

    atual.status !== "EMBARCADA"

  ) {

    throw new Error(

      "A requisição precisa estar conferida para realizar o embarque."

    );

  }



  const volume =

    atual.volumes.find(

      (item) =>

        item.codigo

          .toUpperCase() ===

        codigo

    );



  if (!volume) {

    throw new Error(

      `O volume ${codigo} não pertence a esta requisição.`

    );

  }



  if (

    volume.status ===

      "EMBARCADO" ||

    volume.status ===

      "EM_TRANSITO" ||

    volume.status ===

      "RECEBIDO"

  ) {

    return volume;

  }



  if (

    volume.status !==

    "FECHADO"

  ) {

    throw new Error(

      `O volume ${volume.codigo} precisa estar fechado antes do embarque.`

    );

  }



  const agora =

    new Date().toISOString();



  volume.status =

    "EMBARCADO";



  volume.embarcadoEm =

    volume.embarcadoEm ??

    agora;



  /*

   * EMBARCADA representa a etapa operacional:

   * volumes sendo lidos no embarque.

   *

   * Só vira EM_TRANSITO no finalizarEmbarque().

   */

  atual.status =

    "EMBARCADA";



  estados[requisicao.id] =

    atual;



  salvarEstados(estados);



  return volume;

}



/* =========================================================

   VOLUMES JÁ LIDOS NO EMBARQUE

========================================================= */



export function volumesLidosEmbarque(

  requisicao: RequisicaoTecnica

) {

  return obterEstado(

    requisicao

  ).volumes.filter(

    (volume) =>

      volume.status ===

        "EMBARCADO" ||

      volume.status ===

        "EM_TRANSITO" ||

      volume.status ===

        "RECEBIDO"

  );

}



/* =========================================================

   TODOS OS VOLUMES FORAM LIDOS?

========================================================= */



export function todosVolumesEmbarcados(

  requisicao: RequisicaoTecnica

) {

  const estado =

    obterEstado(requisicao);



  if (

    estado.volumes.length === 0

  ) {

    return false;

  }



  return estado.volumes.every(

    (volume) =>

      volume.status ===

        "EMBARCADO" ||

      volume.status ===

        "EM_TRANSITO" ||

      volume.status ===

        "RECEBIDO"

  );

}



/* =========================================================

   FINALIZAR EMBARQUE



   Ao finalizar:

   - todos os volumes -> EM_TRANSITO

   - requisição -> EM_TRANSITO

========================================================= */



export function finalizarEmbarque(

  requisicao: RequisicaoTecnica

) {

  const estados =

    carregarEstados();



  const atual =

    normalizarEstado(

      estados[

        requisicao.id

      ] ??

        criarEstadoInicial(

          requisicao

        )

    );



  if (

    atual.status !== "CONFERIDA" &&

    atual.status !== "EMBARCADA"

  ) {

    throw new Error(

      "A requisição não está disponível para finalizar o embarque."

    );

  }



  if (

    atual.volumes.length === 0

  ) {

    throw new Error(

      "Nenhum volume foi gerado para esta requisição."

    );

  }



  const pendentes =

    atual.volumes.filter(

      (volume) =>

        volume.status !==

          "EMBARCADO" &&

        volume.status !==

          "EM_TRANSITO" &&

        volume.status !==

          "RECEBIDO"

    );



  if (

    pendentes.length > 0

  ) {

    throw new Error(

      `Ainda faltam ${pendentes.length} volume(s) para embarcar.`

    );

  }



  const agora =

    new Date().toISOString();



  atual.volumes =

    atual.volumes.map(

      (volume) => ({

        ...volume,



        status:

          volume.status ===

          "RECEBIDO"

            ? "RECEBIDO"

            : "EM_TRANSITO",



        embarcadoEm:

          volume.embarcadoEm ??

          agora,

      })

    );



  atual.status =

    "EM_TRANSITO";



  atual.embarcadoEm =

    atual.embarcadoEm ??

    agora;



  atual.transitoEm =

    atual.transitoEm ??

    agora;



  estados[requisicao.id] =

    atual;



  salvarEstados(estados);



  return atual;

}



/* =========================================================

   RECEBIMENTO / ACEITE PELO TÉCNICO

========================================================= */



export function extrairCodigoVolume(leitura: string) {

  const texto = leitura.trim().toUpperCase();

  if (!texto) return "";

  const match = texto.match(/(?:^|\|)VOLUME=([^|]+)/);

  return match ? match[1].trim() : texto;

}



export function iniciarRecebimentoTecnico(requisicao: RequisicaoTecnica) {

  const estados = carregarEstados();

  const atual = normalizarEstado(estados[requisicao.id] ?? criarEstadoInicial(requisicao));

  if (atual.status !== "EM_TRANSITO" && atual.status !== "ACEITE_PENDENTE" && atual.status !== "RECEBIDA_TECNICO")

    throw new Error("Somente requisições em trânsito podem ser recebidas pelo técnico.");

  if (!atual.volumes.length) throw new Error("A requisição não possui volumes para recebimento.");

  if (atual.status === "RECEBIDA_TECNICO") return atual;

  const agora = new Date().toISOString();

  atual.status = "ACEITE_PENDENTE";

  atual.recebimentoTecnico = { ...(atual.recebimentoTecnico ?? { volumesLidos: {}, itensConferidos: {} }), iniciadoEm: atual.recebimentoTecnico?.iniciadoEm ?? agora, volumesLidos: atual.recebimentoTecnico?.volumesLidos ?? {} };

  estados[requisicao.id] = atual; salvarEstados(estados); return atual;

}



export function registrarVolumeRecebimentoTecnico(requisicao: RequisicaoTecnica, leitura: string) {

  const codigo = extrairCodigoVolume(leitura);

  if (!codigo) throw new Error("Leia ou informe o código do volume.");

  const estados = carregarEstados();

  const atual = normalizarEstado(estados[requisicao.id] ?? criarEstadoInicial(requisicao));

  if (atual.status !== "EM_TRANSITO" && atual.status !== "ACEITE_PENDENTE") throw new Error("Esta requisição não está disponível para recebimento.");

  const volume = atual.volumes.find(v => v.codigo.toUpperCase() === codigo);

  if (!volume) throw new Error(`O volume ${codigo} não pertence a esta requisição.`);

  if (volume.status !== "EM_TRANSITO" && volume.status !== "RECEBIDO") throw new Error(`O volume ${volume.codigo} ainda não está em trânsito.`);

  atual.recebimentoTecnico = atual.recebimentoTecnico ?? { volumesLidos: {}, itensConferidos: {} };

  atual.recebimentoTecnico.volumesLidos = atual.recebimentoTecnico.volumesLidos ?? {};

  atual.recebimentoTecnico.volumesLidos[volume.id] = atual.recebimentoTecnico.volumesLidos[volume.id] ?? new Date().toISOString();

  atual.status = "ACEITE_PENDENTE"; estados[requisicao.id] = atual; salvarEstados(estados); return volume;

}



export function marcarItemRecebimentoOk(requisicao:RequisicaoTecnica,volumeId:number,itemId:number){

  const estados=carregarEstados(); const atual=normalizarEstado(estados[requisicao.id]??criarEstadoInicial(requisicao));

  const volume=atual.volumes.find(v=>v.id===volumeId); const item=volume?.itens?.[itemId];

  if(!volume||!item) throw new Error("Item/volume não encontrado.");

  if(!atual.recebimentoTecnico?.volumesLidos?.[volumeId]&&volume.status!=="RECEBIDO") throw new Error("Leia o volume antes de conferir.");

  atual.recebimentoTecnico??={volumesLidos:{},itensConferidos:{}}; atual.recebimentoTecnico.itensConferidos??={};

  atual.recebimentoTecnico.itensConferidos[`${volumeId}:${itemId}`]={volumeId,itemId,situacao:"OK",decisao:"ACEITE_TOTAL",quantidadeEsperada:item.quantidade,quantidadeRecebida:item.quantidade,quantidadeAceita:item.quantidade,quantidadeRecusada:0,seriaisEsperados:[...(item.seriais??[])],seriaisRecebidos:[...(item.seriais??[])],seriaisAceitos:[...(item.seriais??[])],seriaisRecusados:[],conferidoEm:new Date().toISOString()};

  estados[requisicao.id]=atual; salvarEstados(estados); return atual;

}



export function marcarItemRecebimentoDivergencia(requisicao:RequisicaoTecnica,volumeId:number,itemId:number,dados:{tipo:TipoDivergenciaRecebimento;decisao:Exclude<DecisaoRecebimento,"ACEITE_TOTAL">;quantidadeRecebida:number;quantidadeAceita:number;observacao?:string;seriaisRecebidos?:string[];seriaisAceitos?:string[]}){

  const estados=carregarEstados(); const atual=normalizarEstado(estados[requisicao.id]??criarEstadoInicial(requisicao));

  const volume=atual.volumes.find(v=>v.id===volumeId); const item=volume?.itens?.[itemId];

  if(!volume||!item) throw new Error("Item/volume não encontrado.");

  if(!atual.recebimentoTecnico?.volumesLidos?.[volumeId]&&volume.status!=="RECEBIDO") throw new Error("Leia o volume antes de conferir.");

  const qr=Number(dados.quantidadeRecebida),qa=Number(dados.quantidadeAceita);

  if(!Number.isFinite(qr)||qr<0) throw new Error("Quantidade recebida inválida.");

  if(!Number.isFinite(qa)||qa<0||qa>qr) throw new Error("Quantidade aceita inválida.");

  if(dados.decisao==="RECUSA_ITEM"&&qa!==0) throw new Error("Na recusa do item, a quantidade aceita deve ser zero.");

  const sr=[...(dados.seriaisRecebidos??[])],sa=[...(dados.seriaisAceitos??[])];

  if(sa.some(x=>!sr.includes(x))) throw new Error("Todo serial aceito precisa estar entre os seriais recebidos.");

  atual.recebimentoTecnico??={volumesLidos:{},itensConferidos:{}}; atual.recebimentoTecnico.itensConferidos??={};

  atual.recebimentoTecnico.itensConferidos[`${volumeId}:${itemId}`]={volumeId,itemId,situacao:"DIVERGENCIA",decisao:dados.decisao,quantidadeEsperada:item.quantidade,quantidadeRecebida:qr,quantidadeAceita:qa,quantidadeRecusada:Math.max(qr-qa,0),tipoDivergencia:dados.tipo,observacao:dados.observacao?.trim()||undefined,seriaisEsperados:[...(item.seriais??[])],seriaisRecebidos:sr,seriaisAceitos:sa,seriaisRecusados:sr.filter(x=>!sa.includes(x)),conferidoEm:new Date().toISOString()};

  estados[requisicao.id]=atual; salvarEstados(estados); return atual;

}



export function recusarVolumeRecebimento(requisicao:RequisicaoTecnica,volumeId:number,dados:{tipo:TipoDivergenciaRecebimento;observacao?:string}){

  const estados=carregarEstados(); const atual=normalizarEstado(estados[requisicao.id]??criarEstadoInicial(requisicao)); const volume=atual.volumes.find(v=>v.id===volumeId);

  if(!volume) throw new Error("Volume não encontrado.");

  if(!atual.recebimentoTecnico?.volumesLidos?.[volumeId]&&volume.status!=="RECEBIDO") throw new Error("Leia o volume antes de recusar.");

  atual.recebimentoTecnico??={volumesLidos:{},itensConferidos:{}}; atual.recebimentoTecnico.itensConferidos??={}; const agora=new Date().toISOString();

  for(const item of Object.values(volume.itens??{})) atual.recebimentoTecnico.itensConferidos[`${volumeId}:${item.itemId}`]={volumeId,itemId:item.itemId,situacao:"DIVERGENCIA",decisao:"RECUSA_VOLUME",quantidadeEsperada:item.quantidade,quantidadeRecebida:item.quantidade,quantidadeAceita:0,quantidadeRecusada:item.quantidade,tipoDivergencia:dados.tipo,observacao:dados.observacao?.trim()||undefined,seriaisEsperados:[...(item.seriais??[])],seriaisRecebidos:[...(item.seriais??[])],seriaisAceitos:[],seriaisRecusados:[...(item.seriais??[])],conferidoEm:agora};

  estados[requisicao.id]=atual; salvarEstados(estados); return atual;

}



export function finalizarRecebimentoTecnico(requisicao:RequisicaoTecnica){

  const estados=carregarEstados(); const atual=normalizarEstado(estados[requisicao.id]??criarEstadoInicial(requisicao));

  if(atual.status!=="EM_TRANSITO"&&atual.status!=="ACEITE_PENDENTE") throw new Error("A requisição não está disponível para finalizar o recebimento.");

  const lidos=atual.recebimentoTecnico?.volumesLidos??{},avaliacoes=atual.recebimentoTecnico?.itensConferidos??{}; const pendentes=atual.volumes.filter(v=>!lidos[v.id]&&v.status!=="RECEBIDO");

  if(pendentes.length) throw new Error(`Ainda faltam ${pendentes.length} volume(s) para receber.`);

  let itensPendentes=0; for(const v of atual.volumes) for(const i of Object.values(v.itens??{})) if(!avaliacoes[`${v.id}:${i.itemId}`]) itensPendentes++;

  if(itensPendentes) throw new Error(`Ainda faltam ${itensPendentes} item(ns) para avaliar no recebimento.`);

  const agora=new Date().toISOString(); atual.volumes=atual.volumes.map(v=>({...v,status:"RECEBIDO",recebidoEm:v.recebidoEm??agora})); const retorno=gerarRetornoDaRequisicao(requisicao,avaliacoes,atual.volumes); registrarAceiteEstoqueTecnico(requisicao,avaliacoes); atual.status=retorno?(retorno.tipo==="RECUSA_TOTAL"?"RECUSA_TOTAL":"RECUSA_PARCIAL"):"RECEBIDA_TECNICO"; atual.recebidoTecnicoEm=atual.recebidoTecnicoEm??agora;

  atual.recebimentoTecnico={...(atual.recebimentoTecnico??{volumesLidos:{},itensConferidos:{}}),volumesLidos:atual.recebimentoTecnico?.volumesLidos??{},itensConferidos:atual.recebimentoTecnico?.itensConferidos??{},finalizadoEm:atual.recebimentoTecnico?.finalizadoEm??agora};

  estados[requisicao.id]=atual; salvarEstados(estados); return atual;

}



export function recusarRecebimentoCompleto(requisicao:RequisicaoTecnica,dados:{tipo:TipoDivergenciaRecebimento;observacao?:string}){

  const estados=carregarEstados(); const atual=normalizarEstado(estados[requisicao.id]??criarEstadoInicial(requisicao));

  if(atual.status!=="EM_TRANSITO"&&atual.status!=="ACEITE_PENDENTE") throw new Error("A requisição não está disponível para recusa.");

  atual.recebimentoTecnico??={volumesLidos:{},itensConferidos:{}}; atual.recebimentoTecnico.itensConferidos??={};

  const agora=new Date().toISOString();

  for(const volume of atual.volumes){

    atual.recebimentoTecnico.volumesLidos[volume.id]=atual.recebimentoTecnico.volumesLidos[volume.id]??agora;

    for(const item of Object.values(volume.itens??{})){

      atual.recebimentoTecnico.itensConferidos[`${volume.id}:${item.itemId}`]={volumeId:volume.id,itemId:item.itemId,situacao:"DIVERGENCIA",decisao:"RECUSA_VOLUME",quantidadeEsperada:item.quantidade,quantidadeRecebida:item.quantidade,quantidadeAceita:0,quantidadeRecusada:item.quantidade,tipoDivergencia:dados.tipo,observacao:dados.observacao?.trim()||undefined,seriaisEsperados:[...(item.seriais??[])],seriaisRecebidos:[...(item.seriais??[])],seriaisAceitos:[],seriaisRecusados:[...(item.seriais??[])],conferidoEm:agora};

    }

  }

  atual.status="ACEITE_PENDENTE"; estados[requisicao.id]=atual; salvarEstados(estados); return atual;

}



/* =========================================================

   TOTAL DE VOLUMES

========================================================= */



export function totalVolumes(

  requisicao: RequisicaoTecnica

) {

  return obterEstado(

    requisicao

  ).volumes.length;

}



/* =========================================================

   OUVIR ALTERAÇÕES

========================================================= */



export function ouvirAlteracoes(

  callback: () => void

) {

  if (!podeUsarStorage()) {

    return () => {};

  }



  const atualizar = () =>

    callback();



  const atualizarStorage = (

    event: StorageEvent

  ) => {

    if (

      !event.key ||

      event.key === STORAGE_KEY

    ) {

      callback();

    }

  };



  window.addEventListener(

    EVENTO_ATUALIZACAO,

    atualizar

  );



  window.addEventListener(

    "storage",

    atualizarStorage

  );



  return () => {

    window.removeEventListener(

      EVENTO_ATUALIZACAO,

      atualizar

    );



    window.removeEventListener(

      "storage",

      atualizarStorage

    );

  };

}



/* =========================================================

   UTILIDADE PARA DEMONSTRAÇÃO / DEBUG



   NÃO APAGA O LOCALSTORAGE.

   Apenas retorna a requisição correspondente ao ID.

========================================================= */



export function obterRequisicaoPorId(

  id: number

) {

  return requisicoesTecnicasMock.find(

    (requisicao) =>

      requisicao.id === id

  );

}
"use client";

import type { RequisicaoTecnica } from "@/lib/requisicoesTecnicas";

export type EstoqueTecnico={id:string;codigoTecnico:string;tecnico:string;base:string;codigoProduto:string;produto:string;unidade:string;quantidade:number;seriais:string[];situacao:"DISPONIVEL";atualizadoEm:string};
export type MovimentoEstoqueTecnico={id:string;chaveIdempotencia:string;criadoEm:string;tipo:"ENTRADA_ACEITE_TECNICO"|"SAIDA_OS"|"SAIDA_DEVOLUCAO_CD"|"AJUSTE";requisicaoId?:number;documentoOrigem:string;codigoTecnico:string;tecnico:string;base:string;codigoProduto:string;produto:string;unidade:string;quantidade:number;seriais:string[];origem:string;destino:string};
type AvaliacaoAceite={itemId:number;quantidadeAceita:number;seriaisAceitos?:string[]};
const STORAGE_ESTOQUE="wms-expert-estoque-tecnico";
const STORAGE_MOVIMENTOS="wms-expert-movimentacoes-estoque-tecnico";
const EVENTO="wms-estoque-tecnico-update";
function ok(){return typeof window!=="undefined"}
function ler<T>(k:string,p:T):T{if(!ok())return p;try{const v=localStorage.getItem(k);return v?JSON.parse(v) as T:p}catch{return p}}
function salvar<T>(k:string,v:T){if(ok())localStorage.setItem(k,JSON.stringify(v))}
function emitir(){if(ok())window.dispatchEvent(new CustomEvent(EVENTO))}
export function carregarEstoqueTecnico(){return ler<EstoqueTecnico[]>(STORAGE_ESTOQUE,[])}
export function carregarMovimentacoesEstoqueTecnico(){return ler<MovimentoEstoqueTecnico[]>(STORAGE_MOVIMENTOS,[])}
export function obterEstoqueDoTecnico(codigoTecnico:string){return carregarEstoqueTecnico().filter(x=>x.codigoTecnico===codigoTecnico&&x.quantidade>0)}
export function registrarAceiteEstoqueTecnico(requisicao:RequisicaoTecnica,avaliacoes:Record<string,AvaliacaoAceite>){
 if(!ok())return;const estoque=carregarEstoqueTecnico();const movs=carregarMovimentacoesEstoqueTecnico();const agora=new Date().toISOString();let alterou=false;
 for(const a of Object.values(avaliacoes)){const qtd=Number(a.quantidadeAceita??0);if(!Number.isFinite(qtd)||qtd<=0)continue;const item=requisicao.itens.find(x=>x.id===a.itemId);if(!item)continue;
  const chave=`REQ|${requisicao.id}|ITEM|${item.id}|ACEITE_TECNICO`;if(movs.some(m=>m.chaveIdempotencia===chave))continue;const seriais=[...new Set(a.seriaisAceitos??[])];const id=`${requisicao.codigoTecnico}|${item.codigoProduto}|DISPONIVEL`;const ix=estoque.findIndex(x=>x.id===id);
  if(ix>=0)estoque[ix]={...estoque[ix],quantidade:estoque[ix].quantidade+qtd,seriais:[...new Set([...estoque[ix].seriais,...seriais])],atualizadoEm:agora};else estoque.push({id,codigoTecnico:requisicao.codigoTecnico,tecnico:requisicao.tecnico,base:requisicao.base,codigoProduto:item.codigoProduto,produto:item.produto,unidade:item.unidade,quantidade:qtd,seriais,situacao:"DISPONIVEL",atualizadoEm:agora});
  movs.unshift({id:`MOV-TEC-${Date.now()}-${requisicao.id}-${item.id}`,chaveIdempotencia:chave,criadoEm:agora,tipo:"ENTRADA_ACEITE_TECNICO",requisicaoId:requisicao.id,documentoOrigem:requisicao.codigo,codigoTecnico:requisicao.codigoTecnico,tecnico:requisicao.tecnico,base:requisicao.base,codigoProduto:item.codigoProduto,produto:item.produto,unidade:item.unidade,quantidade:qtd,seriais,origem:requisicao.origem||"CD",destino:`${requisicao.codigoTecnico} - ${requisicao.tecnico}`});alterou=true}
 if(alterou){salvar(STORAGE_ESTOQUE,estoque);salvar(STORAGE_MOVIMENTOS,movs);emitir()}
}
export function baixarEstoqueTecnico(d:{codigoTecnico:string;codigoProduto:string;quantidade:number;documentoOrigem:string;seriais?:string[]}){
 if(!ok())throw new Error("Operacao disponivel somente no navegador.");
 const e=carregarEstoqueTecnico(),m=carregarMovimentacoesEstoqueTecnico();
 const chaveBaixa=`SAIDA|${d.documentoOrigem}|${d.codigoTecnico}|${d.codigoProduto}`;
 if(!d.documentoOrigem?.trim()||!d.codigoTecnico?.trim()||!d.codigoProduto?.trim())throw new Error("Identificacao da baixa incompleta.");
 if(m.some(x=>x.chaveIdempotencia===chaveBaixa))throw new Error("Baixa ja registrada para esta OS, tecnico e produto.");
 const ix=e.findIndex(x=>x.codigoTecnico===d.codigoTecnico&&x.codigoProduto===d.codigoProduto);
 if(ix<0)throw new Error("Produto nao encontrado no estoque do tecnico.");
 const q=Number(d.quantidade);
 if(!Number.isSafeInteger(q)||q<=0)throw new Error("Quantidade invalida.");
 if(e[ix].quantidade<q)throw new Error("Saldo insuficiente no estoque do tecnico.");
 const s=[...new Set(d.seriais??[])];
 if(s.some(x=>!e[ix].seriais.includes(x)))throw new Error("Serial nao pertence ao tecnico.");
 if(e[ix].seriais.length>0&&s.length!==q)throw new Error("Informe todos os seriais para esta baixa.");
 const agora=new Date().toISOString();
 e[ix]={...e[ix],quantidade:e[ix].quantidade-q,seriais:e[ix].seriais.filter(x=>!s.includes(x)),atualizadoEm:agora};
 m.unshift({id:`MOV-TEC-${Date.now()}`,chaveIdempotencia:chaveBaixa,criadoEm:agora,tipo:"SAIDA_OS",documentoOrigem:d.documentoOrigem,codigoTecnico:e[ix].codigoTecnico,tecnico:e[ix].tecnico,base:e[ix].base,codigoProduto:e[ix].codigoProduto,produto:e[ix].produto,unidade:e[ix].unidade,quantidade:q,seriais:s,origem:`${e[ix].codigoTecnico} - ${e[ix].tecnico}`,destino:d.documentoOrigem});
 salvar(STORAGE_ESTOQUE,e);salvar(STORAGE_MOVIMENTOS,m);emitir();return e[ix];
}
export function ouvirEstoqueTecnico(cb:()=>void){if(!ok())return()=>{};const a=()=>cb();const s=(ev:StorageEvent)=>{if(!ev.key||ev.key===STORAGE_ESTOQUE||ev.key===STORAGE_MOVIMENTOS)cb()};window.addEventListener(EVENTO,a);window.addEventListener("storage",s);return()=>{window.removeEventListener(EVENTO,a);window.removeEventListener("storage",s)}}

export type DevolucaoTecnicoCD = {
  codigoTecnico: string;
  codigoProduto: string;
  quantidade: number;
  seriais?: string[];
  motivo?: string;
  observacao?: string;
};

function proximoCodigoDevolucao(movimentos: MovimentoEstoqueTecnico[]) {
  const numeros = movimentos
    .map((movimento) => movimento.documentoOrigem)
    .filter((documento) => /^DEV-\d+$/.test(documento))
    .map((documento) => Number(documento.replace("DEV-", "")))
    .filter((numero) => Number.isFinite(numero));

  const maior = numeros.length > 0 ? Math.max(...numeros) : 2600000;
  return `DEV-${String(maior + 1).padStart(7, "0")}`;
}

export function devolverEstoqueTecnicoAoCD(dados: DevolucaoTecnicoCD) {
  if (!ok()) {
    throw new Error("Operação disponível somente no navegador.");
  }

  const estoque = carregarEstoqueTecnico();
  const movimentos = carregarMovimentacoesEstoqueTecnico();

  const indice = estoque.findIndex(
    (item) =>
      item.codigoTecnico === dados.codigoTecnico &&
      item.codigoProduto === dados.codigoProduto &&
      item.situacao === "DISPONIVEL"
  );

  if (indice < 0) {
    throw new Error("Produto não encontrado no estoque do técnico.");
  }

  const item = estoque[indice];
  const quantidade = Number(dados.quantidade);

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error("Informe uma quantidade válida para devolução.");
  }

  if (quantidade > item.quantidade) {
    throw new Error("Quantidade maior que o saldo disponível do técnico.");
  }

  const seriais = [...new Set((dados.seriais ?? []).map((serial) => serial.trim().toUpperCase()).filter(Boolean))];

  if (item.seriais.length > 0) {
    if (seriais.length !== quantidade) {
      throw new Error(`Informe ${quantidade} serial(is) para a devolução.`);
    }

    const serialInvalido = seriais.find((serial) => !item.seriais.includes(serial));
    if (serialInvalido) {
      throw new Error(`Serial ${serialInvalido} não pertence ao estoque do técnico.`);
    }
  }

  const documento = proximoCodigoDevolucao(movimentos);
  const agora = new Date().toISOString();
  const chave = `DEVOLUCAO_CD|${documento}|${item.codigoTecnico}|${item.codigoProduto}`;

  estoque[indice] = {
    ...item,
    quantidade: item.quantidade - quantidade,
    seriais: item.seriais.filter((serial) => !seriais.includes(serial)),
    atualizadoEm: agora,
  };

  movimentos.unshift({
    id: `MOV-DEV-${Date.now()}-${item.codigoTecnico}-${item.codigoProduto}`,
    chaveIdempotencia: chave,
    criadoEm: agora,
    tipo: "SAIDA_DEVOLUCAO_CD",
    documentoOrigem: documento,
    codigoTecnico: item.codigoTecnico,
    tecnico: item.tecnico,
    base: item.base,
    codigoProduto: item.codigoProduto,
    produto: item.produto,
    unidade: item.unidade,
    quantidade,
    seriais,
    origem: `${item.codigoTecnico} - ${item.tecnico}`,
    destino: "CD FORTALEZA",
  });

  salvar(STORAGE_ESTOQUE, estoque);
  salvar(STORAGE_MOVIMENTOS, movimentos);

  // Mantém o retorno separado do estoque disponível do CD até a conferência.
  // Import dinâmico evita acoplamento do store de estoque com o fluxo de retorno.
  const retornoPayload = {
    tipo: "DEVOLUCAO" as const,
    origem: "TECNICO" as const,
    status: "EM_TRANSITO_CD" as const,
    documentoOrigem: documento,
    tecnico: item.tecnico,
    codigoTecnico: item.codigoTecnico,
    base: item.base,
    origemFisica: `${item.codigoTecnico} - ${item.tecnico}`,
    destinoFisico: "CD FORTALEZA",
    observacao: dados.observacao?.trim() || dados.motivo?.trim() || "Devolução de estoque móvel do técnico ao CD.",
    itens: [
      {
        id: Date.now(),
        codigoProduto: item.codigoProduto,
        produto: item.produto,
        unidade: item.unidade,
        quantidade,
        quantidadeEsperada: quantidade,
        motivo: dados.motivo?.trim() || "DEVOLUÇÃO DO TÉCNICO",
        observacao: dados.observacao?.trim() || undefined,
        seriais,
      },
    ],
    recebimentoCD: { itensConferidos: {} },
  };

  // O require é executado apenas no client, no momento da ação.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { criarRetornoManual } = require("@/lib/retornosStore") as typeof import("@/lib/retornosStore");
  const retorno = criarRetornoManual(retornoPayload);

  emitir();

  return {
    documento,
    retorno,
    estoque: estoque[indice],
  };
}

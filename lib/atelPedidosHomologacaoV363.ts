"use client";

import { useEffect, useState } from "react";
import type { RequisicaoTecnica } from "@/lib/requisicoesTecnicas";
import { carregarPedidosV36, pedidoParaCardV36 } from "@/lib/atelPedidosReaisV36";
import { carregarEstados } from "@/lib/requisicoesStore";

// O pedido real usa a mesma entidade e a mesma máquina de estados das REQ.
// O catálogo fica em memória da aba; a fonte dos pedidos continua sendo o Supabase.
let catalogo: RequisicaoTecnica[] = [];
export function obterPedidosAtelV363(): RequisicaoTecnica[] { return catalogo; }
export function obterPedidoAtelV363(id: number): RequisicaoTecnica | undefined {
  return catalogo.find((p) => p.id === id);
}
export async function atualizarPedidosAtelV363(): Promise<RequisicaoTecnica[]> {
  const pedidos = await carregarPedidosV36();
  catalogo = pedidos.map(pedidoParaCardV36);
  const { sincronizarPedidosPedV366 } = await import("@/lib/atelSyncPedV366");
  await sincronizarPedidosPedV366(pedidos, catalogo);
  return catalogo;
}
export function pedidosComEstadoV363(pedidos: RequisicaoTecnica[]): RequisicaoTecnica[] {
  const estados = carregarEstados();
  return pedidos.map((req) => {
    const estado = estados[req.id];
    if (!estado) return req;
    return {
      ...req, status: estado.status,
      itens: req.itens.map((item) => ({
        ...item,
        separado: estado.itens[item.id]?.quantidadeSeparada ?? item.separado,
        conferido: estado.conferencia[item.id]?.quantidadeConferida ?? item.conferido,
      })),
    };
  });
}
export function usePedidoAtelV363(id: number): RequisicaoTecnica | undefined {
  const [pedido, setPedido] = useState<RequisicaoTecnica | undefined>(() => obterPedidoAtelV363(id));
  useEffect(() => {
    let ativo = true;
    const existente = obterPedidoAtelV363(id);
    if (existente) setPedido(existente);
    else if (Number.isFinite(id) && id < 0) {
      void atualizarPedidosAtelV363().then(() => {
        if (ativo) setPedido(obterPedidoAtelV363(id));
      }).catch((erro) => console.error("ATEL V36.3: erro ao carregar pedido", erro));
    }
    return () => { ativo = false; };
  }, [id]);
  return pedido;
}

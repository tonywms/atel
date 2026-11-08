"use client";

import type { RequisicaoTecnica } from "@/lib/requisicoesTecnicas";
import { carregarEstados } from "@/lib/requisicoesStore";

/** Projeta o estado operacional nativo do coletor no card PED da Gestão.
 *  Somente leitura: não altera etapas, estoque, volumes ou pedidos REQ.
 */
export function pedidosComProgressoV364(pedidos: RequisicaoTecnica[]): RequisicaoTecnica[] {
  const estados = carregarEstados();
  return pedidos.map((pedido) => {
    if (pedido.origemIntegracao !== "SUPABASE_V36") return pedido;
    const estado = estados[pedido.id];
    if (!estado) return pedido;
    return {
      ...pedido,
      status: estado.status,
      itens: pedido.itens.map((item) => {
        const separado = estado.itens?.[item.id]?.quantidadeSeparada ?? 0;
        const conferido = estado.conferencia?.[item.id]?.quantidadeConferida ?? 0;
        const embarcado = (estado.volumes ?? []).reduce((total, volume) => {
          if (!["EMBARCADO", "EM_TRANSITO", "RECEBIDO"].includes(volume.status)) return total;
          return total + (volume.itens?.[item.id]?.quantidade ?? 0);
        }, 0);
        return { ...item, separado, conferido, embarcado };
      }),
    };
  });
}

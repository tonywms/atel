import { atelSupabase } from "@/lib/atelSupabaseV08";
import type { RequisicaoTecnica } from "@/lib/requisicoesTecnicas";
export const ATEL_ORG_V36="6ea04673-4deb-42cf-a001-dbb027120103";
export type PedidoV36={id:string;codigo:string;tipo:string;status:string;prioridade:string;origem:string;destino:string;criado_em:string;itens:Array<{item_pedido_id:string;material_id:string;sku:string;descricao:string;unidade:string;quantidade:number;rastreio?:string;seriais?:string[]}>};
export async function carregarPedidosV36():Promise<PedidoV36[]>{
 const db=atelSupabase();if(!db)throw Error("Conexão Supabase indisponível");
 const {data,error}=await db.rpc("atel_v36_listar_pedidos",{p_org:ATEL_ORG_V36});
 if(error)throw Error(error.message);
 return (Array.isArray(data)?data:[]).filter((p:PedidoV36)=>p.tipo==="ABASTECIMENTO");
}
export function pedidoParaCardV36(p:PedidoV36):RequisicaoTecnica{
 const n=parseInt(p.id.replaceAll("-","").slice(0,12),16);
 return {id:-n,codigo:p.codigo,codigoExterno:p.codigo,tecnico:p.destino,codigoTecnico:p.destino,base:p.origem,origem:p.origem,destino:p.destino,tipo:p.tipo,prioridade:(['NORMAL','ALTA','URGENTE'].includes(p.prioridade)?p.prioridade:'NORMAL') as RequisicaoTecnica['prioridade'],status:p.status as RequisicaoTecnica['status'],dataSolicitacao:p.criado_em,dataRecebimento:p.criado_em,origemIntegracao:'SUPABASE_V36',itens:p.itens.map((i,k)=>({id:k+1,itemPedidoUuid:i.item_pedido_id,materialUuid:i.material_id,codigoProduto:i.sku,produto:i.descricao,unidade:i.rastreio==='metragem'?'MT':(i.unidade||'UN'),solicitado:Number(i.quantidade),estoqueCD:0,separado:0,conferido:0,embarcado:0,controlaSerie:i.rastreio==='serial',seriaisPedido:Array.isArray(i.seriais)?i.seriais:[]}))};
}

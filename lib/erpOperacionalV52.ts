import { atelSupabase } from "@/lib/atelSupabaseV08";

export type OsErpV52 = {
  atendimento: number; protocolo: string; servico: string; data_inicio: string;
  cliente: string; endereco: string | null; tecnico: number; plano: string;
};
export type EstoqueErpV52 = {
  cod_produto: number; produto: string; mac: string | null;
  quantidade: number; patrimonio: number | null;
};
export type DetalheErpV52 = Record<string, unknown> & { IDAtendimento: number; IdTecnicoVisita: number };

type Tipo = "os" | "inventario" | "detalhe";
async function consultar<T>(tipo: Tipo, atendimento?: number): Promise<T> {
  const supabase = atelSupabase();
  if (!supabase) throw new Error("Supabase nao configurado");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Sessao necessaria");
  const params = new URLSearchParams({ tipo });
  if (tipo === "detalhe") {
    if (!Number.isSafeInteger(atendimento) || (atendimento ?? 0) <= 0) throw new Error("Atendimento invalido");
    params.set("atendimento", String(atendimento));
  }
  const response = await fetch(`/api/erp-operacional?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
  const body: { dados?: T; error?: string } = await response.json();
  if (!response.ok || body.dados === undefined) throw new Error(body.error || "Falha na consulta ERP");
  return body.dados;
}
export const consultarOsErpV52 = () => consultar<OsErpV52[]>("os");
export const consultarEstoqueErpV52 = () => consultar<EstoqueErpV52[]>("inventario");
export const consultarDetalheErpV52 = (atendimento: number) => consultar<DetalheErpV52>("detalhe", atendimento);

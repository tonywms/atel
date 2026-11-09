import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ORG = "6ea04673-4deb-42cf-a001-dbb027120103";
const TECNICO = "4157";
const headers = { "Cache-Control": "no-store" };
const reply = (value: object, status = 200) => NextResponse.json(value, { status, headers });
type Item = { idempresa: number; idproduto: number; codigoproduto: string; nome: string; codreferencia?: string | null; unidadepadrao?: string | null; controlavalidade?: boolean; controlalote?: boolean; controlanumserie?: boolean };
function validText(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function validId(value: unknown): number | null { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; }
function extract(row: unknown): Item | null {
 if (!row || typeof row !== "object" || Array.isArray(row)) return null;
 const r = row as Record<string, unknown>;
 // Nunca tratar cod_produto ou SKU como idproduto. Sao identificadores diferentes.
 const idproduto = validId(r.idproduto);
 const idempresa = validId(r.idempresa);
 const codigo = validText(r.codigoproduto);
 const nome = validText(r.nome);
 if (!idproduto || !idempresa || !codigo || !nome) return null;
 const item: Item = { idempresa, idproduto, codigoproduto: codigo, nome };
 for (const [key, value] of Object.entries({ codreferencia: r.codreferencia, unidadepadrao: r.unidadepadrao })) {
  if (typeof value === "string") (item as unknown as Record<string, unknown>)[key] = value.trim() || null;
 }
 for (const key of ["controlavalidade", "controlalote", "controlanumserie"] as const) {
  if (typeof r[key] === "boolean") item[key] = r[key] as boolean;
 }
 return item;
}
async function run(req: NextRequest) {
 const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if (!token) return reply({ error: "Sessao Supabase obrigatoria" }, 401);
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
 const adapter = process.env.ATEL_ADAPTER_BASE_URL;
 const adapterKey = process.env.ATEL_ADAPTER_API_KEY;
 if (!url || !publicKey || !serviceKey || !adapter || !adapterKey) return reply({ error: "Configuracao de integracao incompleta" }, 503);
 const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
 const { data: { user }, error: authError } = await auth.auth.getUser(token);
 if (authError || !user) return reply({ error: "Sessao invalida" }, 401);
 const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
 const { data: access, error: accessError } = await db.from("usuarios_organizacao").select("perfil").eq("organizacao_id", ORG).eq("usuario_id", user.id).eq("ativo", true).limit(1);
 if (accessError) return reply({ error: "Falha na verificacao de autorizacao" }, 503);
 if (!access?.some(a => a.perfil === "admin")) return reply({ error: "Somente administrador ativo pode executar reconciliacao V60" }, 403);
 // A rota atualmente conhecida e de inventario de um tecnico; nao e catalogo mestre.
 // Somente compara registros que contenham identidade ERP completa.
 const ctrl = new AbortController();
 const timeout = setTimeout(() => ctrl.abort(), 20000);
 let payload: unknown;
 try {
  const res = await fetch(`${adapter.replace(/\/$/, "")}/inventario/usuario/${TECNICO}`, { headers: { "X-API-Key": adapterKey, Accept: "application/json" }, signal: ctrl.signal, cache: "no-store" });
  if (!res.ok) return reply({ error: `Adapter respondeu HTTP ${res.status}` }, 502);
  payload = await res.json();
 } catch (err) { return reply({ error: err instanceof Error && err.name === "AbortError" ? "Tempo limite Adapter" : "Falha ao consultar Adapter" }, 502); }
 finally { clearTimeout(timeout); }
 if (!Array.isArray(payload)) return reply({ error: "Adapter nao retornou lista" }, 502);
 const valid = payload.map(extract).filter((x): x is Item => x !== null);
 const invalid = payload.length - valid.length;
 const keys = new Set<string>();
 const duplicated: string[] = [];
 for (const item of valid) { const key = `${item.idempresa}:${item.idproduto}`; if (keys.has(key)) duplicated.push(key); keys.add(key); }
 if (duplicated.length) return reply({ error: "Identidades ERP duplicadas na resposta. Nenhuma alteracao.", duplicados: duplicated.slice(0,30) }, 409);
 if (!valid.length) return reply({ modo: "DIAGNOSTICO", fonte: `inventario/usuario/${TECNICO}`, linhas: payload.length, comIdentidadeERPCompleta: 0, semIdentidadeERPCompleta: invalid, bloqueado: true, motivo: "O inventario do tecnico nao fornece identidade ERP completa (idempresa, idproduto, codigoproduto e nome). Nao e seguro atualizar cadastro por SKU ou cod_produto.", alteracoes: 0 });
 const changes: Array<{ idempresa:number; idproduto:number; atual:Record<string,unknown> | null; adapter:Item }> = [];
 for (let i = 0; i < valid.length; i += 100) {
  const chunk = valid.slice(i,i+100);
  const empresas = [...new Set(chunk.map(x=>x.idempresa))];
  const ids = chunk.map(x=>x.idproduto);
  const { data, error } = await db.from("atel_erp_produto_catalogo").select("idempresa,idproduto,codigoproduto,nome,codreferencia,unidadepadrao,controlavalidade,controlalote,controlanumserie").eq("organizacao_id",ORG).in("idempresa",empresas).in("idproduto",ids);
  if (error) return reply({ error: "Falha ao ler catalogo ERP; nenhuma alteracao" }, 503);
  const map = new Map((data||[]).map(x=>[`${x.idempresa}:${x.idproduto}`,x]));
  for (const item of chunk) {
   const old = map.get(`${item.idempresa}:${item.idproduto}`) ?? null;
   if (!old || Object.entries(item).some(([k,v])=>old[k as keyof typeof old] !== v)) changes.push({idempresa:item.idempresa,idproduto:item.idproduto,atual:old,adapter:item});
  }
 }
 // V60 e somente diagnostico: dados de inventario nao sao fonte suficiente para alteracao mestre.
 return reply({ modo:"DIAGNOSTICO_SEM_GRAVACAO", fonte:`inventario/usuario/${TECNICO}`, linhas:payload.length, comIdentidadeERPCompleta:valid.length, semIdentidadeERPCompleta:invalid, diferencas:changes.length, amostra:changes.slice(0,20), bloqueado:true, motivo:"Fonte atual e inventario por tecnico, nao endpoint oficial de catalogo mestre. Atualizacao automatica bloqueada ate confirmar fonte e identidade ERP. Estoque e materiais preservados." });
}
export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

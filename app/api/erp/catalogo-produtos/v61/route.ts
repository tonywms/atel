import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ORG = "6ea04673-4deb-42cf-a001-dbb027120103";
const response = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
type Product = { organizacao_id: string; idempresa: number; idproduto: number; codigoproduto: string; nome: string; codreferencia?: string | null; unidadepadrao?: string | null; controlavalidade?: boolean; controlalote?: boolean; controlanumserie?: boolean };
const intId = (x: unknown): number | null => { const n = Number(x); return Number.isSafeInteger(n) && n > 0 ? n : null; };
const str = (x: unknown): string | null => typeof x === "string" && x.trim() ? x.trim() : null;
function parseProduct(value: unknown): Product | null {
 if (!value || typeof value !== "object" || Array.isArray(value)) return null;
 const row = value as Record<string, unknown>;
 const idempresa = intId(row.idempresa), idproduto = intId(row.idproduto), codigoproduto = str(row.codigoproduto), nome = str(row.nome);
 if (!idempresa || !idproduto || !codigoproduto || !nome) return null;
 const p: Product = { organizacao_id: ORG, idempresa, idproduto, codigoproduto, nome };
 for (const key of ["codreferencia", "unidadepadrao"] as const) if (typeof row[key] === "string") p[key] = str(row[key]);
 for (const key of ["controlavalidade", "controlalote", "controlanumserie"] as const) if (typeof row[key] === "boolean") p[key] = row[key] as boolean;
 return p;
}
async function handler(req: NextRequest) {
 const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if (!token) return response({ error: "Sessao autenticada obrigatoria" }, 401);
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !pub || !secret) return response({ error: "Supabase nao configurado no servidor" }, 503);
 const auth = createClient(url, pub, { auth: { persistSession: false, autoRefreshToken: false } });
 const { data: { user }, error: authError } = await auth.auth.getUser(token);
 if (authError || !user) return response({ error: "Sessao invalida" }, 401);
 const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
 const { data: roles, error: roleError } = await db.from("usuarios_organizacao").select("perfil").eq("organizacao_id", ORG).eq("usuario_id", user.id).eq("ativo", true);
 if (roleError) return response({ error: "Falha ao validar permissoes" }, 503);
 if (!roles?.some(r => r.perfil === "admin")) return response({ error: "Somente administrador ativo pode sincronizar" }, 403);
 // Nunca derivar um catalogo mestre de /inventario/usuario/{id}.
 const base = process.env.ATEL_ADAPTER_BASE_URL;
 const apiKey = process.env.ATEL_ADAPTER_API_KEY;
 const path = process.env.ATEL_ADAPTER_CATALOGO_OFICIAL_PATH;
 if (!base || !apiKey || !path) return response({ status: "AGUARDANDO_FONTE_OFICIAL", motivo: "Configure ATEL_ADAPTER_CATALOGO_OFICIAL_PATH com um endpoint mestre confirmado do Adapter. A rota de inventario do tecnico nao e fonte valida.", alteracoes: 0 }, 409);
 if (!/^\/[a-zA-Z0-9/_-]+$/.test(path) || path.includes("..") || path.startsWith("/inventario/") || path.startsWith("/os/") || path.startsWith("/atendimentos/")) return response({ error: "Caminho de catalogo nao permitido" }, 422);
 let baseUrl: URL;
 try { baseUrl = new URL(base); } catch { return response({ error: "URL do Adapter invalida" }, 503); }
 if (baseUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(baseUrl.hostname)) return response({ error: "Fonte Adapter deve usar HTTPS" }, 503);
 const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20000);
 let payload: unknown;
 try {
  const sourceUrl = new URL(path, baseUrl.toString().replace(/\/?$/, "/"));
  const upstream = await fetch(sourceUrl.toString(), { headers: { "X-API-Key": apiKey, Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
  if (!upstream.ok) return response({ error: `Adapter HTTP ${upstream.status}; nenhuma alteracao` }, 502);
  payload = await upstream.json();
 } catch (e) { return response({ error: e instanceof Error && e.name === "AbortError" ? "Timeout do Adapter" : "Falha de leitura do Adapter", alteracoes: 0 }, 502); }
 finally { clearTimeout(timeout); }
 if (!Array.isArray(payload) || payload.length === 0 || payload.length > 50000) return response({ error: "Catalogo oficial vazio, invalido ou excessivo; nenhuma alteracao" }, 422);
 const products: Product[] = []; const seen = new Set<string>();
 for (const value of payload) {
  const p = parseProduct(value);
  if (!p) return response({ error: "Catalogo com produto sem identidade ERP completa; nenhuma alteracao", linhas: payload.length }, 422);
  const id = `${p.idempresa}:${p.idproduto}`;
  if (seen.has(id)) return response({ error: "Identidade ERP duplicada; nenhuma alteracao", id }, 409);
  seen.add(id); products.push(p);
 }
 // Compara somente campos fornecidos pelo Adapter; campos ausentes sao preservados.
 const changes: Product[] = []; let unchanged = 0;
 for (let i = 0; i < products.length; i += 100) {
  const batch = products.slice(i, i + 100);
  const { data, error } = await db.from("atel_erp_produto_catalogo")
   .select("idempresa,idproduto,codigoproduto,nome,codreferencia,unidadepadrao,controlavalidade,controlalote,controlanumserie")
   .eq("organizacao_id", ORG).in("idempresa", [...new Set(batch.map(p => p.idempresa))]).in("idproduto", batch.map(p => p.idproduto));
  if (error) return response({ error: "Falha ao consultar catalogo atual; nenhuma alteracao" }, 503);
  const existing = new Map((data || []).map(p => [`${p.idempresa}:${p.idproduto}`, p]));
  for (const p of batch) {
   const old = existing.get(`${p.idempresa}:${p.idproduto}`);
   if (!old || Object.entries(p).some(([k, v]) => k !== "organizacao_id" && (old as Record<string, unknown>)[k] !== v)) changes.push(p);
   else unchanged++;
  }
 }
 const dryRun = req.method !== "POST" || req.headers.get("x-atel-confirmar-catalogo") !== "SINCRONIZAR_CATALOGO_OFICIAL";
 if (dryRun) return response({ modo: "SIMULACAO", fonte: path, recebidos: products.length, alteracoesPrevistas: changes.length, semAlteracao: unchanged, amostra: changes.slice(0, 15).map(p => ({ idempresa: p.idempresa, idproduto: p.idproduto, codigo: p.codigoproduto, nome: p.nome })), gravados: 0 });
 // Para impedir gravacoes parciais, nao executa lote de escritas via REST. A aplicacao
 // deve disponibilizar a RPC transacional revisada antes de habilitar o modo gravacao.
 return response({ modo: "GRAVACAO_BLOQUEADA", motivo: "Fonte ainda requer homologacao e persistencia atomica no banco. A V61 nao faz escrita parcial.", recebidos: products.length, alteracoesPrevistas: changes.length, gravados: 0 }, 409);
}
export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }

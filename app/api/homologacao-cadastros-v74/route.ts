import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ORG = "6ea04673-4deb-42cf-a001-dbb027120103";
const config = {
 produtos: { table: "atel_erp_produto_catalogo", fields: "idempresa,idproduto,codigoproduto,nome,unidadepadrao", order: "idproduto", search: "nome" },
 depositos: { table: "atel_erp_depositos", fields: "idempresa,idenderecodeposito,nome,idtipodeposito,ativo", order: "idenderecodeposito", search: "nome" },
 enderecos: { table: "atel_erp_enderecos", fields: "idfilial,idendereco,idenderecodeposito,rua,predio,andar,apto,ativo", order: "idendereco", search: "rua" },
} as const;
function reply(data: object, status=200) { return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}}); }
export async function GET(req: NextRequest) {
 const token=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token) return reply({error:"Sessao obrigatoria"},401);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const pub=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!pub||!secret) return reply({error:"Configuracao Supabase ausente"},503);
 const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(token);
 if(authError||!user) return reply({error:"Sessao invalida"},401);
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:roles,error:roleError}=await db.from("usuarios_organizacao").select("perfil").eq("organizacao_id",ORG).eq("usuario_id",user.id).eq("ativo",true);
 if(roleError) return reply({error:"Falha ao validar permissao"},503);
 if(!roles?.some(r=>r.perfil==="admin")) return reply({error:"Acesso restrito a administrador ativo"},403);
 const tipo=req.nextUrl.searchParams.get("tipo")||"produtos";
 if(!(tipo in config)) return reply({error:"Tipo invalido"},400);
 const cfg=config[tipo as keyof typeof config];
 const pageRaw=Number(req.nextUrl.searchParams.get("pagina")||"1");
 if(!Number.isSafeInteger(pageRaw)||pageRaw<1||pageRaw>100000) return reply({error:"Pagina invalida"},400);
 const termo=(req.nextUrl.searchParams.get("busca")||"").trim();
 if(termo.length>100) return reply({error:"Busca muito longa"},400);
 const filial=req.nextUrl.searchParams.get("empresa");
 if(filial && !/^\d{1,9}$/.test(filial)) return reply({error:"Empresa invalida"},400);
 const idRaw=req.nextUrl.searchParams.get("id")?.trim() || "";
 if(idRaw && !/^\d{1,12}$/.test(idRaw)) return reply({error:"ID invalido"},400);
 const idColumn=tipo==="produtos"?"idproduto":tipo==="depositos"?"idenderecodeposito":"idendereco";
 const size=25;
 let query=db.from(cfg.table).select(cfg.fields,{count:"exact"}).eq("organizacao_id",ORG);
 if(filial && tipo!=="enderecos") query=query.eq("idempresa",Number(filial));
 if(idRaw) query=query.eq(idColumn,Number(idRaw));
 if(termo) query=query.ilike(cfg.search,`%${termo.replace(/[%,_]/g, "")}%`);
 const {data,error,count}=await query.order(cfg.order,{ascending:true}).range((pageRaw-1)*size,pageRaw*size-1);
 if(error) return reply({error:"Consulta Supabase falhou",details:error.message},503);
 return reply({tipo,pagina:pageRaw,porPagina:size,total:count||0,registros:data||[]});
}

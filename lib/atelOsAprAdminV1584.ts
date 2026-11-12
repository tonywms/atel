import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { bancoChecklistV158, ErroChecklistV158 } from "@/lib/atelOsChecklistServerV158";

export function numeroOsV1584(value:unknown){const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null;}
export async function adminAprV1584(req:NextRequest){
 const token=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!token||!url||!key)throw new ErroChecklistV158("Sessão administrativa obrigatória.",401);
 const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await auth.auth.getUser(token);
 if(error||!data.user)throw new ErroChecklistV158("Faça login novamente.",401);
 const db=bancoChecklistV158();
 const {data:membros,error:errMembros}=await db.from("usuarios_organizacao")
  .select("organizacao_id,perfil").eq("usuario_id",data.user.id).eq("ativo",true).eq("perfil","admin").limit(2);
 if(errMembros||!membros||membros.length!==1)throw new ErroChecklistV158("Acesso restrito à gestão desta organização.",403);
 return{db,organizacaoId:String(membros[0].organizacao_id),userId:data.user.id};
}
export async function aprRegistradaGestorV1584(req:NextRequest,atendimento:number){
 const ctx=await adminAprV1584(req);
 const {data,error}=await ctx.db.from("atel_os_apr_riscos_v1582")
  .select("id,usuario_id,atendimento_erp,modelo_versao,riscos,medidas,nenhum_risco,riscos_outros,medidas_outros,observacao,resultado,ciencia,acompanhamento_supervisor,acompanhamento_sesmt,profissionais,situacao,registrado_em,atualizado_em")
  .eq("organizacao_id",ctx.organizacaoId).eq("atendimento_erp",atendimento).eq("situacao","REGISTRADO")
  .order("registrado_em",{ascending:false}).limit(1).maybeSingle();
 if(error)throw new ErroChecklistV158("Não foi possível consultar a APR desta OS.",503);
 return{...ctx,apr:data};
}

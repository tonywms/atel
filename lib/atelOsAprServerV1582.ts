import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { contextoChecklistV158, ErroChecklistV158 } from "@/lib/atelOsChecklistServerV158";

export type OpcaoAPR = {id:string;nome:string};
export type ModeloAPR = {versao:number;estado:string;titulo:string;riscos:OpcaoAPR[];medidas:OpcaoAPR[]};
export type ProfissionalAPR = {nome:string;funcao:string};
export type DadosAPR = {
  riscos:string[];medidas:string[];nenhum_risco:boolean;riscos_outros:string;medidas_outros:string;
  observacao:string;resultado:"PENDENTE"|"APTO"|"NAO_APTO";ciencia:boolean;
  acompanhamento_supervisor:boolean;acompanhamento_sesmt:boolean;profissionais:ProfissionalAPR[];
  situacao:"RASCUNHO"|"REGISTRADO";
};
export const initialAPR:DadosAPR = {riscos:[],medidas:[],nenhum_risco:false,riscos_outros:"",medidas_outros:"",observacao:"",resultado:"PENDENTE",ciencia:false,acompanhamento_supervisor:false,acompanhamento_sesmt:false,profissionais:[],situacao:"RASCUNHO"};
export type ContextoAPR = Awaited<ReturnType<typeof contextoChecklistV158>>;
export const erroAPR = (e:unknown):{mensagem:string;codigo:number} =>
  e instanceof ErroChecklistV158?{mensagem:e.message,codigo:e.status}:{mensagem:"Não foi possível concluir a operação da APR.",codigo:503};
export async function contextoAPR(req:NextRequest,id:number){return contextoChecklistV158(req,id);}
export async function modeloAPR(db:SupabaseClient):Promise<ModeloAPR>{
  const {data,error}=await db.from("atel_os_apr_modelos_v1582").select("versao,estado,titulo,riscos,medidas")
    .eq("codigo","APR_RISCOS").neq("estado","INATIVO").order("versao",{ascending:false}).limit(1).maybeSingle();
  if(error||!data||!Array.isArray(data.riscos)||!Array.isArray(data.medidas))throw new ErroChecklistV158("Modelo APR V158.2 não disponível.",503);
  const isOpcao=(o:unknown):o is OpcaoAPR=>!!o&&typeof o==="object"&&typeof (o as OpcaoAPR).id==="string"&&typeof (o as OpcaoAPR).nome==="string";
  if(!data.riscos.every(isOpcao)||!data.medidas.every(isOpcao))throw new ErroChecklistV158("Modelo APR inválido.",503);
  return data as ModeloAPR;
}
export async function andamentoAPR(db:SupabaseClient,ctx:ContextoAPR,id:number){
  const {data,error}=await db.from("atel_os_andamento").select("etapa,versao")
    .eq("usuario_id",ctx.usuarioId).eq("tecnico_erp",ctx.tecnico).eq("atendimento_erp",id).maybeSingle();
  if(error)throw new ErroChecklistV158("Não foi possível validar a etapa da OS.",503);
  return {etapa:String(data?.etapa||"PENDENTE"),versao:Number(data?.versao||0)};
}
export async function buscarAPR(db:SupabaseClient,ctx:ContextoAPR,id:number){
  const {data,error}=await db.from("atel_os_apr_riscos_v1582").select("*")
    .eq("organizacao_id",ctx.organizacaoId).eq("usuario_id",ctx.usuarioId)
    .eq("tecnico_erp",ctx.tecnico).eq("atendimento_erp",id).maybeSingle();
  if(error)throw new ErroChecklistV158("Não foi possível consultar a avaliação.",503);
  return data;
}
export async function fotosAPR(db:SupabaseClient,ctx:ContextoAPR,aprId:string){
  const {data,error}=await db.from("atel_os_apr_fotos_v1582").select("id,nome_arquivo,caminho_storage,criado_em")
    .eq("apr_id",aprId).eq("organizacao_id",ctx.organizacaoId).eq("usuario_id",ctx.usuarioId)
    .order("criado_em",{ascending:false}).limit(8);
  if(error)throw new ErroChecklistV158("Não foi possível consultar as evidências.",503);
  return Promise.all((data||[]).map(async f=>{
    const {data:link}=await db.storage.from("atel-os-checklists-v158").createSignedUrl(String(f.caminho_storage),120);
    return {id:f.id,nome_arquivo:f.nome_arquivo,criado_em:f.criado_em,url:link?.signedUrl||null};
  }));
}
export function validarAPR(input:Record<string,unknown>,modelo:ModeloAPR):DadosAPR{
  const riscos=lista(input.riscos,modelo.riscos,"riscos");
  const medidas=lista(input.medidas,modelo.medidas,"medidas");
  const texto=(value:unknown,label:string,max:number)=>{
    if(typeof value!=="string"||value.length>max)throw new ErroChecklistV158(`${label} inválido(a).`);
    return value.trim();
  };
  const nenhum_risco=input.nenhum_risco===true;
  const riscos_outros=texto(input.riscos_outros??"","Descrição de outros riscos",500);
  const medidas_outros=texto(input.medidas_outros??"","Descrição de outras medidas",500);
  const observacao=texto(input.observacao??"","Observação",3000);
  const resultado=input.resultado;
  const situacao=input.situacao;
  const ciencia=input.ciencia===true;
  const acompanhamento_supervisor=input.acompanhamento_supervisor===true;
  const acompanhamento_sesmt=input.acompanhamento_sesmt===true;
  const recebidos=input.profissionais??[];
  if(!Array.isArray(recebidos)||recebidos.length>6)throw new ErroChecklistV158("Lista de profissionais inválida (máximo 6).");
  const profissionais:ProfissionalAPR[]=recebidos.map((p:unknown)=>{
    if(!p||typeof p!=="object"||Array.isArray(p))throw new ErroChecklistV158("Profissional inválido.");
    const pessoa=p as Record<string,unknown>;
    return {nome:texto(pessoa.nome??"","Nome completo",120),funcao:texto(pessoa.funcao??"","Função",100)};
  });
  if(!["PENDENTE","APTO","NAO_APTO"].includes(String(resultado)))throw new ErroChecklistV158("Resultado da avaliação inválido.");
  if(situacao!=="RASCUNHO"&&situacao!=="REGISTRADO")throw new ErroChecklistV158("Situação da avaliação inválida.");
  if(nenhum_risco&&riscos.length)throw new ErroChecklistV158("Desmarque os riscos ou a opção Nenhum risco identificado.");
  if(riscos.includes("outros")&&!riscos_outros)throw new ErroChecklistV158("Descreva os outros riscos selecionados.");
  if(medidas.includes("outros")&&!medidas_outros)throw new ErroChecklistV158("Descreva as outras medidas de controle.");
  if(situacao==="REGISTRADO"){
    if(profissionais.length===0||!profissionais.some(p=>p.nome&&p.funcao)||profissionais.some(p=>!p.nome||!p.funcao))
      throw new ErroChecklistV158("Identifique pelo menos um profissional com nome completo e função, preenchendo todos os campos adicionados.");
    if(new Set(profissionais.map(p=>p.nome.toLocaleLowerCase("pt-BR"))).size!==profissionais.length)
      throw new ErroChecklistV158("Não repita o mesmo profissional na APR.");
    if(!ciencia)throw new ErroChecklistV158("Confirme que avaliou as condições e medidas de controle.");
    if(!nenhum_risco&&riscos.length===0)throw new ErroChecklistV158("Selecione os riscos identificados ou marque explicitamente Nenhum risco identificado.");
    if(resultado!=="APTO"&&resultado!=="NAO_APTO")throw new ErroChecklistV158("Informe se o local está apto ou não apto.");
    if(resultado==="APTO"&&riscos.length&&medidas.length===0)throw new ErroChecklistV158("Informe as medidas de controle aplicáveis aos riscos selecionados.");
    if(resultado==="NAO_APTO"&&observacao.length<10)throw new ErroChecklistV158("Justifique o impedimento com pelo menos 10 caracteres.");
    if(resultado==="APTO"&&riscos.length&&observacao.length<10)throw new ErroChecklistV158("Descreva como os riscos selecionados foram controlados (mínimo 10 caracteres).");
  }
  return {riscos,medidas,nenhum_risco,riscos_outros,medidas_outros,observacao,
    resultado:resultado as DadosAPR["resultado"],ciencia,acompanhamento_supervisor,acompanhamento_sesmt,profissionais,situacao};
}
function lista(input:unknown,permitidas:OpcaoAPR[],label:string){
 if(!Array.isArray(input)||input.length>permitidas.length||input.some(x=>typeof x!=="string"))throw new ErroChecklistV158(`Lista de ${label} inválida.`);
 const ids=new Set(permitidas.map(x=>x.id));const unicos=new Set(input as string[]);
 if(unicos.size!==input.length||[...unicos].some(x=>!ids.has(x)))throw new ErroChecklistV158(`Seleção de ${label} não reconhecida.`);
 return [...unicos];
}

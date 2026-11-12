/**
 * ATEL V158.1 — Rascunho local por usuario/OS/tipo e fotos em fila IndexedDB.
 * Nao guarda tokens, nem altera estados da OS. Dados sensiveis ficam no dispositivo
 * ate sincronizacao; a exclusao de dados do navegador pode apaga-los.
 */
export type TipoLocalV1581 = "APR" | "ENCERRAMENTO";
export type RespostaLocalV1581 = {valor:"CONFORME"|"NAO_CONFORME"|"NAO_APLICAVEL"|"";nota:string};
export type ModeloLocalV1581 = {
  codigo:TipoLocalV1581;
  titulo:string;
  versao:number;
  estado:"HOMOLOGACAO"|"PUBLICADO"|"INATIVO";
  perguntas:{id:string;grupo:string;pergunta:string;critica:boolean}[];
};
export type RascunhoLocalV1581 = {
  esquema:1;
  atualizadoEm:number;
  sincronizado:boolean;
  modelo:ModeloLocalV1581;
  respostas:Record<string,RespostaLocalV1581>;
  observacao:string;
};
export type FotoPendenteV1581 = {
  id:string;
  escopo:string;
  nome:string;
  mime:string;
  criadaEm:number;
  arquivo:Blob;
};
const PREFIXO="atel:v1581:os:rascunho";
const DB="atel-os-evidencias-offline-v1581";
const STORE="pendentes";

export function chaveLocalV1581(usuario:string,atendimento:number,tipo:TipoLocalV1581):string {
  if(!/^[0-9a-f-]{36}$/i.test(usuario)||!Number.isSafeInteger(atendimento)||atendimento<=0||!["APR","ENCERRAMENTO"].includes(tipo))throw new Error("Identificacao de rascunho invalida.");
  return `${PREFIXO}:${usuario}:${atendimento}:${tipo}`;
}
export function modeloValidoV1581(modelo:unknown):modelo is ModeloLocalV1581 {
  if(!modelo||typeof modelo!=="object")return false;
  const m=modelo as Partial<ModeloLocalV1581>;
  return (m.codigo==="APR"||m.codigo==="ENCERRAMENTO")&&Number.isSafeInteger(m.versao)&&Number(m.versao)>0&&Array.isArray(m.perguntas)&&m.perguntas.length>0&&m.perguntas.length<=100&&m.perguntas.every(q=>q&&typeof q.id==="string"&&typeof q.pergunta==="string"&&typeof q.grupo==="string");
}
export function lerLocalV1581(chave:string):RascunhoLocalV1581|null {
  try {
    const bruto=window.localStorage.getItem(chave);
    if(!bruto)return null;
    const item:unknown=JSON.parse(bruto);
    if(!item||typeof item!=="object")return null;
    const d=item as Partial<RascunhoLocalV1581>;
    if(d.esquema!==1||!modeloValidoV1581(d.modelo)||!d.respostas||typeof d.respostas!=="object"||Array.isArray(d.respostas)||typeof d.observacao!=="string"||!Number.isSafeInteger(d.atualizadoEm))return null;
    return d as RascunhoLocalV1581;
  } catch {return null;}
}
export function gravarLocalV1581(chave:string,rascunho:RascunhoLocalV1581):boolean {
  try {window.localStorage.setItem(chave,JSON.stringify(rascunho));return true;}
  catch {return false;}
}

function abrir():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined")return reject(new Error("Armazenamento local de fotos indisponivel neste navegador."));
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE)){
        const s=db.createObjectStore(STORE,{keyPath:"id"});
        s.createIndex("por_escopo","escopo",{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error("Nao foi possivel abrir armazenamento local."));
    req.onblocked=()=>reject(new Error("Banco de fotos em uso em outra aba."));
  });
}
export async function listarFotosPendentesV1581(escopo:string):Promise<FotoPendenteV1581[]>{
  const db=await abrir();
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readonly");
      const req=tx.objectStore(STORE).index("por_escopo").getAll(escopo);
      req.onsuccess=()=>resolve((req.result as FotoPendenteV1581[]).sort((a,b)=>a.criadaEm-b.criadaEm));
      req.onerror=()=>reject(req.error||new Error("Falha na leitura de fotos pendentes."));
    });
  } finally {db.close();}
}
export async function guardarFotoPendenteV1581(foto:FotoPendenteV1581):Promise<void>{
  const db=await abrir();
  try {
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).put(foto);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error("Nao foi possivel salvar a foto localmente."));
      tx.onabort=()=>reject(tx.error||new Error("Gravacao da foto interrompida."));
    });
  } finally {db.close();}
}
export async function excluirFotoPendenteV1581(id:string):Promise<void>{
  const db=await abrir();
  try {
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error("Falha ao excluir foto pendente."));
      tx.onabort=()=>reject(tx.error||new Error("Exclusao interrompida."));
    });
  } finally {db.close();}
}

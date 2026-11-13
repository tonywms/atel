"use client";
import {useEffect,useState} from "react";
import {atelSupabase} from "@/lib/atelSupabaseV08";
import "./atel-relatorio-fotografico-v1595.css";
type Modelo={riscos:{id:string;nome:string}[];medidas:{id:string;nome:string}[]};
type APR={resultado:string;situacao:string;observacao:string;riscos:string[];medidas:string[];nenhum_risco:boolean;
 riscos_outros:string;medidas_outros:string;profissionais:{nome:string;funcao:string}[];acompanhamento_supervisor:boolean;acompanhamento_sesmt:boolean;registrado_em:string};
type Dados={apr:APR|null;modelo:Modelo;fotos:{id:string;url:string|null;nome_arquivo:string}[]};
export default function AtelAprConsultaModalV1595({aberto,atendimento,fechar}:{aberto:boolean;atendimento:number;fechar:()=>void}){
 const [dados,setDados]=useState<Dados|null>(null),[erro,setErro]=useState(""),[loading,setLoading]=useState(false);
 useEffect(()=>{if(!aberto)return;let ativo=true;setLoading(true);setErro("");setDados(null);
  void (async()=>{
   try{const sb=atelSupabase();if(!sb)throw new Error("Sessão indisponível.");
    const {data:{session}}=await sb.auth.getSession();if(!session?.access_token)throw new Error("Faça login novamente.");
    const res=await fetch(`/api/os-apr-v1582?atendimento=${atendimento}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
    const body=await res.json() as Dados&{error?:string};if(!res.ok)throw new Error(body.error||"Não foi possível consultar APR.");
    if(ativo)setDados(body);
   }catch(e){if(ativo)setErro(e instanceof Error?e.message:"APR indisponível.");}
   finally{if(ativo)setLoading(false);}
  })();return()=>{ativo=false};
 },[aberto,atendimento]);
 if(!aberto)return null;
 const apr=dados?.apr;
 const traducao=(ids:string[],opcoes:{id:string;nome:string}[])=>ids.map(id=>opcoes.find(o=>o.id===id)?.nome||id);
 return <div className="atel-v1595-apr-backdrop" role="presentation" onClick={fechar}>
  <section role="dialog" aria-modal="true" aria-label="APR registrada - somente consulta" className="atel-v1595-apr-dialog" onClick={e=>e.stopPropagation()}>
   <div className="atel-v1595-apr-modal-header"><div><small>DOCUMENTAÇÃO DA OS nº {atendimento}</small><strong>APR registrada</strong></div><button type="button" onClick={fechar} aria-label="Fechar APR">×</button></div>
   <div className="atel-v1595-apr-content">
    <p className="atel-v1595-apr-readonly">CONSULTA SOMENTE LEITURA · Nenhuma resposta será alterada.</p>
    {loading&&<p>Recuperando avaliação registrada...</p>}
    {erro&&<p className="atel-v1595-error" role="alert">{erro}</p>}
    {!loading&&dados&&!apr&&<p>Esta OS ainda não possui APR registrada.</p>}
    {apr&&<>
     <div className="atel-v1595-apr-result">Resultado: <strong>{apr.resultado==="APTO"?"APTA":apr.resultado==="NAO_APTO"?"NÃO APTA":"PENDENTE"}</strong><small>{apr.situacao==="REGISTRADO"?"Registrada":"Rascunho"}</small></div>
     <h3>Riscos potenciais</h3><ul>{apr.nenhum_risco?<li>Nenhum risco identificado</li>:traducao(apr.riscos||[],dados!.modelo.riscos||[]).map((nome,i)=><li key={i}>{nome}</li>)}</ul>
     {apr.riscos_outros&&<p><b>Outros:</b> {apr.riscos_outros}</p>}
     <h3>Medidas de controle EPI/EPC</h3><ul>{traducao(apr.medidas||[],dados!.modelo.medidas||[]).map((nome,i)=><li key={i}>{nome}</li>)}</ul>
     {apr.medidas_outros&&<p><b>Outras medidas:</b> {apr.medidas_outros}</p>}
     <h3>Profissionais envolvidos</h3><ul>{(apr.profissionais||[]).map((p,i)=><li key={i}>{p.nome} — {p.funcao}</li>)}</ul>
     <p><b>Supervisor:</b> {apr.acompanhamento_supervisor?"Sim":"Não"} · <b>SESMT:</b> {apr.acompanhamento_sesmt?"Sim":"Não"}</p>
     {apr.observacao&&<><h3>Observações da APR</h3><p>{apr.observacao}</p></>}
     {(dados?.fotos||[]).length>0&&<><h3>Fotos da APR</h3><div className="atel-v1595-apr-thumbs">{dados!.fotos.map(f=>f.url?<a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"><img alt={f.nome_arquivo} src={f.url}/></a>:null)}</div></>}
    </>}
   </div>
   <button type="button" className="atel-v1595-apr-close" onClick={fechar}>FECHAR CONSULTA</button>
  </section>
 </div>;
}

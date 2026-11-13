"use client";
import { useEffect, useState } from "react";
import { atelSupabase } from "@/lib/atelSupabaseV08";

// ATEL_E1_V160_2_FINALIZACOES: leitura do registro definitivo da OS.
// Nunca infere conclusao pelo simples desaparecimento da OS no ERP.
export function useAtelOsFinalizadasV1602() {
  const [finalizadas,setFinalizadas]=useState<Record<string,true>>({});
  const [carregando,setCarregando]=useState(true);
  const [erro,setErro]=useState("");
  useEffect(()=>{
    let ativo=true;
    let geracao=0;
    const consultar=async()=>{
      const tentativa=++geracao;
      if(ativo)setCarregando(true);
      try {
        const supabase=atelSupabase();
        if(!supabase)throw new Error("Conexao Supabase indisponivel.");
        const {data:{session}}=await supabase.auth.getSession();
        if(!session?.access_token)throw new Error("Sessao expirada. Entre novamente.");
        const resposta=await fetch("/api/os-painel-status",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
        const dados=await resposta.json() as {finalizacoes?:{atendimento_erp:number}[];error?:string};
        if(!resposta.ok)throw new Error(dados.error||"Consulta das OS finalizadas indisponivel.");
        if(!Array.isArray(dados.finalizacoes))throw new Error("Status de finalizacao incompleto.");
        const mapa:Record<string,true>={};
        for(const registro of dados.finalizacoes){
          const numero=Number(registro.atendimento_erp);
          if(Number.isSafeInteger(numero)&&numero>0)mapa[String(numero)]=true;
        }
        if(ativo&&tentativa===geracao){setFinalizadas(mapa);setErro("");}
      }catch(e){
        if(ativo&&tentativa===geracao){setFinalizadas({});setErro(e instanceof Error?e.message:"Consulta indisponivel.");}
      }finally{
        if(ativo&&tentativa===geracao)setCarregando(false);
      }
    };
    void consultar();
    const foco=()=>{void consultar();};
    const intervalo=window.setInterval(()=>{if(document.visibilityState==="visible")void consultar();},15000);
    window.addEventListener("focus",foco);
    return()=>{ativo=false;window.clearInterval(intervalo);window.removeEventListener("focus",foco);};
  },[]);
  return {finalizadas,carregando,erro};
}

"use client";
import { useEffect, useState } from "react";
import { atelSupabase } from "@/lib/atelSupabaseV08";

type RegistroAPR = {
  id: string; situacao: string; resultado: "APTO" | "NAO_APTO" | "PENDENTE";
  registrado_em: string | null; modelo_versao: number;
};
type RespostaAPI = { apr?: RegistroAPR | null; error?: string };

/** Exibe um registro ja existente, sem gravar ou duplicar evento operacional. */
export function useAtelAprHistoricoV1596(atendimento: number) {
  const [apr, setApr] = useState<RegistroAPR | null>(null);
  const [erro, setErro] = useState("");
  const [atualizacao, setAtualizacao] = useState(0);
  useEffect(() => {
    if (!Number.isSafeInteger(atendimento) || atendimento <= 0) return;
    let ativo = true;
    setApr(null); setErro("");
    void (async () => {
      try {
        const sb = atelSupabase();
        if (!sb) throw new Error("Sessão indisponível");
        const {data: {session}} = await sb.auth.getSession();
        if (!session?.access_token) throw new Error("Sessão expirada");
        const res = await fetch(`/api/os-apr-v1582?atendimento=${encodeURIComponent(String(atendimento))}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
        });
        const body: RespostaAPI = await res.json();
        if (!res.ok) throw new Error(body.error || "Falha ao consultar APR");
        if (ativo) setApr(body.apr?.situacao === "REGISTRADO" ? body.apr : null);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "APR indisponível");
      }
    })();
    return () => { ativo = false; };
  }, [atendimento, atualizacao]);
  return {apr, erro, recarregar: () => setAtualizacao(v => v + 1)};
}

export function AtelAprEventoV1596({apr, onConsultar}:{apr: RegistroAPR; onConsultar: () => void}) {
  const apta = apr.resultado === "APTO";
  const data = apr.registrado_em ? new Date(apr.registrado_em) : null;
  const quando = data && !Number.isNaN(data.getTime())
    ? data.toLocaleString("pt-BR", {dateStyle:"short", timeStyle:"short"}) : "Data não informada";
  return <article data-atel-apr-historico="v159.6" style={{border:"1px solid #cde6ef",borderLeft:`3px solid ${apta?"#168e73":"#c53b31"}`,borderRadius:9,background:apta?"#f3fbf8":"#fff6f4",padding:12}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:6,alignItems:"flex-start",flexWrap:"wrap"}}>
      <strong style={{fontSize:11,color:"#073d57"}}>APR registrada — {apta?"Apta":"Não apta"}</strong>
      <span style={{fontSize:10,color:"#64748b",fontVariantNumeric:"tabular-nums"}}>{quando}</span>
    </div>
    <div style={{fontSize:10,color:apta?"#12765e":"#a72f28",fontWeight:800,marginTop:5}}>
      Avaliação de segurança · Modelo V{apr.modelo_versao} · {apta?"Atendimento liberado pela APR":"Atendimento impedido pela APR"}
    </div>
    <button type="button" onClick={onConsultar} style={{marginTop:9,border:"1px solid #b8dce8",borderRadius:7,background:"white",color:"#087da7",padding:"8px 10px",fontSize:10,fontWeight:900,cursor:"pointer",width:"100%"}}>
      CONSULTAR APR REGISTRADA
    </button>
  </article>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { carregarOrdensServico, obterEstadoFSMOS, ouvirOrdensServico, type OrdemServico, type EstadoFSMOS } from "@/lib/ordensServicoStore";

const etapas: { estado: EstadoFSMOS; nome: string; icone: string }[] = [
  { estado: "PENDENTE", nome: "Pendente", icone: "📋" },
  { estado: "EM_DESLOCAMENTO", nome: "Deslocamento", icone: "🚗" },
  { estado: "NO_LOCAL", nome: "No cliente", icone: "📍" },
  { estado: "EM_ATENDIMENTO", nome: "Atendimento", icone: "🔧" },
  { estado: "FINALIZADA", nome: "Finalizada", icone: "✅" },
];
const cor = "#087eaf";
const painel: React.CSSProperties = { background: "white", border: "1px solid #b9d9eb", borderRadius: 15, padding: 14 };
function br(iso?: string) { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(iso ?? ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : "—"; }
function situacao(estado: EstadoFSMOS) { return ({ PENDENTE: "Pendente", EM_DESLOCAMENTO: "Em deslocamento", NO_LOCAL: "No cliente", EM_ATENDIMENTO: "Em atendimento", PENDENTE_REAGENDAMENTO: "Reagendamento", PENDENTE_TRATATIVA: "Tratativa", FINALIZADA: "Finalizada", CANCELADA: "Cancelada" } as Record<EstadoFSMOS,string>)[estado]; }

export default function JornadaOSMobile() {
  const router = useRouter();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("ABERTAS");
  const [tecnico, setTecnico] = useState("TODOS");
  useEffect(() => { const atualizar = () => setOrdens(carregarOrdensServico()); atualizar(); return ouvirOrdensServico(atualizar); }, []);
  const tecnicos = useMemo(() => [...new Set(ordens.map(o => `${o.codigoTecnico} · ${o.tecnico}`))].sort(), [ordens]);
  const filtradas = useMemo(() => ordens.filter(o => {
    const e = obterEstadoFSMOS(o);
    if (filtro === "ABERTAS" && (e === "FINALIZADA" || e === "CANCELADA")) return false;
    if (filtro === "FINALIZADAS" && e !== "FINALIZADA") return false;
    if (filtro === "ATENCAO" && e !== "PENDENTE_REAGENDAMENTO" && e !== "PENDENTE_TRATATIVA") return false;
    if (tecnico !== "TODOS" && `${o.codigoTecnico} · ${o.tecnico}` !== tecnico) return false;
    return `${o.codigo} ${o.cliente} ${o.tecnico} ${o.cidade}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"));
  }), [ordens, busca, filtro, tecnico]);
  const abertas = ordens.filter(o => !["FINALIZADA", "CANCELADA"].includes(obterEstadoFSMOS(o))).length;
  const atencao = ordens.filter(o => ["PENDENTE_REAGENDAMENTO", "PENDENTE_TRATATIVA"].includes(obterEstadoFSMOS(o))).length;
  return <main style={{ minHeight: "100dvh", background: "#e9eff3", color: "#12334a", fontFamily: "Arial, sans-serif", padding: "14px 12px 26px" }}>
    <div style={{ maxWidth: 660, margin: "auto", display: "grid", gap: 12 }}>
      <header style={{ ...painel, background: "#075b79", color: "white", borderColor: "#075b79" }}>
        <button type="button" onClick={() => router.push("/coletor/ordens-servico")} style={{ border: 0, background: "transparent", color: "white", fontWeight: 700, cursor: "pointer", padding: 0 }}>‹ Voltar às ordens</button>
        <h1 style={{ margin: "12px 0 4px", fontSize: 21 }}>Jornada do Técnico</h1>
        <p style={{ margin: 0, fontSize: 12, opacity: .85 }}>Acompanhamento operacional das OS · demonstração local</p>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
        {[{n:ordens.length,t:"Total"},{n:abertas,t:"Em aberto"},{n:atencao,t:"Atenção"}].map(k=><div key={k.t} style={{...painel, textAlign:"center",padding:"12px 5px"}}><strong style={{display:"block",fontSize:24,color:cor}}>{k.n}</strong><span style={{fontSize:11}}>{k.t}</span></div>)}
      </div>
      <section style={{ ...painel, display: "grid", gap: 9 }} aria-label="Filtros">
        <input aria-label="Buscar ordem de serviço" placeholder="Buscar OS, cliente, técnico ou cidade" value={busca} onChange={e=>setBusca(e.target.value)} style={{padding:11,border:"1px solid #bdd8e6",borderRadius:9,width:"100%",boxSizing:"border-box"}} />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <select aria-label="Situação" value={filtro} onChange={e=>setFiltro(e.target.value)} style={{padding:10,borderRadius:9,border:"1px solid #bdd8e6",minWidth:0}}><option value="ABERTAS">Em aberto</option><option value="TODAS">Todas</option><option value="ATENCAO">Atenção</option><option value="FINALIZADAS">Finalizadas</option></select>
          <select aria-label="Técnico" value={tecnico} onChange={e=>setTecnico(e.target.value)} style={{padding:10,borderRadius:9,border:"1px solid #bdd8e6",minWidth:0}}><option value="TODOS">Todos os técnicos</option>{tecnicos.map(t=><option key={t} value={t}>{t}</option>)}</select>
        </div>
      </section>
      <div style={{fontSize:12,fontWeight:700,color:"#38637a"}}>{filtradas.length} OS no filtro</div>
      {filtradas.length===0 && <section style={painel}>Nenhuma ordem de serviço encontrada para os filtros.</section>}
      {filtradas.map(o=>{ const e=obterEstadoFSMOS(o); const indice=etapas.findIndex(p=>p.estado===e); const eventos=o.historicoFSM??[]; const especial=indice<0; return <article key={o.id} style={{...painel,display:"grid",gap:12}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}><div><strong style={{color:cor,fontSize:16}}>{o.codigo}</strong><div style={{fontWeight:700,marginTop:3}}>{o.cliente}</div><small>{o.tecnico} · {o.base}</small></div><span style={{background:especial?"#fff2dc":e==="FINALIZADA"?"#dff5eb":"#e6f4fc",color:especial?"#935a00":"#08668e",borderRadius:20,padding:"6px 8px",fontSize:10,fontWeight:700,textAlign:"right"}}>{situacao(e)}</span></div>
        <div style={{fontSize:11,color:"#587487"}}>📅 {br(o.agendamentoFSM?.novaData??o.dataPrevista)} · 📍 {o.cidade} · {o.tipo.replaceAll("_"," ")}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:3}} aria-label="Etapas da OS">{etapas.map((p,i)=>{const feito=indice>=0&&i<=indice;return <div key={p.estado} style={{textAlign:"center",minWidth:0}}><div style={{fontSize:21,filter:feito?"none":"grayscale(1)",opacity:feito?1:.35}}>{p.icone}</div><div style={{height:4,background:feito?"#18a080":"#d9e4ea",borderRadius:5,margin:"5px 1px"}}/><div style={{fontSize:9,color:feito?"#075c76":"#8497a4",fontWeight:feito?700:400,overflowWrap:"anywhere"}}>{p.nome}</div></div>})}</div>
        {especial&&<div style={{background:"#fff4df",padding:9,borderRadius:8,fontSize:11}}>⚠ Esta OS está em {situacao(e).toLowerCase()}. Consulte o histórico e a tratativa antes de prosseguir.</div>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><small style={{color:"#658398"}}>{eventos.length} evento(s) registrados</small><button type="button" onClick={()=>router.push(`/coletor/ordens-servico/${o.id}`)} style={{background:cor,color:"white",border:0,borderRadius:9,padding:"11px 14px",fontWeight:700,cursor:"pointer"}}>Abrir atendimento ›</button></div>
      </article>})}
      <p style={{fontSize:10,color:"#688395",textAlign:"center"}}>Consulta somente leitura. O atendimento continua na tela original da OS. Dados armazenados neste navegador.</p>
    </div>
  </main>;
}

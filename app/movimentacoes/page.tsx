"use client";
import {useDemo} from "@/components/Demo";
import s from "../operacional/operacional.module.css";
const steps=["CD","SEPARADO","CONFERIDO","TRÂNSITO","TEC-060","OS/CLIENTE"];
const readable=(v:unknown)=>String(v??"—").replaceAll("_"," ");
export default function Page(){
 const {reqs=[],accept,persona}=useDemo();
 const waiting=reqs.filter((r:any)=>r.status==="AGUARDANDO_ACEITE").length;
 return <main className={s.page}>
 <header className={s.header}><div><div className={s.eyebrow}>Custódia / Operação logística</div><h1 className={s.heading}>Movimentações</h1><p className={s.subtitle}>CD → trânsito → técnico. Embarque não representa consumo do material.</p></div><span className={s.tag}>Ambiente de homologação</span></header>
 <section className={s.stats}><div className={s.stat}><div className={s.statLabel}>Cargas monitoradas</div><div className={s.statValue}>{reqs.length}</div><div className={s.statNote}>Movimentações no fluxo</div></div><div className={s.stat}><div className={s.statLabel}>Aguardando aceite</div><div className={s.statValue}>{waiting}</div><div className={s.statNote}>Ação pendente do responsável</div></div><div className={s.stat}><div className={s.statLabel}>Demais situações</div><div className={s.statValue}>{reqs.length-waiting}</div><div className={s.statNote}>Em execução ou concluídas</div></div></section>
 <section className={s.card}><h2 className={s.cardTitle}>Macrofluxo de custódia</h2><div className={s.flow}>{steps.map((x,i)=><div className={s.step} key={x}><span className={s.stepNo}>{String(i+1).padStart(2,"0")}</span><span className={s.stepText}>{x}</span></div>)}</div></section>
 <section className={s.card}><h2 className={s.cardTitle}>Cargas · {readable(persona)}</h2>{reqs.length?<div className={s.list}>{reqs.map((r:any)=><div className={s.item} key={r.id}><div className={s.itemMain}><div className={s.itemTitle}>{r.code}</div><div className={s.itemSub}>{r.origin} → {r.destination} · {r.technician}</div></div><div className={s.itemActions}><span className={`${s.pill} ${r.status==="AGUARDANDO_ACEITE"?s.amber:s.green}`}>{readable(r.status)}</span>{r.status==="AGUARDANDO_ACEITE"&&<button type="button" className={s.button} onClick={()=>accept(r.id)}>Aceitar carga</button>}</div></div>)}</div>:<div className={s.empty}>Nenhuma carga disponível para acompanhamento.</div>}<p className={s.note}>O aceite mantém a regra operacional já existente; esta atualização modifica apenas a apresentação.</p></section></main>;
}

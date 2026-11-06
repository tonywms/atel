"use client";
import {useDemo} from "@/components/Demo";
import s from "../operacional/operacional.module.css";
const steps=["CLIENTE","OS RETIRADA","TÉCNICO","TRÂNSITO","TRIAGEM","CD/AVARIA"];
export default function Page(){
 const {assets=[],reverse}=useDemo();
 const installed=assets.filter((a:any)=>a.status==="INSTALADO");
 return <main className={s.page}>
 <header className={s.header}><div><div className={s.eyebrow}>Operação / Ciclo reverso</div><h1 className={s.heading}>Logística Reversa</h1><p className={s.subtitle}>Cancelamento, troca, upgrade, devolução e avaria com rastreabilidade patrimonial.</p></div><span className={s.tag}>Ambiente de homologação</span></header>
 <section className={s.stats}><div className={s.stat}><div className={s.statLabel}>Ativos monitorados</div><div className={s.statValue}>{assets.length}</div><div className={s.statNote}>Registros no cenário</div></div><div className={s.stat}><div className={s.statLabel}>Elegíveis para retirada</div><div className={s.statValue}>{installed.length}</div><div className={s.statNote}>Equipamentos instalados</div></div><div className={s.stat}><div className={s.statLabel}>Outras situações</div><div className={s.statValue}>{assets.length-installed.length}</div><div className={s.statNote}>Não disponíveis para recolhimento</div></div></section>
 <section className={s.card}><h2 className={s.cardTitle}>Macrofluxo da devolução</h2><div className={s.flow}>{steps.map((x,i)=><div className={s.step} key={x}><span className={s.stepNo}>{String(i+1).padStart(2,"0")}</span><span className={s.stepText}>{x}</span></div>)}</div></section>
 <section className={s.card}><h2 className={s.cardTitle}>Ativos elegíveis para recolhimento</h2>{installed.length?<div className={s.list}>{installed.map((a:any)=><div className={s.item} key={a.serial}><div className={s.itemMain}><div className={s.itemTitle}>{a.name} · {a.serial}</div><div className={s.itemSub}>{a.customer} · {a.contract}</div></div><div className={s.itemActions}><span className={`${s.pill} ${s.green}`}>INSTALADO</span><button type="button" className={`${s.button} ${s.orange}`} onClick={()=>reverse(a.serial)}>Cancelar / recolher</button></div></div>)}</div>:<div className={s.empty}>Nenhum ativo instalado elegível neste momento. Finalize a OS de instalação para habilitar o cenário de recolhimento.</div>}<p className={s.note}>O botão de recolhimento preserva a ação original; nenhuma regra de negócio foi modificada.</p></section></main>;
}

"use client";
import { useDemo } from "@/components/Demo";
import s from "../cadastros/cadastros.module.css";
const badge=(v:string)=>`${s.pill} ${/ATIVO|FINALIZAD|INSTALAD/.test(v)?s.pillGreen:""}`;
export default function Page(){
 const {assets=[],orders=[]}=useDemo();
 const linked=assets.filter((a:any)=>a.customer==="Maria Silva");
 return <main className={s.page}>
  <header className={s.header}><div><div className={s.eyebrow}>Cadastros / Cliente 360°</div><h1 className={s.heading}>Maria Silva</h1><p className={s.subtitle}>Visão consolidada de contrato, atendimento e patrimônio instalado.</p></div><span className={s.tag}>Ambiente de homologação</span></header>
  <section className={s.stats}><div className={s.stat}><div className={s.statLabel}>Contrato</div><div className={s.statValue}>CTR-10001</div><div className={s.statNote}>Internet Fibra</div></div><div className={s.stat}><div className={s.statLabel}>Ordens de serviço</div><div className={s.statValue}>{orders.length}</div><div className={s.statNote}>Histórico demonstrativo</div></div><div className={s.stat}><div className={s.statLabel}>Equipamentos vinculados</div><div className={s.statValue}>{linked.length}</div><div className={s.statNote}>Patrimônio em comodato</div></div></section>
  <section className={s.grid}><article className={s.card}><h2 className={s.cardTitle}>Dados do contrato</h2><div className={s.row}><div><div className={s.primary}>CTR-10001 · Internet Fibra</div><div className={s.secondary}>Fortaleza · Ceará</div></div><span className={s.pillGreen+" "+s.pill}>CONTRATO ATIVO</span></div></article>
  <article className={s.card}><h2 className={s.cardTitle}>Ordens de serviço</h2>{orders.length?orders.map((o:any)=><div className={s.row} key={o.id}><div><div className={s.primary}>{o.code}</div><div className={s.secondary}>{o.type}</div></div><span className={badge(String(o.status))}>{String(o.status).replaceAll("_"," ")}</span></div>):<div className={s.empty}>Nenhuma ordem de serviço registrada.</div>}</article>
  <article className={`${s.card} ${s.cardFull}`}><h2 className={s.cardTitle}>Equipamentos vinculados</h2><p className={s.cardSub}>Itens instalados ou associados ao cliente.</p>{!linked.length?<div className={s.empty}>Nenhum equipamento vinculado no momento. Após a finalização da OS-90001, o equipamento ONT poderá aparecer aqui em comodato.</div>:<div className={s.tableWrap}><table className={s.table}><thead><tr><th>Equipamento</th><th>Serial</th><th>MAC</th><th>Propriedade</th><th>Status</th></tr></thead><tbody>{linked.map((a:any)=><tr key={a.serial}><td>{a.name}</td><td className={s.mono}>{a.serial}</td><td>{a.mac}</td><td>{a.owner}</td><td><span className={badge(String(a.status))}>{String(a.status).replaceAll("_"," ")}</span></td></tr>)}</tbody></table></div>}</article></section>
 </main>
}

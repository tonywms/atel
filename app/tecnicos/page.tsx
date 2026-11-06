"use client";
import {useDemo} from "@/components/Demo";
import s from "../cadastros/cadastros.module.css";
export default function Page(){
 const {stock=[]}=useDemo();
 const sum=(field:string)=>stock.reduce((t:number,x:any)=>t+Number(x[field]||0),0);
 return <main className={s.page}><header className={s.header}><div><div className={s.eyebrow}>Cadastros / Técnico TEC-060</div><h1 className={s.heading}>Estoque móvel · Tony</h1><p className={s.subtitle}>Custódia do técnico com saldos físicos, reservados e disponíveis.</p></div><span className={s.tag}>TEC-060</span></header>
 <section className={s.stats}><div className={s.stat}><div className={s.statLabel}>Saldo físico</div><div className={s.statValue}>{sum("physical")}</div><div className={s.statNote}>Quantidade total</div></div><div className={s.stat}><div className={s.statLabel}>Reservado</div><div className={s.statValue}>{sum("reserved")}</div><div className={s.statNote}>Vinculado a ordens de serviço</div></div><div className={s.stat}><div className={s.statLabel}>Disponível</div><div className={s.statValue}>{sum("physical")-sum("reserved")}</div><div className={s.statNote}>Físico menos reservado</div></div></section>
 <section className={s.grid}>{stock.map((x:any)=><article className={s.card} key={x.sku}><div className={s.stockHead}><div><div className={s.eyebrow}>{x.sku}</div><h2 className={s.stockName}>{x.name}</h2></div><span className={s.pill}>Em custódia</span></div><div className={s.stockMetrics}><div className={s.metric}><div className={s.metricLabel}>Físico</div><div className={s.metricValue}>{x.physical}</div></div><div className={s.metric}><div className={s.metricLabel}>Reservado</div><div className={s.metricValue}>{x.reserved}</div></div><div className={s.metric}><div className={s.metricLabel}>Disponível</div><div className={`${s.metricValue} ${s.available}`}>{x.physical-x.reserved}</div></div></div></article>)}</section>
 <div className={s.notice}><strong>Regra operacional:</strong> o técnico representa uma custódia ou local lógico. A reserva do material pertence à ordem de serviço.</div></main>
}

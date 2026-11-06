"use client";
import {useDemo} from "@/components/Demo";
import s from "../cadastros/cadastros.module.css";
export default function Page(){
 const {assets=[]}=useDemo();
 const installed=assets.filter((a:any)=>a.status==="INSTALADO").length;
 const transit=assets.filter((a:any)=>String(a.status).includes("TRANSITO")).length;
 return <main className={s.page}><header className={s.header}><div><div className={s.eyebrow}>Cadastros / Patrimônio</div><h1 className={s.heading}>Ativos e seriais</h1><p className={s.subtitle}>Rastreabilidade por número de série, MAC, custódia e contrato.</p></div><span className={s.tag}>Controle patrimonial</span></header>
 <section className={s.stats}><div className={s.stat}><div className={s.statLabel}>Ativos cadastrados</div><div className={s.statValue}>{assets.length}</div><div className={s.statNote}>Registros demonstrativos</div></div><div className={s.stat}><div className={s.statLabel}>Instalados</div><div className={s.statValue}>{installed}</div><div className={s.statNote}>No cliente final</div></div><div className={s.stat}><div className={s.statLabel}>Em trânsito</div><div className={s.statValue}>{transit}</div><div className={s.statNote}>Custódia em movimentação</div></div></section>
 <section className={s.card}><h2 className={s.cardTitle}>Inventário de ativos</h2><p className={s.cardSub}>Consulte a situação atual dos equipamentos identificados.</p>{assets.length?<div className={s.tableWrap}><table className={s.table}><thead><tr><th>Serial</th><th>MAC</th><th>Produto</th><th>Propriedade</th><th>Local atual</th><th>Contrato</th><th>Status</th></tr></thead><tbody>{assets.map((a:any)=><tr key={a.serial}><td className={s.mono}>{a.serial}</td><td>{a.mac}</td><td><strong>{a.name}</strong></td><td>{a.owner}</td><td>{a.location}</td><td>{a.contract||"—"}</td><td><span className={`${s.pill} ${a.status==="INSTALADO"?s.pillGreen:String(a.status).includes("TRANSITO")?s.pillAmber:""}`}>{String(a.status).replaceAll("_"," ")}</span></td></tr>)}</tbody></table></div>:<div className={s.empty}>Nenhum ativo disponível para consulta.</div>}</section>
 </main>
}

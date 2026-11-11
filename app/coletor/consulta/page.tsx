// ATEL_V147_CONSULTA_INSTALADA
"use client";

import { useRouter } from "next/navigation";
import styles from "./consulta.module.css";

function SvgIcon({ type, size = 22 }: { type: "back" | "hub" | "stock" | "technical" | "chevron"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (type === "back") return <svg {...common}><path d="M19 12H5m7 7-7-7 7-7" /></svg>;
  if (type === "hub") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7m-3.5-3.5h7"/></svg>;
  if (type === "technical") return <svg {...common}><circle cx="12" cy="5" r="2.4"/><path d="M7 21v-5a5 5 0 0 1 10 0v5M4 21h16M5 12l-2 3 2 2m14-5 2 3-2 2"/></svg>;
  if (type === "chevron") return <svg {...common}><path d="m9 5 7 7-7 7"/></svg>;
  return <svg {...common}><path d="m4 7 8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10M8 5l8 4"/></svg>;
}

const opcoes = [
  { titulo: "Estoque", descricao: "Consultar saldos e materiais", rota: "/coletor/consulta/estoque", icone: "stock" as const },
  { titulo: "Estoque Técnico", descricao: "Visualizar estoque do técnico", rota: "/coletor/consulta/estoque-tecnico", icone: "technical" as const },
];

export default function ConsultaPage() {
  const router = useRouter();
  return (
    <div className={styles.screen}>
      <main className={styles.phone}>
        <header className={`${styles.header} ${styles.premiumHeader}`}>
          <button type="button" className={`${styles.back} ${styles.premiumBack}`} aria-label="Voltar ao menu do coletor" onClick={() => router.push("/coletor")}>
            <SvgIcon type="back" size={23} />
          </button>
          <div className={styles.headerTitles}>
            <span className={styles.headerEyebrow}>CENTRAL OPERACIONAL</span>
            <h1>Consulta</h1>
          </div>
          <div className={styles.headerSymbol} aria-hidden="true"><SvgIcon type="hub" size={21}/></div>
        </header>
        <nav className={`${styles.content} ${styles.premiumContent}`} aria-label="Opções de consulta">
          <div className={styles.menuIntro}>
            <div><span className={styles.menuEyebrow}>MENU DE CONSULTAS</span><strong>Selecione a consulta</strong></div>
            <span className={styles.menuBadge}>2 rotinas</span>
          </div>
          {opcoes.map((opcao) => (
            <button key={opcao.rota} type="button" className={`${styles.card} ${styles.premiumCard}`} onClick={() => router.push(opcao.rota)}>
              <span className={`${styles.icon} ${styles.premiumIcon}`} aria-hidden="true"><SvgIcon type={opcao.icone} size={22}/></span>
              <span className={styles.cardText}>
                <span className={styles.name}>{opcao.titulo}</span>
                <span className={styles.cardDescription}>{opcao.descricao}</span>
              </span>
              <span className={styles.cardArrow} aria-hidden="true"><SvgIcon type="chevron" size={15}/></span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}

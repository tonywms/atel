"use client";

import { useRouter } from "next/navigation";
import styles from "./consulta.module.css";

function ArrowLeft() {
  return <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 5-7 7 7 7"/><path d="M8 12h12"/></svg>;
}
function InventoryIcon({ technician = false }: { technician?: boolean }) {
  return <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{technician ? <><circle cx="12" cy="5" r="2.5"/><path d="M7 21v-5a5 5 0 0 1 10 0v5M4 21h16M5 12l-2 3 2 2M19 12l2 3-2 2"/></> : <><path d="m4 7 8-4 8 4v10l-8 4-8-4z"/><path d="m4 7 8 4 8-4M12 11v10M8 5l8 4"/></>}</svg>;
}
const options = [
  { title: "Estoque", route: "/coletor/consulta/estoque", technician: false },
  { title: "Estoque Técnico", route: "/coletor/consulta/estoque-tecnico", technician: true },
] as const;

export default function ConsultaPage() {
  const router = useRouter();
  return (
    <div className={styles.screen}>
      <main className={styles.phone}>
        <header className={styles.header}>
          <button type="button" className={styles.back} aria-label="Voltar ao menu do coletor" onClick={() => router.push("/coletor")}><ArrowLeft /></button>
          <h1>Consulta</h1>
        </header>
        <section className={styles.content} aria-label="Opções de consulta">
          {options.map((option) => (
            <button key={option.route} type="button" className={styles.card} onClick={() => router.push(option.route)}>
              <span className={styles.icon}><InventoryIcon technician={option.technician}/></span>
              <span className={styles.name}>{option.title}</span>
              <span className={styles.counter} aria-label="Indicador visual sem contagem disponível" />
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}

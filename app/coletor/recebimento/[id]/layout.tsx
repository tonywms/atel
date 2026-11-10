import type { ReactNode } from "react";
import styles from "./recebimento-detalhe-v101.module.css";

export default function RecebimentoDetalheLayout({ children }: { children: ReactNode }) {
  return <div className={styles.scope}>{children}</div>;
}

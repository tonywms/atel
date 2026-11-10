// ATEL V94 — extensao do Design System existente V90/V91.
import type { ReactNode } from "react";
import tokens from "@/components/atel-ui/atel-tokens.module.css";
import expedicoes from "@/components/atel-ui/atel-expedicoes-v94.module.css";

export default function AtelExpedicoesV94Layout({ children }: { children: ReactNode }) {
  return (
    <div className={`${tokens.atelRoot} ${expedicoes.shell} ${expedicoes.regularizacao}`}>
      {children}
    </div>
  );
}

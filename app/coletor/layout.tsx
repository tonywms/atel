import type { ReactNode } from "react";
import AtalhoProdutividadeV155 from "@/components/atel-ui/AtalhoProdutividadeV155";

// ATEL E1 V155 - Layout do coletor sem alterar as dimensoes ou a navegacao existentes.
export default function ColetorLayout({ children }: { children: ReactNode }) {
  return <>{children}<AtalhoProdutividadeV155 /></>;
}

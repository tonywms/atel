import type { ReactNode } from "react";
import { AtelDataTable } from "@/components/atel-ui";
import tokens from "@/components/atel-ui/atel-tokens.module.css";
import ui from "./atel-cadastros.module.css";

/** Componentes exclusivamente visuais: nao consultam dados nem alteram regras de negocio. */
export function AtelCadastroPage({children,className=""}:{children:ReactNode;className?:string}) {
  return <main className={`${tokens.atelRoot} ${ui.page} ${className}`}>{children}</main>;
}
export function AtelCadastroHero({children,className=""}:{children:ReactNode;className?:string}) {
  return <header className={`${ui.hero} ${className}`}>{children}</header>;
}
export function AtelCadastroStats({children,className=""}:{children:ReactNode;className?:string}) {
  return <section className={`${ui.stats} ${className}`}>{children}</section>;
}
export function AtelCadastroMetric({children,className=""}:{children:ReactNode;className?:string}) {
  return <div className={`${ui.metric} ${className}`}>{children}</div>;
}
export function AtelCadastroTable({children,className=""}:{children:ReactNode;className?:string}) {
  return <AtelDataTable className={`${ui.table} ${className}`}>{children}</AtelDataTable>;
}

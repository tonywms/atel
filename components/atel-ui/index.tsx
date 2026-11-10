import type { ReactNode } from "react";

/** ATEL UI V80: componentes de apresentacao; nao fazem consultas nem mutacoes. */
export function AtelPageHeader({className, iconClassName, title, description, icon, titleId, titleClassName, descriptionClassName, action}: {className: string; iconClassName: string; title: string; description: string; icon: ReactNode; titleId: string; titleClassName: string; descriptionClassName: string; action?: ReactNode}) {
  return <div className={className}><span className={iconClassName}>{icon}</span><div><h1 id={titleId} className={titleClassName}>{title}</h1><p className={descriptionClassName}>{description}</p></div>{action}</div>;
}
export function AtelStatCard({className, iconClassName, labelClassName, valueClassName, icon, label, value, note}: {className: string; iconClassName: string; labelClassName: string; valueClassName: string; icon: ReactNode; label: ReactNode; value: ReactNode; note: ReactNode}) {
  return <article className={className}><div className={iconClassName}>{icon}</div><div><span className={labelClassName}>{label}</span><strong className={valueClassName}>{value}</strong><small>{note}</small></div></article>;
}
export function AtelDataTable({className, children}: {className: string; children: ReactNode}) {
  return <table className={className}>{children}</table>;
}

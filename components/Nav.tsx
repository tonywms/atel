"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const painel = [
  ["Operador Logístico", "/operacao"],
  ["Pedidos", null],
  ["Painel de Pedidos", null],
  ["Expedição", "/expedicoes"],
  ["Painel de Rotas", null],
  ["Painel de Embarque", null],
  ["Painel de Produtividade", null],
  ["Visão Operacional", "/"],
  ["Painel de Controle", "/admin/governanca-operacional"],
] as const;

const expedicoes = [
  ["Dashboard", "/expedicoes"],
  ["Gestão", "/expedicoes/gestao"],
  ["Gestão OS", "/admin/ordens-servico"],  ["OS Adapter", "/expedicoes/os-adapter"],

  ["Conferência", null],
  ["Rel. Expedição", null],
  ["Gerar Pedidos", null],
  ["Comparação Pedidos", null],
  ["Liberação de Pedidos", null],
  ["Retornos / Devoluções", "/expedicoes/retornos"],
  ["Pendências de Retorno", "/expedicoes/pendencias"],
] as const;

const relatorios = [
  ["Estoque Técnico", "/relatorios/estoque-tecnico"],
  ["Patrimônio Cliente", "/relatorios/patrimonio-cliente"],
] as const;

function MenuEntries({items, pathname}:{items:readonly (readonly [string,string|null])[];pathname:string}) {
  return <div className="wms-submenu">{items.map(([name,url]) => url ?
    <Link key={name} href={url} className={pathname === url ? "active" : ""}>{name}</Link> :
    <span key={name} title="Rotina ainda não identificada no código recebido" className="wms-submenu-pendente" aria-disabled="true">{name}</span>
  )}</div>;
}

export function Sidebar() {
  const pathname = usePathname();
  const [painelManual, setPainelManual] = useState<boolean|null>(null);
  const [expManual, setExpManual] = useState<boolean|null>(null);
  const [relManual, setRelManual] = useState<boolean|null>(null);
  const painelAberto = painelManual ?? (pathname === "/" || pathname === "/operacao" || pathname === "/admin/governanca-operacional");
  const expedicoesAberto = expManual ?? (pathname.startsWith("/expedicoes") || pathname === "/admin/ordens-servico");
  const relatoriosAberto = relManual ?? pathname.startsWith("/relatorios");
  return <aside>
    <div className="brand"><div className="brand-logo"><div className="brand-symbol">W</div><div className="brand-text">WMS<span>EXPERT</span></div></div></div>
    <div className="wms-nav">
      <Link href="/" className={`wms-menu-item ${pathname === "/" ? "active" : ""}`}><span className="wms-menu-icon">⌂</span>Início</Link>
      <div className="wms-menu-parent"><span className="wms-menu-icon">⊕</span>Cadastros<span className="wms-chevron">›</span></div>
      <button type="button" className={`wms-menu-parent wms-menu-toggle ${relatoriosAberto ? "open" : ""}`} onClick={()=>setRelManual(!relatoriosAberto)} aria-expanded={relatoriosAberto}><span className="wms-menu-icon">▣</span>Relatórios<span className="wms-chevron">{relatoriosAberto ? "⌄" : "›"}</span></button>
      {relatoriosAberto && <MenuEntries items={relatorios} pathname={pathname}/>}
      <div className="wms-menu-parent"><span className="wms-menu-icon">⌁</span>Entradas<span className="wms-chevron">›</span></div>
      <div className="wms-menu-parent"><span className="wms-menu-icon">↔</span>Movimentações<span className="wms-chevron">›</span></div>
      <button type="button" className={`wms-menu-parent wms-menu-toggle ${expedicoesAberto ? "open" : ""}`} onClick={()=>setExpManual(!expedicoesAberto)} aria-expanded={expedicoesAberto}><span className="wms-menu-icon">▱</span>Expedições<span className="wms-chevron">{expedicoesAberto ? "⌄" : "›"}</span></button>
      {expedicoesAberto && <MenuEntries items={expedicoes} pathname={pathname}/>}
      <div className="wms-menu-parent"><span className="wms-menu-icon">☷</span>Auditoria<span className="wms-chevron">›</span></div>
      <div className="wms-menu-parent"><span className="wms-menu-icon">◉</span>ERP<span className="wms-chevron">›</span></div>
      <button type="button" className={`wms-menu-parent wms-menu-toggle ${painelAberto ? "open" : ""}`} onClick={()=>setPainelManual(!painelAberto)} aria-expanded={painelAberto}><span className="wms-menu-icon">▣</span>Painel<span className="wms-chevron">{painelAberto ? "⌄" : "›"}</span></button>
      {painelAberto && <MenuEntries items={painel} pathname={pathname}/>}
      <div className="wms-menu-parent"><span className="wms-menu-icon">♢</span>Permissões<span className="wms-chevron">›</span></div>
      <div className="wms-menu-parent"><span className="wms-menu-icon">↻</span>Atualizações<span className="wms-chevron">›</span></div>
    </div>
    <div className="sidebar-user"><div className="user-line"><div className="user-avatar">AD</div><div className="user-info"><strong>WMS TELECOM - ADM</strong><span>admin@wmsexpert.com.br</span></div></div><div className="logout">↪ &nbsp; Sair</div></div>
  </aside>;
}
export function Top(){return null;}
export default Sidebar;

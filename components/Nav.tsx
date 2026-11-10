
"use client";

import Link from "next/link";
import Image from "next/image";
import { House, CirclePlus, FileText, ArrowLeftRight, Truck, ListOrdered, Globe2, Monitor, ShieldCheck, RefreshCw, Smartphone, ChevronRight, ChevronDown, LogOut } from "lucide-react";
import "./atel-sidebar-v18.css";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import { ATEL_GRUPOS, ATEL_MASTER, rotaLiberada } from "@/lib/atelPermissoesMenu";

// Navegacao exclusivamente WEB. Rotas /coletor/* so existem na interface mobile.
// Nao incluir rotas do coletor nos grupos administrativos.
const grupos = ATEL_GRUPOS;

function MenuEntries({items, pathname}:{items:readonly (readonly [string,string])[];pathname:string}) {
  return <div className="wms-submenu">{items.map(([name,url]) =>
    <Link key={url} href={url} className={pathname === url ? "active" : ""}>{name}</Link>
  )}</div>;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [regras, setRegras] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const client = atelSupabase();
    if (!client) return;
    let active = true;
    void client.auth.getUser().then(({ data }) => { if (active) setEmail(data.user?.email ?? null); });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setEmail(session?.user?.email ?? null);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    const client = atelSupabase();
    if (!client || !email || email.toLowerCase() === ATEL_MASTER) return;
    let alive = true;
    void client.from("atel_menu_permissoes").select("rota,liberado").then(({data,error}) => {
      if (alive && !error) setRegras(Object.fromEntries((data ?? []).map(p => [p.rota, p.liberado])));
    });
    return () => { alive = false; };
  }, [email, pathname]);
  async function sair() {
    const client = atelSupabase();
    if (!client || saindo) return;
    setSaindo(true);
    try { await client.auth.signOut(); router.replace("/login"); router.refresh(); }
    finally { setSaindo(false); }
  }
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const iconProps = {size:17, strokeWidth:1.9, "aria-hidden":true as const};
  const icon = (Comp: typeof House) => <span className="wms-menu-icon"><Comp {...iconProps}/></span>;
  const chevron = (opened = false) => <span className="wms-chevron">{opened ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</span>;
  const itens = [
    ["Cadastros", CirclePlus], ["Relatórios", FileText],
    ["Movimentações", ArrowLeftRight], ["Expedições", Truck], ["Auditoria", ListOrdered],
    ["ERP", Globe2], ["Painel", Monitor],
  ] as const;
  return <aside className={`atel-sidebar ${collapsed ? "collapsed" : ""}`}>
    <button type="button" className="brand atel-brand-toggle" aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"} onClick={() => setCollapsed(v => !v)}>
      <Image src={collapsed ? "/atel-sidebar/logo-icon.png" : "/atel-sidebar/logo-full.png"} alt="WMS Expert" width={collapsed ? 40 : 172} height={collapsed ? 40 : 46} priority />
    </button>
    <div className="wms-nav">
      <Link href="/" title="Início" className={`wms-menu-item ${pathname === "/" ? "active" : ""}`}>{icon(House)}<span className="atel-nav-label">Início</span></Link>
      {itens.map(([nome, Icone]) => {

        const baseLinks = grupos[nome];
        const links: [string, string][] = baseLinks
          
          .map(([label, url]) => [label, url] as [string, string]);
        if (nome === "Cadastros") {
          links.push(
            ["Produtos", "/admin/homologacao-cadastros-v74/produtos"],
            ["Depósitos", "/admin/homologacao-cadastros-v74/depositos"],
            ["Endereços", "/admin/homologacao-cadastros-v74/enderecos"]
          );
        }
        const linksPermitidos = links.filter(([, url]) => email?.toLowerCase() === ATEL_MASTER || rotaLiberada(url, regras));

        if (!linksPermitidos.length) return null;
        const ativo = linksPermitidos.some(([, url]) => pathname === url || (url !== "/" && pathname.startsWith(url + "/")));
        const aberto = abertos[nome] ?? ativo;
        return <div key={nome}>
          <button type="button" title={nome} className={`wms-menu-parent wms-menu-toggle ${aberto ? "open" : ""}`} onClick={() => { if (collapsed) setCollapsed(false); setAbertos(prev => ({...prev, [nome]: !aberto})); }} aria-expanded={!collapsed && aberto}>
            {icon(Icone)}<span className="atel-nav-label">{nome}</span>{chevron(aberto)}
          </button>
          {!collapsed && aberto && <MenuEntries items={linksPermitidos} pathname={pathname}/>}
          
        </div>;
      })}
      {(email?.toLowerCase() === ATEL_MASTER || rotaLiberada("/coletor", regras)) && <a href="/coletor" target="_blank" rel="noopener noreferrer" title="Abrir coletor em nova aba" className="wms-menu-item wms-coletor-link">
        {icon(Smartphone)}<span className="atel-nav-label">Abrir coletor</span><span className="wms-chevron" aria-hidden="true">↗</span>
      </a>}
      {email?.toLowerCase() === ATEL_MASTER && <Link href="/admin/parametros" className={`wms-menu-item ${pathname === "/admin/parametros" ? "active" : ""}`} title="Parâmetros">{icon(ShieldCheck)}<span className="atel-nav-label">Parâmetros</span></Link>}
    </div>
    <div className="sidebar-user"><div className="user-line"><div className="user-avatar">{email?.toLowerCase() === ATEL_MASTER ? "M" : "T"}</div><div className="user-info"><strong>{email?.toLowerCase() === ATEL_MASTER ? "Administrador Master" : "Homologação WMS Expert"}</strong><span>{email ?? "Validando sessão..."}</span></div></div><button type="button" className="logout atel-logout-button" onClick={() => void sair()} disabled={saindo}><LogOut size={18}/><span>{saindo ? "Saindo..." : "Sair"}</span></button></div>
  </aside>;
}
export function Top(){return null;}
export default Sidebar;

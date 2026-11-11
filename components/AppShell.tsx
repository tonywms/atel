"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/Nav";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import { ATEL_MASTER, ATEL_TESTE, rotaLiberada } from "@/lib/atelPermissoesMenu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [negado, setNegado] = useState(false);
  const login = pathname === "/login" || pathname === "/redefinir-senha";
  useEffect(() => {
    const client = atelSupabase();
    if (!client) { setAutorizado(false); if (!login) router.replace("/login"); return; }
    let alive = true;
    setAutorizado(null);
    // ATEL_V140_AUTH_TIMEOUT: resposta lenta/indisponivel nao deixa a tela travada indefinidamente.
    Promise.race([
      client.auth.getUser(),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("Tempo limite de autenticacao")), 12000);
      }),
    ]).then(({data}) => {
      if (!alive) return;
      const ok = [ATEL_MASTER, ATEL_TESTE].includes(data.user?.email?.toLowerCase() ?? "");
      if (data.user && !ok) void client.auth.signOut();
      setAutorizado(ok);
      if (ok && !login) {
        const master = data.user?.email?.toLowerCase() === ATEL_MASTER;
        if (pathname === "/admin/parametros" && !master) { setNegado(true); return; }
        if (!master) {
          void client.from("atel_menu_permissoes").select("rota,liberado").then(({data: rows,error}) => {
            if (!alive) return;
            if (error) { setNegado(true); return; }
            const rules = Object.fromEntries((rows ?? []).map(p=>[p.rota,p.liberado]));
            setNegado(!rotaLiberada(pathname, rules));
          });
        } else setNegado(false);
      }
      if (!ok && !login) router.replace("/login");
      if (ok && pathname === "/login") router.replace("/");
    }).catch(()=>{if(alive){setAutorizado(false);if(!login)router.replace("/login");}});
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
      if (!alive) return;
      if (!session && !login) {setAutorizado(false);router.replace("/login");}
      if (session && ![ATEL_MASTER, ATEL_TESTE].includes(session.user.email?.toLowerCase() ?? "")) {
        setAutorizado(false); void client.auth.signOut(); if (!login) router.replace("/login"); return;
      }
      if (session && pathname === "/login") {setAutorizado(true);router.replace("/");}
    });
    return ()=>{alive=false;subscription.unsubscribe();};
  },[pathname,router]);
  if (login) return <>{children}</>;
  if (autorizado !== true) return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",color:"#075a79",fontFamily:"Arial"}}>Validando acesso ao WMS Expert...</div>;
  if (negado) return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",fontFamily:"Arial",color:"#075a79"}}>Rotina não liberada para homologação.</div>;
  if (pathname.startsWith("/coletor")) return <>{children}</>;
  return <div className="shell"><Sidebar/><div className="work"><main>{children}</main></div></div>;
}

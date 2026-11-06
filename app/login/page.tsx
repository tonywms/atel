"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import styles from "./signin.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro("");
    const client = atelSupabase();
    if (!client) { setErro("Conexão Supabase não configurada."); return; }
    if (!["teste@wmsexpert.com.br", "master@wmsexpert.com.br"].includes(usuario.trim().toLowerCase())) { setErro("Acesso restrito ao usuário de homologação."); return; }
    setEnviando(true);
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: usuario.trim().toLowerCase(), password: senha });
      if (error || !["teste@wmsexpert.com.br", "master@wmsexpert.com.br"].includes(data.user?.email?.toLowerCase() ?? "")) {
        if (!error) await client.auth.signOut();
        setErro("Usuário ou senha inválidos, ou acesso não autorizado."); return;
      }
      router.replace("/");
      router.refresh();
    } catch { setErro("Não foi possível conectar ao serviço de autenticação."); }
    finally { setEnviando(false); }
  }

  return <div className={styles.screen}>
    <div className={styles.visual} aria-hidden="true"><img src="/atel-login/side.png" alt="" /></div>
    <section className={styles.panel} aria-label="Entrar no WMS Expert">
      <div className={styles.logo}><img src="/atel-login/logo-wmsexpert.png" alt="WMS Expert" /></div>
      <form onSubmit={entrar} className={styles.form}>
        <label className={styles.sr} htmlFor="atel-usuario">Usuário</label>
        <input id="atel-usuario" type="email" autoComplete="username" placeholder="Usuário" value={usuario} onChange={e=>setUsuario(e.target.value)} required />
        <div className={styles.password}>
          <label className={styles.sr} htmlFor="atel-senha">Senha</label>
          <input id="atel-senha" type={mostrar?"text":"password"} autoComplete="current-password" placeholder="Senha" value={senha} onChange={e=>setSenha(e.target.value)} required />
          <button type="button" aria-label={mostrar?"Ocultar senha":"Mostrar senha"} onClick={()=>setMostrar(!mostrar)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
        {erro && <p className={styles.error} role="alert">{erro}</p>}
        <button className={styles.submit} type="submit" disabled={enviando || !usuario || !senha}>{enviando?"ENTRANDO...":"ENTRAR"}</button>
        <p className={styles.notice}>Acesso exclusivo para homologação. Recuperação de senha temporariamente indisponível.</p>
      </form>
    </section>
  </div>;
}

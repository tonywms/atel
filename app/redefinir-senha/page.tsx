"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import styles from "../login/signin.module.css";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    const client = atelSupabase();
    if (!client) return;
    let ativo = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (ativo && event === "PASSWORD_RECOVERY") setPronto(true);
    });
    // Supabase may exchange the recovery code before the event subscription.
    client.auth.getSession().then(({data}) => {
      if (ativo && data.session && window.location.hash.includes("type=recovery")) setPronto(true);
    }).catch(() => {});
    return () => { ativo = false; subscription.unsubscribe(); };
  }, []);

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro("");
    if (senha.length < 8) { setErro("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (senha !== confirmacao) { setErro("As senhas não coincidem."); return; }
    const client = atelSupabase();
    if (!client) { setErro("Conexão Supabase indisponível."); return; }
    setEnviando(true);
    try {
      const { error } = await client.auth.updateUser({password:senha});
      if (error) { setErro("Não foi possível redefinir a senha. Solicite um novo link."); return; }
      await client.auth.signOut();
      setConcluido(true);
    } catch { setErro("Erro de conexão. Tente novamente."); }
    finally { setEnviando(false); }
  }

  return <div className={styles.screen}>
    <div className={styles.visual} aria-hidden="true"><img src="/atel-login/side.png" alt="" /></div>
    <section className={styles.panel} aria-label="Redefinir senha">
      <div className={styles.logo}><img src="/atel-login/logo-wmsexpert.png" alt="WMS Expert" /></div>
      {concluido ? <div className={styles.form}>
        <p className={styles.notice}>Senha alterada com sucesso.</p>
        <button className={styles.submit} onClick={()=>router.replace("/login")}>VOLTAR AO LOGIN</button>
      </div> : <form className={styles.form} onSubmit={salvar}>
        <p style={{margin:0,fontSize:16}}>Redefinir senha</p>
        {!pronto && <p className={styles.notice}>Abra o link de recuperação enviado ao seu e-mail para continuar.</p>}
        <label className={styles.sr} htmlFor="nova-senha">Nova senha</label>
        <input id="nova-senha" type={mostrar?"text":"password"} placeholder="Nova senha" autoComplete="new-password" value={senha} onChange={e=>setSenha(e.target.value)} required />
        <label className={styles.sr} htmlFor="confirmar-senha">Confirmar nova senha</label>
        <input id="confirmar-senha" type={mostrar?"text":"password"} placeholder="Confirmar nova senha" autoComplete="new-password" value={confirmacao} onChange={e=>setConfirmacao(e.target.value)} required />
        <button className={styles.recovery} type="button" onClick={()=>setMostrar(!mostrar)}>{mostrar?"Ocultar senhas":"Mostrar senhas"}</button>
        {erro && <p className={styles.error} role="alert">{erro}</p>}
        <button className={styles.submit} type="submit" disabled={!pronto || enviando || !senha || !confirmacao}>{enviando?"SALVANDO...":"ALTERAR SENHA"}</button>
        <button className={styles.recovery} type="button" onClick={()=>router.replace("/login")}>Voltar ao login</button>
      </form>}
    </section>
  </div>;
}

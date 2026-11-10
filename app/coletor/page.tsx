"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import styles from "./coletor-home.module.css";

// Destinos ja existentes no ATEL: nao modificar sem alteracao funcional aprovada.
const menu = [
  { id: "cadastro", titulo: "Cadastro", href: "/coletor/cadastro" },
  { id: "consulta", titulo: "Consulta", href: "/coletor/consulta" },
  { id: "recepcao", titulo: "Recepção", href: "/coletor/recepcao" },
  { id: "movimentacao", titulo: "Movimentação", href: "/coletor/movimentacao" },
  { id: "expedicao", titulo: "Expedição", href: "/coletor/expedicoes" },
  { id: "auditoria", titulo: "Auditoria", href: "/coletor/auditoria" },
] as const;

type ModuloId = (typeof menu)[number]["id"];

function IconeModulo({ tipo }: { tipo: ModuloId }) {
  return (
    <svg viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {tipo === "cadastro" && (
        <>
          <rect x="12" y="12" width="48" height="48" rx="13" />
          <path d="M36 24v24M24 36h24" />
        </>
      )}
      {tipo === "consulta" && (
        <>
          <circle cx="31" cy="30" r="17" />
          <path d="m44 44 17 17" />
        </>
      )}
      {tipo === "recepcao" && (
        <>
          <circle cx="16" cy="21" r="6" />
          <circle cx="56" cy="21" r="6" />
          <path d="M7 53V39c0-6 4-10 9-10s9 4 9 10v9M65 53V39c0-6-4-10-9-10s-9 4-9 10v9" />
          <path d="m26 35 10-5 10 5v13l-10 5-10-5V35Z" />
          <path d="m26 35 10 5 10-5M36 40v13" />
        </>
      )}
      {tipo === "movimentacao" && (
        <>
          <path d="M15 13h12v34h36M27 27h26v20M16 58h49" />
          <path d="M35 28h11v9H35zM48 28h11v9H48z" />
          <circle cx="27" cy="58" r="5" />
          <circle cx="59" cy="58" r="5" />
        </>
      )}
      {tipo === "expedicao" && (
        <>
          <path d="M8 44h38V22H20M46 30h11l9 11v14H8V44" />
          <path d="M46 41h19M6 22h10M5 31h15M6 39h12" />
          <circle cx="22" cy="55" r="6" />
          <circle cx="54" cy="55" r="6" />
        </>
      )}
      {tipo === "auditoria" && (
        <>
          <path d="m9 29 27-15 27 15M12 34h48M15 59h42M11 65h50" />
          <path d="M21 36v20M33 36v20M45 36v20M57 36v20" />
        </>
      )}
    </svg>
  );
}

export default function ColetorMenuPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [saindo, setSaindo] = useState(false);

  // Mesmo mecanismo de identificacao do usuario: Supabase Auth.
  useEffect(() => {
    const supabase = atelSupabase();
    if (!supabase) return;
    let ativo = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (ativo) setEmail(data.user?.email ?? "");
    }).catch(() => {
      if (ativo) setEmail("");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (ativo) setEmail(sessao?.user?.email ?? "");
    });

    return () => { ativo = false; subscription.unsubscribe(); };
  }, []);

  // Preserva logout e destino original; sem trocar autenticacao ou rotas.
  async function sair() {
    if (saindo) return;
    setSaindo(true);
    try {
      const supabase = atelSupabase();
      if (supabase) await supabase.auth.signOut();
      router.replace("/login");
    } catch {
      setSaindo(false);
    }
  }

  return (
    <main className={styles.tela}>
      <div className={styles.fundo} aria-hidden="true" />
      <div className={styles.conteudo}>
        <header className={styles.marca}>
          <Image
            src="/atel-coletor/logo-wmsexpert-v97.png"
            alt="WMS Expert"
            width={440}
            height={117}
            priority
            className={styles.logo}
          />
        </header>

        <section className={styles.identificacao} aria-label="Identificação do usuário">
          <span className={styles.avatar} aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true">
              <circle cx="20" cy="13" r="6" />
              <path d="M8 34v-5c0-6 5-10 12-10s12 4 12 10v5" />
            </svg>
          </span>
          <div className={styles.dadosUsuario}>
            <span className={styles.etiqueta}>Login</span>
            <span className={styles.usuario} title={email || "Carregando sessão"}>
              {email || "Carregando sessão..."}
            </span>
          </div>
        </section>

        <section className={styles.modulos} aria-labelledby="atalho-coletor-title">
          <div className={styles.tituloSecao}>
            <svg className={styles.iconeSecao} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m3 12 11-7 11 7-11 7-11-7ZM3 18l11 7 11-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1 id="atalho-coletor-title">Acesso rápido / módulos</h1>
            <span className={styles.linhaTitulo} aria-hidden="true" />
          </div>

          <nav className={styles.grade} aria-label="Menu principal do coletor">
            {menu.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.cartao}
                onClick={() => router.push(item.href)}
                aria-label={item.titulo}
              >
                <span className={styles.icone}>
                  <IconeModulo tipo={item.id} />
                </span>
                <span className={styles.tituloCartao}>{item.titulo}</span>
              </button>
            ))}
          </nav>
        </section>

        <footer className={styles.rodape}>
          <button type="button" className={styles.sair} onClick={() => void sair()} disabled={saindo}>
            <svg viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 7V5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3v-2M3 15h16m-6-6 6 6-6 6" />
            </svg>
            <span>{saindo ? "Saindo..." : "Sair"}</span>
          </button>
          <div className={styles.versao}><span />homolog 0.0.0.0<span /></div>
        </footer>
      </div>
    </main>
  );
}

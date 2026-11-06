"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import styles from "./coletor-home.module.css";

// Preserva os destinos originais do menu do coletor.
// A V33 muda somente a apresentação e a identificação de login.
const menu = [
  { id: "cadastro", titulo: "Cadastro", href: "/coletor/cadastro" },
  { id: "consulta", titulo: "Consulta", href: "/coletor/consulta" },
  { id: "recepcao", titulo: "Recepção", href: "/coletor/recepcao" },
  { id: "movimentacao", titulo: "Movimentação", href: "/coletor/movimentacao" },
  { id: "expedicao", titulo: "Expedição", href: "/coletor/expedicoes" },
  { id: "auditoria", titulo: "Auditoria", href: "/coletor/auditoria" },
] as const;

export default function ColetorMenuPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [saindo, setSaindo] = useState(false);

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
    <div className="collector-screen">
      <div className={`collector-phone ${styles.dispositivo}`}>
        <div className={styles.barraSuperior} aria-hidden="true" />

        <div className={styles.painel}>
          <div className={styles.marca}>
            <Image
              src="/atel-coletor/logo-wmsexpert.png"
              alt="WMS Expert"
              width={125}
              height={34}
              priority
              className={styles.logo}
            />
          </div>

          <div className={styles.identificacao}>
            <span className={styles.avatar} aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <circle cx="16" cy="11" r="5.2" stroke="currentColor" strokeWidth="1.65" />
                <path d="M7.2 27v-3.8c0-5.2 3.6-8 8.8-8s8.8 2.8 8.8 8V27" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
              </svg>
            </span>
            <div className={styles.capsula}>
              <span className={styles.etiqueta}>Login</span>
              <span className={styles.usuario} title={email || "Carregando sessão"}>
                {email || "Carregando sessão..."}
              </span>
            </div>
          </div>

          <div className={styles.grade} aria-label="Menu principal do coletor">
            {menu.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.cartao}
                onClick={() => router.push(item.href)}
                aria-label={item.titulo}
              >
                <Image
                  src={`/atel-coletor/${item.id}.png`}
                  alt=""
                  width={64}
                  height={64}
                  className={styles.icone}
                />
                <span className={styles.tituloCartao}>{item.titulo}</span>
              </button>
            ))}
          </div>

          <div className={styles.rodape}>
            <button className={styles.sair} type="button" onClick={() => void sair()} disabled={saindo}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M10 17l5-5-5-5M15 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
              <span>{saindo ? "Saindo..." : "Sair"}</span>
            </button>
            <div className={styles.versao}>homolog 0.0.0.0</div>
          </div>
        </div>

        <div className={styles.barraInferior} aria-hidden="true">
          <span className={styles.voltar} />
          <span className={styles.home} />
          <span className={styles.recentes}><i /><i /><i /></span>
        </div>
      </div>
    </div>
  );
}

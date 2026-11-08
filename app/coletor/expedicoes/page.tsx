"use client";

import styles from "./expedicoes.module.css";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { requisicoesTecnicasMock } from "@/lib/requisicoesTecnicas";
import { atualizarPedidosAtelV363, obterPedidosAtelV363, pedidosComEstadoV363 } from "@/lib/atelPedidosHomologacaoV363";

import {
  carregarEstados,
  ouvirAlteracoes,
} from "@/lib/requisicoesStore";

import {
  carregarRetornos,
  ouvirRetornos,
} from "@/lib/retornosStore";

import {
  carregarOrdensServico,
  ouvirOrdensServico,
} from "@/lib/ordensServicoStore";

type Contadores = {
  separacao: number;
  conferencia: number;
  embarque: number;
  recebimento: number;
  retornos: number;
  ordensServico: number;
};

export default function ColetorExpedicaoPage() {
  const router = useRouter();

  const [contadores, setContadores] =
    useState<Contadores>({
      separacao: 0,
      conferencia: 0,
      embarque: 0,
      recebimento: 0,
      retornos: 0,
      ordensServico: 0,
    });

  function atualizarContadores() {
    const estados = carregarEstados();

    let separacao = 0;
    let conferencia = 0;
    let embarque = 0;
    let recebimento = 0;

    [...requisicoesTecnicasMock, ...pedidosComEstadoV363(obterPedidosAtelV363())].forEach((req) => {
      const status =
        estados[req.id]?.status ??
        req.status;

      if (
        status === "PENDENTE" ||
        status === "EM_SEPARACAO"
      ) {
        separacao += 1;
      }

      if (
        status === "SEPARADA" ||
        status === "EM_CONFERENCIA"
      ) {
        conferencia += 1;
      }

      if (
        status === "CONFERIDA" ||
        status === "EMBARCADA"
      ) {
        embarque += 1;
      }

      if (
        status === "EM_TRANSITO" ||
        status === "ACEITE_PENDENTE"
      ) {
        recebimento += 1;
      }
    });

    const retornos =
      carregarRetornos().filter((r) =>
        [
          "EM_TRANSITO_CD",
          "AGUARDANDO_CONFERENCIA",
          "EM_CONFERENCIA",
        ].includes(r.status)
      ).length;

    const ordensServico =
      carregarOrdensServico().filter(
        (os) =>
          os.status === "PENDENTE" ||
          os.status === "EM_ATENDIMENTO"
      ).length;

    setContadores({
      separacao,
      conferencia,
      embarque,
      recebimento,
      retornos,
      ordensServico,
    });
  }

  useEffect(() => {
    let ativo = true;
    const sincronizar = () => {
      void atualizarPedidosAtelV363()
        .then(() => { if (ativo) atualizarContadores(); })
        .catch((erro) => console.error("ATEL: falha ao atualizar contadores", erro));
    };
    sincronizar();
    window.addEventListener("focus", sincronizar);
    return () => { ativo = false; window.removeEventListener("focus", sincronizar); };
  }, []);

  useEffect(() => {
    atualizarContadores();

    const offReq =
      ouvirAlteracoes(
        atualizarContadores
      );

    const offRet =
      ouvirRetornos(
        atualizarContadores
      );

    const offOs =
      ouvirOrdensServico(
        atualizarContadores
      );

    return () => {
      offReq();
      offRet();
      offOs();
    };
  }, []);

  return (
    <main className={styles.screen}>
      <section className={styles.phone} aria-label="Coletor - Expedição">
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => router.push("/coletor")} aria-label="Voltar ao menu do coletor">
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h1>Expedição</h1>
        </header>
        <nav className={styles.content} aria-label="Rotinas de expedição">
          {([
            { label: "Separação", href: "/coletor/separacao", count: contadores.separacao, icon: "↗" },
            { label: "Conferência", href: "/coletor/conferencia", count: contadores.conferencia, icon: "▣" },
            { label: "Embarque", href: "/coletor/embarque", count: contadores.embarque, icon: "▤" },
            { label: "Recebimento", href: "/coletor/recebimento", count: contadores.recebimento, icon: "✓" },
            { label: "Retornos ao CD", href: "/coletor/retornos", count: contadores.retornos, icon: "↩" },
            { label: "Ordens de Serviço", href: "/coletor/ordens-servico", count: contadores.ordensServico, icon: "⚙" },
          ] as const).map((item) => (
            <button key={item.href} type="button" className={styles.card} onClick={() => router.push(item.href)}>
              <span className={styles.icon} aria-hidden="true"><IconeExpedicao rota={item.href} /></span>
              <span className={styles.name}>{item.label}</span>
              <span className={styles.counter} aria-label={`${item.count} registros`}>{item.count}</span>
            </button>
          ))}
        </nav>
        <div className={styles.androidNav} aria-hidden="true"><span className={styles.androidBack}/><span className={styles.androidHome}/><span className={styles.androidRecent}/></div>
      </section>
    </main>
  );
}

function IconeExpedicao({ rota }: { rota: string }) {
  let desenho;
  switch (rota) {
    case "/coletor/separacao": desenho = <><path d="M4 7h10m-4-4 4 4-4 4"/><rect x="4" y="14" width="16" height="7" rx="2"/><path d="M8 17h8"/></>; break;
    case "/coletor/conferencia": desenho = <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h4m-4 4 2 2 5-5"/></>; break;
    case "/coletor/embarque": desenho = <><path d="M3 7h11v11H3zM14 11h4l3 4v3h-7"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 10h5"/></>; break;
    case "/coletor/recebimento": desenho = <><path d="M4 7 12 3l8 4v10l-8 4-8-4zM4 7l8 5 8-5M12 12v9"/><path d="m9 14 2 2 4-4"/></>; break;
    case "/coletor/retornos": desenho = <><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/></>; break;
    case "/coletor/ordens-servico": desenho = <><path d="M9 3h6l1 2 2 1 2-.5 2 5-2 1v3l2 1-2 5-2-.5-2 1-1 2H9l-1-2-2-1-2 .5-2-5 2-1v-3l-2-1 2-5 2 .5 2-1z"/><circle cx="12" cy="12" r="3"/></>; break;
    default: desenho = <circle cx="12" cy="12" r="8"/>;
  }
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{desenho}</svg>;
}

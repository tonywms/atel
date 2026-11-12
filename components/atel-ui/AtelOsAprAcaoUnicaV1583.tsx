"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { atelSupabase } from "@/lib/atelSupabaseV08";

type FaseAPR = "VERIFICANDO" | "PENDENTE" | "RASCUNHO" | "APTA" | "NAO_APTA" | "INDISPONIVEL";
type ConsultaAPR = {
  modelo?: { versao?: number } | null;
  apr?: {
    situacao?: string;
    resultado?: string;
    ciencia?: boolean;
    modelo_versao?: number;
  } | null;
  error?: string;
};

type Props = {
  atendimento: number;
  destino: string | null;
  rotulo: string;
  disabled: boolean;
  style: CSSProperties;
  onAvancar: () => void;
  onAbrirApr: () => void;
};

/**
 * ATEL E1 V158.3: uma unica acao operacional no rodape.
 * O estado lido do servidor informa a rotulagem e a navegacao.
 * A API /api/os-andamento continua sendo a autoridade da transicao:
 * NUNCA utilizar somente o estado desta interface para liberar a OS.
 */
export default function AtelOsAprAcaoUnicaV1583({
  atendimento, destino, rotulo, disabled, style, onAvancar, onAbrirApr,
}: Props) {
  const [fase, setFase] = useState<FaseAPR>("VERIFICANDO");

  useEffect(() => {
    if (destino !== "ATENDIMENTO") return;
    let ativo = true;
    setFase("VERIFICANDO");
    async function consultar() {
      try {
        const sb = atelSupabase();
        if (!sb) throw new Error("Supabase nao configurado");
        const { data: { session }, error: sessionError } = await sb.auth.getSession();
        if (sessionError || !session?.access_token) throw new Error("Sessao indisponivel");
        const res = await fetch(`/api/os-apr-v1582?atendimento=${encodeURIComponent(String(atendimento))}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Falha ao consultar APR");
        const resposta = (await res.json()) as ConsultaAPR;
        if (resposta.error) throw new Error(resposta.error);
        const apr = resposta.apr;
        const versaoAtual = Number(resposta.modelo?.versao);
        const versaoCompatível = Number.isSafeInteger(versaoAtual) && versaoAtual > 0 && Number(apr?.modelo_versao) === versaoAtual;
        let novaFase: FaseAPR = "PENDENTE";
        if (apr?.situacao === "REGISTRADO" && apr.resultado === "APTO" && apr.ciencia === true && versaoCompatível) {
          novaFase = "APTA";
        } else if (apr?.situacao === "REGISTRADO" && apr.resultado === "NAO_APTO") {
          novaFase = "NAO_APTA";
        } else if (apr?.situacao === "RASCUNHO" || apr?.situacao === "REGISTRADO") {
          novaFase = "RASCUNHO";
        }
        if (ativo) setFase(novaFase);
      } catch {
        if (ativo) setFase("INDISPONIVEL");
      }
    }
    void consultar();
    return () => { ativo = false; };
  }, [atendimento, destino]);

  const aprNecessaria = destino === "ATENDIMENTO";
  const texto = !aprNecessaria ? rotulo
    : fase === "APTA" ? "INICIAR ATENDIMENTO"
    : fase === "RASCUNHO" ? "CONTINUAR APR OBRIGATÓRIA"
    : fase === "NAO_APTA" ? "CONSULTAR APR NÃO APTA"
    : fase === "INDISPONIVEL" ? "CONSULTAR APR OBRIGATÓRIA"
    : fase === "VERIFICANDO" ? "VERIFICANDO APR..."
    : "PREENCHER APR OBRIGATÓRIA";

  return (
    <button
      type="button"
      data-atel-apr-acao-unica="v158.3"
      style={style}
      disabled={disabled || (aprNecessaria && fase === "VERIFICANDO")}
      aria-label={texto}
      onClick={() => {
        if (!aprNecessaria || fase === "APTA") onAvancar();
        else onAbrirApr();
      }}
    >
      {texto}
    </button>
  );
}

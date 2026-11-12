"use client";
import { useEffect, useState } from "react";
import { atelSupabase } from "@/lib/atelSupabaseV08";

type Escopo = "tecnico" | "gestao";
export type EstadoAprV1589 = "APTO" | "NAO_APTO";
export type MapaAprV1589 = Record<string, EstadoAprV1589>;

/** ATEL_E1_V158_9: 1 consulta por pagina; nao faz 1 chamada por OS. */
export function useAtelAprResumoV1589(escopo: Escopo) {
  const [estados, setEstados] = useState<MapaAprV1589>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    let contador = 0;
    const atualizar = async () => {
      const geracao = ++contador;
      try {
        const supabase = atelSupabase();
        if (!supabase) throw new Error("Sessão Supabase indisponível.");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
        const resposta = await fetch(`/api/os-apr-v1589/resumo?escopo=${escopo}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const json = await resposta.json() as { estados?: MapaAprV1589; error?: string };
        if (!resposta.ok) throw new Error(json.error ?? "Falha na consulta da APR.");
        if (ativo && geracao === contador) { setEstados(json.estados ?? {}); setErro(""); }
      } catch (e) {
        if (ativo && geracao === contador) {
          // Nao pressupor que uma APR é apta caso a consulta falhe.
          setEstados({});
          setErro(e instanceof Error ? e.message : "Situação da APR indisponível.");
        }
      } finally {
        if (ativo && geracao === contador) setCarregando(false);
      }
    };
    void atualizar();
    const aoFocar = () => { void atualizar(); };
    window.addEventListener("focus", aoFocar);
    return () => { ativo = false; window.removeEventListener("focus", aoFocar); };
  }, [escopo]);

  return { estados, carregando, erro };
}

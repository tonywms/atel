"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { requisicoesTecnicasMock } from "@/lib/requisicoesTecnicas";

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

    requisicoesTecnicasMock.forEach((req) => {
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
    <div className="collector-screen">
      <div className="collector-phone">

        {/* =====================================================
            BARRA SUPERIOR
        ===================================================== */}

        <div
          style={{
            height: 40,
            background: "#000",
          }}
        />

        {/* =====================================================
            CABEÇALHO
        ===================================================== */}

        <div
          className="collector-header"
          style={{
            position: "relative",
            justifyContent: "center",
          }}
        >
          {/* SETA À ESQUERDA */}
          <button
            type="button"
            className="collector-back-button"
            onClick={() =>
              router.push("/coletor")
            }
            aria-label="Voltar"
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              margin: 0,
              zIndex: 2,
            }}
          >
            ‹
          </button>

          {/* TÍTULO CENTRALIZADO */}
          <div
            className="collector-header-title"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <strong>Expedição</strong>
          </div>
        </div>

        {/* =====================================================
            MENU
        ===================================================== */}

        <div style={menuContainerStyle}>

          {/* SEPARAÇÃO */}

          <button
            type="button"
            onClick={() =>
              router.push(
                "/coletor/separacao"
              )
            }
            style={menuStyle}
          >
            <span style={iconeStyle}>
              ↗
            </span>

            <span style={textoStyle}>
              Separação
            </span>

            <span style={contadorStyle}>
              {contadores.separacao}
            </span>

            <span style={menuIconStyle}>
              ☷
            </span>
          </button>

          {/* CONFERÊNCIA */}

          <button
            type="button"
            onClick={() =>
              router.push(
                "/coletor/conferencia"
              )
            }
            style={menuStyle}
          >
            <span style={iconeStyle}>
              ▣
            </span>

            <span style={textoStyle}>
              Conferência
            </span>

            <span style={contadorStyle}>
              {contadores.conferencia}
            </span>

            <span style={menuIconStyle}>
              ☷
            </span>
          </button>

          {/* EMBARQUE */}

          <button
            type="button"
            onClick={() =>
              router.push(
                "/coletor/embarque"
              )
            }
            style={menuStyle}
          >
            <span style={iconeStyle}>
              ▤
            </span>

            <span style={textoStyle}>
              Embarque
            </span>

            <span style={contadorStyle}>
              {contadores.embarque}
            </span>

            <span style={menuIconStyle}>
              ☷
            </span>
          </button>

          {/* RECEBIMENTO */}

          <button
            type="button"
            onClick={() =>
              router.push(
                "/coletor/recebimento"
              )
            }
            style={menuStyle}
          >
            <span style={iconeStyle}>
              ✓
            </span>

            <span style={textoStyle}>
              Recebimento
            </span>

            <span style={contadorStyle}>
              {contadores.recebimento}
            </span>

            <span style={menuIconStyle}>
              ☷
            </span>
          </button>

          {/* RETORNOS */}

          <button
            type="button"
            onClick={() =>
              router.push(
                "/coletor/retornos"
              )
            }
            style={menuStyle}
          >
            <span style={iconeStyle}>
              ↩
            </span>

            <span style={textoStyle}>
              Retornos ao CD
            </span>

            <span style={contadorStyle}>
              {contadores.retornos}
            </span>

            <span style={menuIconStyle}>
              ☷
            </span>
          </button>

          {/* ORDENS DE SERVIÇO */}

          <button
            type="button"
            onClick={() =>
              router.push(
                "/coletor/ordens-servico"
              )
            }
            style={menuStyle}
          >
            <span style={iconeStyle}>
              ⛭
            </span>

            <span style={textoStyle}>
              Ordens de Serviço
            </span>

            <span style={contadorStyle}>
              {
                contadores.ordensServico
              }
            </span>

            <span style={menuIconStyle}>
              ☷
            </span>
          </button>
        </div>

        {/* =====================================================
            BARRA INFERIOR
        ===================================================== */}

        <div
          style={{
            height: 36,
            background: "#000",
          }}
        />
      </div>
    </div>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const menuContainerStyle: React.CSSProperties = {
  flex: 1,

  display: "flex",
  flexDirection: "column",

  justifyContent: "center",

  gap: 12,

  padding: "18px 14px",

  background: "#f4f4f4",

  overflowY: "auto",
};

const menuStyle: React.CSSProperties = {
  position: "relative",

  minHeight: 68,

  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#1687b0",

  borderRadius: 7,

  background: "#fff",

  display: "grid",

  gridTemplateColumns:
    "48px 1fr auto",

  gridTemplateRows: "1fr",

  alignItems: "center",

  gap: 8,

  padding: "9px 12px",

  boxShadow:
    "0 2px 4px rgba(0,0,0,.15)",

  cursor: "pointer",

  textAlign: "left",
};

const iconeStyle: React.CSSProperties = {
  width: 34,
  height: 34,

  borderRadius: "50%",

  background: "#d9f3fb",

  color: "#1287ae",

  display: "grid",

  placeItems: "center",

  fontSize: 20,

  fontWeight: 700,
};

const textoStyle: React.CSSProperties = {
  fontSize: 16,

  color: "#333",
};

const contadorStyle: React.CSSProperties = {
  alignSelf: "start",

  background: "#1287ae",

  color: "#fff",

  borderRadius: 5,

  minWidth: 32,

  height: 26,

  padding: "0 7px",

  display: "grid",

  placeItems: "center",

  fontSize: 12,

  fontWeight: 700,
};

const menuIconStyle: React.CSSProperties = {
  position: "absolute",

  right: 18,

  bottom: 8,

  color: "#1287ae",

  fontSize: 12,
};
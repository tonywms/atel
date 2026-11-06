"use client";

import "./atel-v47.css";
import "./atel-v47-2.css";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  carregarRetornos,
  ouvirRetornos,
} from "@/lib/retornosStore";

export default function Page() {
  const router = useRouter();

  const [busca, setBusca] = useState("");
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);

  /* =========================================================
     ATUALIZAÇÃO
  ========================================================= */

  useEffect(() => {
    setReady(true);

    return ouvirRetornos(() => {
      setTick((valor) => valor + 1);
    });
  }, []);

  /* =========================================================
     LISTAGEM
  ========================================================= */

  const lista = useMemo(() => {
    if (!ready) {
      return [];
    }

    const termo = busca
      .trim()
      .toLowerCase();

    return carregarRetornos()
      .filter((retorno) =>
        [
          "EM_TRANSITO_CD",
          "AGUARDANDO_CONFERENCIA",
          "EM_CONFERENCIA",
        ].includes(retorno.status)
      )
      .filter((retorno) => {
        if (!termo) {
          return true;
        }

        const texto = [
          retorno.codigo,
          retorno.tecnico,
          retorno.codigoTecnico,
          retorno.documentoOrigem,
          retorno.destinoFisico,
          retorno.base,
        ]
          .join(" ")
          .toLowerCase();

        return texto.includes(termo);
      });
  }, [ready, tick, busca]);

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="collector-screen atel-v47-screen atel-v47-retornos">
      <div
        className="collector-phone"
        style={phone}
      >
        {/* BARRA PRETA SUPERIOR */}

        

        {/* ===================================================
            HEADER
        =================================================== */}

        <div style={header}>
          <button
            type="button"
            onClick={() =>
              router.push("/coletor/expedicoes")
            }
            style={backButton}
            aria-label="Voltar"
          ><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></button>

          <div style={headerTitle}>
            Retornos ao CD
          </div>
        </div>

        {/* ===================================================
            PESQUISA
        =================================================== */}

        <div style={searchArea}>
          <div style={searchContainer}>
            <span style={searchIcon}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span>

            <input
              value={busca}
              onChange={(event) =>
                setBusca(event.target.value)
              }
              placeholder="Retorno / técnico / documento"
              style={searchInput}
            />

            {busca.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setBusca("")
                }
                style={clearSearchButton}
                aria-label="Limpar pesquisa"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* ===================================================
            CORPO
        =================================================== */}

        <div
          className="collector-operation-body"
          style={body}
        >
          {/* =================================================
              CABEÇALHO DA LISTAGEM
          ================================================= */}

          {lista.length > 0 && (
            <div style={listHeader}>
              <span>
                RETORNOS PARA RECEBIMENTO
              </span>

              <span style={counterBadge}>
                {lista.length}
              </span>
            </div>
          )}

          {/* =================================================
              RETORNOS
          ================================================= */}

          {lista.map((retorno) => {
            const quantidade =
              retorno.itens.reduce(
                (total, item) =>
                  total +
                  Number(
                    item.quantidade ?? 0
                  ),
                0
              );

            const conferidos =
              Object.keys(
                retorno.recebimentoCD
                  ?.itensConferidos ?? {}
              ).length;

            return (
              <button
                type="button"
                key={retorno.id}
                onClick={() =>
                  router.push(
                    `/coletor/retornos/${retorno.id}`
                  )
                }
                style={card}
              >
                {/* CABEÇALHO */}

                <div style={cardHeader}>
                  <div style={cardTitleArea}>
                    <div style={returnCode}>
                      {retorno.codigo}
                    </div>

                    <div style={documentOrigin}>
                      {retorno.documentoOrigem}
                    </div>
                  </div>

                  <span
                    style={
                      retorno.status ===
                      "EM_TRANSITO_CD"
                        ? transitBadge
                        : conferenceBadge
                    }
                  >
                    {formatarStatus(
                      retorno.status
                    )}
                  </span>
                </div>

                <div style={divider} />

                {/* TÉCNICO */}

                <div style={technicianName}>
                  {retorno.tecnico}
                </div>

                <div style={technicianCode}>
                  {retorno.codigoTecnico}
                  {retorno.base
                    ? ` • ${retorno.base}`
                    : ""}
                </div>

                {/* ORIGEM / DESTINO */}

                <div style={infoGrid}>
                  <Info
                    label="ORIGEM"
                    value={
                      retorno.documentoOrigem
                    }
                  />

                  <Info
                    label="DESTINO"
                    value={
                      retorno.destinoFisico
                    }
                  />
                </div>

                {/* RODAPÉ DO CARD */}

                <div style={summaryRow}>
                  <div style={summaryItem}>
                    <span style={summaryLabel}>
                      SKUs
                    </span>

                    <strong style={summaryValue}>
                      {retorno.itens.length}
                    </strong>
                  </div>

                  <div style={summaryItem}>
                    <span style={summaryLabel}>
                      QTD.
                    </span>

                    <strong style={summaryValue}>
                      {quantidade}
                    </strong>
                  </div>

                  <div style={summaryItem}>
                    <span style={summaryLabel}>
                      CONFERIDOS
                    </span>

                    <strong style={summaryValue}>
                      {conferidos}/
                      {retorno.itens.length}
                    </strong>
                  </div>

                  <span style={arrow}>
                    ›
                  </span>
                </div>
              </button>
            );
          })}

          {/* =================================================
              LISTA VAZIA
          ================================================= */}

          {ready &&
            lista.length === 0 && (
              <div style={emptyState}>
                <div style={emptyIcon}>
                  ↩
                </div>

                <strong style={emptyTitle}>
                  Nenhum retorno pendente
                </strong>

                <span
                  style={emptyDescription}
                >
                  Nenhum retorno está em
                  trânsito ou aguardando
                  recebimento no CD.
                </span>
              </div>
            )}
        </div>

        {/* BARRA PRETA INFERIOR */}

        <div style={bottomBar} />
      </div>
    </div>
  );
}

/* =========================================================
   COMPONENTE INFO
========================================================= */

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={infoItem}>
      <span style={infoLabel}>
        {label}
      </span>

      <strong style={infoValue}>
        {value}
      </strong>
    </div>
  );
}

/* =========================================================
   FORMATAR STATUS
========================================================= */

function formatarStatus(
  status: string
) {
  switch (status) {
    case "EM_TRANSITO_CD":
      return "EM TRÂNSITO";

    case "AGUARDANDO_CONFERENCIA":
      return "AGUARDANDO";

    case "EM_CONFERENCIA":
      return "EM CONFERÊNCIA";

    default:
      return status.replaceAll(
        "_",
        " "
      );
  }
}

/* =========================================================
   ESTRUTURA DO COLETOR
========================================================= */

const phone: React.CSSProperties = {
  background: "#f4f4f4",

  overflow: "hidden",

  position: "relative",
};

/* =========================================================
   BARRA SUPERIOR
========================================================= */

const topBar: React.CSSProperties = {
  height: 40,

  minHeight: 40,

  background: "#000000",
};

/* =========================================================
   HEADER

   IMPORTANTE:
   O título usa position absolute + 50%.

   Assim ele fica centralizado pela largura REAL da tela
   e não é deslocado pelo botão de voltar.
========================================================= */

const header: React.CSSProperties = {
  height: 76,

  minHeight: 76,

  width: "100%",

  position: "relative",

  display: "block",

  background: "#2193b5",

  padding: 0,

  margin: 0,

  boxSizing: "border-box",

  color: "#ffffff",
};

/* =========================================================
   VOLTAR
========================================================= */

const backButton: React.CSSProperties = {
  position: "absolute",

  left: 8,

  top: "50%",

  transform:
    "translateY(-50%)",

  width: 42,

  height: 50,

  padding: 0,

  margin: 0,

  border: 0,

  outline: 0,

  background: "transparent",

  color: "#ffffff",

  fontSize: 34,

  fontWeight: 400,

  lineHeight: 1,

  cursor: "pointer",

  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  zIndex: 2,
};

/* =========================================================
   TÍTULO

   CENTRO EXATO:
   left 50%
   translateX -50%
========================================================= */

const headerTitle: React.CSSProperties = {
  position: "absolute",

  left: "50%",

  top: "50%",

  transform:
    "translate(-50%, -50%)",

  margin: 0,

  padding: 0,

  width: "max-content",

  maxWidth: "calc(100% - 110px)",

  color: "#ffffff",

  fontSize: 20,

  fontWeight: 800,

  lineHeight: 1,

  textAlign: "center",

  whiteSpace: "nowrap",

  zIndex: 1,
};

/* =========================================================
   PESQUISA
========================================================= */

const searchArea: React.CSSProperties = {
  padding: "12px 12px 8px",

  background: "#f4f4f4",

  boxSizing: "border-box",
};

const searchContainer: React.CSSProperties =
  {
    position: "relative",

    display: "flex",

    alignItems: "center",

    width: "100%",
  };

const searchIcon: React.CSSProperties = {
  position: "absolute",

  left: 15,

  top: "50%",

  transform:
    "translateY(-50%)",

  color: "#98a2b3",

  fontSize: 16,

  pointerEvents: "none",

  zIndex: 1,
};

const searchInput: React.CSSProperties = {
  width: "100%",

  height: 52,

  border:
    "1px solid #b7c3c9",

  borderRadius: 14,

  padding:
    "0 42px 0 40px",

  margin: 0,

  boxSizing: "border-box",

  background: "#ffffff",

  color: "#344054",

  fontSize: 13,

  outline: 0,
};

const clearSearchButton: React.CSSProperties =
  {
    position: "absolute",

    right: 11,

    top: "50%",

    transform:
      "translateY(-50%)",

    width: 28,

    height: 28,

    border: 0,

    borderRadius: "50%",

    background: "#eef2f4",

    color: "#667085",

    fontSize: 18,

    lineHeight: 1,

    display: "grid",

    placeItems: "center",

    cursor: "pointer",
  };

/* =========================================================
   BODY
========================================================= */

const body: React.CSSProperties = {
  flex: 1,

  minHeight: 0,

  overflowY: "auto",

  padding:
    "4px 12px 90px",

  boxSizing: "border-box",
};

/* =========================================================
   CABEÇALHO DA LISTA
========================================================= */

const listHeader: React.CSSProperties = {
  display: "flex",

  alignItems: "center",

  justifyContent:
    "space-between",

  padding: "5px 2px 8px",

  color: "#667085",

  fontSize: 8,

  fontWeight: 900,
};

const counterBadge: React.CSSProperties = {
  minWidth: 22,

  height: 22,

  padding: "0 6px",

  borderRadius: 11,

  display: "grid",

  placeItems: "center",

  boxSizing: "border-box",

  background: "#dff4fb",

  color: "#087da7",

  fontSize: 10,

  fontWeight: 900,
};

/* =========================================================
   CARD
========================================================= */

const card: React.CSSProperties = {
  width: "100%",

  background: "#ffffff",

  borderTop: "1px solid #d9e5eb",
  borderRight: "1px solid #d9e5eb",
  borderBottom: "1px solid #d9e5eb",
  borderLeft: "7px solid #159fc5",

  borderRadius: 16,

  marginBottom: 10,

  padding: 12,

  textAlign: "left",

  cursor: "pointer",

  boxSizing: "border-box",

  overflow: "hidden",

  boxShadow:
    "0 3px 9px rgba(15, 23, 42, 0.055)",
};

const cardHeader: React.CSSProperties = {
  width: "100%",

  display: "flex",

  justifyContent:
    "space-between",

  alignItems: "flex-start",

  gap: 8,
};

const cardTitleArea: React.CSSProperties = {
  minWidth: 0,

  flex: 1,
};

const returnCode: React.CSSProperties = {
  color: "#087da7",

  fontSize: 16,

  fontWeight: 900,
};

const documentOrigin: React.CSSProperties = {
  marginTop: 2,

  color: "#98a2b3",

  fontSize: 8,

  fontWeight: 700,
};

const transitBadge: React.CSSProperties = {
  flexShrink: 0,

  background: "#dff4fb",

  color: "#087da7",

  borderRadius: 15,

  padding: "6px 8px",

  fontSize: 7,

  fontWeight: 900,

  whiteSpace: "nowrap",
};

const conferenceBadge: React.CSSProperties =
  {
    ...transitBadge,

    background: "#fff0c7",

    color: "#946200",
  };

const divider: React.CSSProperties = {
  height: 1,

  background: "#edf0f2",

  margin: "9px 0",
};

/* =========================================================
   TÉCNICO
========================================================= */

const technicianName: React.CSSProperties =
  {
    color: "#344054",

    fontSize: 13,

    fontWeight: 900,
  };

const technicianCode: React.CSSProperties =
  {
    marginTop: 2,

    color: "#667085",

    fontSize: 9,

    fontWeight: 700,
  };

/* =========================================================
   ORIGEM / DESTINO
========================================================= */

const infoGrid: React.CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "1fr 1fr",

  gap: 10,

  marginTop: 12,

  padding: 9,

  borderRadius: 6,

  background: "#f5f8f9",
};

const infoItem: React.CSSProperties = {
  minWidth: 0,
};

const infoLabel: React.CSSProperties = {
  display: "block",

  color: "#98a2b3",

  fontSize: 7,

  fontWeight: 900,
};

const infoValue: React.CSSProperties = {
  display: "block",

  marginTop: 3,

  color: "#344054",

  fontSize: 9,

  lineHeight: 1.3,

  overflowWrap: "anywhere",
};

/* =========================================================
   RESUMO DO CARD
========================================================= */

const summaryRow: React.CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "1fr 1fr 1fr 24px",

  alignItems: "center",

  gap: 6,

  marginTop: 10,
};

const summaryItem: React.CSSProperties = {
  minWidth: 0,
};

const summaryLabel: React.CSSProperties = {
  display: "block",

  color: "#98a2b3",

  fontSize: 6,

  fontWeight: 900,
};

const summaryValue: React.CSSProperties = {
  display: "block",

  marginTop: 2,

  color: "#344054",

  fontSize: 10,

  fontWeight: 900,
};

const arrow: React.CSSProperties = {
  color: "#1596bc",

  fontSize: 24,

  fontWeight: 900,

  textAlign: "right",
};

/* =========================================================
   ESTADO VAZIO
========================================================= */

const emptyState: React.CSSProperties = {
  minHeight: 190,

  display: "flex",

  flexDirection: "column",

  alignItems: "center",

  justifyContent: "center",

  padding: "25px 35px",

  boxSizing: "border-box",

  textAlign: "center",
};

const emptyIcon: React.CSSProperties = {
  width: 44,

  height: 44,

  borderRadius: "50%",

  display: "grid",

  placeItems: "center",

  marginBottom: 10,

  background: "#e5f4f9",

  color: "#1596bc",

  fontSize: 23,

  fontWeight: 900,
};

const emptyTitle: React.CSSProperties = {
  color: "#344054",

  fontSize: 13,

  fontWeight: 900,
};

const emptyDescription: React.CSSProperties =
  {
    maxWidth: 260,

    marginTop: 5,

    color: "#667085",

    fontSize: 10,

    lineHeight: 1.45,
  };

/* =========================================================
   BARRA INFERIOR
========================================================= */

const bottomBar: React.CSSProperties = {
  height: 36,

  minHeight: 36,

  background: "#000000",
};
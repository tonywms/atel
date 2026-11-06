"use client";

import styles from "./conferencia.module.css";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import {
  requisicoesTecnicasMock,
  RequisicaoTecnica,
} from "@/lib/requisicoesTecnicas";
import {
  carregarEstados,
  ouvirAlteracoes,
} from "@/lib/requisicoesStore";

function prioridadeClass(prioridade: string) {
  if (prioridade === "URGENTE") return "collector-priority urgent";
  if (prioridade === "ALTA") return "collector-priority high";
  return "collector-priority normal";
}

function statusNome(status: string) {
  if (status === "SEPARADA") return "Separado";
  if (status === "EM_CONFERENCIA") return "Executando";
  return status.replaceAll("_", " ");
}

/* =========================================================
   CARD PREMIUM
   A borda azul faz parte do próprio card.
========================================================= */

const premiumCardStyle: CSSProperties = {
  width: "calc(100% - 20px)",
  position: "relative",
  display: "block",

  margin: "0 10px 10px",
  padding: 0,

  textAlign: "left",

  background: "#ffffff",

  borderTop: "1px solid #d9e5eb",
  borderRight: "1px solid #d9e5eb",
  borderBottom: "1px solid #d9e5eb",
  borderLeft: "7px solid #159fc5",

  borderRadius: 16,

  overflow: "hidden",

  boxShadow: "0 3px 9px rgba(15, 23, 42, 0.055)",

  cursor: "pointer",

  fontFamily: "inherit",
};

const premiumCardContentStyle: CSSProperties = {
  padding: "13px 13px 11px",
};

const premiumHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
};

const premiumOrderAreaStyle: CSSProperties = {
  minWidth: 0,
  flex: "1 1 auto",
};

const premiumMiniLabelStyle: CSSProperties = {
  marginBottom: 3,

  color: "#718096",

  fontSize: 9,
  fontWeight: 800,

  lineHeight: 1.1,

  letterSpacing: ".65px",
  textTransform: "uppercase",
};

const premiumCodeStyle: CSSProperties = {
  display: "block",

  color: "#172033",

  fontSize: 16,
  fontWeight: 900,

  lineHeight: 1.1,

  letterSpacing: "-.15px",
};

const premiumPriorityBaseStyle: CSSProperties = {
  flex: "0 0 auto",

  minWidth: 64,

  padding: "6px 10px",

  borderRadius: 999,

  textAlign: "center",

  fontSize: 9,
  fontWeight: 900,

  lineHeight: 1,

  letterSpacing: ".2px",
};

function premiumPriorityStyle(
  prioridade: string
): CSSProperties {
  if (prioridade === "URGENTE") {
    return {
      ...premiumPriorityBaseStyle,

      color: "#b42318",
      background: "#fff0ee",

      border: "1px solid #ffc7c2",
    };
  }

  if (prioridade === "ALTA") {
    return {
      ...premiumPriorityBaseStyle,

      color: "#a65b00",
      background: "#fff2d7",

      border: "1px solid #ffd58b",
    };
  }

  return {
    ...premiumPriorityBaseStyle,

    color: "#087da7",
    background: "#eaf8fc",

    border: "1px solid #c6edf7",
  };
}

const premiumTechnicianStyle: CSSProperties = {
  marginTop: 10,

  overflow: "hidden",

  color: "#172033",

  fontSize: 16,
  fontWeight: 850,

  lineHeight: 1.18,

  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const premiumCodeTypeStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",

  gap: 5,

  marginTop: 4,

  color: "#087da7",

  fontSize: 11,
  fontWeight: 850,

  lineHeight: 1.2,
};

const premiumSeparatorStyle: CSSProperties = {
  color: "#a3b3bd",
};

const premiumDividerStyle: CSSProperties = {
  height: 1,

  margin: "10px 0",

  background: "#e8eef2",
};

const premiumInfoGridStyle: CSSProperties = {
  display: "grid",

  gridTemplateColumns: "1fr 1fr",

  gap: "8px 12px",
};

const premiumInfoItemStyle: CSSProperties = {
  minWidth: 0,
};

const premiumInfoLabelStyle: CSSProperties = {
  display: "block",

  marginBottom: 2,

  color: "#81909f",

  fontSize: 8,
  fontWeight: 900,

  lineHeight: 1,

  letterSpacing: ".5px",
  textTransform: "uppercase",
};

const premiumInfoValueStyle: CSSProperties = {
  display: "block",

  overflow: "hidden",

  color: "#46566a",

  fontSize: 11,
  fontWeight: 750,

  lineHeight: 1.2,

  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const premiumFooterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",

  gap: 8,

  marginTop: 11,
};

const premiumStatusBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",

  gap: 5,

  padding: "5px 9px",

  borderRadius: 999,

  fontSize: 9,
  fontWeight: 900,

  lineHeight: 1,

  whiteSpace: "nowrap",
};

function premiumStatusStyle(
  status: string
): CSSProperties {
  if (status === "EM_CONFERENCIA") {
    return {
      ...premiumStatusBaseStyle,

      color: "#087da7",
      background: "#e7f6fb",

      border: "1px solid #c6ebf5",
    };
  }

  return {
    ...premiumStatusBaseStyle,

    color: "#087a48",
    background: "#eaf8f1",

    border: "1px solid #c9ead9",
  };
}

const premiumStatusDotStyle: CSSProperties = {
  width: 5,
  height: 5,

  flex: "0 0 auto",

  borderRadius: "50%",

  background: "currentColor",
};

const premiumCountersStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",

  gap: 7,

  color: "#69798a",

  fontSize: 9,
  fontWeight: 750,

  whiteSpace: "nowrap",
};

const premiumCounterStrongStyle: CSSProperties = {
  color: "#172033",

  fontSize: 10,
  fontWeight: 900,
};

const premiumArrowStyle: CSSProperties = {
  marginLeft: 2,

  color: "#159fc5",

  fontSize: 25,
  fontWeight: 400,

  lineHeight: ".8",
};

/* =========================================================
   COMPONENTE
========================================================= */

export default function ConferenciaListaPage() {
  const router = useRouter();

  const [busca, setBusca] = useState("");

  const [requisicoes, setRequisicoes] =
    useState<RequisicaoTecnica[]>([]);

  function carregar() {
    const estados = carregarEstados();

    const lista = requisicoesTecnicasMock
      .map((req) => {
        const estado = estados[req.id];

        if (!estado) return req;

        return {
          ...req,

          status: estado.status,

          itens: req.itens.map((item) => ({
            ...item,

            separado:
              estado.itens[item.id]
                ?.quantidadeSeparada ??
              item.separado,

            conferido:
              estado.conferencia[item.id]
                ?.quantidadeConferida ??
              item.conferido,
          })),
        };
      })
      .filter(
        (req) =>
          req.status === "SEPARADA" ||
          req.status === "EM_CONFERENCIA"
      );

    setRequisicoes(lista);
  }

  useEffect(() => {
    carregar();

    return ouvirAlteracoes(carregar);
  }, []);

  const filtradas = useMemo(() => {
    const termo = busca
      .trim()
      .toLowerCase();

    if (!termo) return requisicoes;

    return requisicoes.filter(
      (req) =>
        req.codigo
          .toLowerCase()
          .includes(termo) ||

        req.tecnico
          .toLowerCase()
          .includes(termo) ||

        req.codigoTecnico
          .toLowerCase()
          .includes(termo) ||

        req.base
          .toLowerCase()
          .includes(termo)
    );
  }, [busca, requisicoes]);

  function totalItens(
    req: RequisicaoTecnica
  ) {
    return req.itens.reduce(
      (total, item) =>
        total + item.solicitado,
      0
    );
  }

  return (
    <div className={`collector-screen ${styles.screen}`}>
      <div className={`collector-phone ${styles.phone}`}>

        {/* =================================================
            CABEÇALHO
        ================================================= */}

        <div className={`collector-header ${styles.header}`}>
          <div className={`collector-header-title ${styles.headerTitle}`}>
            <button
              type="button"
              className={`collector-back-button ${styles.backButton}`}
              onClick={() =>
                router.push(
                  "/coletor/expedicoes"
                )
              }
              aria-label="Voltar"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            </button>

            <strong>
              Conferência
            </strong>
          </div>
        </div>

        {/* =================================================
            PESQUISA
        ================================================= */}

        <div className={`collector-search-area ${styles.searchArea}`}>
          <div className={`collector-search-box ${styles.searchBox}`}>
            <span className={styles.searchIcon}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg></span>

            <input
              value={busca}
              onChange={(e) =>
                setBusca(
                  e.target.value
                )
              }
              placeholder="Parâmetro de busca"
            />
          </div>
        </div>

        {/* =================================================
            LISTA
        ================================================= */}

        <div className={`collector-request-list ${styles.requestList}`}>

          {filtradas.length === 0 && (
            <div className={styles.emptyState} role="status">
              <div className={styles.emptyIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 2.5 2.5L16 9"/></svg>
              </div>
              <strong>Nenhuma ordem aguardando conferência</strong>
              <span>As ordens separadas aparecerão aqui quando estiverem disponíveis.</span>
            </div>
          )}

          {filtradas.map((req) => (
            <button
              type="button"
              key={req.id}
              onClick={() =>
                router.push(
                  `/coletor/conferencia/${req.id}`
                )
              }
              style={premiumCardStyle}
            >
              <div
                style={
                  premiumCardContentStyle
                }
              >

                {/* =========================================
                    PEDIDO + PRIORIDADE
                ========================================= */}

                <div
                  style={
                    premiumHeaderStyle
                  }
                >
                  <div
                    style={
                      premiumOrderAreaStyle
                    }
                  >
                    <div
                      style={
                        premiumMiniLabelStyle
                      }
                    >
                      ORDEM DE CONFERÊNCIA
                    </div>

                    <strong
                      style={
                        premiumCodeStyle
                      }
                    >
                      Pedido:{" "}
                      {req.codigo.replace(
                        "REQ-",
                        ""
                      )}
                    </strong>
                  </div>

                  <span
                    style={premiumPriorityStyle(
                      req.prioridade
                    )}
                  >
                    {req.prioridade}
                  </span>
                </div>

                {/* =========================================
                    TÉCNICO
                ========================================= */}

                <div
                  style={
                    premiumTechnicianStyle
                  }
                >
                  {req.tecnico}
                </div>

                <div
                  style={
                    premiumCodeTypeStyle
                  }
                >
                  <span>
                    {req.codigoTecnico}
                  </span>

                  <span
                    style={
                      premiumSeparatorStyle
                    }
                  >
                    •
                  </span>

                  <span>
                    {req.tipo}
                  </span>
                </div>

                <div
                  style={
                    premiumDividerStyle
                  }
                />

                {/* =========================================
                    INFORMAÇÕES
                ========================================= */}

                <div
                  style={
                    premiumInfoGridStyle
                  }
                >
                  <div
                    style={
                      premiumInfoItemStyle
                    }
                  >
                    <span
                      style={
                        premiumInfoLabelStyle
                      }
                    >
                      BASE
                    </span>

                    <span
                      style={
                        premiumInfoValueStyle
                      }
                    >
                      {req.base}
                    </span>
                  </div>

                  <div
                    style={
                      premiumInfoItemStyle
                    }
                  >
                    <span
                      style={
                        premiumInfoLabelStyle
                      }
                    >
                      ITENS
                    </span>

                    <span
                      style={
                        premiumInfoValueStyle
                      }
                    >
                      {totalItens(req)}
                    </span>
                  </div>
                </div>

                {/* =========================================
                    STATUS
                ========================================= */}

                <div
                  style={
                    premiumFooterStyle
                  }
                >
                  <span
                    style={premiumStatusStyle(
                      req.status
                    )}
                  >
                    <span
                      style={
                        premiumStatusDotStyle
                      }
                    />

                    {statusNome(
                      req.status
                    )}
                  </span>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    <div
                      style={
                        premiumCountersStyle
                      }
                    >
                      <span>
                        SKUs{" "}
                        <strong
                          style={
                            premiumCounterStrongStyle
                          }
                        >
                          {
                            req.itens
                              .length
                          }
                        </strong>
                      </span>
                    </div>

                    <span
                      style={
                        premiumArrowStyle
                      }
                    >
                      ›
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* =================================================
            RODAPÉ
        ================================================= */}

        <div className={`collector-bottom-info ${styles.footer}`}>
          {filtradas.length}{" "}
          {filtradas.length === 1
            ? "ordem disponível"
            : "ordens disponíveis"}
        </div>
      </div>
    </div>
  );
}

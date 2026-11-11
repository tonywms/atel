"use client";

import "./atel-v47.css";
import AtelOsEstadoERP from "@/components/atel-ui/AtelOsEstadoERP"; // ATEL_OS_ESTADOS_V142
import { consultarOsErpV52, type OsErpV52 } from "@/lib/erpOperacionalV52";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import { useRouter } from "next/navigation";

import {
  carregarOrdensServico,
  ouvirOrdensServico,
  type OrdemServico,
} from "@/lib/ordensServicoStore";

/* =========================================================
   HELPERS
========================================================= */

function prioridadeOrdem(ordem: OrdemServico) {
  if (ordem.id === 2600002) return "ALTA";

  return "NORMAL";
}

function tipoNome(tipo: string) {
  if (tipo === "INSTALACAO") return "INSTALAÇÃO";
  if (tipo === "MANUTENCAO") return "MANUTENÇÃO";
  if (tipo === "TROCA") return "TROCA";
  if (tipo === "RETIRADA") return "RETIRADA";

  return tipo;
}

function statusNome(status: string) {
  if (status === "PENDENTE") return "PENDENTE";
  if (status === "EM_ATENDIMENTO") return "EM ATENDIMENTO";
  if (status === "FINALIZADA") return "FINALIZADA";
  if (status === "CANCELADA") return "CANCELADA";

  return status.replaceAll("_", " ");
}

/* =========================================================
   ESTILOS DA TELA
========================================================= */

const phoneStyle: CSSProperties = {
  height: "100%",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  flex: "0 0 auto",
};

const searchAreaStyle: CSSProperties = {
  flex: "0 0 auto",
  padding: "12px 12px 10px",
};

const listStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  WebkitOverflowScrolling: "touch",
  overscrollBehavior: "contain",
  padding: "4px 10px 24px",
  scrollbarGutter: "stable",
};

const bottomInfoStyle: CSSProperties = {
  flex: "0 0 auto",
};

/* =========================================================
   PESQUISA
========================================================= */

const searchBoxStyle: CSSProperties = {
  minHeight: 52,
  display: "flex",
  alignItems: "center",
  gap: 10,

  padding: "0 15px",

  background: "#ffffff",

  border: "1px solid #d6e1e7",
  borderRadius: 15,

  boxShadow: "0 2px 7px rgba(15, 23, 42, 0.04)",
};

const searchIconStyle: CSSProperties = {
  flex: "0 0 auto",

  color: "#718096",

  fontSize: 21,
  lineHeight: 1,
};

const searchInputStyle: CSSProperties = {
  width: "100%",

  border: 0,
  outline: 0,

  background: "transparent",

  color: "#172033",

  fontSize: 15,
  fontWeight: 500,
};

/* =========================================================
   CARD PREMIUM

   IMPORTANTE:
   A borda azul esquerda faz parte do PRÓPRIO CARD.
   Não existe faixa absoluta sobreposta.
========================================================= */

const cardStyle: CSSProperties = {
  width: "100%",

  position: "relative",

  display: "block",

  margin: "0 0 10px",
  padding: 0,

  textAlign: "left",

  background: "#ffffff",

  borderTop: "1px solid #d9e5eb",
  borderRight: "1px solid #d9e5eb",
  borderBottom: "1px solid #d9e5eb",

  /*
   * Borda grossa azul integrada ao card.
   * O border-radius faz a própria borda acompanhar
   * as curvas superior e inferior.
   */
  borderLeft: "7px solid #159fc5",

  borderRadius: 16,

  overflow: "hidden",

  boxShadow: "0 3px 9px rgba(15, 23, 42, 0.055)",

  cursor: "pointer",

  fontFamily: "inherit",
};

const cardInnerStyle: CSSProperties = {
  padding: "13px 13px 11px 13px",
};

/* =========================================================
   PRIMEIRA LINHA
========================================================= */

const cardTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
};

const ordemAreaStyle: CSSProperties = {
  minWidth: 0,
  flex: "1 1 auto",
};

const miniLabelStyle: CSSProperties = {
  marginBottom: 3,

  color: "#718096",

  fontSize: 9,
  fontWeight: 800,

  lineHeight: 1.1,

  letterSpacing: ".65px",
  textTransform: "uppercase",
};

const codigoStyle: CSSProperties = {
  display: "block",

  color: "#172033",

  fontSize: 16,
  fontWeight: 900,

  lineHeight: 1.1,

  letterSpacing: "-.15px",
};

/* =========================================================
   PRIORIDADE
========================================================= */

const prioridadeBaseStyle: CSSProperties = {
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

function prioridadeStyle(prioridade: string): CSSProperties {
  if (prioridade === "ALTA") {
    return {
      ...prioridadeBaseStyle,

      color: "#a65b00",
      background: "#fff2d7",

      border: "1px solid #ffd58b",
    };
  }

  if (prioridade === "URGENTE") {
    return {
      ...prioridadeBaseStyle,

      color: "#b42318",
      background: "#fff0ee",

      border: "1px solid #ffc7c2",
    };
  }

  return {
    ...prioridadeBaseStyle,

    color: "#087da7",
    background: "#eaf8fc",

    border: "1px solid #c6edf7",
  };
}

/* =========================================================
   CLIENTE
========================================================= */

const clienteStyle: CSSProperties = {
  marginTop: 10,

  overflow: "hidden",

  color: "#172033",

  fontSize: 16,
  fontWeight: 850,

  lineHeight: 1.18,

  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const codigoClienteTipoStyle: CSSProperties = {
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

const separatorStyle: CSSProperties = {
  color: "#a3b3bd",
};

/* =========================================================
   DIVISOR
========================================================= */

const dividerStyle: CSSProperties = {
  height: 1,

  margin: "10px 0",

  background: "#e8eef2",
};

/* =========================================================
   INFORMAÇÕES
========================================================= */

const infoGridStyle: CSSProperties = {
  display: "grid",

  gridTemplateColumns: "1fr 1fr",

  gap: "8px 12px",
};

const infoItemStyle: CSSProperties = {
  minWidth: 0,
};

const infoLabelStyle: CSSProperties = {
  display: "block",

  marginBottom: 2,

  color: "#81909f",

  fontSize: 8,
  fontWeight: 900,

  lineHeight: 1,

  letterSpacing: ".5px",
  textTransform: "uppercase",
};

const infoValueStyle: CSSProperties = {
  display: "block",

  overflow: "hidden",

  color: "#46566a",

  fontSize: 11,
  fontWeight: 750,

  lineHeight: 1.2,

  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

/* =========================================================
   RODAPÉ DO CARD
========================================================= */

const cardFooterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",

  gap: 8,

  marginTop: 11,
};

const footerLeftStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",

  gap: 7,

  minWidth: 0,
};

const statusBaseStyle: CSSProperties = {
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

function statusStyle(status: string): CSSProperties {
  if (status === "EM_ATENDIMENTO") {
    return {
      ...statusBaseStyle,

      color: "#087da7",
      background: "#e7f6fb",

      border: "1px solid #c6ebf5",
    };
  }

  if (status === "PENDENTE") {
    return {
      ...statusBaseStyle,

      color: "#9a6400",
      background: "#fff5dc",

      border: "1px solid #ffe1a3",
    };
  }

  return {
    ...statusBaseStyle,

    color: "#566474",
    background: "#edf2f5",

    border: "1px solid #dde5e9",
  };
}

const statusDotStyle: CSSProperties = {
  width: 5,
  height: 5,

  flex: "0 0 auto",

  borderRadius: "50%",

  background: "currentColor",
};

const countersStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",

  gap: 7,

  color: "#69798a",

  fontSize: 9,
  fontWeight: 750,

  whiteSpace: "nowrap",
};

const counterStrongStyle: CSSProperties = {
  color: "#172033",

  fontSize: 10,
  fontWeight: 900,
};

const arrowStyle: CSSProperties = {
  marginLeft: 2,

  color: "#159fc5",

  fontSize: 25,
  fontWeight: 400,

  lineHeight: ".8",
};

/* =========================================================
   VAZIO
========================================================= */

const emptyStyle: CSSProperties = {
  margin: "12px 4px",

  padding: "32px 16px",

  textAlign: "center",

  color: "#7b8794",
  background: "#ffffff",

  border: "1px dashed #cfdce3",
  borderRadius: 16,

  fontSize: 13,
  fontWeight: 650,
};

/* =========================================================
   COMPONENTE
========================================================= */

export default function OrdensServicoPage() {
  const router = useRouter();

  const [busca, setBusca] = useState("");
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [erroERP, setErroERP] = useState("");
  const [carregandoERP, setCarregandoERP] = useState(true);
  const [tentativaERP, setTentativaERP] = useState(0);

  /* =======================================================
     CARREGAR
  ======================================================= */

  useEffect(() => {
    let ativo = true;
    setCarregandoERP(true);
    setErroERP("");
    consultarOsErpV52().then((lista) => {
      if (!ativo) return;
      if (!Array.isArray(lista)) throw new Error("Formato de OS invalido");
      const convertidas: OrdemServico[] = lista.map((os: OsErpV52) => {
        const partes = String(os.cliente ?? "").match(/^(\d+)\s*-\s*(.+)$/);
        return {
          id: Number(os.atendimento), codigo: String(os.protocolo || os.atendimento),
          tipo: String(os.servico || "SERVICO_ERP") as OrdemServico["tipo"],
          status: "PENDENTE", codigoTecnico: String(os.tecnico), tecnico: `Tecnico ERP ${os.tecnico}`,
          base: "ERP", codigoCliente: partes?.[1] ?? "", cliente: partes?.[2] ?? String(os.cliente ?? ""),
          endereco: os.endereco ?? "", cidade: "", dataPrevista: String(os.data_inicio ?? "").slice(0, 10),
          observacao: String(os.servico ?? ""), materiaisPrevistos: [], itens: [],
        };
      });
      setOrdens(convertidas.sort((a, b) => {
        const data = String(b.dataPrevista ?? "").localeCompare(String(a.dataPrevista ?? ""));
        return data || b.id - a.id;
      }));
      setErroERP("");
    }).catch((e: unknown) => {
      if (!ativo) return;
      setOrdens([]); // Falha ERP nao deve exibir OS ficticias.
      setErroERP(e instanceof Error ? e.message : "Falha na consulta ERP");
    }).finally(() => { if (ativo) setCarregandoERP(false); });
    return () => { ativo = false; };
  }, [tentativaERP]);

  /* =======================================================
     FILTRO
  ======================================================= */

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    const ativas = ordens.filter(
      (ordem) =>
        ordem.status === "PENDENTE" ||
        ordem.status === "EM_ATENDIMENTO"
    );

    if (!termo) {
      return ativas;
    }

    return ativas.filter((ordem) => {
      const campos = [
        String(ordem.id),
        ordem.codigo,
        ordem.cliente,
        ordem.codigoCliente,
        ordem.tecnico,
        ordem.codigoTecnico,
        ordem.base,
        ordem.tipo,
        ordem.status,
        ordem.cidade,
      ];

      return campos.some((campo) =>
        String(campo ?? "")
          .toLowerCase()
          .includes(termo)
      );
    });
  }, [ordens, busca]);

  /* =======================================================
     TOTAIS
  ======================================================= */

  function totalItens(ordem: OrdemServico) {
    return ordem.itens.reduce(
      (total, item) =>
        total + Number(item.quantidade ?? 0),
      0
    );
  }

  function totalSkus(ordem: OrdemServico) {
    /*
     * Se a OS já possui materiais efetivamente utilizados,
     * mostramos essa quantidade.
     *
     * Se ainda não utilizou nada, mostramos quantos materiais
     * foram previstos para o atendimento.
     */
    if (ordem.itens.length > 0) {
      return ordem.itens.length;
    }

    return ordem.materiaisPrevistos?.length ?? 0;
  }

  function totalPrevistos(ordem: OrdemServico) {
    return ordem.materiaisPrevistos?.length ?? 0;
  }

  /* =======================================================
     ABRIR OS
  ======================================================= */

  function abrirOrdem(ordem: OrdemServico) {
    router.push(`/coletor/ordens-servico/${ordem.id}?origem=erp`);
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="collector-screen atel-v47-screen atel-v47-ordens-servico">
      <div
        className="collector-phone"
        style={phoneStyle}
      >
        {/* =================================================
            CABEÇALHO
        ================================================= */}

        <div
          className="collector-header"
          style={headerStyle}
        >
          <div className="collector-header-title">
            <button
              type="button"
              className="collector-back-button"
              onClick={() =>
                router.push("/coletor/expedicoes")
              }
              aria-label="Voltar"
            ><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></button>

            <strong>
              Ordens de Serviço
            </strong>
          </div>
        </div>

        {/* =================================================
            PESQUISA
        ================================================= */}

        <div
          className="collector-search-area"
          style={searchAreaStyle}
        >
          <div style={searchBoxStyle}>
            <span style={searchIconStyle}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span>

            <input
              value={busca}
              onChange={(event) =>
                setBusca(event.target.value)
              }
              placeholder="Buscar OS, cliente ou técnico"
              style={searchInputStyle}
            />
          </div>
        </div>

        {/* =================================================
            LISTA
        ================================================= */}

        <div
          className="collector-request-list atel-os-v142-list-area"
          style={listStyle}
        >
          {carregandoERP && <AtelOsEstadoERP carregando titulo="Ordens de Serviço" />}
          {!carregandoERP && erroERP && <AtelOsEstadoERP carregando={false} erro={erroERP} titulo="Ordens de Serviço" onRetry={() => setTentativaERP(n => n + 1)} />}
          {!carregandoERP && !erroERP && filtradas.length === 0 && (
            <div style={emptyStyle}>
              Nenhuma ordem de serviço encontrada.
            </div>
          )}

          {filtradas.map((ordem) => {
            const prioridade =
              prioridadeOrdem(ordem);

            const itens =
              totalItens(ordem);

            const skus =
              totalSkus(ordem);

            const previstos =
              totalPrevistos(ordem);

            return (
              <button
                type="button"
                key={ordem.id}
                className="atel-os-v142-order-card"
                onClick={() =>
                  abrirOrdem(ordem)
                }
                style={cardStyle}
              >
                <div style={cardInnerStyle}>
                  {/* =======================================
                      OS + PRIORIDADE
                  ======================================= */}

                  <div style={cardTopStyle}>
                    <div style={ordemAreaStyle}>
                      <div style={miniLabelStyle}>
                        ORDEM DE SERVIÇO
                      </div>

                      <strong style={codigoStyle}>
                        OS nº {ordem.id}
                      </strong>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, overflowWrap: "anywhere" }}>
                        Protocolo: {ordem.codigo}
                      </div>
                    </div>

                    <span
                      style={prioridadeStyle(
                        prioridade
                      )}
                    >
                      {prioridade}
                    </span>
                  </div>

                  {/* =======================================
                      CLIENTE
                  ======================================= */}

                  <div style={clienteStyle}>
                    {ordem.cliente}
                  </div>

                  <div
                    style={codigoClienteTipoStyle}
                  >
                    <span>
                      {ordem.codigoCliente}
                    </span>

                    <span style={separatorStyle}>
                      •
                    </span>

                    <span>
                      {tipoNome(ordem.tipo)}
                    </span>
                  </div>

                  <div style={dividerStyle} />

                  {/* =======================================
                      TÉCNICO / BASE
                  ======================================= */}

                  <div style={infoGridStyle}>
                    <div style={infoItemStyle}>
                      <span style={infoLabelStyle}>
                        TÉCNICO
                      </span>

                      <span style={infoValueStyle}>
                        {ordem.tecnico}
                      </span>
                    </div>

                    <div style={infoItemStyle}>
                      <span style={infoLabelStyle}>
                        CÓDIGO
                      </span>

                      <span style={infoValueStyle}>
                        {ordem.codigoTecnico}
                      </span>
                    </div>

                    <div style={infoItemStyle}>
                      <span style={infoLabelStyle}>
                        BASE
                      </span>

                      <span style={infoValueStyle}>
                        {ordem.base}
                      </span>
                    </div>

                    <div style={infoItemStyle}>
                      <span style={infoLabelStyle}>
                        CIDADE
                      </span>

                      <span style={infoValueStyle}>
                        {ordem.cidade}
                      </span>
                    </div>
                  </div>

                  {/* =======================================
                      STATUS / QUANTIDADES
                  ======================================= */}

                  <div style={cardFooterStyle}>
                    <div style={footerLeftStyle}>
                      <span
                        style={statusStyle(
                          ordem.status
                        )}
                      >
                        <span
                          style={statusDotStyle}
                        />

                        {statusNome(
                          ordem.status
                        )}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                      }}
                    >
                      <div style={countersStyle}>
                        {itens > 0 ? (
                          <>
                            <span>
                              ITENS{" "}
                              <strong
                                style={
                                  counterStrongStyle
                                }
                              >
                                {itens}
                              </strong>
                            </span>

                            <span>
                              •
                            </span>
                          </>
                        ) : null}

                        <span>
                          SKUs{" "}
                          <strong
                            style={
                              counterStrongStyle
                            }
                          >
                            {skus}
                          </strong>
                        </span>

                        {previstos > 0 &&
                          ordem.itens.length === 0 && (
                            <>
                              <span>
                                •
                              </span>

                              <span
                                style={{
                                  color:
                                    "#087da7",
                                }}
                              >
                                PREVISTOS
                              </span>
                            </>
                          )}
                      </div>

                      <span style={arrowStyle}>
                        ›
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          <div
            aria-hidden="true"
            style={{
              height: 12,
              flexShrink: 0,
            }}
          />
        </div>

        {/* =================================================
            RODAPÉ
        ================================================= */}

        <div
          className="collector-bottom-info"
          style={bottomInfoStyle}
        >
          {filtradas.length}{" "}
          {filtradas.length === 1
            ? "ordem disponível"
            : "ordens disponíveis"}
        </div>
      </div>
    </div>
  );
}
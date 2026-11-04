"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  requisicoesTecnicasMock,
  RequisicaoTecnica,
} from "@/lib/requisicoesTecnicas";

import {
  carregarEstados,
  ouvirAlteracoes,
} from "@/lib/requisicoesStore";

type RequisicaoRecebimento = RequisicaoTecnica & {
  volumes: any[];
  volumesLidos: Record<number, string>;
};

function totalItens(req: RequisicaoTecnica) {
  return req.itens.reduce(
    (total, item) => total + item.solicitado,
    0
  );
}

export default function RecebimentoListaPage() {
  const router = useRouter();

  const [busca, setBusca] = useState("");

  const [requisicoes, setRequisicoes] =
    useState<RequisicaoRecebimento[]>([]);

  function carregar() {
    const estados = carregarEstados();

    const lista = requisicoesTecnicasMock
      .map((req) => {
        const estado = estados[req.id];

        return {
          ...req,

          status:
            estado?.status ??
            req.status,

          volumes:
            estado?.volumes ??
            [],

          volumesLidos:
            estado?.recebimentoTecnico?.volumesLidos ??
            {},
        } as RequisicaoRecebimento;
      })
      .filter(
        (req) =>
          req.status === "EM_TRANSITO" ||
          req.status === "ACEITE_PENDENTE"
      );

    setRequisicoes(lista);
  }

  useEffect(() => {
    carregar();

    return ouvirAlteracoes(
      carregar
    );
  }, []);

  const filtradas =
    useMemo(() => {
      const termo =
        busca
          .trim()
          .toLowerCase();

      if (!termo) {
        return requisicoes;
      }

      return requisicoes.filter(
        (req) =>
          [
            req.codigo,
            req.tecnico,
            req.codigoTecnico,
            req.base,
            req.tipo,
          ]
            .join(" ")
            .toLowerCase()
            .includes(termo)
      );
    }, [busca, requisicoes]);

  return (
    <div className="collector-screen">

      <div className="collector-phone">

        {/* HEADER */}

        <div className="collector-header">

          <div className="collector-header-title">

            <button
              type="button"
              className="collector-back-button"
              onClick={() =>
                router.push(
                  "/coletor/expedicoes"
                )
              }
            >
              ‹
            </button>

            <strong>
              Ordens - Recebimento
            </strong>

          </div>

        </div>

        {/* BUSCA */}

        <div className="collector-search-area">

          <div className="collector-search-box">

            <span>⌕</span>

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

        {/* LISTA */}

        <div className="collector-request-list">

          {filtradas.length === 0 && (

            <div
              style={{
                padding:
                  "32px 20px",

                textAlign:
                  "center",

                color:
                  "#64748b",
              }}
            >
              Nenhuma requisição em trânsito
              aguardando recebimento.
            </div>

          )}

          {filtradas.map(
            (req) => {

              const quantidadeLida =
                req.volumes.filter(
                  (volume) =>
                    Boolean(
                      req.volumesLidos[
                        volume.id
                      ]
                    ) ||
                    volume.status ===
                      "RECEBIDO"
                ).length;

              return (

                <button
                  key={req.id}
                  type="button"

                  onClick={() =>
                    router.push(
                      `/coletor/recebimento/${req.id}`
                    )
                  }

                  style={{
                    width: "calc(100% - 20px)",

                    position: "relative",
                    display: "block",

                    margin: "0 10px 10px",
                    padding: 0,

                    textAlign: "left",

                    background: "#ffffff",

                    /*
                     * BORDA PREMIUM
                     * O azul é a própria borda
                     * esquerda do card.
                     */
                    borderTop:
                      "1px solid #d9e5eb",

                    borderRight:
                      "1px solid #d9e5eb",

                    borderBottom:
                      "1px solid #d9e5eb",

                    borderLeft:
                      "7px solid #159fc5",

                    borderRadius: 16,

                    overflow: "hidden",

                    boxShadow:
                      "0 3px 9px rgba(15, 23, 42, 0.055)",

                    cursor: "pointer",

                    fontFamily: "inherit",
                  }}
                >

                  <div
                    style={{
                      padding:
                        "13px 13px 11px",
                    }}
                  >

                    {/* CABEÇALHO */}

                    <div
                      style={{
                        display: "flex",

                        alignItems:
                          "flex-start",

                        justifyContent:
                          "space-between",

                        gap: 10,
                      }}
                    >

                      <div
                        style={{
                          minWidth: 0,
                          flex: "1 1 auto",
                        }}
                      >

                        <div
                          style={{
                            marginBottom: 3,

                            color:
                              "#718096",

                            fontSize: 9,
                            fontWeight: 800,

                            lineHeight: 1.1,

                            letterSpacing:
                              ".65px",

                            textTransform:
                              "uppercase",
                          }}
                        >
                          ORDEM DE RECEBIMENTO
                        </div>

                        <strong
                          style={{
                            display:
                              "block",

                            color:
                              "#172033",

                            fontSize: 16,
                            fontWeight: 900,

                            lineHeight: 1.1,

                            letterSpacing:
                              "-.15px",
                          }}
                        >
                          Pedido:{" "}
                          {req.codigo.replace(
                            "REQ-",
                            ""
                          )}
                        </strong>

                      </div>

                      {/* STATUS SUPERIOR */}

                      <span
                        style={{
                          flex:
                            "0 0 auto",

                          padding:
                            "6px 10px",

                          borderRadius:
                            999,

                          textAlign:
                            "center",

                          fontSize: 9,
                          fontWeight: 900,

                          lineHeight: 1,

                          whiteSpace:
                            "nowrap",

                          color:
                            req.status ===
                            "ACEITE_PENDENTE"
                              ? "#a65b00"
                              : "#087da7",

                          background:
                            req.status ===
                            "ACEITE_PENDENTE"
                              ? "#fff2d7"
                              : "#eaf8fc",

                          border:
                            req.status ===
                            "ACEITE_PENDENTE"
                              ? "1px solid #ffd58b"
                              : "1px solid #c6edf7",
                        }}
                      >

                        {req.status ===
                        "ACEITE_PENDENTE"

                          ? "ACEITE PENDENTE"

                          : "EM TRÂNSITO"}

                      </span>

                    </div>

                    {/* TÉCNICO */}

                    <div
                      style={{
                        marginTop: 10,

                        overflow:
                          "hidden",

                        color:
                          "#172033",

                        fontSize: 16,
                        fontWeight: 850,

                        lineHeight: 1.18,

                        whiteSpace:
                          "nowrap",

                        textOverflow:
                          "ellipsis",
                      }}
                    >
                      {req.tecnico}
                    </div>

                    {/* CÓDIGO / TIPO */}

                    <div
                      style={{
                        display: "flex",

                        alignItems:
                          "center",

                        flexWrap: "wrap",

                        gap: 5,

                        marginTop: 4,

                        color:
                          "#087da7",

                        fontSize: 11,
                        fontWeight: 850,

                        lineHeight: 1.2,
                      }}
                    >

                      <span>
                        {req.codigoTecnico}
                      </span>

                      <span
                        style={{
                          color:
                            "#a3b3bd",
                        }}
                      >
                        •
                      </span>

                      <span>
                        {req.tipo}
                      </span>

                    </div>

                    {/* DIVISOR */}

                    <div
                      style={{
                        height: 1,

                        margin:
                          "10px 0",

                        background:
                          "#e8eef2",
                      }}
                    />

                    {/* INFORMAÇÕES */}

                    <div
                      style={{
                        display: "grid",

                        gridTemplateColumns:
                          "1fr 1fr",

                        gap:
                          "8px 12px",
                      }}
                    >

                      <div
                        style={{
                          minWidth: 0,
                        }}
                      >

                        <span
                          style={{
                            display:
                              "block",

                            marginBottom:
                              2,

                            color:
                              "#81909f",

                            fontSize: 8,
                            fontWeight: 900,

                            lineHeight: 1,

                            letterSpacing:
                              ".5px",

                            textTransform:
                              "uppercase",
                          }}
                        >
                          BASE
                        </span>

                        <span
                          style={{
                            display:
                              "block",

                            overflow:
                              "hidden",

                            color:
                              "#46566a",

                            fontSize: 11,
                            fontWeight: 750,

                            lineHeight: 1.2,

                            whiteSpace:
                              "nowrap",

                            textOverflow:
                              "ellipsis",
                          }}
                        >
                          {req.base}
                        </span>

                      </div>

                      <div>

                        <span
                          style={{
                            display:
                              "block",

                            marginBottom:
                              2,

                            color:
                              "#81909f",

                            fontSize: 8,
                            fontWeight: 900,

                            lineHeight: 1,

                            letterSpacing:
                              ".5px",

                            textTransform:
                              "uppercase",
                          }}
                        >
                          ITENS
                        </span>

                        <span
                          style={{
                            color:
                              "#46566a",

                            fontSize: 11,
                            fontWeight: 750,

                            lineHeight: 1.2,
                          }}
                        >
                          {totalItens(req)}
                        </span>

                      </div>

                    </div>

                    {/* RODAPÉ */}

                    <div
                      style={{
                        display: "flex",

                        alignItems:
                          "center",

                        justifyContent:
                          "space-between",

                        gap: 8,

                        marginTop: 12,
                      }}
                    >

                      {/* STATUS */}

                      <span
                        style={{
                          display:
                            "inline-flex",

                          alignItems:
                            "center",

                          gap: 5,

                          padding:
                            "5px 9px",

                          borderRadius:
                            999,

                          fontSize: 9,
                          fontWeight: 900,

                          lineHeight: 1,

                          whiteSpace:
                            "nowrap",

                          color:
                            req.status ===
                            "ACEITE_PENDENTE"
                              ? "#9a6400"
                              : "#087da7",

                          background:
                            req.status ===
                            "ACEITE_PENDENTE"
                              ? "#fff5dc"
                              : "#e7f6fb",

                          border:
                            req.status ===
                            "ACEITE_PENDENTE"
                              ? "1px solid #ffe1a3"
                              : "1px solid #c6ebf5",
                        }}
                      >

                        <span
                          style={{
                            width: 5,
                            height: 5,

                            flex:
                              "0 0 auto",

                            borderRadius:
                              "50%",

                            background:
                              "currentColor",
                          }}
                        />

                        {req.status ===
                        "ACEITE_PENDENTE"

                          ? "Aceite Pendente"

                          : "Em Trânsito"}

                      </span>

                      {/* CONTADORES */}

                      <div
                        style={{
                          display: "flex",

                          alignItems:
                            "center",

                          gap: 10,

                          color:
                            "#69798a",

                          fontSize: 9,
                          fontWeight: 750,

                          whiteSpace:
                            "nowrap",
                        }}
                      >

                        <span>
                          Volumes{" "}

                          <strong
                            style={{
                              color:
                                "#172033",

                              fontSize:
                                10,

                              fontWeight:
                                900,
                            }}
                          >
                            {req.volumes.length}
                          </strong>
                        </span>

                        <span>
                          Lidos{" "}

                          <strong
                            style={{
                              color:
                                "#172033",

                              fontSize:
                                10,

                              fontWeight:
                                900,
                            }}
                          >
                            {quantidadeLida}/
                            {req.volumes.length}
                          </strong>
                        </span>

                        <span
                          style={{
                            marginLeft: 2,

                            color:
                              "#159fc5",

                            fontSize: 25,
                            fontWeight: 400,

                            lineHeight:
                              ".8",
                          }}
                        >
                          ›
                        </span>

                      </div>

                    </div>

                  </div>

                </button>

              );
            }
          )}

        </div>

        {/* RODAPÉ DA TELA */}

        <div className="collector-bottom-info">

          {filtradas.length}{" "}

          {filtradas.length === 1
            ? "ordem disponível"
            : "ordens disponíveis"}

        </div>

      </div>

    </div>
  );
}
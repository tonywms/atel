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

export default function EmbarquePage() {
  const router = useRouter();

  const [busca, setBusca] = useState("");
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    const atualizar = () =>
      setVersao((valor) => valor + 1);

    atualizar();

    return ouvirAlteracoes(atualizar);
  }, []);

  const requisicoes = useMemo(() => {
    void versao;

    const estados = carregarEstados();

    const termo = busca
      .trim()
      .toUpperCase();

    return requisicoesTecnicasMock
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
        };
      })
      .filter(
        (req) =>
          req.status === "CONFERIDA" ||
          req.status === "EMBARCADA"
      )
      .filter((req) => {
        if (!termo) {
          return true;
        }

        return [
          req.codigo,
          req.tecnico,
          req.codigoTecnico,
          req.base,
          req.tipo,
        ]
          .join(" ")
          .toUpperCase()
          .includes(termo);
      });
  }, [busca, versao]);

  return (
    <div className="collector-screen">
      <div
        className="collector-phone"
        style={{
          background: "#f4f4f4",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 40,
            background: "#000",
            flex: "0 0 auto",
          }}
        />

        <div
          style={{
            minHeight: 76,
            background: "#168bb2",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 18px",
            flex: "0 0 auto",
          }}
        >
          <button
            type="button"
            onClick={() =>
              router.push(
                "/coletor/expedicoes"
              )
            }
            style={{
              border: 0,
              background: "transparent",
              color: "#fff",
              fontSize: 34,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ‹
          </button>

          <strong
            style={{
              fontSize: 23,
            }}
          >
            Ordens - Embarque
          </strong>
        </div>

        <div
          style={{
            padding: "12px 12px 8px",
            flex: "0 0 auto",
          }}
        >
          <div
            style={{
              minHeight: 56,
              border: "1px solid #aaa",
              borderRadius: 18,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 15px",
            }}
          >
            <span
              style={{
                color: "#587184",
                fontSize: 20,
              }}
            >
              ⌕
            </span>

            <input
              value={busca}
              onChange={(e) =>
                setBusca(
                  e.target.value
                )
              }
              placeholder="Parâmetro de busca"
              style={{
                flex: 1,
                border: 0,
                outline: 0,
                background: "transparent",
                fontSize: 15,
              }}
            />
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "8px 8px 30px",
          }}
        >
          {requisicoes.map(
            (req) => (
              <Card
                key={req.id}
                requisicao={req}
                onClick={() =>
                  router.push(
                    `/coletor/embarque/${req.id}`
                  )
                }
              />
            )
          )}

          {requisicoes.length === 0 && (
            <div
              style={{
                marginTop: 50,
                textAlign: "center",
                color: "#999",
                fontSize: 12,
              }}
            >
              Nenhuma ordem disponível
              para embarque.
            </div>
          )}

          <div
            style={{
              marginTop: 20,
              textAlign: "center",
              color: "#999",
              fontSize: 10,
            }}
          >
            {requisicoes.length}{" "}
            ordem(ns) disponível(is)
          </div>
        </div>

        <div
          style={{
            height: 36,
            background: "#000",
            flex: "0 0 auto",
          }}
        />
      </div>
    </div>
  );
}

function Card({
  requisicao,
  onClick,
}: {
  requisicao:
    RequisicaoTecnica & {
      volumes: any[];
    };

  onClick: () => void;
}) {
  const volumes =
    requisicao.volumes ?? [];

  const lidos =
    volumes.filter(
      (volume) =>
        volume.status ===
          "EMBARCADO" ||
        volume.status ===
          "EM_TRANSITO" ||
        volume.status ===
          "RECEBIDO"
    ).length;

  const totalItens =
    requisicao.itens.reduce(
      (total, item) =>
        total +
        item.solicitado,
      0
    );

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 166,

        marginBottom: 10,

        /*
         * BORDA PREMIUM
         * Azul grosso integrado ao próprio card.
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

        background: "#fff",

        padding: "12px 13px",

        textAlign: "left",
        cursor: "pointer",

        position: "relative",

        overflow: "hidden",

        /*
         * Sombra bem sutil apenas
         * para separar do fundo.
         */
        boxShadow:
          "0 3px 9px rgba(15, 23, 42, 0.055)",

        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              color: "#718096",
              fontSize: 9,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing:
                ".65px",
              textTransform:
                "uppercase",
            }}
          >
            ORDEM DE EMBARQUE
          </div>

          <div
            style={{
              marginTop: 3,
              color: "#172033",
              fontSize: 16,
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing:
                "-.15px",
            }}
          >
            Pedido:{" "}
            {requisicao.codigo.replace(
              "REQ-",
              ""
            )}
          </div>
        </div>

        <span
          style={{
            alignSelf: "start",

            borderRadius: 999,

            background:
              requisicao.status ===
              "EMBARCADA"
                ? "#fff2d7"
                : "#eaf8fc",

            color:
              requisicao.status ===
              "EMBARCADA"
                ? "#a65b00"
                : "#087da7",

            border:
              requisicao.status ===
              "EMBARCADA"
                ? "1px solid #ffd58b"
                : "1px solid #c6edf7",

            padding:
              "6px 10px",

            fontSize: 9,
            fontWeight: 900,

            lineHeight: 1,

            whiteSpace: "nowrap",
          }}
        >
          {requisicao.status ===
          "EMBARCADA"
            ? "EM ANDAMENTO"
            : "CONFERIDA"}
        </span>
      </div>

      {/* TÉCNICO */}

      <div
        style={{
          marginTop: 10,

          overflow: "hidden",

          color: "#172033",

          fontSize: 16,
          fontWeight: 850,

          lineHeight: 1.18,

          whiteSpace: "nowrap",
          textOverflow:
            "ellipsis",
        }}
      >
        {requisicao.tecnico}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",

          gap: 5,

          marginTop: 4,

          color: "#087da7",

          fontSize: 11,
          fontWeight: 850,

          lineHeight: 1.2,
        }}
      >
        <span>
          {requisicao.codigoTecnico}
        </span>

        <span
          style={{
            color: "#a3b3bd",
          }}
        >
          •
        </span>

        <span>
          {requisicao.tipo}
        </span>
      </div>

      {/* DIVISOR */}

      <div
        style={{
          height: 1,
          margin: "10px 0",
          background: "#e8eef2",
        }}
      />

      {/* INFORMAÇÕES */}

      <div
        style={{
          display: "grid",

          gridTemplateColumns:
            "1fr 1fr",

          gap: "8px 12px",
        }}
      >
        <div
          style={{
            minWidth: 0,
          }}
        >
          <span
            style={{
              display: "block",

              marginBottom: 2,

              color: "#81909f",

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
              display: "block",

              overflow: "hidden",

              color: "#46566a",

              fontSize: 11,
              fontWeight: 750,

              lineHeight: 1.2,

              whiteSpace:
                "nowrap",

              textOverflow:
                "ellipsis",
            }}
          >
            {requisicao.base}
          </span>
        </div>

        <div>
          <span
            style={{
              display: "block",

              marginBottom: 2,

              color: "#81909f",

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
              color: "#46566a",

              fontSize: 11,
              fontWeight: 750,

              lineHeight: 1.2,
            }}
          >
            {totalItens}
          </span>
        </div>
      </div>

      {/* RODAPÉ DO CARD */}

      <div
        style={{
          display: "flex",

          alignItems: "center",
          justifyContent:
            "space-between",

          gap: 8,

          marginTop: 12,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",

            gap: 5,

            padding:
              "5px 9px",

            borderRadius: 999,

            color:
              requisicao.status ===
              "EMBARCADA"
                ? "#9a6400"
                : "#087da7",

            background:
              requisicao.status ===
              "EMBARCADA"
                ? "#fff5dc"
                : "#e7f6fb",

            border:
              requisicao.status ===
              "EMBARCADA"
                ? "1px solid #ffe1a3"
                : "1px solid #c6ebf5",

            fontSize: 9,
            fontWeight: 900,

            lineHeight: 1,

            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,

              borderRadius:
                "50%",

              background:
                "currentColor",
            }}
          />

          {requisicao.status ===
          "EMBARCADA"
            ? "Embarcando"
            : "Aguardando embarque"}
        </span>

        <div
          style={{
            display: "flex",
            alignItems: "center",

            gap: 11,

            color: "#69798a",

            fontSize: 9,
            fontWeight: 750,
          }}
        >
          <span>
            Volumes{" "}
            <strong
              style={{
                color: "#172033",
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              {volumes.length}
            </strong>
          </span>

          <span>
            Lidos{" "}
            <strong
              style={{
                color: "#172033",
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              {lidos}/
              {volumes.length}
            </strong>
          </span>

          <span
            style={{
              marginLeft: 2,

              color: "#159fc5",

              fontSize: 25,
              fontWeight: 400,

              lineHeight: ".8",
            }}
          >
            ›
          </span>
        </div>
      </div>
    </button>
  );
}
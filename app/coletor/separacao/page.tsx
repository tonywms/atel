"use client";
import v157ListaStyles from "./atel-v157-1-lista.module.css";
import "./atel-v156-separacao.css"; // ATEL_E1_V156_2_SEPARACAO_HEADER
import { pedidosComEstadoV363 } from "@/lib/atelPedidosHomologacaoV363";

import {carregarPedidosV36,pedidoParaCardV36} from "@/lib/atelPedidosReaisV36";
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

/* =========================================================
   HELPERS
========================================================= */

function prioridadeClass(prioridade: string) {
  if (prioridade === "URGENTE") {
    return "collector-priority urgent";
  }

  if (prioridade === "ALTA") {
    return "collector-priority high";
  }

  return "collector-priority normal";
}

function statusNome(status: string) {
  if (status === "PENDENTE") {
    return "Pendente";
  }

  if (status === "EM_SEPARACAO") {
    return "Em Separação";
  }

  return status.replaceAll("_", " ");
}

/* =========================================================
   ESTILOS

   IMPORTANTE:
   A tela inteira NÃO rola.

   Quem rola é somente "listStyle", onde ficam os cards.
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
};

/*
 * ESSA É A CORREÇÃO PRINCIPAL.
 *
 * flex: 1
 * minHeight: 0
 * overflowY: auto
 *
 * fazem a lista ocupar somente o espaço restante
 * e permitir rolagem até o último pedido.
 */
const listStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,

  overflowY: "auto",
  overflowX: "hidden",

  WebkitOverflowScrolling: "touch",

  overscrollBehavior: "contain",

  paddingBottom: 24,

  scrollbarGutter: "stable",
};

const bottomInfoStyle: CSSProperties = {
  flex: "0 0 auto",
};

/* =========================================================
   COMPONENTE
========================================================= */

export default function SeparacaoListaPage() {
  const router = useRouter();

  const [busca, setBusca] = useState("");

  const [requisicoesMock, setRequisicoes] =
    useState<RequisicaoTecnica[]>([]);

  const [pedidosReais,setPedidosReais]=useState<RequisicaoTecnica[]>([]);
  useEffect(()=>{let ativo=true;async function atualizar(){try{const pedidos=await carregarPedidosV36();if(ativo)setPedidosReais(pedidosComEstadoV363(pedidos.map(pedidoParaCardV36)).filter(p=>p.status==="PENDENTE"||p.status==="EM_SEPARACAO"));}catch(e){console.error("ATEL V36 pedidos reais:",e)}}void atualizar();const intervalo=setInterval(()=>void atualizar(),30000);return()=>{ativo=false;clearInterval(intervalo)}},[]);
  const requisicoes=[...requisicoesMock,...pedidosReais];

  /* =======================================================
     CARREGAR REQUISIÇÕES
  ======================================================= */

  function carregar() {
    const estados = carregarEstados();

    const lista = requisicoesTecnicasMock
      .map((req) => {
        const estado = estados[req.id];

        if (!estado) {
          return req;
        }

        return {
          ...req,

          status: estado.status,

          itens: req.itens.map((item) => ({
            ...item,

            separado:
              estado.itens[item.id]?.quantidadeSeparada ??
              item.separado,
          })),
        };
      })
      .filter(
        (req) =>
          req.status === "PENDENTE" ||
          req.status === "EM_SEPARACAO"
      );

    setRequisicoes(lista);
  }

  /* =======================================================
     ATUALIZAÇÃO
  ======================================================= */

  useEffect(() => {
    carregar();

    return ouvirAlteracoes(carregar);
  }, []);

  /* =======================================================
     PESQUISA
  ======================================================= */

  const filtradas = useMemo(() => {
    const termo = busca
      .trim()
      .toLowerCase();

    if (!termo) {
      return requisicoes;
    }

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

  /* =======================================================
     TOTAL DE ITENS
  ======================================================= */

  function totalItens(
    req: RequisicaoTecnica
  ) {
    return req.itens.reduce(
      (total, item) =>
        total + item.solicitado,
      0
    );
  }

  /* =======================================================
     ABRIR REQUISIÇÃO
  ======================================================= */

  function abrirRequisicao(
    req: RequisicaoTecnica
  ) {
    router.push(`/coletor/separacao/${req.id}`);
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="collector-screen atel-v156-separacao">
      <div
        className="collector-phone"
        style={phoneStyle}
      >
        {/* =================================================
            CABEÇALHO
        ================================================= */}

        <div
          className="collector-header"
          style={{
            ...headerStyle,
            width: "100%",
            boxSizing: "border-box",
            padding: "0 18px",
            minHeight: 66,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          <div
            className="collector-header-title"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 12,
              margin: 0,
              padding: 0,
            }}
          >
            <button
              type="button"
              className="collector-back-button"
              onClick={() => { window.location.href = "/coletor/expedicoes"; }}
              aria-label="Voltar para Expedição"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 24px",
                width: 24,
                height: 32,
                margin: 0,
                padding: 0,
                border: 0,
                background: "transparent",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <strong style={{ margin: 0, color: "#ffffff", fontSize: 21, lineHeight: 1.2, fontWeight: 700, textAlign: "left" }}>
              Separação
            </strong>
          </div>
        
          
</div>
        {/* ATEL_E1_V157_1_PAINEL_LISTA: resumo da carteira, nao confirma operacoes */}
        <section className={v157ListaStyles.painel} aria-label="Resumo da carteira de separação">
          <div className={v157ListaStyles.topo}>
            <span className={v157ListaStyles.simbolo} aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 20h18M6 16v-5M11 16V7M16 16V4M21 16V9" /></svg></span>
            <div className={v157ListaStyles.titulos}><span className={v157ListaStyles.kicker}>VISÃO OPERACIONAL</span><strong>Minha fila de separação</strong></div>
            <span className={v157ListaStyles.tag}>Em tempo real</span>
          </div>
          <div className={v157ListaStyles.metricas}>
            <div><strong>{filtradas.length}</strong><span>Pedidos na lista</span></div>
            <div><strong>{filtradas.filter(req => req.status === "EM_SEPARACAO").length}</strong><span>Em separação</span></div>
            <div><strong>{filtradas.filter(req => req.status === "PENDENTE").length}</strong><span>Aguardando</span></div>
          </div>
          <p>Abra um pedido abaixo para acompanhar o progresso dos itens e a próxima pendência.</p>
        </section>


{/* =================================================
            PESQUISA
        ================================================= */}

        <div
          className="collector-search-area"
          style={searchAreaStyle}
        >
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

        {/* =================================================
            LISTA COM SCROLL
        ================================================= */}

        <div
          className="collector-request-list"
          style={listStyle}
        >
          {filtradas.length === 0 && (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                color: "#7b8794",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Nenhuma requisição encontrada.
            </div>
          )}

          {filtradas.map((req) => (
            <button
              type="button"
              key={req.id}
              className="collector-request-card"
              onClick={() =>
                abrirRequisicao(req)
              }
              style={{
                width: "calc(100% - 20px)",
                margin: "0 10px 10px",
                padding: 0,
                background: "#ffffff",
                borderTop: "1px solid #d9e5eb",
                borderRight: "1px solid #d9e5eb",
                borderBottom: "1px solid #d9e5eb",
                borderLeft: "7px solid #159fc5",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 3px 9px rgba(15, 23, 42, 0.055)",
              }}
            >

              <div className="collector-card-content">
                {/* =========================================
                    CABEÇALHO DO CARD
                ========================================= */}

                <div className="collector-card-header">
                  <strong>
                    {req.codigo}
                  </strong>

                  <span
                    className={prioridadeClass(
                      req.prioridade
                    )}
                  >
                    {req.prioridade}
                  </span>
                </div>

                {/* =========================================
                    TÉCNICO
                ========================================= */}

                <div className="collector-technician">
                  {req.tecnico}
                </div>

                {/* =========================================
                    DADOS
                ========================================= */}

                <div className="collector-card-row">
                  <span>
                    Técnico:
                  </span>

                  <b>
                    {req.codigoTecnico}
                  </b>
                </div>

                <div className="collector-card-row">
                  <span>
                    Base:
                  </span>

                  <b>
                    {req.base}
                  </b>
                </div>

                <div className="collector-card-row">
                  <span>
                    Tipo:
                  </span>

                  <b>
                    {req.tipo}
                  </b>
                </div>

                {/* =========================================
                    QUANTIDADES
                ========================================= */}

                <div className="collector-card-numbers">
                  <div>
                    <span>
                      Itens:
                    </span>

                    <strong>
                      {totalItens(req)}
                    </strong>
                  </div>

                  <div>
                    <span>
                      SKUs:
                    </span>

                    <strong>
                      {req.itens.length}
                    </strong>
                  </div>
                </div>

                {/* =========================================
                    STATUS
                ========================================= */}

                <div className="collector-card-footer">
                  <span
                    className={
                      req.status ===
                      "PENDENTE"
                        ? "collector-status pending"
                        : "collector-status separating"
                    }
                  >
                    {statusNome(
                      req.status
                    )}
                  </span>

                  <span className="collector-arrow">
                    ›
                  </span>
                </div>
              </div>
            </button>
          ))}

          {/*
           * Folga extra para garantir que o último card
           * nunca fique escondido no final da área rolável.
           */}
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
            ? "requisição disponível"
            : "requisições disponíveis"}
        </div>
      </div>
    </div>
  );
}
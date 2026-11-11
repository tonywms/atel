"use client";

import "./atel-v149-consulta-premium.css";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  carregarEstoqueTecnico,
  ouvirEstoqueTecnico,
  type EstoqueTecnico,
} from "@/lib/estoqueTecnicoStore";

export default function Page() {

const router = useRouter();

  const [e, setE] = useState<EstoqueTecnico[]>([]);
  const [q, setQ] = useState("");

  function load() {
    setE(carregarEstoqueTecnico());
  }

  useEffect(() => {
    load();

    return ouvirEstoqueTecnico(load);
  }, []);

  const f = useMemo(() => {
    const x = q.trim().toLowerCase();

    return e.filter(
      (i) =>
        i.quantidade > 0 &&
        (!x ||
          [
            i.codigoProduto,
            i.produto,
            i.tecnico,
            i.codigoTecnico,
            i.base,
            ...i.seriais,
          ].some((v) =>
            String(v)
              .toLowerCase()
              .includes(x)
          ))
    );
  }, [e, q]);

  return (
    <div className="collector-screen atel-v149-consulta-screen">
      <div className="collector-phone">

        {/* BARRA PRETA SUPERIOR */}

        <div
          style={{
            height: 40,
            background: "#000",
          }}
        />

        {/* HEADER */}

        <div className="collector-header atel-v149-header">
          <button type="button" className="atel-v149-back" onClick={() => router.push("/coletor/consulta")} aria-label="Voltar às consultas"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7"/></svg></button>
          <div className="atel-v149-header-text"><span>CENTRAL DE CONSULTAS</span><strong>Estoque</strong></div>
          <span className="atel-v149-header-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 5 9-5m-9 5v9"/></svg></span>
        </div>

        {/* BUSCA */}

        <div className="collector-search-area atel-v149-search-area">
          <div className="atel-v149-search-box">
            <span className="atel-v149-search-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span>
            <input type="search" aria-label="Pesquisar no estoque" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Produto, técnico, base ou serial..." />
            {q && <button type="button" className="atel-v149-clear" aria-label="Limpar pesquisa" onClick={() => setQ("")}>×</button>}
          </div>
        </div>

        {/* LISTA */}

        <div className="collector-request-list">

          {f.map((i) => (

            <div
              key={i.id}
              className="collector-request-card"

              style={{
                minHeight: 170,

                background: "#ffffff",

                /* ==============================
                   BORDA PADRÃO PREMIUM
                ============================== */

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
              }}
            >

              {/*
                collector-card-strip REMOVIDO.

                A faixa azul agora é a própria
                borda esquerda do card.
              */}

              <div className="collector-card-content">

                {/* PRODUTO / QUANTIDADE */}

                <div className="collector-card-header">

                  <strong>
                    {i.codigoProduto}
                  </strong>

                  <strong>
                    {i.quantidade}{" "}
                    {i.unidade}
                  </strong>

                </div>

                {/* DESCRIÇÃO */}

                <div className="collector-technician">
                  {i.produto}
                </div>

                {/* TÉCNICO */}

                <div className="collector-card-row">

                  <span>
                    Técnico:{" "}
                  </span>

                  {i.codigoTecnico}
                  {" - "}
                  {i.tecnico}

                </div>

                {/* BASE */}

                <div className="collector-card-row">

                  <span>
                    Base:{" "}
                  </span>

                  {i.base}

                </div>

                {/* SERIAL */}

                {i.seriais.length > 0 && (

                  <div className="collector-card-row">

                    <span>
                      Serial:{" "}
                    </span>

                    {i.seriais.join(" • ")}

                  </div>

                )}

                {/* RODAPÉ */}

                <div className="collector-card-footer">

                  <span className="collector-status separating">
                    DISPONÍVEL
                  </span>

                  <span className="collector-arrow">
                    ›
                  </span>

                </div>

              </div>

            </div>

          ))}

          {/* SEM RESULTADOS */}

          {!f.length && (

            <div
              style={{
                padding: 35,
                textAlign: "center",
                color: "#819098",
              }}
            >
              Nenhum estoque encontrado.
            </div>

          )}

        </div>

        {/* RODAPÉ */}

        <div className="collector-bottom-info">
          {f.length} posições encontradas
        </div>

        {/* BARRA PRETA INFERIOR */}

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
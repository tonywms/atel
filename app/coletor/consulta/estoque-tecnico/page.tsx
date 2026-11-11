"use client";

import "./atel-v149-consulta-premium.css";
import "./atel-v150-qualidade.css";
import "./atel-v152-devolucao.css";
// ATEL_V152_DEVOLUCAO
// ATEL_V150_QUALIDADE_OPERACIONAL

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  carregarEstoqueTecnico,
  devolverEstoqueTecnicoAoCD,
  ouvirEstoqueTecnico,
  type EstoqueTecnico,
} from "@/lib/estoqueTecnicoStore";

export default function Page() {

const router = useRouter();

  const [estoque, setEstoque] = useState<EstoqueTecnico[]>([]);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] =
    useState<EstoqueTecnico | null>(null);

  const [quantidade, setQuantidade] = useState("1");
  const [seriais, setSeriais] = useState<string[]>([]);
  const [motivo, setMotivo] = useState("DEVOLUÇÃO DO TÉCNICO");
  const [motivosAbertos, setMotivosAbertos] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const v150ProcessandoRef = React.useRef(false);

  function carregar() {
    setEstoque(carregarEstoqueTecnico());
  }

  useEffect(() => {
    carregar();

    return ouvirEstoqueTecnico(carregar);
  }, []);

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    const mapa = new Map<string, EstoqueTecnico[]>();

    estoque
      .filter((item) => item.quantidade > 0)
      .filter((item) => {
        if (!termo) return true;

        return [
          item.tecnico,
          item.codigoTecnico,
          item.base,
          item.codigoProduto,
          item.produto,
          ...item.seriais,
        ].some((valor) =>
          valor.toLowerCase().includes(termo)
        );
      })
      .forEach((item) => {
        mapa.set(
          item.codigoTecnico,
          [
            ...(mapa.get(item.codigoTecnico) ?? []),
            item,
          ]
        );
      });

    return [...mapa.entries()];
  }, [estoque, busca]);

  const saldoTotal = estoque.reduce(
    (total, item) => total + item.quantidade,
    0
  );

  function abrirDevolucao(item: EstoqueTecnico) {
    setSelecionado(item);

    setQuantidade(
      item.seriais.length > 0
        ? "1"
        : "1"
    );

    setSeriais([]);
    setMotivo("DEVOLUÇÃO DO TÉCNICO");
    setMotivosAbertos(false);
    setObservacao("");
    setMensagem("");
    setConfirmando(false);
  }

  function alternarSerial(serial: string) {
    if (!selecionado) return;

    const atual =
      seriais.includes(serial);

    const novaLista =
      atual
        ? seriais.filter(
            (item) => item !== serial
          )
        : [...seriais, serial];

    setSeriais(novaLista);

    setQuantidade(
      String(novaLista.length)
    );
  }

  function prepararDevolucao() {
    if (!selecionado) return;
    if (selecionado.seriais.length > 0) {
      const validos = new Set(selecionado.seriais);
      if (new Set(seriais).size !== seriais.length || seriais.some(serial => !validos.has(serial))) {
        setMensagem("Selecao de seriais inconsistente. Reabra a devolucao e selecione novamente.");
        return;
      }
    }
    if (!motivo.trim()) {
      setMensagem("Selecione o motivo da devolucao.");
      return;
    }


    const qtd =
      Number(quantidade);

    if (!Number.isSafeInteger(qtd) || qtd <= 0) {
      setMensagem(
        "Informe uma quantidade válida."
      );

      return;
    }

    if (
      qtd >
      selecionado.quantidade
    ) {
      setMensagem(
        "Quantidade maior que o saldo disponível."
      );

      return;
    }

    if (
      selecionado.seriais.length > 0 &&
      seriais.length !== qtd
    ) {
      setMensagem(
        `Selecione ${qtd} serial(is).`
      );

      return;
    }

    setMensagem("");
    
    // ATEL V152 - material com serie exige identificacao e motivo documentado.
    if ((motivo === "AVARIA" || motivo === "OUTRO") && !observacao.trim()) {
      setMensagem("Informe uma justificativa para " + motivo.toLowerCase() + ".");
      return;
    }
    if (selecionado.seriais.length > 0 &&
        (seriais.length === 0 || seriais.length > selecionado.quantidade)) {
      setMensagem("Selecione seriais validos dentro do saldo disponivel.");
      return;
    }
setConfirmando(true);
  }

  function confirmarDevolucao() {
    if (!selecionado || v150ProcessandoRef.current) return;
    v150ProcessandoRef.current = true;
    try {
      const resultado =
        devolverEstoqueTecnicoAoCD({
          codigoTecnico:
            selecionado.codigoTecnico,

          codigoProduto:
            selecionado.codigoProduto,

          quantidade:
            Number(quantidade),

          seriais,

          motivo,

          observacao,
        });

      setConfirmando(false);
      setSelecionado(null);

      carregar();

      setMensagem(
        `${resultado.documento} enviado ao CD. Retorno ${resultado.retorno.codigo} criado.`
      );
    } catch (error) {
      setConfirmando(false);

      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar a devolução."
      );
    } finally { v150ProcessandoRef.current = false; }
  }

  return (
    <div className="collector-screen atel-v149-consulta-screen">
      <div className="collector-phone">

        {/* ================================================
            BARRA SUPERIOR
        ================================================= */}

        <div
          style={{
            height: 40,
            background: "#000",
            flex: "0 0 auto",
          }}
        />

        {/* ================================================
            CABEÇALHO
        ================================================= */}

        <div className="collector-header atel-v149-header">
          <button type="button" className="atel-v149-back" onClick={() => router.push("/coletor/consulta")} aria-label="Voltar às consultas"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7"/></svg></button>
          <div className="atel-v149-header-text"><span>CENTRAL DE CONSULTAS</span><strong>Estoque Técnico</strong></div>
          <span className="atel-v149-header-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="7" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2M18 6h4m-2-2v4"/></svg></span>
        </div>

        {/* ================================================
            PESQUISA
        ================================================= */}

        <div className="collector-search-area atel-v149-search-area">
          <div className="atel-v149-search-box">
            <span className="atel-v149-search-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></span>
            <input type="search" aria-label="Pesquisar no estoque" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Técnico, produto ou serial..." />
            {busca && <button type="button" className="atel-v149-clear" aria-label="Limpar pesquisa" onClick={() => setBusca("")}>×</button>}
          </div>
        </div>

        {/* ================================================
            MENSAGEM
        ================================================= */}

        {mensagem && !selecionado && (
          <div
            style={{
              margin:
                "0 14px 8px",

              padding:
                "9px 11px",

              borderRadius: 8,

              background:
                "#e6f5fb",

              color:
                "#076a91",

              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {mensagem}
          </div>
        )}

        {/* ================================================
            LISTA DE ESTOQUE
        ================================================= */}

        <div
          className="collector-request-list"
          style={{
            overflowY: "auto",
            flex: 1,
            paddingBottom: 12,
          }}
        >

          {grupos.flatMap(
            ([codigoTecnico, itens]) =>
              itens.map(
                (item) => (
                  <div
                    key={item.id}
                    className="collector-request-card"

                    style={{
                      minHeight: 190,

                      background:
                        "#ffffff",

                      /*
                       * BORDA PREMIUM
                       *
                       * O azul é a própria
                       * borda esquerda do card.
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

                      overflow:
                        "hidden",

                      boxShadow:
                        "0 3px 9px rgba(15, 23, 42, 0.055)",
                    }}
                  >

                    {/*
                      IMPORTANTE:

                      O antigo:

                      <div className="collector-card-strip" />

                      foi removido porque agora
                      o azul faz parte da borda
                      do próprio card.
                    */}

                    <div className="collector-card-content">

                      {/* ==================================
                          PRODUTO / QUANTIDADE
                      =================================== */}

                      <div className="collector-card-header">

                        <strong>
                          {item.codigoProduto}
                        </strong>

                        <strong>
                          {item.quantidade}{" "}
                          {item.unidade}
                        </strong>

                      </div>

                      {/* ==================================
                          DESCRIÇÃO
                      =================================== */}

                      <div className="collector-technician">
                        {item.produto}
                      </div>

                      {/* ==================================
                          TÉCNICO
                      =================================== */}

                      <div className="collector-card-row">

                        <span>
                          Técnico:{" "}
                        </span>

                        {codigoTecnico}
                        {" - "}
                        {itens[0].tecnico}

                      </div>

                      {/* ==================================
                          BASE
                      =================================== */}

                      <div className="collector-card-row">

                        <span>
                          Base:{" "}
                        </span>

                        {itens[0].base}

                      </div>

                      {/* ==================================
                          SERIAL
                      =================================== */}

                      {item.seriais.length > 0 && (

                        <div className="collector-card-row">

                          <span>
                            Serial:{" "}
                          </span>

                          {item.seriais.join(
                            " • "
                          )}

                        </div>

                      )}

                      {/* ==================================
                          RODAPÉ DO CARD
                      =================================== */}

                      <div className="collector-card-footer">

                        <button
                          type="button"

                          onClick={() =>
                            abrirDevolucao(
                              item
                            )
                          }

                          style={{
                            height: 34,

                            padding:
                              "0 13px",

                            border:
                              "1px solid #1687b0",

                            borderRadius:
                              6,

                            background:
                              "#fff",

                            color:
                              "#087fab",

                            fontSize: 10,
                            fontWeight: 800,

                            cursor:
                              "pointer",
                          }}
                        >
                          DEVOLVER AO CD
                        </button>

                        <span className="collector-arrow">
                          ›
                        </span>

                      </div>

                    </div>

                  </div>
                )
              )
          )}

          {/* ================================================
              SEM ESTOQUE
          ================================================= */}

          {!grupos.length && (

            <div className="atel-v150-empty" role="status"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 10h8m-8 4h5"/></svg><strong>Nenhum estoque móvel encontrado</strong><span>Revise o filtro ou consulte outro técnico ou produto.</span></div>

          )}

        </div>

        {/* ================================================
            RODAPÉ
        ================================================= */}

        <div
          className="collector-bottom-info"
          style={{
            marginTop: 0,
            padding: 8,
          }}
        >
          {grupos.length} técnicos
          {" • "}
          saldo total {saldoTotal}
        </div>

        <div
          style={{
            height: 36,
            background: "#000",
            flex: "0 0 auto",
          }}
        />

        {/* ================================================
            MODAL DEVOLUÇÃO
        ================================================= */}

        {selecionado && (

          <div className="atel-v151-overlay" style={S.overlay}>

            <div className="atel-v151-modal" style={S.modal}>

              <div className="atel-v150-modal-heading">
                <span className="atel-v150-heading-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 5 9-5m-9 5v9"/></svg></span>
                <div><small>OPERACAO DE ESTOQUE</small><strong>Devolucao ao CD</strong></div>
              </div>

              <div style={S.infoBand}>

                {selecionado.codigoTecnico}
                {" • "}
                {selecionado.tecnico}

                <br />

                {selecionado.codigoProduto}
                {" • "}
                {selecionado.produto}

              </div>

              {/* SALDO */}

              
              <div className="atel-v150-summary" role="group" aria-label="Resumo da devolucao">
                <div><span>DISPONIVEL</span><strong>{selecionado.quantidade}</strong></div>
                <div><span>DEVOLVER</span><strong>{selecionado.seriais.length ? seriais.length : (Number(quantidade) || 0)}</strong></div>
                <div><span>RESTANTE</span><strong>{Math.max(0, selecionado.quantidade - (selecionado.seriais.length ? seriais.length : (Number(quantidade) || 0)))}</strong></div>
              </div>
{/* QUANTIDADE / SERIAIS */}

              {selecionado.seriais.length === 0 ? (

                <label style={S.label}>

                  QUANTIDADE

                  <input
                    type="number"
                    min={1}
                    max={
                      selecionado.quantidade
                    }
                    value={
                      quantidade
                    }
                    onChange={(
                      event
                    ) =>
                      setQuantidade(
                        event.target.value
                      )
                    }
                    style={S.input}
                  />

                </label>

              ) : (

                <div>

                  <div style={S.label}>
                    SERIAIS PARA DEVOLUÇÃO
                  </div>

                  <div className="atel-v152-serial-tools" role="group" aria-label="Acoes de selecao dos seriais">
  <span className="atel-v152-serial-count" aria-live="polite">{seriais.length} de {selecionado.seriais.length} selecionados</span>
  <div className="atel-v152-serial-actions">
    <button type="button" onClick={() => {
      const disponiveis = Array.from(new Set(selecionado.seriais));
      const selecionaveis = disponiveis.slice(0, Math.max(0, Math.floor(selecionado.quantidade)));
      setSeriais(selecionaveis);
      setQuantidade(String(selecionaveis.length));
      setMensagem("");
    }}>Selecionar todos</button>
    <button type="button" onClick={() => {setSeriais([]);setQuantidade("0");setMensagem("");}}>Limpar</button>
  </div>
</div>
                  {selecionado.seriais.map(
                    (serial) => (

                      <button
                        key={serial}
                        type="button"

                        onClick={() =>
                          alternarSerial(
                            serial
                          )
                        }

                        style={{
                          ...S.serialButton,

                          ...(seriais.includes(
                            serial
                          )
                            ? S.serialSelected
                            : {}),
                        }}
                      >

                        <span>
                          {seriais.includes(
                            serial
                          )
                            ? "✓"
                            : "○"}
                        </span>

                        <strong>
                          {serial}
                        </strong>

                      </button>

                    )
                  )}

                </div>

              )}

              {/* MOTIVO */}

              <label style={S.label}>

                MOTIVO

                <div className="atel-v149-motivo-picker">
                  <button type="button" className="atel-v149-motivo-trigger" aria-expanded={motivosAbertos} aria-controls="atel-v149-motivos" onClick={() => setMotivosAbertos(!motivosAbertos)}>
                    <span>{motivo}</span><span className={motivosAbertos ? "atel-v149-rotate" : ""}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span>
                  </button>
                  {motivosAbertos && <div id="atel-v149-motivos" role="listbox" aria-label="Selecione o motivo" className="atel-v149-motivo-list">
                    <button key="DEVOLUÇÃO DO TÉCNICO" type="button" role="option" aria-selected={motivo === "DEVOLUÇÃO DO TÉCNICO"} className={motivo === "DEVOLUÇÃO DO TÉCNICO" ? "atel-v149-motivo-option is-selected" : "atel-v149-motivo-option"} onClick={() => { setMotivo("DEVOLUÇÃO DO TÉCNICO"); setMotivosAbertos(false); }}><span>DEVOLUÇÃO DO TÉCNICO</span>{motivo === "DEVOLUÇÃO DO TÉCNICO" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>}</button>
                    <button key="SOBRA DE MATERIAL" type="button" role="option" aria-selected={motivo === "SOBRA DE MATERIAL"} className={motivo === "SOBRA DE MATERIAL" ? "atel-v149-motivo-option is-selected" : "atel-v149-motivo-option"} onClick={() => { setMotivo("SOBRA DE MATERIAL"); setMotivosAbertos(false); }}><span>SOBRA DE MATERIAL</span>{motivo === "SOBRA DE MATERIAL" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>}</button>
                    <button key="TROCA DE TÉCNICO" type="button" role="option" aria-selected={motivo === "TROCA DE TÉCNICO"} className={motivo === "TROCA DE TÉCNICO" ? "atel-v149-motivo-option is-selected" : "atel-v149-motivo-option"} onClick={() => { setMotivo("TROCA DE TÉCNICO"); setMotivosAbertos(false); }}><span>TROCA DE TÉCNICO</span>{motivo === "TROCA DE TÉCNICO" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>}</button>
                    <button key="AVARIA" type="button" role="option" aria-selected={motivo === "AVARIA"} className={motivo === "AVARIA" ? "atel-v149-motivo-option is-selected" : "atel-v149-motivo-option"} onClick={() => { setMotivo("AVARIA"); setMotivosAbertos(false); }}><span>AVARIA</span>{motivo === "AVARIA" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>}</button>
                    <button key="OUTRO" type="button" role="option" aria-selected={motivo === "OUTRO"} className={motivo === "OUTRO" ? "atel-v149-motivo-option is-selected" : "atel-v149-motivo-option"} onClick={() => { setMotivo("OUTRO"); setMotivosAbertos(false); }}><span>OUTRO</span>{motivo === "OUTRO" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>}</button>
                  </div>}
                </div>

              </label>

              {/* OBSERVAÇÃO */}

              <label style={S.label}>

                OBSERVAÇÃO

                <textarea
                  value={observacao}

                  onChange={(
                    event
                  ) =>
                    setObservacao(
                      event.target.value
                    )
                  }

                  style={
                    S.textarea
                  }

                  placeholder="Observação opcional"
                />

              </label>

              {/* ERRO */}

              {mensagem && (

                <div
                  style={
                    S.modalMessage
                  }
                >
                  {mensagem}
                </div>

              )}

              {/* AÇÕES */}

              <div className="atel-v151-actions" style={S.actions}>

                <button
                  type="button"
                  style={S.cancel}

                  onClick={() =>
                    setSelecionado(
                      null
                    )
                  }
                >
                  CANCELAR
                </button>

                <button
                  type="button"
                  style={S.confirm}
                  onClick={
                    prepararDevolucao
                  }
                >
                  GERAR DEVOLUÇÃO
                </button>

              </div>

            </div>

          </div>

        )}

        {/* ================================================
            CONFIRMAÇÃO DA DEVOLUÇÃO
        ================================================= */}

        {selecionado && confirmando && (

          <div style={S.overlayTop}>

            <div style={S.confirmModal}>

              <div style={S.confirmIcon}>
                !
              </div>

              <div style={S.confirmTitle}>
                Confirmar Devolução
              </div>

              <p style={S.confirmText}>

                Confirma a saída de{" "}

                <b>
                  {quantidade}{" "}
                  {selecionado.unidade}
                </b>

                {" "}de{" "}

                <b>
                  {selecionado.codigoProduto}
                </b>

                {" "}do estoque móvel de{" "}

                {selecionado.tecnico}
                ?

              </p>
              <div className="atel-v150-confirm-summary" role="group" aria-label="Conferencia antes de gerar o retorno">
                <div className="atel-v150-confirm-heading"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6m-6 4h6m-6 4h4"/></svg> <strong>CONFIRA OS DADOS DA OPERACAO</strong></div>
                <div className="atel-v150-summary-line"><span>Produto</span><b>{selecionado.codigoProduto}</b></div>
                <div className="atel-v150-summary-line"><span>Tecnico</span><b>{selecionado.codigoTecnico}</b></div>
                <div className="atel-v150-summary-line"><span>Motivo</span><b>{motivo}</b></div>
                <div className="atel-v150-summary-line"><span>Quantidade</span><b>{quantidade} {selecionado.unidade}</b></div>
                <div className="atel-v150-summary-line"><span>Saldo restante</span><b>{Math.max(0, selecionado.quantidade - Number(quantidade))} {selecionado.unidade}</b></div>
                {seriais.length > 0 && <div className="atel-v150-serial-summary"><span>Seriais selecionados</span>{seriais.map(s => <code key={s}>{s}</code>)}</div>}
              </div>


              <div style={S.warning}>

                O material ficará EM TRÂNSITO
                e só entrará no estoque do CD
                após a conferência do retorno.

              </div>

              <div style={S.actions}>

                <button
                  type="button"
                  style={S.cancel}

                  onClick={() =>
                    setConfirmando(
                      false
                    )
                  }
                >
                  VOLTAR
                </button>

                <button
                  type="button"
                  style={S.confirm}
                  onClick={
                    confirmarDevolucao
                  }
                >
                  CONFIRMAR
                </button>

              </div>

            </div>

          </div>

        )}

      </div>
    </div>
  );
}

/* =========================================================
   ESTILOS DOS MODAIS / COMPONENTES AUXILIARES
========================================================= */

const S: Record<
  string,
  React.CSSProperties
> = {

  phone: {
    width:
      "min(420px,100vw)",

    height:
      "100dvh",

    margin:
      "0 auto",

    background:
      "#eef2f4",

    display:
      "grid",

    gridTemplateRows:
      "40px 58px minmax(0,1fr) 36px",

    overflow:
      "hidden",

    position:
      "relative",
  },

  black: {
    background:
      "#050505",
  },

  header: {
    background:
      "#0796bc",

    color:
      "#fff",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    padding:
      "0 12px",

    fontSize:
      14,
  },

  back: {
    width:
      34,

    height:
      34,

    border:
      0,

    background:
      "transparent",

    color:
      "#fff",

    fontSize:
      30,

    cursor:
      "pointer",
  },

  content: {
    minHeight:
      0,

    overflowY:
      "auto",

    padding:
      12,
  },

  search: {
    width:
      "100%",

    height:
      42,

    boxSizing:
      "border-box",

    border:
      "1px solid #c9d4da",

    borderRadius:
      7,

    padding:
      "0 11px",

    background:
      "#fff",
  },

  summary: {
    display:
      "grid",

    gridTemplateColumns:
      "1fr 1fr",

    gap:
      8,

    margin:
      "10px 0",

    fontSize:
      9,

    color:
      "#72818a",
  },

  message: {
    padding:
      10,

    marginBottom:
      10,

    borderRadius:
      7,

    background:
      "#e8f7ef",

    color:
      "#067647",

    fontSize:
      10,

    fontWeight:
      700,
  },

  card: {
    background:
      "#fff",

    border:
      "1px solid #d7e0e4",

    borderRadius:
      9,

    marginBottom:
      10,

    overflow:
      "hidden",
  },

  tech: {
    padding:
      11,

    display:
      "flex",

    justifyContent:
      "space-between",

    background:
      "#f7f9fa",

    fontSize:
      12,
  },

  block: {
    display:
      "block",

    marginTop:
      2,

    fontSize:
      9,

    color:
      "#72818a",
  },

  rowWrap: {
    borderTop:
      "1px solid #edf1f3",

    paddingBottom:
      9,
  },

  row: {
    padding:
      11,

    display:
      "grid",

    gridTemplateColumns:
      "1fr 65px",

    gap:
      8,

    fontSize:
      11,
  },

  serial: {
    display:
      "block",

    marginTop:
      5,

    color:
      "#087da7",

    fontSize:
      9,

    fontStyle:
      "normal",

    fontWeight:
      700,
  },

  qty: {
    textAlign:
      "right",

    fontSize:
      15,
  },

  returnButton: {
    width:
      "calc(100% - 22px)",

    minHeight:
      34,

    margin:
      "0 11px",

    border:
      "1px solid #168bb2",

    borderRadius:
      6,

    background:
      "#fff",

    color:
      "#087da7",

    fontSize:
      9,

    fontWeight:
      900,

    cursor:
      "pointer",
  },

  empty: {
    padding:
      35,

    textAlign:
      "center",

    color:
      "#819098",
  },

  overlay: {
    position:
      "absolute",

    inset:
      0,

    zIndex:
      50,

    background:
      "rgba(0,0,0,.48)",

    display:
      "flex",

    alignItems:
      "flex-end",
  },

  overlayTop: {
    position:
      "absolute",

    inset:
      0,

    zIndex:
      80,

    background:
      "rgba(0,0,0,.58)",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    padding:
      18,
  },

  modal: {
    width:
      "100%",

    maxHeight:
      "82%",

    overflowY:
      "auto",

    background:
      "#fff",

    borderRadius:
      "18px 18px 0 0",

    padding:
      16,
  },

  modalTitle: {
    color:
      "#087da7",

    fontSize:
      16,

    fontWeight:
      900,

    marginBottom:
      10,
  },

  infoBand: {
    padding:
      10,

    borderRadius:
      7,

    background:
      "#edf8fc",

    color:
      "#087da7",

    fontSize:
      10,

    fontWeight:
      800,

    lineHeight:
      1.5,
  },

  balance: {
    display:
      "flex",

    justifyContent:
      "space-between",

    margin:
      "12px 0",

    padding:
      10,

    border:
      "1px solid #d8e2e8",

    borderRadius:
      7,

    fontSize:
      9,

    color:
      "#667085",
  },

  label: {
    display:
      "block",

    marginTop:
      11,

    color:
      "#344054",

    fontSize:
      9,

    fontWeight:
      900,
  },

  input: {
    width:
      "100%",

    height:
      40,

    boxSizing:
      "border-box",

    marginTop:
      5,

    border:
      "1px solid #cbd5e1",

    borderRadius:
      6,

    padding:
      "0 9px",

    background:
      "#fff",
  },

  textarea: {
    width:
      "100%",

    minHeight:
      70,

    boxSizing:
      "border-box",

    marginTop:
      5,

    border:
      "1px solid #cbd5e1",

    borderRadius:
      6,

    padding:
      9,

    resize:
      "vertical",
  },

  serialButton: {
    width:
      "100%",

    minHeight:
      38,

    marginTop:
      6,

    padding:
      "0 10px",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      8,

    border:
      "1px solid #d8e2e8",

    borderRadius:
      6,

    background:
      "#fff",

    color:
      "#344054",

    cursor:
      "pointer",
  },

  serialSelected: {
    border:
      "1px solid #168bb2",

    background:
      "#edf8fc",

    color:
      "#087da7",
  },

  modalMessage: {
    marginTop:
      10,

    padding:
      9,

    borderRadius:
      6,

    background:
      "#fff0ef",

    color:
      "#b42318",

    fontSize:
      9,

    fontWeight:
      700,
  },

  actions: {
    display:
      "grid",

    gridTemplateColumns:
      "1fr 1.35fr",

    gap:
      8,

    marginTop:
      15,
  },

  cancel: {
    minHeight:
      44,

    border:
      "1px solid #cbd5e1",

    borderRadius:
      7,

    background:
      "#fff",

    color:
      "#475467",

    fontSize:
      10,

    fontWeight:
      900,

    cursor:
      "pointer",
  },

  confirm: {
    minHeight:
      44,

    border:
      0,

    borderRadius:
      7,

    background:
      "#0796bc",

    color:
      "#fff",

    fontSize:
      10,

    fontWeight:
      900,

    cursor:
      "pointer",
  },

  confirmModal: {
    width:
      "100%",

    background:
      "#fff",

    borderRadius:
      14,

    padding:
      18,

    textAlign:
      "center",
  },

  confirmIcon: {
    width:
      42,

    height:
      42,

    margin:
      "0 auto 10px",

    borderRadius:
      21,

    background:
      "#fff6dc",

    color:
      "#946200",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    fontSize:
      22,

    fontWeight:
      900,
  },

  confirmTitle: {
    fontSize:
      16,

    fontWeight:
      900,

    color:
      "#20242a",
  },

  confirmText: {
    fontSize:
      11,

    lineHeight:
      1.55,

    color:
      "#475467",
  },

  warning: {
    padding:
      10,

    borderRadius:
      7,

    background:
      "#fff6dc",

    color:
      "#946200",

    fontSize:
      9,

    lineHeight:
      1.45,

    fontWeight:
      700,
  },
};
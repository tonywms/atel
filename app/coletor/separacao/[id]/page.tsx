"use client";
import AtelSeparacaoProgressoV157 from "@/components/atel-ui/AtelSeparacaoProgressoV157";
import { usePedidoAtelV363 } from "@/lib/atelPedidosHomologacaoV363";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./separacao-detalhe.module.css";
import "./atel-v136-premium.css";

import { requisicoesTecnicasMock } from "@/lib/requisicoesTecnicas";
import {
  finalizarSeparacao,
  iniciarSeparacao,
  obterEstado,
  registrarSeparacaoItem,
} from "@/lib/requisicoesStore";

type Endereco = {
  id: string;
  codigo: string;
  rua: string;
  predio: string;
  andar: string;
  apto: string;
};

function enderecoDoItem(itemId: number): Endereco {
  if (itemId === 1) {
    return {
      id: "01-01-00-01",
      codigo: "3106",
      rua: "01",
      predio: "01",
      andar: "00",
      apto: "01",
    };
  }

  if (itemId === 2) {
    return {
      id: "01-02-00-03",
      codigo: "3110",
      rua: "01",
      predio: "02",
      andar: "00",
      apto: "03",
    };
  }

  return {
    id: "01-02-00-01",
    codigo: "3108",
    rua: "01",
    predio: "02",
    andar: "00",
    apto: "01",
  };
}

function normalizar(valor: string) {
  return valor.trim().toUpperCase();
}

export default function SeparacaoDetalhePage() {
  const params = useParams();
  const router = useRouter();

  const idParam = params.id;
  const id = Number(Array.isArray(idParam) ? idParam[0] : idParam);

  const pedidoAtel = usePedidoAtelV363(id);
  const requisicao = useMemo(
    () => requisicoesTecnicasMock.find((req) => req.id === id) ?? pedidoAtel,
    [id, pedidoAtel]
  );

  const [carregado, setCarregado] = useState(false);
  const [itemAtual, setItemAtual] = useState(0);

  const [enderecoLido, setEnderecoLido] = useState("");
  const [enderecoConfirmado, setEnderecoConfirmado] = useState(false);

  const [produtoLido, setProdutoLido] = useState("");
  const [produtoConfirmado, setProdutoConfirmado] = useState(false);

  const [serialDigitado, setSerialDigitado] = useState("");

  const [quantidades, setQuantidades] =
    useState<Record<number, number>>({});

  const [seriais, setSeriais] =
    useState<Record<number, string[]>>({});

  const [mensagem, setMensagem] = useState("");
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => {
    if (!requisicao) {
      setCarregado(true);
      return;
    }

    try {
      const estado = iniciarSeparacao(requisicao);

      const qtd: Record<number, number> = {};
      const serial: Record<number, string[]> = {};

      requisicao.itens.forEach((item) => {
        qtd[item.id] =
          estado.itens[item.id]?.quantidadeSeparada ?? 0;

        serial[item.id] =
          estado.itens[item.id]?.seriais ?? [];
      });

      setQuantidades(qtd);
      setSeriais(serial);

      const primeiroPendente = requisicao.itens.findIndex(
        (item) =>
          (qtd[item.id] ?? 0) < item.solicitado
      );

      if (primeiroPendente >= 0) {
        setItemAtual(primeiroPendente);
      } else {
        setItemAtual(
          Math.max(requisicao.itens.length - 1, 0)
        );
      }
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a separação."
      );
    } finally {
      setCarregado(true);
    }
  }, [requisicao]);

  if (!carregado) {
    return (
      <div className={`collector-screen ${styles.screen}`}>
        <div className={`collector-phone ${styles.phone}`}>
          <div
            style={{
              padding: 30,
              textAlign: "center",
            }}
          >
            Carregando...
          </div>
        </div>
      </div>
    );
  }

  if (!requisicao) {
    return (
      <div className={`collector-screen ${styles.screen}`}>
        <div className={`collector-phone ${styles.phone}`}>
          <div
            style={{
              padding: 30,
              textAlign: "center",
            }}
          >
            Requisição não encontrada.
          </div>
        </div>
      </div>
    );
  }

  const item = requisicao.itens[itemAtual];

  if (!item) {
    return (
      <div className={`collector-screen ${styles.screen}`}>
        <div className={`collector-phone ${styles.phone}`}>
          <div
            style={{
              padding: 30,
              textAlign: "center",
            }}
          >
            Nenhum produto encontrado.
          </div>
        </div>
      </div>
    );
  }

  const endereco = enderecoDoItem(item.id);

  const atendido = quantidades[item.id] ?? 0;
  const solicitado = item.solicitado;
  const listaSeriais = seriais[item.id] ?? [];

  const itensSeparados = requisicao.itens.filter(
    (produto) =>
      (quantidades[produto.id] ?? 0) >=
      produto.solicitado
  ).length;

  const todosSeparados = requisicao.itens.every(
    (produto) =>
      (quantidades[produto.id] ?? 0) >=
      produto.solicitado
  );

  const estoque = item.estoqueCD ?? 0;

  function limparLeitura() {
    setEnderecoLido("");
    setEnderecoConfirmado(false);

    setProdutoLido("");
    setProdutoConfirmado(false);

    setSerialDigitado("");
    setMensagem("");
  }

  /*
   * IMPORTANTE:
   *
   * O endereço visual continua sendo:
   *
   * 01-02-00-03
   *
   * porém o operador/coletor lê o código interno:
   *
   * 3110
   *
   * Portanto a validação é feita contra endereco.codigo.
   */
  function confirmarEndereco() {
    const leitura = normalizar(enderecoLido);

    if (!leitura) {
      setMensagem(
        "Informe ou leia o ID do endereço."
      );
      return;
    }

    if (
      leitura !== normalizar(endereco.codigo)
    ) {
      setEnderecoConfirmado(false);
      setProdutoConfirmado(false);

      setMensagem(
        `Endereço incorreto. O código informado não pertence ao endereço ${endereco.id}.`
      );

      return;
    }

    setEnderecoConfirmado(true);

    setMensagem(
      `Endereço ${endereco.id} confirmado.`
    );
  }

  function confirmarProduto() {
    if (!enderecoConfirmado) {
      setMensagem(
        "Confirme primeiro o endereço."
      );
      return;
    }

    const leitura = normalizar(produtoLido);

    if (!leitura) {
      setMensagem(
        "Informe ou leia o código do produto."
      );
      return;
    }

    if (
      leitura !== normalizar(item.codigoProduto)
    ) {
      setProdutoConfirmado(false);

      setMensagem(
        `Produto incorreto. Produto esperado: ${item.codigoProduto}.`
      );

      return;
    }

    setProdutoConfirmado(true);

    if (item.controlaSerie) {
      setMensagem(
        "Produto confirmado. Leia o número de série."
      );
    } else {
      setMensagem(
        "Produto confirmado. Confirme a separação."
      );
    }
  }

  function adicionarSerial() {
    if (!requisicao) return;
    if (
      !enderecoConfirmado ||
      !produtoConfirmado
    ) {
      setMensagem(
        "Confirme endereço e produto primeiro."
      );
      return;
    }

    const serial = normalizar(serialDigitado);

    if (!serial) {
      setMensagem(
        "Informe ou leia o número de série."
      );
      return;
    }

    if (listaSeriais.includes(serial)) {
      setMensagem(
        `Serial ${serial} já foi separado.`
      );
      return;
    }

    if (
      listaSeriais.length >= solicitado
    ) {
      setMensagem(
        "Quantidade solicitada já foi atendida."
      );
      return;
    }

    const novos = [
      ...listaSeriais,
      serial,
    ];

    setSeriais((anterior) => ({
      ...anterior,
      [item.id]: novos,
    }));

    setQuantidades((anterior) => ({
      ...anterior,
      [item.id]: novos.length,
    }));

    registrarSeparacaoItem(
      requisicao,
      item.id,
      novos.length,
      novos
    );

    setSerialDigitado("");

    if (
      novos.length >= solicitado
    ) {
      setMensagem(
        "Produto totalmente separado."
      );
    } else {
      setMensagem(
        `Serial separado. Faltam ${
          solicitado - novos.length
        }.`
      );
    }
  }

  function confirmarSeparacaoProduto() {
    if (!requisicao) return;
    if (!enderecoConfirmado) {
      setMensagem(
        "Confirme primeiro o endereço."
      );
      return;
    }

    if (!produtoConfirmado) {
      setMensagem(
        "Confirme primeiro o produto."
      );
      return;
    }

    if (item.controlaSerie) {
      if (
        listaSeriais.length <
        solicitado
      ) {
        setMensagem(
          `Ainda faltam ${
            solicitado -
            listaSeriais.length
          } serial(is).`
        );
        return;
      }

      registrarSeparacaoItem(
        requisicao,
        item.id,
        listaSeriais.length,
        listaSeriais
      );

      setMensagem(
        "Produto separado com sucesso."
      );

      return;
    }

    registrarSeparacaoItem(
      requisicao,
      item.id,
      solicitado,
      []
    );

    setQuantidades((anterior) => ({
      ...anterior,
      [item.id]: solicitado,
    }));

    setMensagem(
      `${solicitado} ${item.unidade} separado(s) com sucesso.`
    );
  }

  function irProximoProduto() {
    if (!requisicao) return;
    const estado = obterEstado(requisicao);

    const qtd =
      estado.itens[item.id]
        ?.quantidadeSeparada ?? 0;

    if (qtd < solicitado) {
      setMensagem(
        "Conclua o produto atual antes de avançar."
      );
      return;
    }

    const proximoPendente =
      requisicao.itens.findIndex(
        (produto, indice) =>
          indice > itemAtual &&
          (estado.itens[produto.id]
            ?.quantidadeSeparada ??
            0) <
            produto.solicitado
      );

    if (proximoPendente >= 0) {
      setItemAtual(proximoPendente);
      limparLeitura();
      return;
    }

    const qualquerPendente =
      requisicao.itens.findIndex(
        (produto) =>
          (estado.itens[produto.id]
            ?.quantidadeSeparada ??
            0) <
          produto.solicitado
      );

    if (qualquerPendente >= 0) {
      setItemAtual(qualquerPendente);
      limparLeitura();
      return;
    }

    setMensagem(
      "Todos os produtos foram separados. Finalize a separação."
    );
  }

  function pularProduto() {
    if (!requisicao) return;
    if (
      requisicao.itens.length <= 1
    ) {
      setMensagem(
        "Não existe outro produto para pular."
      );
      return;
    }

    const proximo =
      itemAtual >=
      requisicao.itens.length - 1
        ? 0
        : itemAtual + 1;

    setItemAtual(proximo);
    limparLeitura();
  }

  function cortarProduto() {
    setMensagem(
      "Corte registrado somente como simulação visual nesta etapa."
    );
  }

  function concluirSeparacao() {
    if (!requisicao) return;
    try {
      setFinalizando(true);

      finalizarSeparacao(
        requisicao
      );

      setMensagem(
        "Separação finalizada com sucesso."
      );

      window.setTimeout(() => {
        router.push(
          "/coletor/separacao"
        );
      }, 700);
    } catch (error) {
      setFinalizando(false);

      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar a separação."
      );
    }
  }

  const produtoConcluido =
    atendido >= solicitado;

  return (
    <div className={`collector-screen ${styles.screen} atel-v136-separacao`}>
      <div
        className={`collector-phone ${styles.phone}`}
        style={{
          background: "#f3f3f3",
          overflow: "hidden",
        }}
      >

        {/* HEADER */}
        <div className={`${styles.header} atel-v136-header`}
          style={{
            minHeight: 66,
            background: "#1686b0",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            padding: "0 18px",
            flex: "0 0 auto",
          }}
        >
          <button
            type="button"
            onClick={() =>
              router.push(
                "/coletor/separacao"
              )
            }
            style={{
              width: 44,
              height: 44,
              border: 0,
              background: "transparent",
              color: "#fff",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
              padding: 0,
              marginRight: 12,
            }}
          >
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>

          <div className="atel-v136-header-heading"><span className="atel-v136-header-eyebrow">OPERAÇÃO DO COLETOR</span><strong>Separação</strong></div>
<span className="atel-v136-header-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 11l2 2 4-4M9 17h6"/></svg></span>
        </div>

        {/* RESUMO DO PEDIDO */}
        {/* ATEL_V136_4_RESUMO_LIMPO: resumo compacto sem cards internos */}
        <section className={styles.cleanSummary} aria-label="Resumo da separação">
          <div className={styles.cleanSummaryMetrics}>
            <div className={styles.cleanSummaryMetric}>
              <span>Pedido</span>
              <strong>{requisicao.codigo.replace("REQ-", "")}</strong>
            </div>
            <div className={styles.cleanSummaryMetric}>
              <span>Itens</span>
              <strong>{itemAtual + 1}<small>/{requisicao.itens.length}</small></strong>
            </div>
            <div className={styles.cleanSummaryMetric}>
              <span>Separados</span>
              <strong>{itensSeparados}<small>/{requisicao.itens.length}</small></strong>
            </div>
          </div>
          <div className={styles.cleanSummaryClient}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" /><path d="M4.5 21v-1.5A6.5 6.5 0 0 1 11 13h2a6.5 6.5 0 0 1 6.5 6.5V21" />
            </svg>
            <span>Cliente</span>
            <strong>{requisicao.tecnico}</strong>
          </div>
        </section>
{/* CONTEÚDO */}
        <div className={`${styles.content} atel-v136-content`}
          style={{
            flex: 1,
            overflowY: "auto",
            padding:
              "14px 13px 110px",
          }}
        >
          {/* ATEL_E1_V157_PROGRESSO - painel somente leitura; nenhuma baixa ou confirmacao */}
          <AtelSeparacaoProgressoV157
            linhas={requisicao.itens.map((produto) => ({
              id: produto.id,
              codigo: produto.codigoProduto,
              descricao: produto.produto,
              solicitado: produto.solicitado,
              separado: quantidades[produto.id] ?? 0,
              unidade: produto.unidade,
            }))}
            itemAtualId={item.id}
            onIrPendente={(indice) => {
              if (indice < 0 || indice >= requisicao.itens.length) return;
              if (indice !== itemAtual) {
                setItemAtual(indice);
                limparLeitura();
              }
              document.getElementById("atel-v157-leitura")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />

          {/* =========================
              ENDEREÇO
          ========================= */}

          <section className={`${styles.card} atel-v136-address`} style={cardStyle} id="atel-v157-leitura">
            <div style={cardTitleRowStyle}>
              <div className="atel-v136-card-heading"><strong>Informações de Endereço</strong><small>Valide a localização antes de separar o produto</small></div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                }}
              >
                <button type="button" aria-label="Focar bipagem do endereço" title="Bipar endereço" onClick={() => document.getElementById("atel-v136-address-code")?.focus()} style={roundButtonStyle}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>
                </button>

                <button type="button" aria-label="Limpar leitura do endereço" title="Limpar leitura" onClick={() => { setEnderecoLido(""); setEnderecoConfirmado(false); setProdutoConfirmado(false); }} style={roundButtonStyle}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a8 8 0 0 1 14-5l2 2"/><path d="M20 3v5h-5"/><path d="M20 13a8 8 0 0 1-14 5l-2-2"/><path d="M4 21v-5h5"/></svg>
                </button>
              </div>
            </div>

            {/* R / P / A / A */}

            <div className={`${styles.addressGrid} atel-v136-address-grid`}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(4, 1fr)",
                gap: 18,
                marginTop: 10,
              }}
            >
              <EnderecoBox
                letra="R"
                valor={endereco.rua}
                legenda="Rua"
                preenchido
              />

              <EnderecoBox
                letra="P"
                valor={endereco.predio}
                legenda="Prédio"
              />

              <EnderecoBox
                letra="A"
                valor={endereco.andar}
                legenda="Andar"
                preenchido
              />

              <EnderecoBox
                letra="A"
                valor={endereco.apto}
                legenda="Apto"
              />
            </div>

            {/* LEITURA DO ID/CÓDIGO INTERNO */}

            <div className="atel-v136-scan" style={{ display:"grid", gridTemplateColumns:"1fr 118px",
                marginTop: 14,
                border:
                  "1px solid #1686b0",
                borderRadius: 5,
                overflow: "hidden",
                minHeight: 52,
              }}
            >
              <div
                style={{
                  background: "#e9f6fa",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 16px",
                }}
              >
                <span className="atel-v136-barcode" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 5v14M6 5v14M10 5v14M13 5v14M17 5v14M20 5v14"/></svg></span>

                <input id="atel-v136-address-code" aria-label="Bipar codigo do endereco" value={enderecoLido}
                  onChange={(e) => {
                    setEnderecoLido(
                      e.target.value
                    );

                    setEnderecoConfirmado(
                      false
                    );

                    setProdutoConfirmado(
                      false
                    );
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter"
                    ) {
                      confirmarEndereco();
                    }
                  }}
                  placeholder="ID do endereço"
                  autoComplete="off"
                  style={{
                    width: "100%",
                    border: 0,
                    outline: 0,
                    background:
                      "transparent",
                    fontSize: 17,
                    color: "#444",
                  }}
                />
              </div>

              <button
                type="button"
                onClick={
                  confirmarEndereco
                }
                style={{
                  border: 0,
                  background: "#1686b0",
                  color: "#fff",
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>
            </div>

            {/*
              IMPORTANTE:
              agora simula o CÓDIGO INTERNO,
              não o endereço R/P/A/A.
            */}

            <button
              type="button"
              onClick={() => {
                setEnderecoLido(
                  endereco.codigo
                );

                setEnderecoConfirmado(
                  false
                );

                setProdutoConfirmado(
                  false
                );
              }}
              style={simularStyle}
            >
              Simular leitura:{" "}
              {endereco.codigo}
            </button>

            {enderecoConfirmado && (
  <div className="atel-v136-address-success" role="status">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>
    <div><strong>Endereço validado · {endereco.codigo}</strong><span>Localização {endereco.id}</span></div>
  </div>
)}
          </section>

          {/* =========================
              PRODUTO
          ========================= */}

          <section className={`${styles.card} atel-v136-product`} style={{...cardStyle, marginTop:14}}>
            <div style={cardTitleRowStyle}>
              <div className="atel-v136-card-heading"><strong>Informações do produto</strong><small>Identificação e conferência do item</small></div>

              <button
                type="button"
                style={roundButtonStyle}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>
              </button>
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 19,
                fontWeight: 500,
                color: "#111",
              }}
            >
              {item.produto}
            </div>

            <div
              style={{
                marginTop: 3,
                color: "#858585",
                fontSize: 16,
              }}
            >
              Cód:{" "}
              {item.codigoProduto}
            </div>

            {/* LEITURA PRODUTO */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 118px",
                marginTop: 7,
                border: "1px solid #ccc",
                borderRadius: 5,
                overflow: "hidden",
                minHeight: 52,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 13,
                  padding: "0 16px",
                  background: "#fff",
                }}
              >
                <span
                  style={{
                    fontSize: 21,
                    color: "#929292",
                  }}
                >
                  ◇
                </span>

                <input
                  value={produtoLido}
                  onChange={(e) => {
                    setProdutoLido(
                      e.target.value
                    );

                    setProdutoConfirmado(
                      false
                    );
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter"
                    ) {
                      confirmarProduto();
                    }
                  }}
                  placeholder="Código do produto"
                  disabled={
                    !enderecoConfirmado
                  }
                  autoComplete="off"
                  style={{
                    width: "100%",
                    border: 0,
                    outline: 0,
                    background:
                      "transparent",
                    fontSize: 16,
                    color: "#444",
                    opacity:
                      enderecoConfirmado
                        ? 1
                        : 0.55,
                  }}
                />
              </div>

              <button
                type="button"
                onClick={
                  confirmarProduto
                }
                disabled={
                  !enderecoConfirmado
                }
                style={{
                  border: 0,
                  background: "#1686b0",
                  color: "#fff",
                  fontSize: 21,
                  cursor:
                    enderecoConfirmado
                      ? "pointer"
                      : "default",
                  opacity:
                    enderecoConfirmado
                      ? 1
                      : 0.5,
                }}
              >
                ✓
              </button>
            </div>

            <button
              type="button"
              disabled={
                !enderecoConfirmado
              }
              onClick={() => {
                setProdutoLido(
                  item.codigoProduto
                );

                setProdutoConfirmado(
                  false
                );
              }}
              style={{
                ...simularStyle,
                opacity:
                  enderecoConfirmado
                    ? 1
                    : 0.45,
              }}
            >
              Simular leitura:{" "}
              {item.codigoProduto}
            </button>

            {/* QUANTIDADES */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, 1fr)",
                gap: 28,
                marginTop: 14,
              }}
            >
              <QuantidadeBox
                titulo="Estoque"
                valor={estoque}
              />

              <QuantidadeBox
                titulo="Solicitado"
                valor={solicitado}
              />

              <QuantidadeBox
                titulo="Atendido"
                valor={atendido}
              />
            </div>

            {/* SERIAL */}

            {produtoConfirmado &&
              item.controlaSerie && (
                <div
                  style={{
                    marginTop: 16,
                    borderTop:
                      "1px solid #e3e3e3",
                    paddingTop: 14,
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      marginBottom: 7,
                      color: "#777",
                      fontSize: 15,
                    }}
                  >
                    Número de série
                  </strong>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "1fr 70px",
                      border:
                        "1px solid #ccc",
                      borderRadius: 5,
                      overflow: "hidden",
                      minHeight: 48,
                    }}
                  >
                    <input
                      value={
                        serialDigitado
                      }
                      onChange={(e) =>
                        setSerialDigitado(
                          e.target.value
                        )
                      }
                      onKeyDown={(e) => {
                        if (
                          e.key ===
                          "Enter"
                        ) {
                          adicionarSerial();
                        }
                      }}
                      placeholder="Leia o número de série"
                      autoComplete="off"
                      style={{
                        border: 0,
                        outline: 0,
                        padding:
                          "0 13px",
                        fontSize: 15,
                      }}
                    />

                    <button
                      type="button"
                      onClick={
                        adicionarSerial
                      }
                      style={{
                        border: 0,
                        background:
                          "#1686b0",
                        color: "#fff",
                        fontSize: 24,
                        cursor: "pointer",
                      }}
                    >
                      +
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      color: "#666",
                    }}
                  >
                    Seriais:{" "}
                    <strong>
                      {
                        listaSeriais.length
                      }
                      /{solicitado}
                    </strong>
                  </div>

                  {listaSeriais.map(
                    (serial) => (
                      <div
                        key={serial}
                        style={{
                          marginTop: 5,
                          padding:
                            "6px 9px",
                          background:
                            "#f5f5f5",
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        ✓ {serial}
                      </div>
                    )
                  )}

                  {listaSeriais.length <
                    solicitado && (
                    <button
                      type="button"
                      onClick={() =>
                        setSerialDigitado(
                          `SN-${requisicao.id}-${item.id}-${String(
                            listaSeriais.length +
                              1
                          ).padStart(
                            3,
                            "0"
                          )}`
                        )
                      }
                      style={
                        simularStyle
                      }
                    >
                      Simular serial
                    </button>
                  )}
                </div>
              )}

            {/* CONFIRMAR */}

            {produtoConfirmado && (
              <button
                type="button"
                onClick={
                  confirmarSeparacaoProduto
                }
                style={{
                  width: "100%",
                  minHeight: 45,
                  marginTop: 15,
                  border: 0,
                  borderRadius: 4,
                  background: "#1686b0",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {item.controlaSerie
                  ? "CONFIRMAR SERIAIS"
                  : `CONFIRMAR ${solicitado} ${item.unidade}`}
              </button>
            )}
          </section>

          {/* MENSAGEM */}

          {mensagem && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "#fff",
                border:
                  "1px solid #d8d8d8",
                borderRadius: 6,
                fontSize: 12,
                color: "#555",
              }}
            >
              {mensagem}
            </div>
          )}

          {/* PRÓXIMO */}

          {produtoConcluido &&
            !todosSeparados && (
              <button
                type="button"
                onClick={
                  irProximoProduto
                }
                style={{
                  width: "100%",
                  minHeight: 46,
                  marginTop: 12,
                  border: 0,
                  borderRadius: 5,
                  background: "#1686b0",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                PRÓXIMO PRODUTO ›
              </button>
            )}

          {/* FINALIZAR */}

          {todosSeparados && (
            <button
              type="button"
              disabled={finalizando}
              onClick={
                concluirSeparacao
              }
              style={{
                width: "100%",
                minHeight: 48,
                marginTop: 12,
                border: 0,
                borderRadius: 5,
                background: "#1686b0",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {finalizando
                ? "FINALIZANDO..."
                : "FINALIZAR SEPARAÇÃO"}
            </button>
          )}
        </div>

        {/* RODAPÉ */}

        <div className={styles.footer}
          style={{
            height: 72,
            flex: "0 0 72px",
            display: "grid",
            gridTemplateColumns:
              "1fr 72px 1fr",
            alignItems: "center",
            padding: "0 14px",
            background: "#f3f3f3",
          }}
        >
          <button
            type="button"
            onClick={
              cortarProduto
            }
            style={{
              height: 48,
              border: 0,
              borderRadius:
                "6px 0 0 6px",
              background: "#e82429",
              color: "#fff",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M7 7l1 13h8l1-13M9 7V4h6v3"/></svg>
            Cortar
          </button>

          <div
            style={{
              width: 72,
              height: 72,
              marginTop: -2,
              borderRadius: "50%",
              background: "#fff",
              display: "grid",
              placeItems: "center",
              color: "#1686b0",
              fontSize: 31,
              position: "relative",
              zIndex: 2,
            }}
          >
            <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
          </div>

          <button
            type="button"
            onClick={
              pularProduto
            }
            style={{
              height: 48,
              border: 0,
              borderRadius:
                "0 6px 6px 0",
              background: "#1686b0",
              color: "#fff",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            Pular
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7"/></svg>
          </button>
        </div>


      </div>
    </div>
  );
}

function EnderecoBox({ letra, valor, preenchido = false, legenda }: {
  letra: string; valor: string; preenchido?: boolean; legenda?: string;
}) {
  return (
    <div className={"atel-v136-tile" + (preenchido ? " atel-v136-tile-primary" : "")}>
      <span className="atel-v136-tile-letter">{letra}</span>
      <strong>{valor}</strong>
      <small>{legenda ?? "Posição"}</small>
    </div>
  );
}
function QuantidadeBox({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <div>
      <strong
        style={{
          display: "block",
          marginBottom: 5,
          color: "#818181",
          fontSize: 16,
        }}
      >
        {titulo}
      </strong>

      <div
        style={{
          height: 39,
          border:
            "1px solid #c5c5c5",
          borderRadius: 5,
          background: "#fff",
          display: "grid",
          placeItems: "center",
          color: "#222",
          fontSize: 18,
        }}
      >
        {valor}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1.5px solid #1686b0",
  borderRadius: 14,
  padding: "18px 17px 20px",
};

const cardTitleRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const cardTitleStyle: React.CSSProperties = {
  color: "#1281ad",
  fontSize: 19,
  fontWeight: 700,
};

const roundButtonStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  flex: "0 0 46px",
  border: 0,
  borderRadius: "50%",
  background: "#1686b0",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontSize: 23,
  cursor: "pointer",
};

const simularStyle: React.CSSProperties = {
  display: "block",
  marginTop: 7,
  padding: 0,
  border: 0,
  background: "transparent",
  color: "#087da7",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
};

const successStyle: React.CSSProperties = {
  marginTop: 8,
  padding: "7px 9px",
  borderRadius: 5,
  background: "#eaf8f0",
  color: "#087647",
  fontSize: 11,
  fontWeight: 700,
};

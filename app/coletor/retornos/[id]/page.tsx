// ATEL E1 V128.2 - icone SVG do retorno
"use client";
import "./atel-v138-retorno-premium.css";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  DestinoItemRetorno,
  finalizarRecebimentoRetorno,
  iniciarRecebimentoRetorno,
  obterRetorno,
  ouvirRetornos,
  registrarConferenciaItemRetorno,
  registrarLeituraRetorno,
  RetornoDevolucao,
} from "@/lib/retornosStore";

/* =========================================================
   TIPOS
========================================================= */

type Modal =
  | RetornoDevolucao["itens"][number]
  | null;

type DestinoSelecionado =
  | DestinoItemRetorno
  | null;

/* =========================================================
   PAGE
========================================================= */

export default function Page() {
  const params = useParams();
  const router = useRouter();

  const id = Number(
    Array.isArray(params.id)
      ? params.id[0]
      : params.id
  );

  const [retorno, setRetorno] =
    useState<RetornoDevolucao | null>(null);

  const [codigo, setCodigo] =
    useState("");

  const [mensagem, setMensagem] =
    useState("");

  const [modal, setModal] =
    useState<Modal>(null);

  /*
   * IMPORTANTE:
   * Não existe destino padrão.
   *
   * O operador precisa escolher explicitamente:
   * DISPONIVEL
   * QUARENTENA
   * DIVERGENCIA
   */
  const [destino, setDestino] =
    useState<DestinoSelecionado>(null);

  const [quantidade, setQuantidade] =
    useState("");

  const [seriais, setSeriais] =
    useState("");

  const [observacao, setObservacao] =
    useState("");

  /* =========================================================
     ATUALIZAÇÃO
  ========================================================= */

  function atualizar() {
    setRetorno(
      obterRetorno(id)
    );
  }

  useEffect(() => {
    try {
      iniciarRecebimentoRetorno(id);
    } catch {
      // Pode já estar iniciado.
    }

    atualizar();

    return ouvirRetornos(
      atualizar
    );
  }, [id]);

  /* =========================================================
     CONFERÊNCIAS
  ========================================================= */

  const conferencias =
    retorno?.recebimentoCD
      ?.itensConferidos ?? {};

  const lido = Boolean(
    retorno?.recebimentoCD
      ?.codigoLido
  );

  /* =========================================================
     RESUMO
  ========================================================= */

  const resumo =
    useMemo(() => {
      const valores =
        Object.values(
          conferencias
        );

      return {
        avaliados:
          valores.length,

        disponivel:
          valores.reduce(
            (total, item) =>
              total +
              Number(
                item.quantidadeDisponivel ??
                  0
              ),
            0
          ),

        quarentena:
          valores.reduce(
            (total, item) =>
              total +
              Number(
                item.quantidadeQuarentena ??
                  0
              ),
            0
          ),

        divergencia:
          valores.reduce(
            (total, item) =>
              total +
              Number(
                item.quantidadeDivergente ??
                  0
              ),
            0
          ),
      };
    }, [conferencias]);

  /* =========================================================
     RETORNO NÃO ENCONTRADO
  ========================================================= */

  if (!retorno) {
    return (
      <div className="collector-screen">
        <div
          className="collector-phone"
          style={phone}
        >
          <div style={topBar} />

          <div style={header}>
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/coletor/retornos"
                )
              }
              style={backButton}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            </button>

            <strong style={headerTitle}>
              Recebimento de Retorno
            </strong>

            <div style={{ width: 32 }} />
          </div>

          <div style={emptyBox}>
            Retorno não encontrado.
          </div>

          <div style={bottomBar} />
        </div>
      </div>
    );
  }

  const retornoSeguro = retorno;

  /* =========================================================
     LEITURA
  ========================================================= */

  function validarCodigo(
    codigoParaValidar: string
  ) {
    try {
      registrarLeituraRetorno(
        id,
        codigoParaValidar
      );

      setMensagem(
        "✓ Retorno identificado. Conferência liberada."
      );

      setCodigo("");

      atualizar();
    } catch (erro) {
      setMensagem(
        erro instanceof Error
          ? erro.message
          : "Erro ao validar retornoSeguro."
      );
    }
  }

  function ler() {
    validarCodigo(codigo);
  }

  function simularLeitura() {
    setCodigo(
      retornoSeguro.codigo
    );

    validarCodigo(
      retornoSeguro.codigo
    );
  }

  /* =========================================================
     ABRIR ITEM
  ========================================================= */

  function abrirItem(
    item: RetornoDevolucao["itens"][number]
  ) {
    const conferencia =
      conferencias[item.id];

    setModal(item);

    /*
     * CORREÇÃO IMPORTANTE:
     *
     * Se o item nunca foi conferido:
     * destino = null.
     *
     * Assim MATERIAL OK não fica selecionado
     * automaticamente.
     *
     * Se já foi conferido, carregamos o destino
     * salvo anteriormente.
     */
    setDestino(
      conferencia?.destino ??
        null
    );

    setQuantidade(
      String(
        conferencia
          ?.quantidadeRecebida ??
          item.quantidade
      )
    );

    setSeriais(
      (
        conferencia
          ?.seriaisRecebidos ??
        item.seriais ??
        []
      ).join("\n")
    );

    setObservacao(
      conferencia
        ?.observacao ??
        ""
    );

    setMensagem("");
  }

  function fecharModal() {
    setModal(null);

    setDestino(null);

    setQuantidade("");

    setSeriais("");

    setObservacao("");
  }

  /* =========================================================
     SALVAR CONFERÊNCIA
  ========================================================= */

  function salvarItem() {
    if (!modal) {
      return;
    }

    if (!destino) {
      setMensagem(
        "Selecione MATERIAL OK, AVARIADO ou DIVERGÊNCIA."
      );

      return;
    }

    const quantidadeNumerica =
      Number(quantidade);

    if (
      !Number.isFinite(
        quantidadeNumerica
      ) ||
      quantidadeNumerica < 0
    ) {
      setMensagem(
        "Informe uma quantidade recebida válida."
      );

      return;
    }

    if (
      quantidadeNumerica >
      Number(modal.quantidade)
    ) {
      setMensagem(
        `A quantidade recebida não pode ser maior que ${modal.quantidade} ${modal.unidade}.`
      );

      return;
    }

    /*
     * Para material avariado,
     * exigimos uma observação.
     */
    if (
      destino === "QUARENTENA" &&
      !observacao.trim()
    ) {
      setMensagem(
        "Informe a avaria encontrada antes de enviar o material para QUARENTENA."
      );

      return;
    }

    /*
     * Para divergência,
     * também exigimos explicação.
     */
    if (
      destino === "DIVERGENCIA" &&
      !observacao.trim()
    ) {
      setMensagem(
        "Informe a divergência encontrada."
      );

      return;
    }

    try {
      const listaSeriais =
        seriais
          .split(/\r?\n|,/)
          .map(
            (serial) =>
              serial.trim()
          )
          .filter(Boolean);

      registrarConferenciaItemRetorno(
        id,
        modal.id,
        {
          destino,

          quantidadeRecebida:
            quantidadeNumerica,

          seriaisRecebidos:
            listaSeriais,

          observacao:
            observacao.trim() ||
            undefined,
        }
      );

      const mensagemDestino =
        destino === "DISPONIVEL"
          ? "✓ Material destinado ao ESTOQUE DISPONÍVEL."
          : destino === "QUARENTENA"
          ? "⚠ Material destinado à QUARENTENA."
          : "✕ DIVERGÊNCIA registrada. Material não entrará no estoque.";

      fecharModal();

      setMensagem(
        mensagemDestino
      );

      atualizar();
    } catch (erro) {
      setMensagem(
        erro instanceof Error
          ? erro.message
          : "Erro ao conferir item."
      );
    }
  }

  /* =========================================================
     FINALIZAR
  ========================================================= */

  function finalizar() {
    try {
      finalizarRecebimentoRetorno(
        id
      );

      setMensagem(
        "✓ Retorno finalizado com sucesso."
      );

      atualizar();

      setTimeout(() => {
        router.push(
          "/coletor/retornos"
        );
      }, 700);
    } catch (erro) {
      setMensagem(
        erro instanceof Error
          ? erro.message
          : "Erro ao finalizar retornoSeguro."
      );
    }
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="collector-screen atel-v138-ret-detail">
      <div
        className="collector-phone"
        style={phone}
      >
        {/* =============================================
            BARRA SUPERIOR
        ============================================= */}

        <div style={topBar} />

        {/* =============================================
            HEADER
        ============================================= */}

        <div className="atel-v138-header" style={header}>
          <button
            type="button"
            onClick={() =>
              router.push(
                "/coletor/retornos"
              )
            }
            style={backButton}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          </button>

          <strong style={headerTitle}>
            Recebimento de Retorno
          </strong>

          <span className="atel-v138-header-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg></span>
        </div>

        {/* =============================================
            CONTEÚDO
        ============================================= */}

        <div className="atel-v138-body" style={content}>
          {/* ===========================================
              DADOS DO RETORNO
          =========================================== */}

          <div className="atel-v138-document" style={returnCard}>
            <div style={returnHeader}>
              <div>
                <div className="atel-v138-document-code" style={returnCode}>
                  {retornoSeguro.codigo}
                </div>

                <div style={returnType}>
                  {formatarTipo(
                    retornoSeguro.tipo
                  )}
                </div>
              </div>

              <span style={statusPill}>
                {formatarStatus(
                  retornoSeguro.status
                )}
              </span>
            </div>

            <div style={divider} />

            <InfoRow
              label="Técnico"
              value={`${retornoSeguro.tecnico} • ${retornoSeguro.codigoTecnico}`}
            />

            <InfoRow
              label="Documento"
              value={
                retornoSeguro.documentoOrigem
              }
            />

            <InfoRow
              label="Base"
              value={retornoSeguro.base}
            />

            <InfoRow
              label="Destino"
              value={
                retornoSeguro.destinoFisico
              }
            />

            <div className="atel-v138-document-stats" style={miniSummary}>
              <div>
                <span style={miniLabel}>
                  SKUs
                </span>

                <strong style={miniValue}>
                  {retornoSeguro.itens.length}
                </strong>
              </div>

              <div>
                <span style={miniLabel}>
                  QTD. RETORNO
                </span>

                <strong style={miniValue}>
                  {retornoSeguro.itens.reduce(
                    (total, item) =>
                      total +
                      Number(
                        item.quantidade ??
                          0
                      ),
                    0
                  )}
                </strong>
              </div>
            </div>
          </div>

          {/* ===========================================
              LEITURA
          =========================================== */}

          {!lido && (
            <div className="atel-v138-panel" style={scanCard}>
              <div style={sectionTitle}>
                LEITURA DO RETORNO
              </div>

              <div style={sectionDescription}>
                Leia o código do retornoSeguro ou utilize a simulação abaixo para testar a operação.
              </div>

              <div style={scanLabel}>
                CÓDIGO DO RETORNO
              </div>

              <input
                value={codigo}
                onChange={(event) =>
                  setCodigo(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    ler();
                  }
                }}
                placeholder="Leia ou digite o código"
                autoFocus
                style={input}
              />

              <button
                type="button"
                onClick={
                  simularLeitura
                }
                style={
                  simulateButton
                }
              >
                <span
                  style={{
                    fontSize: 18,
                  }}
                >
                  ▣
                </span>

                <span>
                  SIMULAR LEITURA
                </span>

                <strong>
                  {retornoSeguro.codigo}
                </strong>
              </button>

              <button
                type="button"
                onClick={ler}
                style={primaryButton}
              >
                VALIDAR RETORNO
              </button>
            </div>
          )}

          {/* ===========================================
              MENSAGEM
          =========================================== */}

          {mensagem && (
            <div
              style={{
                ...messageBox,

                background:
                  mensagem.startsWith(
                    "✓"
                  )
                    ? "#e8f7ef"
                    : mensagem.startsWith(
                        "⚠"
                      )
                    ? "#fff8e1"
                    : "#fff0ef",

                borderColor:
                  mensagem.startsWith(
                    "✓"
                  )
                    ? "#b7dfc9"
                    : mensagem.startsWith(
                        "⚠"
                      )
                    ? "#f2cc60"
                    : "#f5c2bd",

                color:
                  mensagem.startsWith(
                    "✓"
                  )
                    ? "#067647"
                    : mensagem.startsWith(
                        "⚠"
                      )
                    ? "#946200"
                    : "#b42318",
              }}
            >
              {mensagem}
            </div>
          )}

          {/* ===========================================
              CONTEÚDO APÓS LEITURA
          =========================================== */}

          {lido && (
            <>
              {/* =======================================
                  LEITURA CONFIRMADA
              ======================================= */}

              <div style={readSuccess}>
                <div style={successIcon}>
                  ✓
                </div>

                <div>
                  <strong
                    style={{
                      display: "block",
                      color: "#067647",
                      fontSize: 12,
                    }}
                  >
                    RETORNO IDENTIFICADO
                  </strong>

                  <span
                    style={{
                      display: "block",
                      marginTop: 2,
                      color: "#667085",
                      fontSize: 9,
                    }}
                  >
                    {retornoSeguro.codigo} liberado para conferência
                  </span>
                </div>
              </div>

              {/* =======================================
                  TÍTULO
              ======================================= */}

              <div style={materialsHeader}>
                <div>
                  <div style={sectionTitle}>
                    CONTEÚDO PARA CONFERÊNCIA
                  </div>

                  <div
                    style={{
                      fontSize: 9,
                      color: "#667085",
                      marginTop: 2,
                    }}
                  >
                    Confira quantidade, serial e condição física.
                  </div>
                </div>

                <span style={countBadge}>
                  {resumo.avaliados}/
                  {retornoSeguro.itens.length}
                </span>
              </div>

              {/* =======================================
                  ITENS
              ======================================= */}

              {retornoSeguro.itens.map(
                (itemRetorno) => {
                  const conferencia =
                    conferencias[
                      itemRetorno.id
                    ];

                  return (
                    <button
                      type="button"
                      key={
                        itemRetorno.id
                      }
                      onClick={() =>
                        abrirItem(
                          itemRetorno
                        )
                      }
                      style={itemCard}
                    >
                      <div style={itemTop}>
                        <div>
                          <div className="atel-v138-item-code" style={productCode}>
                            {
                              itemRetorno.codigoProduto
                            }
                          </div>

                          <div className="atel-v138-item-name" style={productName}>
                            {
                              itemRetorno.produto
                            }
                          </div>
                        </div>

                        <ItemStatus
                          conferencia={
                            conferencia
                          }
                        />
                      </div>

                      <div style={itemGrid}>
                        <ItemInfo
                          label="RETORNO"
                          value={`${itemRetorno.quantidade} ${itemRetorno.unidade}`}
                        />

                        <ItemInfo
                          label="MOTIVO"
                          value={formatarTexto(
                            itemRetorno.motivo ??
                              "-"
                          )}
                        />
                      </div>

                      {itemRetorno
                        .seriais?.length >
                        0 && (
                        <div style={serialBox}>
                          <span style={serialLabel}>
                            SERIAIS DO RETORNO
                          </span>

                          <strong style={serialValue}>
                            {itemRetorno.seriais.join(
                              ", "
                            )}
                          </strong>
                        </div>
                      )}

                      {conferencia && (
                        <div
                          style={{
                            ...conferenceResult,

                            background:
                              conferencia.destino ===
                              "DISPONIVEL"
                                ? "#eaf8f0"
                                : conferencia.destino ===
                                  "QUARENTENA"
                                ? "#fff6dc"
                                : "#fff0ef",
                          }}
                        >
                          <span>
                            Recebido{" "}
                            <b>
                              {
                                conferencia.quantidadeRecebida
                              }
                            </b>
                          </span>

                          <span>
                            Disponível{" "}
                            <b>
                              {
                                conferencia.quantidadeDisponivel
                              }
                            </b>
                          </span>

                          <span>
                            Quarentena{" "}
                            <b>
                              {
                                conferencia.quantidadeQuarentena
                              }
                            </b>
                          </span>

                          <span>
                            Divergência{" "}
                            <b>
                              {
                                conferencia.quantidadeDivergente
                              }
                            </b>
                          </span>
                        </div>
                      )}

                      <div style={tapHint}>
                        TOQUE PARA CONFERIR
                        <span>›</span>
                      </div>
                    </button>
                  );
                }
              )}

              {/* =======================================
                  RESUMO
              ======================================= */}

              <div className="atel-v138-summary" style={summaryCard}>
                <div style={sectionTitle}>
                  RESUMO DO RECEBIMENTO
                </div>

                <div className="atel-v138-summary-grid" style={summaryGrid}>
                  <SummaryItem
                    label="AVALIADOS"
                    value={`${resumo.avaliados}/${retornoSeguro.itens.length}`}
                  />

                  <SummaryItem
                    label="DISPONÍVEL"
                    value={
                      resumo.disponivel
                    }
                  />

                  <SummaryItem
                    label="QUARENTENA"
                    value={
                      resumo.quarentena
                    }
                  />

                  <SummaryItem
                    label="DIVERGÊNCIA"
                    value={
                      resumo.divergencia
                    }
                  />
                </div>
              </div>

              {/* =======================================
                  FINALIZAR
              ======================================= */}

              <button
                type="button"
                onClick={finalizar}
                disabled={
                  resumo.avaliados !==
                  retornoSeguro.itens.length
                }
                style={{
                  ...finishButton,

                  opacity:
                    resumo.avaliados ===
                    retornoSeguro.itens.length
                      ? 1
                      : 0.42,

                  cursor:
                    resumo.avaliados ===
                    retornoSeguro.itens.length
                      ? "pointer"
                      : "not-allowed",
                }}
              >
                FINALIZAR RECEBIMENTO
              </button>
            </>
          )}
        </div>

        {/* =============================================
            BARRA INFERIOR
        ============================================= */}

        <div style={bottomBar} />

        {/* =============================================
            MODAL
        ============================================= */}

        {modal && (
          <div style={overlay}>
            <div className="atel-v138-sheet" style={sheet}>
              <div style={sheetHandle} />

              <div style={modalHeader}>
                <div>
                  <div style={modalCode}>
                    {modal.codigoProduto}
                  </div>

                  <div style={modalProduct}>
                    {modal.produto}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fecharModal}
                  style={closeButton}
                >
                  ×
                </button>
              </div>

              {/* =======================================
                  QUANTIDADE ESPERADA
              ======================================= */}

              <div style={expectedBox}>
                <span>
                  QUANTIDADE ESPERADA
                </span>

                <strong>
                  {modal.quantidade}{" "}
                  {modal.unidade}
                </strong>
              </div>

              {/* =======================================
                  QUANTIDADE RECEBIDA
              ======================================= */}

              <label style={label}>
                QUANTIDADE RECEBIDA
              </label>

              <input
                type="number"
                min={0}
                max={modal.quantidade}
                value={quantidade}
                onChange={(event) =>
                  setQuantidade(
                    event.target.value
                  )
                }
                style={input}
              />

              {/* =======================================
                  DESTINO
              ======================================= */}

              <label style={label}>
                CONDIÇÃO / DESTINO DO MATERIAL
              </label>

              {!destino && (
                <div style={choiceWarning}>
                  SELECIONE O DESTINO DO MATERIAL
                </div>
              )}

              <Choice
                active={
                  destino ===
                  "DISPONIVEL"
                }
                icon="✓"
                title="MATERIAL OK"
                description="Material apto para retornar ao estoque disponível."
                onClick={() =>
                  setDestino(
                    "DISPONIVEL"
                  )
                }
              />

              <Choice
                active={
                  destino ===
                  "QUARENTENA"
                }
                icon="⚠"
                title="AVARIADO"
                description="Material será recebido em QUARENTENA e não ficará disponível."
                onClick={() =>
                  setDestino(
                    "QUARENTENA"
                  )
                }
              />

              <Choice
                active={
                  destino ===
                  "DIVERGENCIA"
                }
                icon="✕"
                title="DIVERGÊNCIA"
                description="Não movimenta estoque. Será criada uma pendência para análise."
                onClick={() =>
                  setDestino(
                    "DIVERGENCIA"
                  )
                }
              />

              {/* =======================================
                  SERIAIS
              ======================================= */}

              {(
                modal.seriais.length >
                  0 ||
                seriais.length > 0
              ) && (
                <>
                  <label style={label}>
                    SERIAIS RECEBIDOS
                  </label>

                  {modal.seriais.length >
                    0 && (
                    <div style={expectedSerial}>
                      <span>
                        ESPERADO
                      </span>

                      <strong>
                        {modal.seriais.join(
                          ", "
                        )}
                      </strong>
                    </div>
                  )}

                  <textarea
                    value={seriais}
                    onChange={(event) =>
                      setSeriais(
                        event.target.value
                      )
                    }
                    placeholder="Um serial por linha"
                    style={textarea}
                  />
                </>
              )}

              {/* =======================================
                  OBSERVAÇÃO
              ======================================= */}

              <label style={label}>
                OBSERVAÇÃO
                {(destino ===
                  "QUARENTENA" ||
                  destino ===
                    "DIVERGENCIA") &&
                  " *"}
              </label>

              <textarea
                value={observacao}
                onChange={(event) =>
                  setObservacao(
                    event.target.value
                  )
                }
                placeholder={
                  destino ===
                  "QUARENTENA"
                    ? "Descreva a avaria encontrada..."
                    : destino ===
                      "DIVERGENCIA"
                    ? "Descreva a divergência encontrada..."
                    : "Informe uma observação, se necessário"
                }
                style={textarea}
              />

              {/* =======================================
                  PREVISÃO DO DESTINO
              ======================================= */}

              <div style={destinationPreview}>
                {!destino && (
                  <>
                    <strong>
                      DESTINO NÃO DEFINIDO
                    </strong>

                    <span>
                      Escolha uma das opções acima.
                    </span>
                  </>
                )}

                {destino ===
                  "DISPONIVEL" && (
                  <>
                    <strong
                      style={{
                        color:
                          "#067647",
                      }}
                    >
                      ✓ ESTOQUE DISPONÍVEL
                    </strong>

                    <span>
                      {quantidade || 0}{" "}
                      {modal.unidade} entrarão no estoque disponível do CD.
                    </span>
                  </>
                )}

                {destino ===
                  "QUARENTENA" && (
                  <>
                    <strong
                      style={{
                        color:
                          "#946200",
                      }}
                    >
                      ⚠ QUARENTENA
                    </strong>

                    <span>
                      {quantidade || 0}{" "}
                      {modal.unidade} entrarão exclusivamente em quarentena.
                    </span>
                  </>
                )}

                {destino ===
                  "DIVERGENCIA" && (
                  <>
                    <strong
                      style={{
                        color:
                          "#b42318",
                      }}
                    >
                      ✕ PENDÊNCIA
                    </strong>

                    <span>
                      Nenhuma quantidade entrará em estoque até a divergência ser resolvida.
                    </span>
                  </>
                )}
              </div>

              {/* =======================================
                  CONFIRMAR
              ======================================= */}

              <button
                type="button"
                onClick={salvarItem}
                disabled={!destino}
                style={{
                  ...primaryButton,

                  opacity:
                    destino
                      ? 1
                      : 0.45,

                  cursor:
                    destino
                      ? "pointer"
                      : "not-allowed",
                }}
              >
                {destino ===
                "QUARENTENA"
                  ? "CONFIRMAR E ENVIAR À QUARENTENA"
                  : destino ===
                    "DIVERGENCIA"
                  ? "REGISTRAR DIVERGÊNCIA"
                  : destino ===
                    "DISPONIVEL"
                  ? "CONFIRMAR MATERIAL OK"
                  : "SELECIONE O DESTINO"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   COMPONENTES
========================================================= */

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={infoRow}>
      <span style={infoLabel}>
        {label}
      </span>

      <strong style={infoValue}>
        {value}
      </strong>
    </div>
  );
}

function ItemInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <span style={itemInfoLabel}>
        {label}
      </span>

      <strong style={itemInfoValue}>
        {value}
      </strong>
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="atel-v138-summary-stat" style={summaryItem}>
      <span style={summaryLabel}>
        {label}
      </span>

      <strong style={summaryValue}>
        {value}
      </strong>
    </div>
  );
}

function ItemStatus({
  conferencia,
}: {
  conferencia:
    | {
        destino:
          DestinoItemRetorno;
      }
    | undefined;
}) {
  if (!conferencia) {
    return (
      <span style={pendingBadge}>
        PENDENTE
      </span>
    );
  }

  if (
    conferencia.destino ===
    "DISPONIVEL"
  ) {
    return (
      <span style={availableBadge}>
        ✓ DISPONÍVEL
      </span>
    );
  }

  if (
    conferencia.destino ===
    "QUARENTENA"
  ) {
    return (
      <span style={quarantineBadge}>
        ⚠ QUARENTENA
      </span>
    );
  }

  return (
    <span style={divergenceBadge}>
      ✕ DIVERGÊNCIA
    </span>
  );
}

function Choice({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="atel-v138-choice" style={{...choiceButton,

        border: active
          ? "2px solid #1596bc"
          : "1px solid #d0d8dd",

        background: active
          ? "#edf9fd"
          : "#ffffff",
      }}
    >
      <div
        style={{
          ...choiceIcon,

          background: active
            ? "#1596bc"
            : "#eef2f4",

          color: active
            ? "#ffffff"
            : "#667085",
        }}
      >
        {icon}
      </div>

      <div>
        <strong
          style={{
            display: "block",
            color: active
              ? "#087da7"
              : "#344054",
            fontSize: 11,
          }}
        >
          {title}
        </strong>

        <span style={choiceDescription}>
          {description}
        </span>
      </div>
    </button>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function formatarTexto(
  valor: string
) {
  return valor
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /(^|\s)\S/g,
      (letra) =>
        letra.toUpperCase()
    );
}

function formatarTipo(
  tipo: string
) {
  return formatarTexto(tipo);
}

function formatarStatus(
  status: string
) {
  switch (status) {
    case "EM_TRANSITO_CD":
      return "EM TRÂNSITO CD";

    case "AGUARDANDO_CONFERENCIA":
      return "AGUARDANDO CONFERÊNCIA";

    case "EM_CONFERENCIA":
      return "EM CONFERÊNCIA";

    case "FINALIZADO":
      return "FINALIZADO";

    default:
      return formatarTexto(
        status
      ).toUpperCase();
  }
}

/* =========================================================
   ESTILOS
========================================================= */

const phone:
  React.CSSProperties = {
  background: "#f4f4f4",
  overflow: "hidden",
  position: "relative",
};

const topBar:
  React.CSSProperties = {
  height: 40,
  minHeight: 40,
  background: "#000000",
};

const bottomBar:
  React.CSSProperties = {
  height: 36,
  minHeight: 36,
  background: "#000000",
};

const header:
  React.CSSProperties = {
  minHeight: 76,
  background: "#2193b5",
  display: "grid",
  gridTemplateColumns:
    "42px 1fr 42px",
  alignItems: "center",
  padding: "0 10px",
  color: "#ffffff",
  boxSizing: "border-box",
};

const headerTitle:
  React.CSSProperties = {
  textAlign: "center",
  fontSize: 19,
  fontWeight: 800,
};

const backButton:
  React.CSSProperties = {
  width: 38,
  height: 38,
  border: 0,
  borderRadius: 11,
  background: "rgba(255,255,255,.12)",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
};

const content:
  React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  WebkitOverflowScrolling:
    "touch",
  padding: "12px 12px 100px",
  boxSizing: "border-box",
};

const emptyBox:
  React.CSSProperties = {
  padding: 30,
  textAlign: "center",
  color: "#667085",
};

const returnCard:
  React.CSSProperties = {
  border:
    "1px solid #c7d4da",
  borderRadius: 9,
  background: "#ffffff",
  padding: 12,
};

const returnHeader:
  React.CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const returnCode:
  React.CSSProperties = {
  color: "#087da7",
  fontSize: 19,
  fontWeight: 900,
};

const returnType:
  React.CSSProperties = {
  marginTop: 3,
  color: "#667085",
  fontSize: 9,
  fontWeight: 700,
};

const statusPill:
  React.CSSProperties = {
  background: "#dff4fb",
  color: "#087da7",
  borderRadius: 15,
  padding: "6px 9px",
  fontSize: 8,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const divider:
  React.CSSProperties = {
  height: 1,
  background: "#edf0f2",
  margin: "10px 0 8px",
};

const infoRow:
  React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "76px 1fr",
  gap: 7,
  alignItems: "start",
  marginTop: 6,
};

const infoLabel:
  React.CSSProperties = {
  color: "#98a2b3",
  fontSize: 8,
  fontWeight: 900,
  textTransform: "uppercase",
};

const infoValue:
  React.CSSProperties = {
  color: "#344054",
  fontSize: 10,
  lineHeight: 1.35,
};

const miniSummary:
  React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr",
  gap: 8,
  marginTop: 11,
  padding: "9px 10px",
  background: "#f5f8f9",
  borderRadius: 6,
};

const miniLabel:
  React.CSSProperties = {
  display: "block",
  color: "#98a2b3",
  fontSize: 7,
  fontWeight: 900,
};

const miniValue:
  React.CSSProperties = {
  display: "block",
  color: "#344054",
  fontSize: 11,
  marginTop: 2,
};

const scanCard:
  React.CSSProperties = {
  marginTop: 10,
  padding: 12,
  background: "#ffffff",
  border:
    "1px solid #d0d8dd",
  borderRadius: 9,
};

const sectionTitle:
  React.CSSProperties = {
  color: "#087da7",
  fontSize: 12,
  fontWeight: 900,
};

const sectionDescription:
  React.CSSProperties = {
  color: "#667085",
  fontSize: 9,
  lineHeight: 1.4,
  marginTop: 3,
  marginBottom: 12,
};

const scanLabel:
  React.CSSProperties = {
  fontSize: 8,
  color: "#344054",
  fontWeight: 900,
  marginBottom: 5,
};

const input:
  React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  border:
    "1px solid #b8c5cc",
  borderRadius: 7,
  padding: "0 10px",
  boxSizing: "border-box",
  outline: "none",
  background: "#ffffff",
  color: "#344054",
};

const textarea:
  React.CSSProperties = {
  width: "100%",
  minHeight: 58,
  border:
    "1px solid #b8c5cc",
  borderRadius: 7,
  padding: 10,
  boxSizing: "border-box",
  outline: "none",
  resize: "vertical",
  background: "#ffffff",
  color: "#344054",
};

const simulateButton:
  React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  marginTop: 9,
  border:
    "1px dashed #1596bc",
  borderRadius: 7,
  background: "#edf9fd",
  color: "#087da7",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  gap: 8,
  padding: "0 12px",
  fontSize: 9,
};

const primaryButton:
  React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  border: 0,
  borderRadius: 6,
  background: "#1596bc",
  color: "#ffffff",
  fontWeight: 900,
  marginTop: 10,
  cursor: "pointer",
};

const messageBox:
  React.CSSProperties = {
  marginTop: 10,
  padding: "10px 11px",
  border: "1px solid",
  borderRadius: 7,
  fontSize: 9,
  fontWeight: 800,
  lineHeight: 1.4,
};

const readSuccess:
  React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  background: "#e8f7ef",
  border:
    "1px solid #b7dfc9",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  gap: 9,
};

const successIcon:
  React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: "#27ae75",
  color: "#ffffff",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  fontSize: 18,
};

const materialsHeader:
  React.CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  margin: "13px 1px 8px",
};

const countBadge:
  React.CSSProperties = {
  background: "#dff4fb",
  color: "#087da7",
  borderRadius: 14,
  padding: "5px 8px",
  fontSize: 8,
  fontWeight: 900,
};

const itemCard:
  React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  border:
    "1px solid #c7d4da",
  borderRadius: 8,
  background: "#ffffff",
  marginBottom: 9,
  padding: 10,
  cursor: "pointer",
  color: "inherit",
};

const itemTop:
  React.CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "flex-start",
  gap: 8,
};

const productCode:
  React.CSSProperties = {
  color: "#087da7",
  fontSize: 10,
  fontWeight: 900,
};

const productName:
  React.CSSProperties = {
  color: "#344054",
  fontSize: 11,
  fontWeight: 900,
  marginTop: 2,
};

const itemGrid:
  React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr",
  gap: 10,
  marginTop: 10,
};

const itemInfoLabel:
  React.CSSProperties = {
  display: "block",
  color: "#98a2b3",
  fontSize: 7,
  fontWeight: 900,
};

const itemInfoValue:
  React.CSSProperties = {
  display: "block",
  color: "#344054",
  fontSize: 9,
  marginTop: 2,
};

const serialBox:
  React.CSSProperties = {
  marginTop: 9,
  background: "#f5f8f9",
  borderRadius: 6,
  padding: 8,
};

const serialLabel:
  React.CSSProperties = {
  display: "block",
  color: "#98a2b3",
  fontSize: 7,
  fontWeight: 900,
};

const serialValue:
  React.CSSProperties = {
  display: "block",
  color: "#344054",
  fontSize: 8,
  marginTop: 3,
  lineHeight: 1.4,
};

const conferenceResult:
  React.CSSProperties = {
  marginTop: 9,
  padding: 8,
  borderRadius: 6,
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr",
  gap: 5,
  fontSize: 8,
  color: "#344054",
};

const tapHint:
  React.CSSProperties = {
  marginTop: 9,
  color: "#087da7",
  fontSize: 8,
  fontWeight: 900,
  display: "flex",
  justifyContent:
    "space-between",
};

const summaryCard:
  React.CSSProperties = {
  marginTop: 12,
  background: "#ffffff",
  border:
    "1px solid #c7d4da",
  borderRadius: 8,
  padding: 11,
};

const summaryGrid:
  React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, 1fr)",
  gap: 6,
  marginTop: 10,
};

const summaryItem:
  React.CSSProperties = {
  minWidth: 0,
  padding: "8px 3px",
  border:
    "1px solid #e3e8eb",
  borderRadius: 6,
  textAlign: "center",
};

const summaryLabel:
  React.CSSProperties = {
  display: "block",
  color: "#98a2b3",
  fontSize: 6,
  fontWeight: 900,
};

const summaryValue:
  React.CSSProperties = {
  display: "block",
  color: "#344054",
  fontSize: 13,
  marginTop: 3,
};

const finishButton:
  React.CSSProperties = {
  width: "100%",
  minHeight: 50,
  border: 0,
  borderRadius: 6,
  background: "#1596bc",
  color: "#ffffff",
  fontWeight: 900,
  marginTop: 12,
};

const overlay:
  React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 50,
  background:
    "rgba(0,0,0,.48)",
  display: "flex",
  alignItems: "flex-end",
};

const sheet:
  React.CSSProperties = {
  width: "100%",
  maxHeight: "82%",
  overflowY: "auto",
  WebkitOverflowScrolling:
    "touch",
  background: "#ffffff",
  borderRadius:
    "16px 16px 0 0",
  padding:
    "10px 14px 18px",
  boxSizing: "border-box",
};

const sheetHandle:
  React.CSSProperties = {
  width: 42,
  height: 4,
  borderRadius: 5,
  background: "#cbd5db",
  margin: "0 auto 10px",
};

const modalHeader:
  React.CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const modalCode:
  React.CSSProperties = {
  color: "#087da7",
  fontSize: 12,
  fontWeight: 900,
};

const modalProduct:
  React.CSSProperties = {
  color: "#344054",
  fontSize: 12,
  fontWeight: 900,
  marginTop: 3,
};

const closeButton:
  React.CSSProperties = {
  width: 30,
  height: 30,
  border: 0,
  borderRadius: "50%",
  background: "#eef2f4",
  color: "#667085",
  fontSize: 18,
  cursor: "pointer",
};

const expectedBox:
  React.CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  gap: 10,
  background: "#f5f8f9",
  borderRadius: 6,
  padding: 9,
  marginTop: 12,
  color: "#667085",
  fontSize: 8,
  fontWeight: 900,
};

const label:
  React.CSSProperties = {
  display: "block",
  color: "#344054",
  fontSize: 8,
  fontWeight: 900,
  marginTop: 12,
  marginBottom: 5,
};

const choiceWarning:
  React.CSSProperties = {
  background: "#fff6dc",
  color: "#946200",
  border:
    "1px solid #f2cc60",
  borderRadius: 6,
  padding: 8,
  marginBottom: 7,
  fontSize: 8,
  fontWeight: 900,
  textAlign: "center",
};

const choiceButton:
  React.CSSProperties = {
  width: "100%",
  minHeight: 54,
  borderRadius: 7,
  marginBottom: 7,
  padding: 8,
  display: "flex",
  alignItems: "center",
  gap: 9,
  textAlign: "left",
  cursor: "pointer",
};

const choiceIcon:
  React.CSSProperties = {
  width: 30,
  height: 30,
  minWidth: 30,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
};

const choiceDescription:
  React.CSSProperties = {
  display: "block",
  color: "#667085",
  fontSize: 7,
  marginTop: 2,
  lineHeight: 1.35,
};

const expectedSerial:
  React.CSSProperties = {
  background: "#f5f8f9",
  borderRadius: 6,
  padding: 8,
  marginBottom: 6,
  color: "#667085",
  fontSize: 7,
};

const destinationPreview:
  React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  marginTop: 10,
  padding: 9,
  background: "#f5f8f9",
  borderRadius: 6,
  color: "#667085",
  fontSize: 8,
};

/* =========================================================
   BADGES DE STATUS DO ITEM
========================================================= */

const pendingBadge:
  React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 22,
  padding: "4px 8px",
  borderRadius: 12,
  background: "#eef2f4",
  color: "#667085",
  fontSize: 7,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const availableBadge:
  React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 22,
  padding: "4px 8px",
  borderRadius: 12,
  background: "#e8f7ef",
  color: "#067647",
  fontSize: 7,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const quarantineBadge:
  React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 22,
  padding: "4px 8px",
  borderRadius: 12,
  background: "#fff6dc",
  color: "#946200",
  fontSize: 7,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const divergenceBadge:
  React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 22,
  padding: "4px 8px",
  borderRadius: 12,
  background: "#fff0ef",
  color: "#b42318",
  fontSize: 7,
  fontWeight: 900,
  whiteSpace: "nowrap",
};
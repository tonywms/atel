"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { requisicoesTecnicasMock } from "@/lib/requisicoesTecnicas";

import {
  DecisaoRecebimento,
  finalizarRecebimentoTecnico,
  iniciarRecebimentoTecnico,
  marcarItemRecebimentoDivergencia,
  marcarItemRecebimentoOk,
  obterEstado,
  recusarVolumeRecebimento,
  registrarVolumeRecebimentoTecnico,
  TipoDivergenciaRecebimento,
  VolumeRequisicao,
} from "@/lib/requisicoesStore";

/* =========================================================
   TIPOS
========================================================= */

type Modal = {
  volumeId: number;
  itemId: number;
  produto: string;
  codigo: string;
  unidade: string;
  esperado: number;
  seriais: string[];
} | null;

const TIPOS: [TipoDivergenciaRecebimento, string][] = [
  ["FALTANTE", "Item faltante"],
  ["QUANTIDADE_DIVERGENTE", "Quantidade divergente"],
  ["AVARIADO", "Material avariado"],
  ["PRODUTO_ERRADO", "Produto errado"],
  ["SERIAL_DIVERGENTE", "Serial divergente"],
];

/* =========================================================
   HELPERS
========================================================= */

const rotulo = (d?: DecisaoRecebimento) =>
  d === "ACEITE_TOTAL"
    ? "ACEITE TOTAL"
    : d === "ACEITE_PARCIAL"
      ? "ACEITE PARCIAL"
      : d === "RECUSA_ITEM"
        ? "ITEM RECUSADO"
        : d === "RECUSA_VOLUME"
          ? "VOLUME RECUSADO"
          : "DIVERGÊNCIA";

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

  const req = useMemo(
    () =>
      requisicoesTecnicasMock.find(
        (r) => r.id === id
      ),
    [id]
  );

  const [ready, setReady] =
    useState(false);

  const [volumes, setVolumes] =
    useState<VolumeRequisicao[]>([]);

  const [lidos, setLidos] =
    useState<Record<number, string>>({});

  const [avs, setAvs] =
    useState<Record<string, any>>({});

  const [codigo, setCodigo] =
    useState("");

  const [msg, setMsg] =
    useState("");

  const [fim, setFim] =
    useState(false);

  /* =======================================================
     MODAL DIVERGÊNCIA
  ======================================================= */

  const [modal, setModal] =
    useState<Modal>(null);

  const [tipo, setTipo] =
    useState<TipoDivergenciaRecebimento>(
      "QUANTIDADE_DIVERGENTE"
    );

  const [decisao, setDecisao] =
    useState<
      Exclude<
        DecisaoRecebimento,
        "ACEITE_TOTAL"
      >
    >("ACEITE_PARCIAL");

  const [qr, setQr] =
    useState("0");

  const [qa, setQa] =
    useState("0");

  const [obs, setObs] =
    useState("");

  /*
   * NOVO:
   * seriais fisicamente recebidos.
   */
  const [
    seriaisRecebidos,
    setSeriaisRecebidos,
  ] = useState<string[]>([]);

  /*
   * NOVO:
   * seriais que o técnico decidiu aceitar.
   */
  const [
    seriaisAceitos,
    setSeriaisAceitos,
  ] = useState<string[]>([]);

  /* =======================================================
     HELPERS
  ======================================================= */

  const key = (
    v: number,
    i: number
  ) => `${v}:${i}`;

  function refresh() {
    if (!req) return;

    const e = obterEstado(req);

    setVolumes(
      e.volumes ?? []
    );

    setLidos(
      e.recebimentoTecnico
        ?.volumesLidos ?? {}
    );

    setAvs(
      e.recebimentoTecnico
        ?.itensConferidos ?? {}
    );
  }

  /* =======================================================
     INICIALIZAÇÃO
  ======================================================= */

  useEffect(() => {
    if (!req) {
      setReady(true);
      return;
    }

    try {
      iniciarRecebimentoTecnico(
        req
      );

      refresh();
    } catch (e) {
      setMsg(
        e instanceof Error
          ? e.message
          : "Erro."
      );
    } finally {
      setReady(true);
    }
  }, [req]);

  /* =======================================================
     TELAS DE ESTADO
  ======================================================= */

  if (!ready) {
    return (
      <Tela t="Carregando..." />
    );
  }

  if (!req) {
    return (
      <Tela t="Requisição não encontrada." />
    );
  }

  /* =======================================================
     RESUMO
  ======================================================= */

  const qtdLidos =
    volumes.filter(
      (v) =>
        !!lidos[v.id] ||
        v.status === "RECEBIDO"
    ).length;

  const faltam =
    volumes.length - qtdLidos;

  let total = 0;
  let avaliados = 0;
  let ok = 0;
  let div = 0;
  let aceitos = 0;
  let recusados = 0;
  let recusaVolume = false;

  volumes.forEach((v) => {
    if (
      !lidos[v.id] &&
      v.status !== "RECEBIDO"
    ) {
      return;
    }

    Object.values(
      v.itens ?? {}
    ).forEach((i) => {
      total++;

      const a =
        avs[
          key(
            v.id,
            i.itemId
          )
        ];

      if (!a) return;

      avaliados++;

      if (
        a.situacao === "OK"
      ) {
        ok++;
      } else {
        div++;
      }

      aceitos += Number(
        a.quantidadeAceita ??
          a.quantidadeRecebida ??
          0
      );

      recusados += Number(
        a.quantidadeRecusada ??
          0
      );

      if (
        a.decisao ===
        "RECUSA_VOLUME"
      ) {
        recusaVolume = true;
      }
    });
  });

  const pode =
    volumes.length > 0 &&
    faltam === 0 &&
    total > 0 &&
    avaliados === total &&
    !fim;

  const prod = (i: number) =>
    req.itens.find(
      (x) => x.id === i
    );

  const totalVol = (
    v: VolumeRequisicao
  ) =>
    Object.values(
      v.itens ?? {}
    ).reduce(
      (s, i) =>
        s +
        Number(
          i.quantidade || 0
        ),
      0
    );

  /* =======================================================
     LEITURA DO VOLUME
  ======================================================= */

  function ler() {
    try {
      if (!codigo.trim()) {
        throw new Error(
          "Leia ou informe o código do volume."
        );
      }

      const v =
        registrarVolumeRecebimentoTecnico(
          req!,
          codigo
        );

      setCodigo("");

      refresh();

      setMsg(
        `Volume ${v.codigo} lido. Confira os materiais antes do aceite.`
      );
    } catch (e) {
      setMsg(
        e instanceof Error
          ? e.message
          : "Erro ao ler volume."
      );
    }
  }

  /* =======================================================
     MATERIAL OK
  ======================================================= */

  function materialOk(
    v: number,
    i: number
  ) {
    try {
      marcarItemRecebimentoOk(
        req!,
        v,
        i
      );

      refresh();

      setMsg(
        "Material aceito integralmente."
      );
    } catch (e) {
      setMsg(
        e instanceof Error
          ? e.message
          : "Erro."
      );
    }
  }

  /* =======================================================
     ABRIR DIVERGÊNCIA
  ======================================================= */

  function abrir(
    v: VolumeRequisicao,
    i: number
  ) {
    const iv =
      v.itens[i];

    const p =
      prod(i);

    if (!iv || !p) {
      return;
    }

    const seriais =
      [
        ...(iv.seriais ?? []),
      ];

    setModal({
      volumeId: v.id,
      itemId: i,
      produto: p.produto,
      codigo:
        p.codigoProduto,
      unidade: p.unidade,
      esperado:
        iv.quantidade,
      seriais,
    });

    setTipo(
      "QUANTIDADE_DIVERGENTE"
    );

    setDecisao(
      "ACEITE_PARCIAL"
    );

    /*
     * Por padrão consideramos que
     * todo o material chegou.
     */
    setQr(
      String(
        iv.quantidade
      )
    );

    /*
     * Inicialmente todos os
     * seriais estão recebidos
     * e aceitos.
     */
    setSeriaisRecebidos(
      seriais
    );

    setSeriaisAceitos(
      seriais
    );

    /*
     * Para produto serializado
     * a quantidade aceita será
     * controlada pelos seriais.
     */
    if (
      seriais.length > 0
    ) {
      setQa(
        String(
          seriais.length
        )
      );
    } else {
      setQa(
        String(
          Math.max(
            iv.quantidade - 1,
            0
          )
        )
      );
    }

    setObs("");
  }

  /* =======================================================
     ALTERAR SERIAL ACEITO
  ======================================================= */

  function toggleSerialAceito(
    serial: string
  ) {
    setSeriaisAceitos(
      (atuais) => {
        const existe =
          atuais.includes(
            serial
          );

        const novos =
          existe
            ? atuais.filter(
                (s) =>
                  s !==
                  serial
              )
            : [
                ...atuais,
                serial,
              ];

        /*
         * QUANTIDADE ACEITA
         * acompanha automaticamente
         * os seriais selecionados.
         */
        setQa(
          String(
            novos.length
          )
        );

        return novos;
      }
    );
  }

  /* =======================================================
     DECISÃO ACEITE PARCIAL
  ======================================================= */

  function selecionarAceiteParcial() {
    setDecisao(
      "ACEITE_PARCIAL"
    );

    if (
      modal &&
      modal.seriais.length > 0
    ) {
      setQa(
        String(
          seriaisAceitos.length
        )
      );
    } else {
      setQa(qr);
    }
  }

  /* =======================================================
     RECUSAR ITEM
  ======================================================= */

  function selecionarRecusaItem() {
    setDecisao(
      "RECUSA_ITEM"
    );

    setQa("0");

    setSeriaisAceitos([]);
  }

  /* =======================================================
     RECUSAR VOLUME
  ======================================================= */

  function selecionarRecusaVolume() {
    setDecisao(
      "RECUSA_VOLUME"
    );

    setQa("0");

    setSeriaisAceitos([]);
  }

  /* =======================================================
     SALVAR DIVERGÊNCIA
  ======================================================= */

  function salvar() {
    if (!modal) return;

    try {
      const quantidadeRecebida =
        Number(
          qr.replace(
            ",",
            "."
          )
        );

      /*
       * PRODUTO SERIALIZADO:
       * quantidade aceita vem
       * exclusivamente dos seriais.
       */
      const quantidadeAceita =
        decisao ===
        "RECUSA_ITEM"
          ? 0
          : modal.seriais
                .length > 0
            ? seriaisAceitos.length
            : Number(
                qa.replace(
                  ",",
                  "."
                )
              );

      if (
        decisao ===
          "ACEITE_PARCIAL" &&
        quantidadeAceita >=
          quantidadeRecebida
      ) {
        throw new Error(
          "No aceite parcial deve existir pelo menos uma unidade recusada."
        );
      }

      if (
        quantidadeAceita >
        quantidadeRecebida
      ) {
        throw new Error(
          "A quantidade aceita não pode ser maior que a quantidade recebida."
        );
      }

      if (
        modal.seriais.length >
          0 &&
        seriaisAceitos.length >
          seriaisRecebidos.length
      ) {
        throw new Error(
          "Existem mais seriais aceitos do que seriais recebidos."
        );
      }

      if (
        decisao ===
        "RECUSA_VOLUME"
      ) {
        recusarVolumeRecebimento(
          req!,
          modal.volumeId,
          {
            tipo,
            observacao:
              obs,
          }
        );
      } else {
        marcarItemRecebimentoDivergencia(
          req!,
          modal.volumeId,
          modal.itemId,
          {
            tipo,

            decisao,

            quantidadeRecebida,

            quantidadeAceita,

            observacao: obs,

            seriaisRecebidos:
              seriaisRecebidos,

            seriaisAceitos:
              decisao ===
              "RECUSA_ITEM"
                ? []
                : seriaisAceitos,
          }
        );
      }

      setModal(null);

      refresh();

      setMsg(
        decisao ===
          "RECUSA_VOLUME"
          ? "Volume recusado. Todo o conteúdo ficará pendente de retorno ao CD."
          : decisao ===
              "RECUSA_ITEM"
            ? "Item recusado. Nenhuma unidade será aceita."
            : "Aceite parcial registrado."
      );
    } catch (e) {
      setMsg(
        e instanceof Error
          ? e.message
          : "Erro ao registrar decisão."
      );
    }
  }

  /* =======================================================
     FINALIZAR
  ======================================================= */

  function finalizar() {
    try {
      setFim(true);

      finalizarRecebimentoTecnico(
        req!
      );

      setMsg(
        div
          ? "Recebimento finalizado com divergência/recusa."
          : "Recebimento confirmado."
      );

      setTimeout(
        () =>
          router.push(
            "/coletor/recebimento"
          ),
        900
      );
    } catch (e) {
      setFim(false);

      setMsg(
        e instanceof Error
          ? e.message
          : "Erro ao finalizar."
      );
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="collector-screen">
      <div
        className="collector-phone"
        style={{
          position: "relative",
        }}
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="collector-header">
          <div className="collector-header-title">
            <button
              className="collector-back-button"
              onClick={() =>
                router.push(
                  "/coletor/recebimento"
                )
              }
            >
              ‹
            </button>

            <div>
              <strong>
                #
                {req.codigo.replace(
                  "REQ-",
                  ""
                )}
              </strong>

              <div
                style={{
                  fontSize: 10,
                }}
              >
                {req.tecnico.toUpperCase()}
              </div>

              <div
                style={{
                  fontSize: 9,
                }}
              >
                {req.codigoTecnico} •{" "}
                {req.base}
              </div>
            </div>
          </div>

          <span
            style={{
              fontSize: 22,
            }}
          >
            ⋮
          </span>
        </div>

        {/* =================================================
            BODY
        ================================================= */}

        <div
          className="collector-operation-body"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            paddingBottom: 110,
          }}
        >
          <section className="collector-section">
            <div className="collector-section-title">
              <span>
                Recebimento de Volumes
              </span>

              <span>✓</span>
            </div>

            <div style={info}>
              Material em trânsito
              para{" "}
              {req.codigoTecnico}
            </div>

            {/* =============================================
                CONTADORES
            ============================================= */}

            <div className="collector-quantity-grid">
              <div>
                <span>
                  Esperados
                </span>

                <strong>
                  {volumes.length}
                </strong>
              </div>

              <div>
                <span>
                  Lidos
                </span>

                <strong>
                  {qtdLidos}
                </strong>
              </div>

              <div>
                <span>
                  Faltam
                </span>

                <strong>
                  {faltam}
                </strong>
              </div>
            </div>

            {/* =============================================
                DESTINO
            ============================================= */}

            <div style={box}>
              <div style={lab}>
                DESTINO
              </div>

              <b
                style={{
                  fontSize: 16,
                }}
              >
                {req.tecnico}
              </b>

              <div
                style={{
                  color:
                    "#087da7",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {req.codigoTecnico} •{" "}
                {req.base}
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color:
                    "#64748b",
                }}
              >
                Origem:{" "}
                {req.origem ||
                  "CD FORTALEZA"}
                <br />

                Tipo: {req.tipo}
              </div>
            </div>

            {/* =============================================
                LEITURA
            ============================================= */}

            <div
              style={{
                marginTop: 16,
                marginBottom: 7,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              LEITURA DO VOLUME
            </div>

            <div className="collector-input-action">
              <input
                value={codigo}
                onChange={(e) =>
                  setCodigo(
                    e.target.value
                  )
                }
                placeholder="Código do volume"
                onKeyDown={(e) =>
                  e.key ===
                    "Enter" &&
                  ler()
                }
              />

              <button
                onClick={ler}
              >
                ✓
              </button>
            </div>

            {/* =============================================
                VOLUMES
            ============================================= */}

            {volumes.map(
              (v) => {
                const vl =
                  !!lidos[v.id] ||
                  v.status ===
                    "RECEBIDO";

                const itens =
                  Object.values(
                    v.itens ?? {}
                  );

                const vr =
                  itens.length >
                    0 &&
                  itens.every(
                    (i) =>
                      avs[
                        key(
                          v.id,
                          i.itemId
                        )
                      ]?.decisao ===
                      "RECUSA_VOLUME"
                  );

                return (
                  <div
                    key={v.id}
                    style={{
                      marginTop: 10,

                      border: `1.5px solid ${
                        vr
                          ? "#c0392b"
                          : vl
                            ? "#22a06b"
                            : "#cbd5e1"
                      }`,

                      borderRadius: 8,

                      overflow:
                        "hidden",

                      background:
                        "#fff",
                    }}
                  >
                    {/* =====================================
                        CABEÇALHO VOLUME
                    ===================================== */}

                    <div
                      style={{
                        padding: 11,

                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        alignItems:
                          "center",
                      }}
                    >
                      <div>
                        <b
                          style={{
                            fontSize:
                              12,
                          }}
                        >
                          {v.codigo}
                        </b>

                        <div
                          style={{
                            fontSize:
                              10,

                            color:
                              "#64748b",

                            marginTop:
                              4,
                          }}
                        >
                          {
                            itens.length
                          }{" "}
                          SKU(s) •{" "}
                          {totalVol(
                            v
                          )}{" "}
                          unidades
                        </div>
                      </div>

                      <span
                        style={{
                          padding:
                            "5px 8px",

                          borderRadius:
                            12,

                          fontSize:
                            9,

                          fontWeight:
                            900,

                          background:
                            vr
                              ? "#fee4e2"
                              : vl
                                ? "#dff4e9"
                                : "#e9f7fc",

                          color:
                            vr
                              ? "#b42318"
                              : vl
                                ? "#07864c"
                                : "#087da7",
                        }}
                      >
                        {vr
                          ? "✕ RECUSADO"
                          : vl
                            ? "✓ LIDO"
                            : "AGUARDANDO"}
                      </span>
                    </div>

                    {/* =====================================
                        SIMULAR LEITURA
                    ===================================== */}

                    {!vl && (
                      <button
                        className="collector-demo-fill"
                        onClick={() =>
                          setCodigo(
                            v.codigo
                          )
                        }
                        style={{
                          margin:
                            "0 11px 11px",
                        }}
                      >
                        Simular leitura:{" "}
                        {v.codigo}
                      </button>
                    )}

                    {/* =====================================
                        ITENS
                    ===================================== */}

                    {vl && (
                      <div>
                        <div
                          style={{
                            padding:
                              "9px 11px",

                            background:
                              "#edf8fc",

                            color:
                              "#087da7",

                            fontSize:
                              10,

                            fontWeight:
                              900,
                          }}
                        >
                          CONTEÚDO PARA
                          CONFERÊNCIA
                        </div>

                        {itens.map(
                          (iv) => {
                            const p =
                              prod(
                                iv.itemId
                              );

                            if (!p) {
                              return null;
                            }

                            const a =
                              avs[
                                key(
                                  v.id,
                                  iv.itemId
                                )
                              ];

                            const isOk =
                              a?.situacao ===
                              "OK";

                            return (
                              <div
                                key={
                                  iv.itemId
                                }
                                style={{
                                  padding:
                                    11,

                                  borderBottom:
                                    "1px solid #e5e7eb",

                                  background:
                                    isOk
                                      ? "#f4fbf7"
                                      : a
                                        ? "#fffaf0"
                                        : "#fff",
                                }}
                              >
                                <div
                                  style={{
                                    display:
                                      "flex",

                                    justifyContent:
                                      "space-between",

                                    gap: 10,
                                  }}
                                >
                                  <div>
                                    <b
                                      style={{
                                        fontSize:
                                          12,
                                      }}
                                    >
                                      {
                                        p.produto
                                      }
                                    </b>

                                    <div
                                      style={{
                                        color:
                                          "#087da7",

                                        fontSize:
                                          10,

                                        fontWeight:
                                          800,
                                      }}
                                    >
                                      {
                                        p.codigoProduto
                                      }
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      textAlign:
                                        "right",
                                    }}
                                  >
                                    <span
                                      style={
                                        lab
                                      }
                                    >
                                      ESPERADO
                                    </span>

                                    <b
                                      style={{
                                        display:
                                          "block",

                                        fontSize:
                                          14,
                                      }}
                                    >
                                      {
                                        iv.quantidade
                                      }{" "}
                                      {
                                        p.unidade
                                      }
                                    </b>
                                  </div>
                                </div>

                                {/* =========================
                                    SERIAIS ESPERADOS
                                ========================= */}

                                {p.controlaSerie &&
                                  iv.seriais &&
                                  iv.seriais
                                    .length >
                                    0 && (
                                    <div
                                      style={{
                                        marginTop:
                                          8,

                                        padding:
                                          8,

                                        background:
                                          "#f8fafc",

                                        border:
                                          "1px solid #e2e8f0",

                                        borderRadius:
                                          5,
                                      }}
                                    >
                                      <div
                                        style={
                                          lab
                                        }
                                      >
                                        SERIAIS
                                        ESPERADOS
                                      </div>

                                      {iv.seriais.map(
                                        (
                                          s
                                        ) => (
                                          <div
                                            key={
                                              s
                                            }
                                            style={{
                                              fontSize:
                                                10,

                                              marginTop:
                                                4,
                                            }}
                                          >
                                            •{" "}
                                            {
                                              s
                                            }
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}

                                {/* =========================
                                    RESULTADO
                                ========================= */}

                                {a && (
                                  <div
                                    style={{
                                      marginTop:
                                        8,

                                      padding:
                                        7,

                                      borderRadius:
                                        5,

                                      background:
                                        isOk
                                          ? "#eaf8f0"
                                          : "#fff1cc",

                                      color:
                                        isOk
                                          ? "#07864c"
                                          : "#9a6700",

                                      fontSize:
                                        10,

                                      fontWeight:
                                        800,

                                      lineHeight:
                                        1.4,
                                    }}
                                  >
                                    {isOk ? (
                                      `✓ ACEITE TOTAL • ${a.quantidadeAceita} ${p.unidade}`
                                    ) : (
                                      <>
                                        ⚠{" "}
                                        {rotulo(
                                          a.decisao
                                        )}
                                        <br />

                                        Recebido:{" "}
                                        {
                                          a.quantidadeRecebida
                                        }{" "}
                                        •
                                        Aceito:{" "}
                                        {
                                          a.quantidadeAceita
                                        }{" "}
                                        •
                                        Recusado:{" "}
                                        {
                                          a.quantidadeRecusada
                                        }{" "}
                                        {
                                          p.unidade
                                        }
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* =========================
                                    BOTÕES
                                ========================= */}

                                {!vr && (
                                  <div
                                    style={{
                                      display:
                                        "flex",

                                      gap: 7,

                                      marginTop:
                                        9,
                                    }}
                                  >
                                    <button
                                      onClick={() =>
                                        materialOk(
                                          v.id,
                                          iv.itemId
                                        )
                                      }
                                      style={
                                        btnOk
                                      }
                                    >
                                      {isOk
                                        ? "✓ ACEITO"
                                        : "✓ MATERIAL OK"}
                                    </button>

                                    <button
                                      onClick={() =>
                                        abrir(
                                          v,
                                          iv.itemId
                                        )
                                      }
                                      style={
                                        btnDiv
                                      }
                                    >
                                      ⚠
                                      DIVERGÊNCIA
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            )}

            {/* =============================================
                RESUMO
            ============================================= */}

            {qtdLidos > 0 && (
              <div style={box}>
                <b
                  style={{
                    fontSize: 10,
                  }}
                >
                  RESUMO DO RECEBIMENTO
                </b>

                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "repeat(3,1fr)",

                    gap: 6,

                    marginTop: 8,
                  }}
                >
                  <Resumo
                    t="Avaliados"
                    v={`${avaliados}/${total}`}
                  />

                  <Resumo
                    t="Aceitos"
                    v={String(
                      aceitos
                    )}
                  />

                  <Resumo
                    t="Recusados"
                    v={String(
                      recusados
                    )}
                  />
                </div>

                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "repeat(2,1fr)",

                    gap: 6,

                    marginTop: 6,
                  }}
                >
                  <Resumo
                    t="Itens OK"
                    v={String(
                      ok
                    )}
                  />

                  <Resumo
                    t="Divergências"
                    v={String(
                      div
                    )}
                  />
                </div>
              </div>
            )}

            {msg && (
              <div
                className="collector-message"
                style={{
                  marginTop: 12,
                }}
              >
                {msg}
              </div>
            )}
          </section>
        </div>

        {/* =================================================
            BOTÃO FINAL
        ================================================= */}

        <div
          style={{
            padding:
              "10px 12px",

            background:
              "#f4f4f4",
          }}
        >
          <button
            className="collector-confirm-item"
            disabled={!pode}
            onClick={
              finalizar
            }
            style={{
              width: "100%",

              minHeight: 48,

              opacity: pode
                ? 1
                : 0.45,
            }}
          >
            {fim
              ? "FINALIZANDO..."
              : recusaVolume
                ? "CONFIRMAR RECUSA / RECEBIMENTO"
                : div
                  ? "CONFIRMAR ACEITE PARCIAL"
                  : "CONFIRMAR ACEITE"}
          </button>
        </div>

        {/* =================================================
            MODAL DIVERGÊNCIA
        ================================================= */}

        {modal && (
          <div
            style={overlay}
            onClick={() =>
              setModal(null)
            }
          >
            <div
              style={modalCss}
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              {/* ===========================================
                  CABEÇALHO
              =========================================== */}

              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  alignItems:
                    "flex-start",
                }}
              >
                <div>
                  <b
                    style={{
                      fontSize: 15,
                    }}
                  >
                    Registrar
                    Divergência
                  </b>

                  <div
                    style={{
                      fontSize: 10,

                      color:
                        "#64748b",

                      marginTop: 2,
                    }}
                  >
                    {modal.codigo} •{" "}
                    {modal.produto}
                  </div>
                </div>

                <button
                  onClick={() =>
                    setModal(
                      null
                    )
                  }
                  style={{
                    border: 0,

                    background:
                      "transparent",

                    fontSize: 24,

                    cursor:
                      "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              {/* ===========================================
                  TIPO
              =========================================== */}

              <Campo t="TIPO DA DIVERGÊNCIA" />

              <select
                value={tipo}
                onChange={(e) =>
                  setTipo(
                    e.target
                      .value as TipoDivergenciaRecebimento
                  )
                }
                style={campo}
              >
                {TIPOS.map(
                  ([v, l]) => (
                    <option
                      key={v}
                      value={v}
                    >
                      {l}
                    </option>
                  )
                )}
              </select>

              {/* ===========================================
                  QUANTIDADE RECEBIDA
              =========================================== */}

              <Campo t="QUANTIDADE RECEBIDA" />

              <input
                type="number"
                min="0"
                value={qr}
                onChange={(e) =>
                  setQr(
                    e.target.value
                  )
                }
                style={campo}
              />

              <div
                style={{
                  fontSize: 10,

                  color:
                    "#64748b",

                  marginTop: 5,
                }}
              >
                Esperado:{" "}
                {modal.esperado}{" "}
                {modal.unidade}
              </div>

              {/* ===========================================
                  DECISÃO
              =========================================== */}

              <Campo t="O QUE DESEJA FAZER?" />

              <Opcao
                ativo={
                  decisao ===
                  "ACEITE_PARCIAL"
                }
                titulo="ACEITAR PARCIALMENTE"
                desc="Selecione abaixo exatamente quais seriais serão aceitos. Os não selecionados retornarão ao CD."
                on={
                  selecionarAceiteParcial
                }
              />

              <Opcao
                ativo={
                  decisao ===
                  "RECUSA_ITEM"
                }
                titulo="RECUSAR ESTE ITEM"
                desc="Não aceito nenhuma unidade deste item. Todos os seriais do item deverão retornar ao CD."
                on={
                  selecionarRecusaItem
                }
              />

              <Opcao
                ativo={
                  decisao ===
                  "RECUSA_VOLUME"
                }
                perigo
                titulo="RECUSAR TODO O VOLUME"
                desc="Nenhum material deste volume será aceito. Todo o volume deverá retornar ao CD."
                on={
                  selecionarRecusaVolume
                }
              />

              {/* ===========================================
                  PRODUTO SERIALIZADO
              =========================================== */}

              {modal.seriais.length >
                0 &&
                decisao !==
                  "RECUSA_VOLUME" && (
                  <>
                    <Campo t="SERIAIS RECEBIDOS / ACEITOS" />

                    <div
                      style={
                        serialContainer
                      }
                    >
                      {seriaisRecebidos.map(
                        (
                          serial
                        ) => {
                          const selecionado =
                            seriaisAceitos.includes(
                              serial
                            );

                          const recusado =
                            !selecionado;

                          return (
                            <label
                              key={
                                serial
                              }
                              style={{
                                ...serialRow,

                                borderColor:
                                  selecionado
                                    ? "#22a06b"
                                    : "#e0a000",

                                background:
                                  selecionado
                                    ? "#f0fbf5"
                                    : "#fff8df",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  selecionado
                                }
                                disabled={
                                  decisao ===
                                  "RECUSA_ITEM"
                                }
                                onChange={() =>
                                  toggleSerialAceito(
                                    serial
                                  )
                                }
                                style={{
                                  width:
                                    18,

                                  height:
                                    18,

                                  cursor:
                                    "pointer",

                                  accentColor:
                                    "#22a06b",
                                }}
                              />

                              <div
                                style={{
                                  flex: 1,
                                }}
                              >
                                <b
                                  style={{
                                    display:
                                      "block",

                                    fontSize:
                                      11,

                                    color:
                                      "#111827",
                                  }}
                                >
                                  {
                                    serial
                                  }
                                </b>

                                <span
                                  style={{
                                    display:
                                      "block",

                                    marginTop:
                                      2,

                                    fontSize:
                                      9,

                                    fontWeight:
                                      900,

                                    color:
                                      selecionado
                                        ? "#07864c"
                                        : "#9a6700",
                                  }}
                                >
                                  {selecionado
                                    ? "✓ ACEITAR ESTE SERIAL"
                                    : "↩ RECUSAR / RETORNAR AO CD"}
                                </span>
                              </div>

                              <span
                                style={{
                                  fontSize:
                                    16,

                                  fontWeight:
                                    900,

                                  color:
                                    selecionado
                                      ? "#07864c"
                                      : "#b77900",
                                }}
                              >
                                {selecionado
                                  ? "✓"
                                  : "↩"}
                              </span>
                            </label>
                          );
                        }
                      )}
                    </div>

                    {/* =====================================
                        RESUMO SERIAL
                    ===================================== */}

                    <div
                      style={
                        serialResumo
                      }
                    >
                      <div>
                        <span>
                          RECEBIDOS
                        </span>

                        <strong>
                          {
                            seriaisRecebidos.length
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          ACEITOS
                        </span>

                        <strong
                          style={{
                            color:
                              "#07864c",
                          }}
                        >
                          {decisao ===
                          "RECUSA_ITEM"
                            ? 0
                            : seriaisAceitos.length}
                        </strong>
                      </div>

                      <div>
                        <span>
                          RECUSADOS
                        </span>

                        <strong
                          style={{
                            color:
                              "#b77900",
                          }}
                        >
                          {decisao ===
                          "RECUSA_ITEM"
                            ? seriaisRecebidos.length
                            : seriaisRecebidos.length -
                              seriaisAceitos.length}
                        </strong>
                      </div>
                    </div>

                    {/* =====================================
                        QUANTIDADE ACEITA AUTOMÁTICA
                    ===================================== */}

                    <Campo t="QUANTIDADE ACEITA" />

                    <div
                      style={
                        quantidadeAutomatica
                      }
                    >
                      <strong>
                        {decisao ===
                        "RECUSA_ITEM"
                          ? 0
                          : seriaisAceitos.length}
                      </strong>

                      <span>
                        {
                          modal.unidade
                        }
                      </span>

                      <small>
                        Calculada
                        automaticamente
                        pelos seriais
                        selecionados
                      </small>
                    </div>
                  </>
                )}

              {/* ===========================================
                  PRODUTO SEM SERIAL
              =========================================== */}

              {modal.seriais.length ===
                0 &&
                decisao ===
                  "ACEITE_PARCIAL" && (
                  <>
                    <Campo t="QUANTIDADE ACEITA" />

                    <input
                      type="number"
                      min="0"
                      value={qa}
                      onChange={(
                        e
                      ) =>
                        setQa(
                          e.target
                            .value
                        )
                      }
                      style={
                        campo
                      }
                    />
                  </>
                )}

              {/* ===========================================
                  OBSERVAÇÃO
              =========================================== */}

              <Campo t="OBSERVAÇÃO" />

              <textarea
                rows={3}
                value={obs}
                onChange={(e) =>
                  setObs(
                    e.target.value
                  )
                }
                style={{
                  ...campo,

                  height: "auto",

                  paddingTop: 10,
                }}
                placeholder="Descreva o problema encontrado..."
              />

              {decisao ===
                "RECUSA_VOLUME" && (
                <div
                  style={{
                    marginTop: 12,

                    padding: 10,

                    background:
                      "#fff1f0",

                    color:
                      "#b42318",

                    fontSize: 10,

                    fontWeight:
                      800,
                  }}
                >
                  ⚠ Todo o volume
                  ficará pendente de
                  retorno ao CD.
                </div>
              )}

              {/* ===========================================
                  BOTÃO SALVAR
              =========================================== */}

              <button
                onClick={salvar}
                style={{
                  width: "100%",

                  height: 46,

                  marginTop: 14,

                  border: 0,

                  borderRadius: 6,

                  background:
                    decisao ===
                    "RECUSA_VOLUME"
                      ? "#c0392b"
                      : "#e39400",

                  color: "#fff",

                  fontWeight: 900,

                  cursor:
                    "pointer",
                }}
              >
                {decisao ===
                "RECUSA_VOLUME"
                  ? "CONFIRMAR RECUSA DO VOLUME"
                  : decisao ===
                      "RECUSA_ITEM"
                    ? "CONFIRMAR RECUSA DO ITEM"
                    : "SALVAR ACEITE PARCIAL"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   OPÇÃO
========================================================= */

function Opcao({
  ativo,
  titulo,
  desc,
  on,
  perigo = false,
}: {
  ativo: boolean;
  titulo: string;
  desc: string;
  on: () => void;
  perigo?: boolean;
}) {
  return (
    <button
      onClick={on}
      style={{
        width: "100%",

        textAlign: "left",

        padding: 10,

        marginBottom: 7,

        borderRadius: 7,

        border: ativo
          ? `2px solid ${
              perigo
                ? "#c0392b"
                : "#087da7"
            }`
          : "1px solid #cbd5e1",

        background: ativo
          ? perigo
            ? "#fff1f0"
            : "#edf8fc"
          : "#fff",

        cursor: "pointer",
      }}
    >
      <b
        style={{
          fontSize: 10,

          color: perigo
            ? "#b42318"
            : "#111827",
        }}
      >
        {ativo ? "● " : "○ "}
        {titulo}
      </b>

      <div
        style={{
          fontSize: 9,

          color: "#64748b",

          marginTop: 4,
        }}
      >
        {desc}
      </div>
    </button>
  );
}

/* =========================================================
   RESUMO
========================================================= */

function Resumo({
  t,
  v,
}: {
  t: string;
  v: string;
}) {
  return (
    <div
      style={{
        padding: 8,

        border:
          "1px solid #e2e8f0",

        borderRadius: 5,

        textAlign: "center",
      }}
    >
      <span
        style={{
          display: "block",

          fontSize: 8,

          color: "#64748b",

          fontWeight: 800,
        }}
      >
        {t.toUpperCase()}
      </span>

      <b
        style={{
          fontSize: 14,
        }}
      >
        {v}
      </b>
    </div>
  );
}

/* =========================================================
   CAMPO
========================================================= */

function Campo({
  t,
}: {
  t: string;
}) {
  return (
    <div
      style={{
        marginTop: 13,

        marginBottom: 5,

        fontSize: 9,

        fontWeight: 900,
      }}
    >
      {t}
    </div>
  );
}

/* =========================================================
   TELA
========================================================= */

function Tela({
  t,
}: {
  t: string;
}) {
  return (
    <div className="collector-screen">
      <div className="collector-phone">
        <div
          style={{
            padding: 30,

            textAlign:
              "center",
          }}
        >
          {t}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const info = {
  padding: 10,

  borderRadius: 7,

  background: "#edf8fc",

  color: "#087da7",

  fontSize: 12,

  fontWeight: 700,

  marginBottom: 12,
} as const;

const box = {
  marginTop: 15,

  padding: 12,

  border:
    "1px solid #d8e2e8",

  borderRadius: 7,

  background: "#fff",
} as const;

const lab = {
  display: "block",

  color: "#64748b",

  fontSize: 9,

  fontWeight: 800,
} as const;

const btnOk = {
  flex: 1,

  height: 36,

  border:
    "1px solid #22a06b",

  borderRadius: 5,

  background: "#eaf8f0",

  color: "#07864c",

  fontSize: 10,

  fontWeight: 900,

  cursor: "pointer",
} as const;

const btnDiv = {
  flex: 1,

  height: 36,

  border:
    "1px solid #e0a000",

  borderRadius: 5,

  background: "#fff8df",

  color: "#9a6700",

  fontSize: 10,

  fontWeight: 900,

  cursor: "pointer",
} as const;

const overlay = {
  position: "absolute",

  inset: 0,

  zIndex: 999,

  background:
    "rgba(0,0,0,.45)",

  display: "flex",

  alignItems: "flex-end",
} as const;

const modalCss = {
  width: "100%",

  maxHeight: "84%",

  overflowY: "auto",

  background: "#fff",

  borderRadius:
    "16px 16px 0 0",

  padding: 16,

  boxSizing: "border-box",
} as const;

const campo = {
  width: "100%",

  minHeight: 42,

  border:
    "1px solid #cbd5e1",

  borderRadius: 6,

  background: "#fff",

  padding: "0 10px",

  fontSize: 12,

  boxSizing:
    "border-box",
} as const;

/* =========================================================
   NOVO — SELEÇÃO DE SERIAL
========================================================= */

const serialContainer = {
  display: "flex",

  flexDirection: "column",

  gap: 7,
} as const;

const serialRow = {
  width: "100%",

  minHeight: 52,

  display: "flex",

  alignItems: "center",

  gap: 10,

  padding: "8px 10px",

  border:
    "1.5px solid #cbd5e1",

  borderRadius: 7,

  boxSizing: "border-box",

  cursor: "pointer",

  transition:
    "all .15s ease",
} as const;

const serialResumo = {
  display: "grid",

  gridTemplateColumns:
    "repeat(3, 1fr)",

  gap: 6,

  marginTop: 8,
} as const;

/* =========================================================
   Precisamos tipar separadamente porque existem
   propriedades específicas dos elementos internos.
========================================================= */

const quantidadeAutomatica = {
  minHeight: 48,

  display: "flex",

  alignItems: "center",

  gap: 6,

  padding: "8px 10px",

  border:
    "1px solid #cbd5e1",

  borderRadius: 6,

  background: "#f8fafc",
} as const;
"use client";
import "./atel-v137-embarque.css";
import { usePedidoAtelV363 } from "@/lib/atelPedidosHomologacaoV363";

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
  requisicoesTecnicasMock,
} from "@/lib/requisicoesTecnicas";

import {
  finalizarEmbarque,
  iniciarEmbarque,
  obterEstado,
  registrarVolumeEmbarque,
  VolumeRequisicao,
} from "@/lib/requisicoesStore";

export default function EmbarqueDetalhePage() {
  const params =
    useParams();

  const router =
    useRouter();

  const idParam =
    params.id;

  const id =
    Number(
      Array.isArray(idParam)
        ? idParam[0]
        : idParam
    );

  const pedidoAtel = usePedidoAtelV363(id);
  const requisicao = useMemo(
    () => requisicoesTecnicasMock.find((req) => req.id === id) ?? pedidoAtel,
    [id, pedidoAtel]
  );

  const [carregado, setCarregado] =
    useState(false);

  const [volumes, setVolumes] =
    useState<VolumeRequisicao[]>(
      []
    );

  const [codigoLido, setCodigoLido] =
    useState("");

  const [mensagem, setMensagem] =
    useState("");

  const [finalizando, setFinalizando] =
    useState(false);

  function atualizar() {
    if (!requisicao) {
      return;
    }

    const estado =
      obterEstado(
        requisicao
      );

    setVolumes(
      estado.volumes ?? []
    );
  }

  useEffect(() => {
    if (!requisicao) {
      setCarregado(true);
      return;
    }

    try {
      const estado =
        iniciarEmbarque(
          requisicao
        );

      setVolumes(
        estado.volumes ?? []
      );
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar o embarque."
      );
    } finally {
      setCarregado(true);
    }
  }, [requisicao]);

  if (!carregado) {
    return (
      <TelaMensagem
        texto="Carregando..."
      />
    );
  }

  if (!requisicao) {
    return (
      <TelaMensagem
        texto="Requisição não encontrada."
      />
    );
  }

  const requisicaoSeguro = requisicao;

  const volumesLidos =
    volumes.filter(
      (volume) =>
        volume.status ===
          "EMBARCADO" ||
        volume.status ===
          "EM_TRANSITO" ||
        volume.status ===
          "RECEBIDO"
    );

  const faltam =
    Math.max(
      volumes.length -
        volumesLidos.length,
      0
    );

  const todosLidos =
    volumes.length > 0 &&
    faltam === 0;

  function lerVolume() {
    const codigo =
      codigoLido
        .trim()
        .toUpperCase();

    if (!codigo) {
      setMensagem(
        "Leia ou informe o código do volume."
      );
      return;
    }

    try {
      const volume =
        registrarVolumeEmbarque(
          requisicaoSeguro,
          codigo
        );

      atualizar();

      setCodigoLido("");

      setMensagem(
        `✓ ${volume.codigo} conferido para embarque.`
      );
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o volume."
      );
    }
  }

  function concluir() {
    try {
      setFinalizando(true);

      finalizarEmbarque(
        requisicaoSeguro
      );

      setMensagem(
        "Embarque finalizado. Material em trânsito para o técnico."
      );

      window.setTimeout(
        () => {
          router.push(
            "/coletor/embarque"
          );
        },
        700
      );
    } catch (error) {
      setFinalizando(false);

      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar o embarque."
      );
    }
  }

  const primeiroPendente =
    volumes.find(
      (volume) =>
        volume.status ===
        "FECHADO"
    );

  return (
    <div className="collector-screen atel-ds-v137-embarque">
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

        <div className="atel-v137-embarque-header"
          style={{
            minHeight: 76,
            background: "#168bb2",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 16px",
            flex: "0 0 auto",
          }}
        >
          <button type="button" onClick={() => router.push("/coletor/embarque")}
            aria-label="Voltar à lista de embarques" style={{border:0,background:"transparent",color:"white",cursor:"pointer"}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>

          <div
            style={{
              flex: 1,
              lineHeight: 1,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              #
              {requisicaoSeguro.codigo.replace(
                "REQ-",
                ""
              )}
            </div>

            <div
              style={{
                marginTop: 3,
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              {requisicaoSeguro.tecnico.toUpperCase()}
            </div>

            <div
              style={{
                marginTop: 2,
                fontSize: 9,
              }}
            >
              {requisicaoSeguro.codigoTecnico} •{" "}
              {requisicaoSeguro.base}
            </div>
          </div>

          <span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M7 7l1 13h10l1-13M9 7V4h6v3"/></svg></span>
        </div>

        <div className="atel-v137-embarque-body"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding:
              "12px 12px 120px",
          }}
        >
          <section
            style={cardStyle}
          >
            <div
              style={
                tituloStyle
              }
            >
              Embarque de Volumes

              <span style={iconeStyle}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 11l2 2 4-4M9 17h6"/></svg></span>
            </div>

            <div
              style={{
                marginTop: 14,
                padding:
                  "10px 12px",
                borderRadius: 6,
                background:
                  "#e8f6fb",
                color: "#087da7",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              Conferência finalizada.
              Leia os volumes para
              liberar o transporte.
            </div>

            <div className="atel-v137-embarque-metrics" style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:8,marginTop:12}}>
              <Resumo
                titulo="ESPERADOS"
                valor={
                  volumes.length
                }
              />

              <Resumo
                titulo="LIDOS"
                valor={
                  volumesLidos.length
                }
              />

              <Resumo
                titulo="FALTAM"
                valor={faltam}
              />
            </div>
          </section>

          <section
            style={{
              ...cardStyle,
              marginTop: 12,
            }}
          >
            <div
              style={
                tituloStyle
              }
            >
              Destino

              <span style={iconeStyle}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-7 8-12a8 8 0 1 0-16 0c0 5 8 12 8 12Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 17,
                fontWeight: 900,
              }}
            >
              {requisicaoSeguro.tecnico}
            </div>

            <div
              style={{
                marginTop: 3,
                color: "#087da7",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {requisicaoSeguro.codigoTecnico} •{" "}
              {requisicaoSeguro.base}
            </div>

            <div
              style={{
                marginTop: 7,
                fontSize: 11,
                color: "#666",
              }}
            >
              Tipo:{" "}
              <strong>
                {requisicaoSeguro.tipo}
              </strong>
            </div>
          </section>

          <section
            style={{
              ...cardStyle,
              marginTop: 12,
            }}
          >
            <div
              style={
                tituloStyle
              }
            >
              Leitura do Volume

              <span style={iconeStyle}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M22 8v8"/></svg></span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 84px",
                marginTop: 14,
                minHeight: 52,
                border:
                  "1px solid #168bb2",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <input
                value={
                  codigoLido
                }
                onChange={(e) =>
                  setCodigoLido(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key ===
                    "Enter"
                  ) {
                    lerVolume();
                  }
                }}
                placeholder="Leia o código do volume"
                autoComplete="off"
                style={{
                  minWidth: 0,
                  border: 0,
                  outline: 0,
                  padding:
                    "0 12px",
                  fontSize: 13,
                }}
              />

              <button
                type="button"
                onClick={lerVolume}
                style={{
                  border: 0,
                  background:
                    "#168bb2",
                  color: "#fff",
                  fontSize: 24,
                  cursor: "pointer",
                }}
              >
                ✓
              </button>
            </div>

            {primeiroPendente && (
              <button
                type="button"
                onClick={() =>
                  setCodigoLido(
                    primeiroPendente.codigo
                  )
                }
                style={{
                  marginTop: 7,
                  border: 0,
                  background:
                    "transparent",
                  padding: 0,
                  color: "#087da7",
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Simular leitura:{" "}
                {primeiroPendente.codigo}
              </button>
            )}
          </section>

          <section
            style={{
              ...cardStyle,
              marginTop: 12,
            }}
          >
            <div
              style={
                tituloStyle
              }
            >
              Volumes

              <span style={iconeStyle}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg></span>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gap: 8,
              }}
            >
              {volumes.map(
                (volume) => {
                  const lido =
                    volume.status ===
                      "EMBARCADO" ||
                    volume.status ===
                      "EM_TRANSITO" ||
                    volume.status ===
                      "RECEBIDO";

                  return (
                    <div
                      key={
                        volume.id
                      }
                      style={{
                        border:
                          lido
                            ? "1px solid #3aa879"
                            : "1px solid #cbd5df",
                        borderRadius: 7,
                        padding:
                          "11px 12px",
                        background:
                          lido
                            ? "#edf9f3"
                            : "#fff",
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        gap: 10,
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            display:
                              "block",
                            fontSize: 12,
                          }}
                        >
                          {
                            volume.codigo
                          }
                        </strong>

                        <span
                          style={{
                            display:
                              "block",
                            marginTop: 3,
                            color:
                              "#687685",
                            fontSize: 10,
                          }}
                        >
                          {
                            Object.keys(
                              volume.itens
                            ).length
                          }{" "}
                          SKU(s)
                        </span>
                      </div>

                      <span
                        style={{
                          borderRadius:
                            20,
                          padding:
                            "5px 8px",
                          background:
                            lido
                              ? "#d7f3e5"
                              : "#eef2f5",
                          color:
                            lido
                              ? "#087647"
                              : "#687685",
                          fontSize: 9,
                          fontWeight:
                            900,
                        }}
                      >
                        {lido
                          ? "✓ LIDO"
                          : "PENDENTE"}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </section>

          {mensagem && (
            <div
              style={{
                marginTop: 12,
                padding:
                  "10px 12px",
                border:
                  "1px solid #9ed8eb",
                borderRadius: 6,
                background:
                  "#e9f7fc",
                color: "#087da7",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {mensagem}
            </div>
          )}
        </div>

        <div className="atel-v137-embarque-actions"
          style={{
            flex: "0 0 auto",
            padding: "10px 12px 12px",
            background: "#fff",
            borderTop:
              "1px solid #ddd",
          }}
        >
          <button
            type="button"
            disabled={
              !todosLidos ||
              finalizando
            }
            onClick={concluir}
            style={{
              width: "100%",
              minHeight: 50,
              border: 0,
              background:
                todosLidos
                  ? "#168bb2"
                  : "#9acddd",
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              cursor:
                todosLidos
                  ? "pointer"
                  : "default",
            }}
          >
            {finalizando
              ? "FINALIZANDO..."
              : todosLidos
              ? "FINALIZAR EMBARQUE"
              : `AGUARDANDO ${faltam} VOLUME(S)`}
          </button>
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

function TelaMensagem({
  texto,
}: {
  texto: string;
}) {
  return (
    <div className="collector-screen">
      <div
        className="collector-phone"
        style={{
          display: "grid",
          placeItems: "center",
        }}
      >
        {texto}
      </div>
    </div>
  );
}

function Resumo({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <div
      style={{
        minHeight: 66,
        border:
          "1px solid #d1dce4",
        borderRadius: 6,
        background: "#fff",
        display: "grid",
        placeItems: "center",
        alignContent: "center",
        gap: 5,
      }}
    >
      <span
        style={{
          fontSize: 9,
          color: "#536474",
        }}
      >
        {titulo}
      </span>

      <strong
        style={{
          color: "#087da7",
          fontSize: 18,
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

const cardStyle:
  React.CSSProperties = {
    background: "#fff",
    border:
      "1.5px solid #168bb2",
    borderRadius: 14,
    padding: "15px 14px",
  };

const tituloStyle:
  React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 10,
    color: "#087da7",
    fontSize: 14,
    fontWeight: 800,
  };

const iconeStyle:
  React.CSSProperties = {
    width: 42,
    height: 42,
    flex: "0 0 42px",
    borderRadius: "50%",
    background: "#168bb2",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontSize: 18,
  };
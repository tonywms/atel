"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import {
  carregarPatrimonioCliente,
  ouvirOrdensServico,
  type PatrimonioCliente,
} from "@/lib/ordensServicoStore";

/* =========================================================
   HELPERS
========================================================= */

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

function formatarData(data: string) {
  if (!data) return "-";

  const valor = new Date(data);

  if (Number.isNaN(valor.getTime())) {
    return data;
  }

  return valor.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: PatrimonioCliente["status"]) {
  if (status === "INSTALADO") return "INSTALADO";
  if (status === "VENDIDO") return "VENDIDO";
  if (status === "RETIRADO") return "RETIRADO";

  return status;
}

/* =========================================================
   PÁGINA
========================================================= */

export default function PatrimonioClientePage() {
  const [patrimonios, setPatrimonios] = useState<
    PatrimonioCliente[]
  >([]);

  const [busca, setBusca] = useState("");

  const [clienteSelecionado, setClienteSelecionado] =
    useState("");

  /* =======================================================
     CARREGAMENTO
  ======================================================= */

  function carregar() {
    const dados = carregarPatrimonioCliente();

    setPatrimonios(dados);

    setClienteSelecionado((atual) => {
      if (
        atual &&
        dados.some(
          (item) => item.codigoCliente === atual
        )
      ) {
        return atual;
      }

      return dados[0]?.codigoCliente ?? "";
    });
  }

  useEffect(() => {
    carregar();

    const off = ouvirOrdensServico(carregar);

    return () => {
      off();
    };
  }, []);

  /* =======================================================
     CLIENTES
  ======================================================= */

  const clientes = useMemo(() => {
    const mapa = new Map<
      string,
      {
        codigoCliente: string;
        cliente: string;
        quantidade: number;
        comodatos: number;
        vendidos: number;
      }
    >();

    patrimonios.forEach((item) => {
      const atual = mapa.get(item.codigoCliente);

      if (atual) {
        atual.quantidade += 1;

        if (item.tipo === "COMODATO") {
          atual.comodatos += 1;
        }

        if (item.tipo === "VENDA") {
          atual.vendidos += 1;
        }

        return;
      }

      mapa.set(item.codigoCliente, {
        codigoCliente: item.codigoCliente,
        cliente: item.cliente,
        quantidade: 1,
        comodatos: item.tipo === "COMODATO" ? 1 : 0,
        vendidos: item.tipo === "VENDA" ? 1 : 0,
      });
    });

    return Array.from(mapa.values()).sort((a, b) =>
      a.cliente.localeCompare(b.cliente)
    );
  }, [patrimonios]);

  /* =======================================================
     FILTRO
  ======================================================= */

  const patrimoniosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) {
      return patrimonios;
    }

    return patrimonios.filter((item) => {
      const texto = [
        item.codigoCliente,
        item.cliente,
        item.ordemServico,
        item.codigoProduto,
        item.produto,
        item.serial,
        item.tipo,
        item.tecnico,
        item.codigoTecnico,
        item.status,
      ]
        .join(" ")
        .toLowerCase();

      return texto.includes(termo);
    });
  }, [patrimonios, busca]);

  const clientesFiltrados = useMemo(() => {
    if (!busca.trim()) {
      return clientes;
    }

    const codigos = new Set(
      patrimoniosFiltrados.map(
        (item) => item.codigoCliente
      )
    );

    return clientes.filter((cliente) =>
      codigos.has(cliente.codigoCliente)
    );
  }, [clientes, patrimoniosFiltrados, busca]);

  /* =======================================================
     CLIENTE SELECIONADO
  ======================================================= */

  const clienteAtual = useMemo(() => {
    const selecionado = clientes.find(
      (item) =>
        item.codigoCliente === clienteSelecionado
    );

    if (
      selecionado &&
      clientesFiltrados.some(
        (item) =>
          item.codigoCliente ===
          selecionado.codigoCliente
      )
    ) {
      return selecionado;
    }

    return clientesFiltrados[0] ?? null;
  }, [
    clientes,
    clientesFiltrados,
    clienteSelecionado,
  ]);

  /* =======================================================
     EQUIPAMENTOS DO CLIENTE
  ======================================================= */

  const equipamentosCliente = useMemo(() => {
    if (!clienteAtual) {
      return [];
    }

    return patrimoniosFiltrados
      .filter(
        (item) =>
          item.codigoCliente ===
          clienteAtual.codigoCliente
      )
      .sort(
        (a, b) =>
          new Date(b.instaladoEm).getTime() -
          new Date(a.instaladoEm).getTime()
      );
  }, [patrimoniosFiltrados, clienteAtual]);

  /* =======================================================
     INDICADORES
  ======================================================= */

  const totalClientes = new Set(
    patrimonios.map(
      (item) => item.codigoCliente
    )
  ).size;

  const totalEquipamentos = patrimonios.filter(
    (item) => item.status !== "RETIRADO"
  ).length;

  const totalComodatos = patrimonios.filter(
    (item) =>
      item.tipo === "COMODATO" &&
      item.status === "INSTALADO"
  ).length;

  const totalVendidos = patrimonios.filter(
    (item) =>
      item.tipo === "VENDA" &&
      item.status === "VENDIDO"
  ).length;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div style={pageStyle}>
      {/* ===================================================
          CABEÇALHO
      =================================================== */}

      <div style={headerCardStyle}>
        <div>
          <div style={eyebrowStyle}>
            RELATÓRIOS
          </div>

          <h1 style={titleStyle}>
            Patrimônio do Cliente
          </h1>

          <div style={subtitleStyle}>
            Equipamentos instalados, comodatos e materiais
            vinculados aos clientes.
          </div>
        </div>

        <button
          type="button"
          style={refreshButtonStyle}
          onClick={carregar}
        >
          ↻ ATUALIZAR
        </button>
      </div>

      {/* ===================================================
          INDICADORES
      =================================================== */}

      <div style={metricsGridStyle}>
        <MetricCard
          icon="♟"
          label="CLIENTES"
          value={totalClientes}
          description="com patrimônio vinculado"
        />

        <MetricCard
          icon="▣"
          label="EQUIPAMENTOS"
          value={totalEquipamentos}
          description="ativos em clientes"
        />

        <MetricCard
          icon="↔"
          label="COMODATOS"
          value={totalComodatos}
          description="ativos instalados"
        />

        <MetricCard
          icon="✓"
          label="VENDIDOS"
          value={totalVendidos}
          description="equipamentos vendidos"
        />
      </div>

      {/* ===================================================
          PESQUISA
      =================================================== */}

      <div style={searchCardStyle}>
        <span style={searchIconStyle}>
          ⌕
        </span>

        <input
          value={busca}
          onChange={(event) =>
            setBusca(event.target.value)
          }
          placeholder="Buscar cliente, código, produto, serial, OS ou técnico..."
          style={searchInputStyle}
        />

        <div style={searchBadgeStyle}>
          {clientesFiltrados.length}{" "}
          {clientesFiltrados.length === 1
            ? "cliente"
            : "clientes"}
        </div>
      </div>

      {/* ===================================================
          CONTEÚDO PRINCIPAL
      =================================================== */}

      <div style={masterDetailStyle}>
        {/* ===============================================
            LISTA DE CLIENTES

            IMPORTANTE:
            NÃO USAR <aside> AQUI.
            O CSS GLOBAL DO SISTEMA USA ASIDE PARA O MENU.
        =============================================== */}

        <div style={clientListStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <strong style={panelHeaderTitleStyle}>
                CLIENTES
              </strong>

              <div style={panelHeaderSubtitleStyle}>
                Patrimônio em campo
              </div>
            </div>

            <div style={panelCountStyle}>
              {clientesFiltrados.length}
            </div>
          </div>

          <div style={clientScrollStyle}>
            {clientesFiltrados.length === 0 && (
              <div style={emptyStyle}>
                Nenhum cliente encontrado.
              </div>
            )}

            {clientesFiltrados.map((cliente) => {
              const ativo =
                clienteAtual?.codigoCliente ===
                cliente.codigoCliente;

              return (
                <button
                  key={cliente.codigoCliente}
                  type="button"
                  onClick={() =>
                    setClienteSelecionado(
                      cliente.codigoCliente
                    )
                  }
                  style={{
                    ...clientButtonStyle,
                    ...(ativo
                      ? clientButtonActiveStyle
                      : {}),
                  }}
                >
                  <div style={avatarStyle}>
                    {iniciais(cliente.cliente)}
                  </div>

                  <div style={clientButtonInfoStyle}>
                    <strong style={clientNameStyle}>
                      {cliente.cliente}
                    </strong>

                    <span style={clientCodeStyle}>
                      {cliente.codigoCliente}
                    </span>

                    <span style={clientSmallStyle}>
                      {cliente.comodatos} comodato
                      {cliente.comodatos !== 1 ? "s" : ""}
                      {" • "}
                      {cliente.vendidos} vendido
                      {cliente.vendidos !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div style={clientQuantityStyle}>
                    <strong>
                      {cliente.quantidade}
                    </strong>

                    <span>
                      ITENS
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===============================================
            DETALHE
        =============================================== */}

        <div style={detailStyle}>
          {!clienteAtual ? (
            <div style={emptyDetailStyle}>
              Nenhum patrimônio registrado.
            </div>
          ) : (
            <>
              <div style={detailHeaderStyle}>
                <div>
                  <div style={eyebrowSmallStyle}>
                    PATRIMÔNIO EM CAMPO
                  </div>

                  <h2 style={detailTitleStyle}>
                    {clienteAtual.cliente}
                  </h2>

                  <div style={detailSubtitleStyle}>
                    {clienteAtual.codigoCliente}
                  </div>
                </div>

                <div style={detailMetricsStyle}>
                  <SmallMetric
                    label="ITENS"
                    value={clienteAtual.quantidade}
                  />

                  <SmallMetric
                    label="COMODATOS"
                    value={clienteAtual.comodatos}
                  />

                  <SmallMetric
                    label="VENDIDOS"
                    value={clienteAtual.vendidos}
                  />
                </div>
              </div>

              <div style={equipmentGridStyle}>
                {equipamentosCliente.length === 0 && (
                  <div style={emptyDetailStyle}>
                    Nenhum equipamento encontrado para este
                    cliente.
                  </div>
                )}

                {equipamentosCliente.map((item) => (
                  <EquipmentCard
                    key={item.id}
                    item={item}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===================================================
          MOVIMENTAÇÕES RECENTES
      =================================================== */}

      {clienteAtual && (
        <div style={historyStyle}>
          <div style={historyHeaderStyle}>
            <div>
              <strong style={panelHeaderTitleStyle}>
                MOVIMENTAÇÕES RECENTES
              </strong>

              <div style={panelHeaderSubtitleStyle}>
                Histórico de {clienteAtual.cliente}
              </div>
            </div>

            <div style={panelCountStyle}>
              {equipamentosCliente.length}
            </div>
          </div>

          {equipamentosCliente.length === 0 ? (
            <div style={emptyStyle}>
              Nenhuma movimentação registrada.
            </div>
          ) : (
            equipamentosCliente.flatMap((item, index) => {
              const eventos = [
                <div
                  key={`${item.id}-${item.serial}-${item.ordemServico}-instalacao-${index}`}
                  style={historyRowStyle}
                >
                  <div style={{ ...historyIconStyle, ...historyIconInstalledStyle }}>↓</div>
                  <div style={historyInfoStyle}>
                    <div style={historyTitleLineStyle}>
                      <strong>
                        {item.tipo === "COMODATO" ? "Instalação em comodato" : "Venda ao cliente"}
                      </strong>
                      <span style={documentBadgeStyle}>{item.ordemServico}</span>
                    </div>
                    <div style={historyDescriptionStyle}>
                      {item.codigoProduto} • {item.produto} • {formatarData(item.instaladoEm)}
                    </div>
                    {item.serial && <div style={serialBadgeStyle}># {item.serial}</div>}
                  </div>
                  <div style={historyStatusStyle}>
                    {item.tipo === "COMODATO" ? "INSTALADO" : "VENDIDO"}
                  </div>
                </div>,
              ];

              if (item.status === "RETIRADO" && item.retiradoEm) {
                eventos.push(
                  <div
                    key={`${item.id}-${item.serial}-${item.ordemRetirada ?? "RETIRADA"}-retirada-${index}`}
                    style={historyRowStyle}
                  >
                    <div style={{ ...historyIconStyle, ...historyIconRemovedStyle }}>↑</div>
                    <div style={historyInfoStyle}>
                      <div style={historyTitleLineStyle}>
                        <strong>Retirada do cliente</strong>
                        <span style={documentBadgeStyle}>{item.ordemRetirada ?? "-"}</span>
                      </div>
                      <div style={historyDescriptionStyle}>
                        {item.codigoProduto} • {item.produto} • {formatarData(item.retiradoEm)}
                      </div>
                      {item.serial && <div style={serialBadgeStyle}># {item.serial}</div>}
                    </div>
                    <div style={historyStatusStyle}>RETIRADO</div>
                  </div>
                );
              }

              return eventos;
            })
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   CARD INDICADOR
========================================================= */

function MetricCard({
  icon,
  label,
  value,
  description,
}: {
  icon: string;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div style={metricCardStyle}>
      <div style={metricIconStyle}>
        {icon}
      </div>

      <div style={metricInfoStyle}>
        <span style={metricLabelStyle}>
          {label}
        </span>

        <strong style={metricValueStyle}>
          {value}
        </strong>

        <span style={metricDescriptionStyle}>
          {description}
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   INDICADOR PEQUENO
========================================================= */

function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={smallMetricStyle}>
      <span style={smallMetricLabelStyle}>
        {label}
      </span>

      <strong style={smallMetricValueStyle}>
        {value}
      </strong>
    </div>
  );
}

/* =========================================================
   CARD EQUIPAMENTO
========================================================= */

function EquipmentCard({
  item,
}: {
  item: PatrimonioCliente;
}) {
  const ativo =
    item.status !== "RETIRADO";

  return (
    <div style={equipmentCardStyle}>
      <div style={equipmentTopStyle}>
        <div style={equipmentIdentityStyle}>
          <div style={equipmentIconStyle}>
            ▣
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={equipmentCodeStyle}>
              {item.codigoProduto}
            </div>

            <strong style={equipmentNameStyle}>
              {item.produto}
            </strong>
          </div>
        </div>

        <div style={equipmentQuantityStyle}>
          1
          <span style={equipmentUnitStyle}>
            UN
          </span>
        </div>
      </div>

      <div style={equipmentBadgesStyle}>
        <span
          style={{
            ...typeBadgeStyle,
            ...(item.tipo === "VENDA"
              ? saleBadgeStyle
              : {}),
          }}
        >
          • {item.tipo}
        </span>

        <span
          style={{
            ...statusBadgeStyle,
            ...(ativo
              ? activeStatusStyle
              : removedStatusStyle),
          }}
        >
          • {statusLabel(item.status)}
        </span>
      </div>

      {item.serial && (
        <div style={equipmentSerialStyle}>
          # {item.serial}
        </div>
      )}

      <div style={equipmentDividerStyle} />

      <div style={equipmentMetaGridStyle}>
        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>
            OS
          </span>

          <strong style={metaValueStyle}>
            {item.ordemServico}
          </strong>
        </div>

        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>
            TÉCNICO
          </span>

          <strong style={metaValueStyle}>
            {item.tecnico}
          </strong>
        </div>

        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>
            CÓDIGO
          </span>

          <strong style={metaValueStyle}>
            {item.codigoTecnico}
          </strong>
        </div>

        <div style={metaItemStyle}>
          <span style={metaLabelStyle}>
            INSTALAÇÃO
          </span>

          <strong style={metaValueStyle}>
            {formatarData(item.instaladoEm)}
          </strong>
        </div>
      </div>

      {item.status === "RETIRADO" && item.retiradoEm && (
        <>
          <div style={equipmentDividerStyle} />
          <div style={equipmentMetaGridStyle}>
            <div style={metaItemStyle}>
              <span style={metaLabelStyle}>OS RETIRADA</span>
              <strong style={metaValueStyle}>{item.ordemRetirada ?? "-"}</strong>
            </div>
            <div style={metaItemStyle}>
              <span style={metaLabelStyle}>RETIRADO POR</span>
              <strong style={metaValueStyle}>{item.retiradoPorTecnico ?? item.tecnico}</strong>
            </div>
            <div style={metaItemStyle}>
              <span style={metaLabelStyle}>CÓDIGO</span>
              <strong style={metaValueStyle}>{item.retiradoPorCodigoTecnico ?? item.codigoTecnico}</strong>
            </div>
            <div style={metaItemStyle}>
              <span style={metaLabelStyle}>RETIRADA</span>
              <strong style={metaValueStyle}>{formatarData(item.retiradoEm)}</strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const pageStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: "100vh",
  boxSizing: "border-box",
  padding: 24,
  background: "#f4f7f9",
  color: "#0a1d2b",
};

const headerCardStyle: CSSProperties = {
  width: "100%",
  minHeight: 108,
  boxSizing: "border-box",
  background: "#fff",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dbe4e9",
  borderRadius: 14,
  padding: "20px 24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,.03)",
};

const eyebrowStyle: CSSProperties = {
  color: "#0096bd",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 2,
};

const eyebrowSmallStyle: CSSProperties = {
  color: "#0096bd",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 1.5,
};

const titleStyle: CSSProperties = {
  margin: "4px 0 2px",
  fontSize: 30,
  lineHeight: 1.05,
  fontWeight: 900,
  color: "#0a1d2b",
};

const subtitleStyle: CSSProperties = {
  color: "#7a8791",
  fontSize: 13,
};

const refreshButtonStyle: CSSProperties = {
  height: 46,
  padding: "0 22px",
  border: 0,
  borderRadius: 7,
  background: "#1498bd",
  color: "#fff",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const metricsGridStyle: CSSProperties = {
  width: "100%",
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: 14,
  marginTop: 14,
};

const metricCardStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 96,
  boxSizing: "border-box",
  background: "#fff",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dbe4e9",
  borderRadius: 12,
  padding: "16px",
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const metricIconStyle: CSSProperties = {
  width: 52,
  height: 52,
  flex: "0 0 52px",
  borderRadius: 12,
  background: "#e4f6fb",
  color: "#0096bd",
  display: "grid",
  placeItems: "center",
  fontSize: 22,
  fontWeight: 900,
};

const metricInfoStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
};

const metricLabelStyle: CSSProperties = {
  color: "#788692",
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 1,
};

const metricValueStyle: CSSProperties = {
  color: "#0498bd",
  fontSize: 29,
  lineHeight: 1,
  margin: "5px 0",
};

const metricDescriptionStyle: CSSProperties = {
  color: "#96a1a9",
  fontSize: 9,
};

const searchCardStyle: CSSProperties = {
  width: "100%",
  height: 62,
  boxSizing: "border-box",
  marginTop: 14,
  background: "#fff",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dbe4e9",
  borderRadius: 12,
  padding: "0 16px",
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const searchIconStyle: CSSProperties = {
  color: "#66808e",
  fontSize: 21,
};

const searchInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 42,
  border: 0,
  outline: "none",
  background: "transparent",
  color: "#42515c",
  fontSize: 13,
};

const searchBadgeStyle: CSSProperties = {
  flex: "0 0 auto",
  background: "#f0f4f6",
  color: "#50616d",
  borderRadius: 18,
  padding: "7px 14px",
  fontSize: 10,
  fontWeight: 800,
};

const masterDetailStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  display: "grid",
  gridTemplateColumns:
    "355px minmax(0, 1fr)",
  gap: 14,
  marginTop: 14,
  alignItems: "start",
};

const clientListStyle: CSSProperties = {
  minWidth: 0,
  background: "#fff",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dbe4e9",
  borderRadius: 12,
  overflow: "hidden",
};

const panelHeaderStyle: CSSProperties = {
  minHeight: 64,
  boxSizing: "border-box",
  padding: "14px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "#e4ebef",
};

const panelHeaderTitleStyle: CSSProperties = {
  color: "#0a1d2b",
  fontSize: 11,
  fontWeight: 900,
};

const panelHeaderSubtitleStyle: CSSProperties = {
  marginTop: 2,
  color: "#8b98a1",
  fontSize: 9,
};

const panelCountStyle: CSSProperties = {
  width: 30,
  height: 30,
  flex: "0 0 30px",
  borderRadius: "50%",
  background: "#e7f6fa",
  color: "#0096bd",
  display: "grid",
  placeItems: "center",
  fontSize: 10,
  fontWeight: 900,
};

const clientScrollStyle: CSSProperties = {
  maxHeight: 520,
  overflowY: "auto",
  padding: 10,
};

const clientButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 88,
  boxSizing: "border-box",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "transparent",
  borderRadius: 9,
  background: "#fff",
  display: "grid",
  gridTemplateColumns:
    "46px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 12,
  padding: "12px",
  marginBottom: 7,
  cursor: "pointer",
  textAlign: "left",
};

const clientButtonActiveStyle: CSSProperties = {
  background: "#eaf8fc",
  borderColor: "#a9ddeb",
  boxShadow: "inset 4px 0 0 #079bc3",
};

const avatarStyle: CSSProperties = {
  width: 43,
  height: 43,
  borderRadius: "50%",
  background: "#159abc",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontSize: 11,
  fontWeight: 900,
};

const clientButtonInfoStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
};

const clientNameStyle: CSSProperties = {
  color: "#0a1d2b",
  fontSize: 12,
  lineHeight: 1.2,
};

const clientCodeStyle: CSSProperties = {
  color: "#6d7d88",
  fontSize: 9,
  marginTop: 2,
};

const clientSmallStyle: CSSProperties = {
  color: "#8b98a1",
  fontSize: 8,
  marginTop: 3,
};

const clientQuantityStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  color: "#0799bd",
  fontSize: 10,
};

const detailStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 420,
  background: "#fff",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dbe4e9",
  borderRadius: 12,
  overflow: "hidden",
};

const detailHeaderStyle: CSSProperties = {
  minHeight: 92,
  boxSizing: "border-box",
  padding: "18px",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "#e4ebef",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
};

const detailTitleStyle: CSSProperties = {
  margin: "4px 0 2px",
  color: "#0a1d2b",
  fontSize: 22,
};

const detailSubtitleStyle: CSSProperties = {
  color: "#71818c",
  fontSize: 10,
};

const detailMetricsStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flex: "0 0 auto",
};

const smallMetricStyle: CSSProperties = {
  width: 82,
  height: 58,
  boxSizing: "border-box",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dbe4e9",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

const smallMetricLabelStyle: CSSProperties = {
  color: "#80909a",
  fontSize: 8,
  fontWeight: 900,
};

const smallMetricValueStyle: CSSProperties = {
  color: "#0799bd",
  fontSize: 19,
};

const equipmentGridStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: 12,
  padding: 12,
};

const equipmentCardStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 185,
  boxSizing: "border-box",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dbe4e9",
  borderRadius: 10,
  padding: 14,
  background: "#fff",
};

const equipmentTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

const equipmentIdentityStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const equipmentIconStyle: CSSProperties = {
  width: 42,
  height: 42,
  flex: "0 0 42px",
  borderRadius: 9,
  background: "#e8f7fb",
  color: "#0096bd",
  display: "grid",
  placeItems: "center",
};

const equipmentCodeStyle: CSSProperties = {
  color: "#0096bd",
  fontSize: 9,
  fontWeight: 900,
};

const equipmentNameStyle: CSSProperties = {
  display: "block",
  marginTop: 4,
  color: "#0a1d2b",
  fontSize: 12,
};

const equipmentQuantityStyle: CSSProperties = {
  flex: "0 0 auto",
  color: "#0a1d2b",
  fontSize: 22,
  fontWeight: 900,
  textAlign: "right",
};

const equipmentUnitStyle: CSSProperties = {
  display: "block",
  color: "#758590",
  fontSize: 8,
};

const equipmentBadgesStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 7,
  marginTop: 12,
};

const typeBadgeStyle: CSSProperties = {
  padding: "5px 10px",
  borderRadius: 14,
  background: "#e9f8ef",
  color: "#008b42",
  fontSize: 8,
  fontWeight: 900,
};

const saleBadgeStyle: CSSProperties = {
  background: "#e8f4ff",
  color: "#1476b8",
};

const statusBadgeStyle: CSSProperties = {
  padding: "5px 10px",
  borderRadius: 14,
  fontSize: 8,
  fontWeight: 900,
};

const activeStatusStyle: CSSProperties = {
  background: "#e9f8ef",
  color: "#008b42",
};

const removedStatusStyle: CSSProperties = {
  background: "#f1f3f4",
  color: "#77848c",
};

const equipmentSerialStyle: CSSProperties = {
  display: "inline-block",
  marginTop: 10,
  padding: "5px 9px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ccdbe2",
  borderRadius: 5,
  color: "#526571",
  fontSize: 8,
  fontWeight: 800,
};

const equipmentDividerStyle: CSSProperties = {
  height: 1,
  background: "#e5ebee",
  margin: "12px 0",
};

const equipmentMetaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const metaItemStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

const metaLabelStyle: CSSProperties = {
  color: "#89969e",
  fontSize: 7,
  fontWeight: 900,
};

const metaValueStyle: CSSProperties = {
  color: "#53636d",
  fontSize: 9,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const historyStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 14,
  background: "#fff",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#dbe4e9",
  borderRadius: 12,
  overflow: "hidden",
};

const historyHeaderStyle: CSSProperties = {
  minHeight: 62,
  boxSizing: "border-box",
  padding: "12px 16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "#e4ebef",
};

const historyRowStyle: CSSProperties = {
  minHeight: 72,
  margin: "0 16px",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "#e6ecef",
  display: "grid",
  gridTemplateColumns:
    "40px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 12,
};

const historyIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
};

const historyIconInstalledStyle: CSSProperties = {
  background: "#e5f7ed",
  color: "#009448",
};

const historyIconRemovedStyle: CSSProperties = {
  background: "#fff1dd",
  color: "#d17c00",
};

const historyInfoStyle: CSSProperties = {
  minWidth: 0,
};

const historyTitleLineStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#0a1d2b",
  fontSize: 11,
};

const documentBadgeStyle: CSSProperties = {
  background: "#edf2f4",
  color: "#61727d",
  borderRadius: 4,
  padding: "3px 6px",
  fontSize: 8,
  fontWeight: 800,
};

const historyDescriptionStyle: CSSProperties = {
  marginTop: 4,
  color: "#74838d",
  fontSize: 9,
};

const serialBadgeStyle: CSSProperties = {
  display: "inline-block",
  marginTop: 4,
  padding: "2px 6px",
  background: "#f1f4f5",
  borderRadius: 4,
  color: "#596b76",
  fontSize: 8,
};

const historyStatusStyle: CSSProperties = {
  color: "#009448",
  fontSize: 10,
  fontWeight: 900,
};

const emptyStyle: CSSProperties = {
  padding: 30,
  color: "#8b98a1",
  fontSize: 11,
  textAlign: "center",
};

const emptyDetailStyle: CSSProperties = {
  minHeight: 300,
  gridColumn: "1 / -1",
  display: "grid",
  placeItems: "center",
  color: "#8b98a1",
  fontSize: 12,
};
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { requisicoesTecnicasMock } from "@/lib/requisicoesTecnicas";

import {
  carregarEstados,
  ouvirAlteracoes,
} from "@/lib/requisicoesStore";

import {
  carregarRetornos,
  ouvirRetornos,
} from "@/lib/retornosStore";

import {
  carregarPendenciasRetorno,
  ouvirPendenciasRetorno,
} from "@/lib/pendenciasRetornoStore";

/* =========================================================
   TIPOS
========================================================= */

type ResumoExpedicao = {
  requisicoes: number;
  separacao: number;
  conferencia: number;
  embarque: number;
  transito: number;
  retornos: number;
  pendencias: number;
};

/* =========================================================
   PAGE
========================================================= */

export default function ExpedicoesPage() {
  const [resumo, setResumo] = useState<ResumoExpedicao>({
    requisicoes: 0,
    separacao: 0,
    conferencia: 0,
    embarque: 0,
    transito: 0,
    retornos: 0,
    pendencias: 0,
  });

  /* =======================================================
     ATUALIZAÇÃO DOS INDICADORES
  ======================================================= */

  function atualizar() {
    const estados = carregarEstados();

    let requisicoes = 0;
    let separacao = 0;
    let conferencia = 0;
    let embarque = 0;
    let transito = 0;

    requisicoesTecnicasMock.forEach((req) => {
      const status =
        estados[req.id]?.status ??
        req.status;

      requisicoes += 1;

      if (
        status === "PENDENTE" ||
        status === "EM_SEPARACAO"
      ) {
        separacao += 1;
      }

      if (
        status === "SEPARADA" ||
        status === "EM_CONFERENCIA"
      ) {
        conferencia += 1;
      }

      if (
        status === "CONFERIDA" ||
        status === "EMBARCADA"
      ) {
        embarque += 1;
      }

      if (
        status === "EM_TRANSITO" ||
        status === "ACEITE_PENDENTE"
      ) {
        transito += 1;
      }
    });

    const retornos = carregarRetornos().filter(
      (retorno) =>
        retorno.status !== "FINALIZADO"
    ).length;

    const pendencias =
      carregarPendenciasRetorno().filter(
        (pendencia) =>
          pendencia.status !== "RESOLVIDA"
      ).length;

    setResumo({
      requisicoes,
      separacao,
      conferencia,
      embarque,
      transito,
      retornos,
      pendencias,
    });
  }

  /* =======================================================
     EVENTOS
  ======================================================= */

  useEffect(() => {
    atualizar();

    const offRequisicoes =
      ouvirAlteracoes(atualizar);

    const offRetornos =
      ouvirRetornos(atualizar);

    const offPendencias =
      ouvirPendenciasRetorno(atualizar);

    return () => {
      offRequisicoes();
      offRetornos();
      offPendencias();
    };
  }, []);

  /* =======================================================
     TOTAL OPERAÇÃO
  ======================================================= */

  const totalOperacao = useMemo(() => {
    return (
      resumo.separacao +
      resumo.conferencia +
      resumo.embarque +
      resumo.transito
    );
  }, [resumo]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div style={styles.page}>
      {/* ===================================================
          CABEÇALHO
      =================================================== */}

      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>
            EXPEDIÇÕES
          </div>

          <h1 style={styles.title}>
            Gestão de Expedições
          </h1>

          <p style={styles.subtitle}>
            Controle operacional das expedições,
            requisições técnicas, retornos e
            logística reversa.
          </p>
        </div>

        <Link
          href="/expedicoes/requisicoes-tecnicas"
          style={styles.primaryButton}
        >
          + REQUISIÇÕES TÉCNICAS
        </Link>
      </div>

      {/* ===================================================
          KPIs
      =================================================== */}

      <div style={styles.kpiGrid}>
        <Kpi
          titulo="REQUISIÇÕES"
          valor={resumo.requisicoes}
          descricao="Demandas recebidas"
        />

        <Kpi
          titulo="EM SEPARAÇÃO"
          valor={resumo.separacao}
          descricao="Pendentes / separação"
        />

        <Kpi
          titulo="CONFERÊNCIA"
          valor={resumo.conferencia}
          descricao="Aguardando conferência"
        />

        <Kpi
          titulo="EMBARQUE"
          valor={resumo.embarque}
          descricao="Prontos para expedição"
        />

        <Kpi
          titulo="EM TRÂNSITO"
          valor={resumo.transito}
          descricao="A caminho do técnico"
        />

        <Kpi
          titulo="RETORNOS"
          valor={resumo.retornos}
          descricao="Retornos em aberto"
        />

        <Kpi
          titulo="PENDÊNCIAS"
          valor={resumo.pendencias}
          descricao="Divergências de retorno"
          alerta={resumo.pendencias > 0}
        />
      </div>

      {/* ===================================================
          PAINEL PRINCIPAL
      =================================================== */}

      <div style={styles.contentGrid}>
        {/* ===============================================
            ROTINAS
        =============================================== */}

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.panelEyebrow}>
                OPERAÇÃO
              </div>

              <h2 style={styles.panelTitle}>
                Rotinas de Expedição
              </h2>
            </div>

            <span style={styles.operationBadge}>
              {totalOperacao} EM OPERAÇÃO
            </span>
          </div>

          <div style={styles.menuGrid}>
            <Modulo
              titulo="Dashboard"
              descricao="Visão geral da operação de expedição."
              icone="▦"
            />

            <Modulo
              titulo="Gestão"
              descricao="Acompanhamento e gestão operacional."
              icone="☷"
            />

            <Modulo
              titulo="Conferência"
              descricao="Conferência dos materiais expedidos."
              icone="✓"
            />

            <Modulo
              titulo="Rel. Expedição"
              descricao="Relatórios da operação de expedição."
              icone="▤"
            />

            <Modulo
              titulo="Gerar Pedidos"
              descricao="Geração de pedidos para expedição."
              icone="+"
            />

            <Modulo
              titulo="Comparação Pedidos"
              descricao="Comparação e validação de pedidos."
              icone="⇄"
            />

            <Modulo
              titulo="Liberação de Pedidos"
              descricao="Liberação operacional dos pedidos."
              icone="✓"
            />
          </div>
        </div>

        {/* ===============================================
            ÚLTIMA MILHA
        =============================================== */}

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.panelEyebrow}>
                ÚLTIMA MILHA
              </div>

              <h2 style={styles.panelTitle}>
                Operação Técnica
              </h2>
            </div>
          </div>

          <div style={styles.lastMileList}>
            <Link
              href="/expedicoes/requisicoes-tecnicas"
              style={styles.actionCard}
            >
              <div style={styles.actionIcon}>
                ↗
              </div>

              <div style={styles.actionContent}>
                <strong style={styles.actionTitle}>
                  Requisições Técnicas
                </strong>

                <span style={styles.actionDescription}>
                  Abastecimento e materiais enviados
                  aos técnicos.
                </span>
              </div>

              <div style={styles.actionNumber}>
                {resumo.requisicoes}
              </div>

              <div style={styles.arrow}>
                ›
              </div>
            </Link>

            <Link
              href="/expedicoes/retornos"
              style={styles.actionCard}
            >
              <div style={styles.actionIcon}>
                ↩
              </div>

              <div style={styles.actionContent}>
                <strong style={styles.actionTitle}>
                  Retornos / Devoluções
                </strong>

                <span style={styles.actionDescription}>
                  Materiais retornando dos técnicos
                  para o CD.
                </span>
              </div>

              <div style={styles.actionNumber}>
                {resumo.retornos}
              </div>

              <div style={styles.arrow}>
                ›
              </div>
            </Link>

            <Link
              href="/expedicoes/pendencias"
              style={styles.actionCard}
            >
              <div
                style={{
                  ...styles.actionIcon,
                  ...(resumo.pendencias > 0
                    ? styles.actionIconAlert
                    : {}),
                }}
              >
                !
              </div>

              <div style={styles.actionContent}>
                <strong style={styles.actionTitle}>
                  Pendências de Retorno
                </strong>

                <span style={styles.actionDescription}>
                  Divergências encontradas durante
                  conferência dos retornos.
                </span>
              </div>

              <div
                style={{
                  ...styles.actionNumber,
                  ...(resumo.pendencias > 0
                    ? styles.actionNumberAlert
                    : {}),
                }}
              >
                {resumo.pendencias}
              </div>

              <div style={styles.arrow}>
                ›
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ===================================================
          FLUXO
      =================================================== */}

      <div style={styles.flowPanel}>
        <div style={styles.panelEyebrow}>
          FLUXO OPERACIONAL
        </div>

        <h2 style={styles.panelTitle}>
          Expedição → Técnico
        </h2>

        <div style={styles.flow}>
          <FlowItem
            numero="01"
            titulo="Demanda"
            descricao="API / ERP"
          />

          <FlowArrow />

          <FlowItem
            numero="02"
            titulo="Separação"
            descricao="CD"
          />

          <FlowArrow />

          <FlowItem
            numero="03"
            titulo="Conferência"
            descricao="WMS"
          />

          <FlowArrow />

          <FlowItem
            numero="04"
            titulo="Embarque"
            descricao="Expedição"
          />

          <FlowArrow />

          <FlowItem
            numero="05"
            titulo="Trânsito"
            descricao="Última milha"
          />

          <FlowArrow />

          <FlowItem
            numero="06"
            titulo="Técnico"
            descricao="Estoque móvel"
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   COMPONENTE KPI
========================================================= */

function Kpi({
  titulo,
  valor,
  descricao,
  alerta = false,
}: {
  titulo: string;
  valor: number;
  descricao: string;
  alerta?: boolean;
}) {
  return (
    <div style={styles.kpi}>
      <span style={styles.kpiTitle}>
        {titulo}
      </span>

      <strong
        style={{
          ...styles.kpiValue,
          ...(alerta
            ? styles.kpiValueAlert
            : {}),
        }}
      >
        {valor}
      </strong>

      <span style={styles.kpiDescription}>
        {descricao}
      </span>
    </div>
  );
}

/* =========================================================
   COMPONENTE MÓDULO
========================================================= */

function Modulo({
  titulo,
  descricao,
  icone,
}: {
  titulo: string;
  descricao: string;
  icone: string;
}) {
  return (
    <div style={styles.moduleCard}>
      <div style={styles.moduleIcon}>
        {icone}
      </div>

      <div>
        <strong style={styles.moduleTitle}>
          {titulo}
        </strong>

        <p style={styles.moduleDescription}>
          {descricao}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   COMPONENTE FLOW
========================================================= */

function FlowItem({
  numero,
  titulo,
  descricao,
}: {
  numero: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <div style={styles.flowItem}>
      <span style={styles.flowNumber}>
        {numero}
      </span>

      <strong style={styles.flowTitle}>
        {titulo}
      </strong>

      <span style={styles.flowDescription}>
        {descricao}
      </span>
    </div>
  );
}

function FlowArrow() {
  return (
    <div style={styles.flowArrow}>
      →
    </div>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    width: "100%",
    padding: "22px 24px 40px",
    boxSizing: "border-box",
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 20,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.4,
    color: "#0796bc",
    marginBottom: 5,
  },

  title: {
    margin: 0,
    fontSize: 27,
    lineHeight: 1.1,
    color: "#111827",
  },

  subtitle: {
    margin: "8px 0 0",
    fontSize: 12,
    color: "#66747d",
  },

  primaryButton: {
    minHeight: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 17px",
    borderRadius: 5,
    background: "#0796bc",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(135px, 1fr))",
    gap: 10,
    marginBottom: 14,
  },

  kpi: {
    background: "#ffffff",
    border: "1px solid #dce4e8",
    borderRadius: 7,
    padding: "13px 14px",
    minHeight: 88,
    boxSizing: "border-box",
  },

  kpiTitle: {
    display: "block",
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: 0.6,
    color: "#7b8992",
  },

  kpiValue: {
    display: "block",
    marginTop: 4,
    fontSize: 25,
    lineHeight: 1,
    color: "#0796bc",
  },

  kpiValueAlert: {
    color: "#d14343",
  },

  kpiDescription: {
    display: "block",
    marginTop: 7,
    fontSize: 9,
    color: "#8a98a1",
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1.4fr) minmax(300px, 0.8fr)",
    gap: 14,
  },

  panel: {
    background: "#ffffff",
    border: "1px solid #dce4e8",
    borderRadius: 8,
    overflow: "hidden",
  },

  panelHeader: {
    minHeight: 62,
    padding: "13px 15px",
    boxSizing: "border-box",
    borderBottom: "1px solid #e5ebee",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  panelEyebrow: {
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: 0.8,
    color: "#0796bc",
    marginBottom: 3,
  },

  panelTitle: {
    margin: 0,
    fontSize: 16,
    color: "#17212b",
  },

  operationBadge: {
    padding: "5px 8px",
    borderRadius: 999,
    background: "#e7f5fa",
    color: "#087b9d",
    fontSize: 8,
    fontWeight: 900,
  },

  menuGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 9,
    padding: 12,
  },

  moduleCard: {
    minHeight: 76,
    border: "1px solid #e1e7ea",
    borderRadius: 6,
    padding: 11,
    boxSizing: "border-box",
    display: "grid",
    gridTemplateColumns: "34px 1fr",
    gap: 10,
    alignItems: "center",
    background: "#ffffff",
  },

  moduleIcon: {
    width: 34,
    height: 34,
    borderRadius: 6,
    background: "#e8f6fa",
    color: "#0788ad",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 900,
  },

  moduleTitle: {
    display: "block",
    fontSize: 11,
    color: "#17212b",
  },

  moduleDescription: {
    margin: "4px 0 0",
    fontSize: 9,
    lineHeight: 1.35,
    color: "#7a8891",
  },

  lastMileList: {
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 9,
  },

  actionCard: {
    minHeight: 72,
    display: "grid",
    gridTemplateColumns:
      "38px minmax(0, 1fr) auto 16px",
    alignItems: "center",
    gap: 10,
    padding: "10px 11px",
    boxSizing: "border-box",
    border: "1px solid #e1e7ea",
    borderRadius: 6,
    background: "#ffffff",
    textDecoration: "none",
    color: "inherit",
  },

  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#e7f6fa",
    color: "#0789ad",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    fontWeight: 900,
  },

  actionIconAlert: {
    background: "#fdecec",
    color: "#c73b3b",
  },

  actionContent: {
    minWidth: 0,
  },

  actionTitle: {
    display: "block",
    fontSize: 11,
    color: "#17212b",
  },

  actionDescription: {
    display: "block",
    marginTop: 4,
    fontSize: 9,
    lineHeight: 1.3,
    color: "#7d8a92",
  },

  actionNumber: {
    minWidth: 27,
    height: 27,
    padding: "0 6px",
    borderRadius: 999,
    background: "#e7f6fa",
    color: "#0789ad",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 900,
  },

  actionNumberAlert: {
    background: "#fdecec",
    color: "#c73b3b",
  },

  arrow: {
    color: "#8b979e",
    fontSize: 20,
  },

  flowPanel: {
    marginTop: 14,
    background: "#ffffff",
    border: "1px solid #dce4e8",
    borderRadius: 8,
    padding: 15,
  },

  flow: {
    marginTop: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 7,
    overflowX: "auto",
    paddingBottom: 3,
  },

  flowItem: {
    minWidth: 100,
    minHeight: 70,
    padding: "9px 10px",
    boxSizing: "border-box",
    border: "1px solid #dfe6e9",
    borderRadius: 6,
    background: "#f9fbfc",
  },

  flowNumber: {
    display: "block",
    fontSize: 8,
    fontWeight: 900,
    color: "#0796bc",
  },

  flowTitle: {
    display: "block",
    marginTop: 4,
    fontSize: 10,
    color: "#17212b",
  },

  flowDescription: {
    display: "block",
    marginTop: 4,
    fontSize: 8,
    color: "#87949c",
  },

  flowArrow: {
    flex: "0 0 auto",
    fontSize: 17,
    fontWeight: 900,
    color: "#0796bc",
  },
};
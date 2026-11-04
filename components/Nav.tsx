"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();

  const active = (url: string) =>
    pathname === url;

  const relatoriosAberto =
    pathname.startsWith("/relatorios");

  const expedicoesAberto =
    pathname.startsWith("/expedicoes");

  return (
    <aside>
      <div className="brand">
        <div className="brand-logo">
          <div className="brand-symbol">
            W
          </div>

          <div className="brand-text">
            WMS<span>EXPERT</span>
          </div>
        </div>
      </div>

      <div className="wms-nav">
        <Link
          href="/"
          className={`wms-menu-item ${
            active("/") ? "active" : ""
          }`}
        >
          <span className="wms-menu-icon">
            ⌂
          </span>
          Início
        </Link>

        <div className="wms-menu-parent">
          <span className="wms-menu-icon">
            ⊕
          </span>
          Cadastros
          <span className="wms-chevron">
            ›
          </span>
        </div>

        {/* RELATÓRIOS */}

        <Link
          href="/relatorios/estoque-tecnico"
          className={`wms-menu-parent ${
            relatoriosAberto ? "open" : ""
          }`}
        >
          <span className="wms-menu-icon">
            ▣
          </span>

          Relatórios

          <span className="wms-chevron">
            {relatoriosAberto ? "⌄" : "›"}
          </span>
        </Link>

        {relatoriosAberto && (
          <div className="wms-submenu">
            <Link href="#">
              Estoque
            </Link>

            <Link
              href="/relatorios/estoque-tecnico"
              className={
                active(
                  "/relatorios/estoque-tecnico"
                )
                  ? "active"
                  : ""
              }
            >
              Estoque Técnico
            </Link>

            <Link
              href="/relatorios/patrimonio-cliente"
              className={
                active(
                  "/relatorios/patrimonio-cliente"
                )
                  ? "active"
                  : ""
              }
            >
              Patrimônio Cliente
            </Link>

            <Link href="#">
              Endereço
            </Link>

            <Link href="#">
              Produtividade
            </Link>

            <Link href="#">
              Vencimento
            </Link>

            <Link href="#">
              Abastecimento
            </Link>

            <Link href="#">
              Fotos
            </Link>

            <Link href="#">
              Corte
            </Link>

            <Link href="#">
              Extrato
            </Link>

            <Link href="#">
              Inventário
            </Link>

            <Link href="#">
              Manifesto de Entrega
            </Link>
          </div>
        )}

        {/* ENTRADAS */}

        <div className="wms-menu-parent">
          <span className="wms-menu-icon">
            ⌁
          </span>

          Entradas

          <span className="wms-chevron">
            ›
          </span>
        </div>

        {/* MOVIMENTAÇÕES */}

        <div className="wms-menu-parent">
          <span className="wms-menu-icon">
            ↔
          </span>

          Movimentações

          <span className="wms-chevron">
            ›
          </span>
        </div>

        {/* EXPEDIÇÕES */}

        <div
          className={`wms-menu-parent ${
            expedicoesAberto ? "open" : ""
          }`}
        >
          <span className="wms-menu-icon">
            ▱
          </span>

          Expedições

          <span className="wms-chevron">
            {expedicoesAberto ? "⌄" : "›"}
          </span>
        </div>

        {expedicoesAberto && (
          <div className="wms-submenu">
            <Link href="#">
              Dashboard
            </Link>

            <Link href="#">
              Gestão
            </Link>

            <Link href="#">
              Conferência
            </Link>

            <Link href="#">
              Rel. Expedição
            </Link>

            <Link href="#">
              Gerar Pedidos
            </Link>

            <Link href="#">
              Comparação Pedidos
            </Link>

            <Link href="#">
              Liberação de Pedidos
            </Link>

            <Link
              href="/expedicoes/requisicoes-tecnicas"
              className={
                active(
                  "/expedicoes/requisicoes-tecnicas"
                )
                  ? "active"
                  : ""
              }
            >
              Requisições Técnicas
            </Link>

            <Link
              href="/expedicoes/retornos"
              className={
                active(
                  "/expedicoes/retornos"
                )
                  ? "active"
                  : ""
              }
            >
              Retornos / Devoluções
            </Link>

            <Link
              href="/expedicoes/pendencias"
              className={
                active(
                  "/expedicoes/pendencias"
                )
                  ? "active"
                  : ""
              }
            >
              Pendências de Retorno
            </Link>
          </div>
        )}

        {/* AUDITORIA */}

        <div className="wms-menu-parent">
          <span className="wms-menu-icon">
            ☷
          </span>

          Auditoria

          <span className="wms-chevron">
            ›
          </span>
        </div>

        {/* ERP */}

        <div className="wms-menu-parent">
          <span className="wms-menu-icon">
            ◉
          </span>

          ERP

          <span className="wms-chevron">
            ›
          </span>
        </div>

        {/* PAINEL */}

        <div className="wms-menu-parent">
          <span className="wms-menu-icon">
            ▣
          </span>

          Painel

          <span className="wms-chevron">
            ›
          </span>
        </div>

        {/* PERMISSÕES */}

        <div className="wms-menu-parent">
          <span className="wms-menu-icon">
            ♢
          </span>

          Permissões

          <span className="wms-chevron">
            ›
          </span>
        </div>

        {/* ATUALIZAÇÕES */}

        <div className="wms-menu-parent">
          <span className="wms-menu-icon">
            ↻
          </span>

          Atualizações

          <span className="wms-chevron">
            ›
          </span>
        </div>
      </div>

      {/* USUÁRIO */}

      <div className="sidebar-user">
        <div className="user-line">
          <div className="user-avatar">
            AD
          </div>

          <div className="user-info">
            <strong>
              WMS TELECOM - ADM
            </strong>

            <span>
              admin@wmsexpert.com.br
            </span>
          </div>
        </div>

        <div className="logout">
          ↪ &nbsp; Sair
        </div>
      </div>
    </aside>
  );
}

export function Top() {
  return null;
}

export default Sidebar;
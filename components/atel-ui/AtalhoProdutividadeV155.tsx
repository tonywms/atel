"use client";

// ATEL E1 V155: atalho de produtividade reutilizavel nas 7 listas operacionais.
// Nao altera card, fluxo de estoque, API ou dimensoes do coletor.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";

const ROTAS = new Set([
  "/coletor/separacao", "/coletor/conferencia", "/coletor/embarque",
  "/coletor/recebimento", "/coletor/retornos", "/coletor/devolucao-cd",
  "/coletor/ordens-servico",
]);

function encontrarCabecalho(): HTMLElement | null {
  const phone = document.querySelector<HTMLElement>(".collector-phone");
  if (!phone) return null;
  // Rotinas com classe collector-header.
  const classHeader = phone.querySelector<HTMLElement>(".collector-header");
  if (classHeader) return classHeader;
  // RET e DEV usam estilo inline: identificar SOMENTE a faixa superior azul
  // com botao Voltar, sem depender de texto, estilo formatado ou posicao exata.
  const filhos = Array.from(phone.children).filter((x): x is HTMLElement => x instanceof HTMLElement);
  for (const el of filhos.slice(0, 7)) {
    if (!el.querySelector('button[aria-label*="Voltar"]')) continue;
    const background = getComputedStyle(el).backgroundImage;
    if (background.includes("gradient")) return el;
  }
  return null;
}

export default function AtalhoProdutividadeV155() {
  const pathname = usePathname();
  const router = useRouter();
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  const ativo = ROTAS.has(pathname ?? "");
  useEffect(() => {
    if (!ativo) { setAlvo(null); return; }
    const atualizar = () => {
      const encontrado = encontrarCabecalho();
      setAlvo((anterior) => anterior === encontrado ? anterior : encontrado);
    };
    atualizar();
    const observer = new MutationObserver(atualizar);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); setAlvo(null); };
  }, [ativo, pathname]);

  useEffect(() => {
    if (!alvo || !ativo) return;
    // O icone fica dentro do azul, mas nao ocupa espaco no fluxo da pagina.
    const anterior = alvo.style.position;
    if (getComputedStyle(alvo).position === "static") alvo.style.position = "relative";
    return () => { alvo.style.position = anterior; };
  }, [alvo, ativo]);

  if (!ativo || !alvo) return null;
  return createPortal(
    <button
      type="button"
      data-atel-atalho-produtividade-v155="true"
      aria-label="Abrir minha produtividade"
      title="Minha produtividade"
      onClick={() => router.push(`/coletor/produtividade?origem=${encodeURIComponent(pathname)}`)}
      style={{
        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
        zIndex: 5, width: 36, height: 36, padding: 0, display: "grid", placeItems: "center",
        border: "1px solid rgba(255,255,255,.24)", borderRadius: 11,
        background: "rgba(255,255,255,.13)", color: "#fff", cursor: "pointer",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.10)",
      }}
    >
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20V11m5 9V6m5 14v-7m5 7V4" />
        <path d="M2 21h20" />
      </svg>
    </button>,
    alvo,
  );
}

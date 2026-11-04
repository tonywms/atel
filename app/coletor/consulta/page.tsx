"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function ConsultaPage() {
  const router = useRouter();

  return (
    <div className="collector-screen">
      <div className="collector-phone">
        <div style={{ height: 40, background: "#000", flex: "0 0 auto" }} />

        <div className="collector-header" style={{ justifyContent: "center" }}>
          <div className="collector-header-title">
            <button
              type="button"
              className="collector-back-button"
              onClick={() => router.push("/coletor")}
            >
              ‹
            </button>
            <strong>Consulta</strong>
          </div>
        </div>

        <div style={S.body}>
          <button
            type="button"
            style={S.menu}
            onClick={() => router.push("/coletor/consulta/estoque")}
          >
            <span style={S.circle}>▦</span>
            <span style={S.text}>Estoque</span>
            <span style={S.arrow}>☷</span>
          </button>

          <button
            type="button"
            style={S.menu}
            onClick={() => router.push("/coletor/consulta/estoque-tecnico")}
          >
            <span style={S.circle}>▦</span>
            <span style={S.text}>Estoque Técnico</span>
            <span style={S.arrow}>☷</span>
          </button>
        </div>

        <div style={{ height: 36, background: "#000", flex: "0 0 auto" }} />
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  body: { flex: 1, padding: "18px 14px", background: "#f4f4f4", display: "flex", flexDirection: "column", gap: 12 },
  menu: { position: "relative", width: "100%", minHeight: 68, border: "1px solid #1687b0", borderRadius: 7, background: "#fff", display: "grid", gridTemplateColumns: "48px 1fr", alignItems: "center", gap: 8, padding: "9px 12px", boxShadow: "0 2px 4px rgba(0,0,0,.15)", textAlign: "left", cursor: "pointer" },
  circle: { width: 34, height: 34, borderRadius: "50%", background: "#d9f3fb", color: "#1287ae", display: "grid", placeItems: "center", fontSize: 20, fontWeight: 700 },
  text: { fontSize: 16, color: "#333" },
  arrow: { position: "absolute", right: 18, bottom: 8, color: "#1287ae", fontSize: 12 },
};
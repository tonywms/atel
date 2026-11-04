"use client";

import { useRouter } from "next/navigation";

export default function ColetorMenuPage() {
  const router = useRouter();

  return (
    <div className="collector-screen">
      <div className="collector-phone">
        {/* BARRA SUPERIOR */}
        <div style={topBarStyle} />

        {/* ÁREA PRINCIPAL */}
        <div style={mainStyle}>
          {/* LOGO */}
          <div style={logoStyle}>
            <div style={logoSymbolStyle}>
              <span style={logoLeftStyle} />
              <span style={logoCenterStyle} />
              <span style={logoRightStyle} />
            </div>

            <span style={logoTextStyle}>
              WMSEXPERT
            </span>
          </div>

          {/* LOGIN */}
          <div style={loginContainerStyle}>
            <div style={avatarStyle}>
              <span style={avatarHeadStyle} />
              <span style={avatarBodyStyle} />
            </div>

            <div style={loginBoxStyle}>
              <div style={loginLabelStyle}>
                Login
              </div>

              <div style={loginEmailStyle}>
                adm@wmsexpert.com.br
              </div>
            </div>
          </div>

          {/* MENU PRINCIPAL */}
          <div style={menuGridStyle}>
            {/* CADASTRO */}
            <button
              type="button"
              style={menuCardStyle}
              onClick={() =>
                router.push("/coletor/cadastro")
              }
            >
              <div style={iconAreaStyle}>
                <div style={plusCircleStyle}>
                  <span style={plusHorizontalStyle} />
                  <span style={plusVerticalStyle} />
                </div>
              </div>

              <span style={menuTextStyle}>
                Cadastro
              </span>
            </button>

            {/* CONSULTA */}
            <button
              type="button"
              style={menuCardStyle}
              onClick={() =>
                router.push("/coletor/consulta")
              }
            >
              <div style={iconAreaStyle}>
                <div style={searchIconStyle}>
                  <span style={searchHandleStyle} />
                </div>
              </div>

              <span style={menuTextStyle}>
                Consulta
              </span>
            </button>

            {/* RECEPÇÃO */}
            <button
              type="button"
              style={menuCardStyle}
              onClick={() =>
                router.push("/coletor/recepcao")
              }
            >
              <div style={iconAreaStyle}>
                <span style={largeIconStyle}>
                  ♟♟
                </span>
              </div>

              <span style={menuTextStyle}>
                Recepção
              </span>
            </button>

            {/* MOVIMENTAÇÃO */}
            <button
              type="button"
              style={menuCardStyle}
              onClick={() =>
                router.push("/coletor/movimentacao")
              }
            >
              <div style={iconAreaStyle}>
                <span style={largeIconStyle}>
                  ▥
                </span>
              </div>

              <span style={menuTextStyle}>
                Movimentação
              </span>
            </button>

            {/* EXPEDIÇÃO */}
            <button
              type="button"
              style={menuCardStyle}
              onClick={() =>
                router.push("/coletor/expedicoes")
              }
            >
              <div style={iconAreaStyle}>
                <span
                  style={{
                    ...largeIconStyle,
                    transform: "rotate(-8deg)",
                  }}
                >
                  ◩
                </span>
              </div>

              <span style={menuTextStyle}>
                Expedição
              </span>
            </button>

            {/* AUDITORIA */}
            <button
              type="button"
              style={menuCardStyle}
              onClick={() =>
                router.push("/coletor/auditoria")
              }
            >
              <div style={iconAreaStyle}>
                <span style={largeIconStyle}>
                  ♜
                </span>
              </div>

              <span style={menuTextStyle}>
                Auditoria
              </span>
            </button>
          </div>

          {/* SAIR */}
          <button
            type="button"
            style={logoutStyle}
            onClick={() => router.push("/")}
          >
            <span style={logoutIconStyle}>
              ↪
            </span>

            <span>Sair</span>
          </button>

          {/* VERSÃO */}
          <div style={versionStyle}>
            Versão 0.0.0.0
          </div>
        </div>

        {/* BARRA INFERIOR */}
        <div style={bottomBarStyle}>
          <span style={androidBackStyle}>
            ‹
          </span>

          <span style={androidHomeStyle} />

          <span style={androidRecentStyle}>
            ▥
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const topBarStyle: React.CSSProperties = {
  height: 34,
  minHeight: 34,
  background: "#000",
};

const mainStyle: React.CSSProperties = {
  flex: 1,

  display: "flex",
  flexDirection: "column",

  alignItems: "center",

  padding: "16px 6px 12px",

  background:
    "linear-gradient(180deg, #1885ad 0%, #06a1bd 100%)",

  overflowY: "auto",
};

const logoStyle: React.CSSProperties = {
  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  gap: 5,

  height: 32,

  marginBottom: 4,

  color: "#fff",
};

const logoSymbolStyle: React.CSSProperties = {
  position: "relative",

  width: 23,
  height: 25,
};

const logoLeftStyle: React.CSSProperties = {
  position: "absolute",

  left: 2,
  top: 5,

  width: 7,
  height: 15,

  border: "2px solid #fff",

  transform: "skewY(30deg)",
};

const logoCenterStyle: React.CSSProperties = {
  position: "absolute",

  left: 8,
  top: 1,

  width: 7,
  height: 22,

  border: "2px solid #fff",

  transform: "skewY(-30deg)",
};

const logoRightStyle: React.CSSProperties = {
  position: "absolute",

  right: 1,
  top: 5,

  width: 7,
  height: 15,

  border: "2px solid #fff",

  transform: "skewY(30deg)",
};

const logoTextStyle: React.CSSProperties = {
  fontSize: 13,

  fontWeight: 500,

  color: "#fff",
};

const loginContainerStyle: React.CSSProperties = {
  height: 44,

  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  marginBottom: 6,
};

const avatarStyle: React.CSSProperties = {
  position: "relative",

  zIndex: 2,

  width: 40,
  height: 40,

  borderRadius: "50%",

  border: "1px solid #fff",

  background: "#e7f8fc",
};

const avatarHeadStyle: React.CSSProperties = {
  position: "absolute",

  width: 9,
  height: 9,

  left: 14,
  top: 8,

  border: "1.5px solid #0788af",

  borderRadius: "50%",
};

const avatarBodyStyle: React.CSSProperties = {
  position: "absolute",

  width: 14,
  height: 10,

  left: 11,
  bottom: 7,

  border: "1.5px solid #0788af",

  borderBottom: "none",

  borderRadius: "10px 10px 0 0",
};

const loginBoxStyle: React.CSSProperties = {
  position: "relative",

  width: 143,
  height: 29,

  marginLeft: -6,

  borderRadius: 18,

  background: "#fff",

  display: "flex",

  alignItems: "center",

  justifyContent: "center",
};

const loginLabelStyle: React.CSSProperties = {
  position: "absolute",

  top: -8,
  left: 10,

  padding: "1px 8px",

  border: "1px solid #0789b0",

  borderRadius: 6,

  background: "#fff",

  color: "#0780a7",

  fontSize: 8,

  fontWeight: 800,

  lineHeight: "11px",
};

const loginEmailStyle: React.CSSProperties = {
  paddingLeft: 11,

  color: "#086d8f",

  fontSize: 9,

  fontWeight: 700,
};

const menuGridStyle: React.CSSProperties = {
  width: "100%",

  display: "grid",

  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",

  gap: 6,
};

const menuCardStyle: React.CSSProperties = {
  height: 145,

  padding: 0,

  border: "none",

  borderRadius: 10,

  outline: "none",

  background: "#fff",

  display: "flex",

  flexDirection: "column",

  alignItems: "center",

  justifyContent: "center",

  gap: 20,

  cursor: "pointer",

  fontFamily: "inherit",
};

const iconAreaStyle: React.CSSProperties = {
  width: 54,
  height: 44,

  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  color: "#0784ad",
};

const menuTextStyle: React.CSSProperties = {
  color: "#087ea6",

  fontSize: 13,

  fontWeight: 800,
};

const plusCircleStyle: React.CSSProperties = {
  position: "relative",

  width: 30,
  height: 30,

  border: "2px solid #0784ad",

  borderRadius: "50%",
};

const plusHorizontalStyle: React.CSSProperties = {
  position: "absolute",

  width: 17,
  height: 2,

  left: 5,
  top: 12,

  background: "#0784ad",
};

const plusVerticalStyle: React.CSSProperties = {
  position: "absolute",

  width: 2,
  height: 17,

  left: 12,
  top: 5,

  background: "#0784ad",
};

const searchIconStyle: React.CSSProperties = {
  position: "relative",

  width: 27,
  height: 27,

  border: "2px solid #0784ad",

  borderRadius: "50%",
};

const searchHandleStyle: React.CSSProperties = {
  position: "absolute",

  width: 14,
  height: 2,

  right: -10,
  bottom: -5,

  background: "#0784ad",

  transform: "rotate(48deg)",

  transformOrigin: "left center",
};

const largeIconStyle: React.CSSProperties = {
  display: "block",

  color: "#0784ad",

  fontSize: 35,

  fontWeight: 700,

  lineHeight: 1,
};

const logoutStyle: React.CSSProperties = {
  minWidth: 86,

  height: 30,

  marginTop: 19,

  padding: "0 12px",

  border: "2px solid #fff",

  borderRadius: 7,

  background: "transparent",

  color: "#fff",

  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  gap: 7,

  cursor: "pointer",

  fontSize: 10,

  fontWeight: 700,

  boxShadow:
    "inset 0 0 0 1px #0783a8",
};

const logoutIconStyle: React.CSSProperties = {
  fontSize: 12,

  fontWeight: 700,
};

const versionStyle: React.CSSProperties = {
  marginTop: 8,

  color: "#fff",

  fontSize: 11,

  fontWeight: 700,
};

const bottomBarStyle: React.CSSProperties = {
  height: 36,

  minHeight: 36,

  padding: "0 48px",

  background: "#000",

  color: "#bfc4c7",

  display: "flex",

  alignItems: "center",

  justifyContent: "space-between",
};

const androidBackStyle: React.CSSProperties = {
  fontSize: 20,

  fontWeight: 300,

  lineHeight: 1,
};

const androidHomeStyle: React.CSSProperties = {
  width: 10,

  height: 10,

  border: "1px solid #bfc4c7",

  borderRadius: "50%",
};

const androidRecentStyle: React.CSSProperties = {
  fontSize: 15,

  lineHeight: 1,
};
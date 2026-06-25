import { useState } from "react";
import { createRoot } from "react-dom/client";

const screens = ["Alerts", "Templates", "Tasks", "Voice"] as const;
const buildStamp = "SHIFT_SECURE_DIAGNOSTIC_2026_06_25_REACT_ONLY";

type Screen = (typeof screens)[number];

function MobileDiagnostic() {
  const [activeScreen, setActiveScreen] = useState<Screen>("Alerts");

  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: "48px 20px",
        background: "#f7f7f2",
        color: "#121212",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: "28px",
          lineHeight: 1.15,
          fontWeight: 700,
        }}
      >
        Shift Secure Diagnostic
      </h1>
      <p
        style={{
          margin: "0 0 28px",
          fontSize: "16px",
          lineHeight: 1.4,
          color: "#454545",
        }}
      >
        React local state only
      </p>
      <p
        data-diagnostic-build={buildStamp}
        style={{
          margin: "0 0 24px",
          fontSize: "12px",
          lineHeight: 1.4,
          color: "#666666",
        }}
      >
        {buildStamp}
      </p>

      <div
        style={{
          display: "grid",
          gap: "12px",
        }}
      >
        {screens.map((screen) => (
          <button
            key={screen}
            type="button"
            onClick={() => setActiveScreen(screen)}
            style={{
              width: "100%",
              minHeight: "56px",
              border: "1px solid #121212",
              borderRadius: "0",
              background: activeScreen === screen ? "#121212" : "#ffffff",
              color: activeScreen === screen ? "#ffffff" : "#121212",
              font: "inherit",
              fontSize: "18px",
              fontWeight: 600,
              textAlign: "left",
              padding: "0 18px",
            }}
          >
            {screen}
          </button>
        ))}
      </div>

      <p
        style={{
          margin: "32px 0 0",
          fontSize: "20px",
          lineHeight: 1.35,
          fontWeight: 600,
        }}
      >
        {activeScreen} screen coming soon
      </p>
    </main>
  );
}

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(<MobileDiagnostic />);
}
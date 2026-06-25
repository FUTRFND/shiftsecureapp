import { useState } from "react";

type Section = "alerts" | "templates" | "tasks" | "voice";

export function MobileHome() {
  const [active, setActive] = useState<Section | null>(null);

  const message =
    active === "alerts"
      ? "Alerts screen coming soon"
      : active === "templates"
        ? "Templates screen coming soon"
        : active === "tasks"
          ? "Tasks screen coming soon"
          : active === "voice"
            ? "Voice screen coming soon"
            : "";

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Shift Secure</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          type="button"
          onClick={() => setActive("alerts")}
          style={{ padding: 16, fontSize: 16, textAlign: "left" }}
        >
          Alerts
        </button>
        <button
          type="button"
          onClick={() => setActive("templates")}
          style={{ padding: 16, fontSize: 16, textAlign: "left" }}
        >
          Templates
        </button>
        <button
          type="button"
          onClick={() => setActive("tasks")}
          style={{ padding: 16, fontSize: 16, textAlign: "left" }}
        >
          Tasks
        </button>
        <button
          type="button"
          onClick={() => setActive("voice")}
          style={{ padding: 16, fontSize: 16, textAlign: "left" }}
        >
          Voice
        </button>
      </div>

      {message ? <p style={{ marginTop: 20, fontSize: 14 }}>{message}</p> : null}
    </div>
  );
}

type PillState = "idle" | "recording" | "sending" | "error";

interface PillProps {
  state: PillState;
}

export function Pill({ state }: PillProps) {
  if (state === "idle") return null;

  const label: Record<Exclude<PillState, "idle">, string> = {
    recording: "Listening...",
    sending: "Sending...",
    error: "Error",
  };

  const dotColor = state === "error" ? "#f97316" : "#ef4444";
  const showWave = state === "recording";

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(24, 24, 27, 0.85)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "40px",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        backdropFilter: "blur(10px)",
        userSelect: "none",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: dotColor,
          boxShadow: `0 0 8px ${dotColor}`,
          flexShrink: 0,
        }}
      />
      <span style={{ color: "white", fontSize: "13px", fontWeight: 500 }}>
        {label[state as Exclude<PillState, "idle">]}
      </span>
      {showWave && (
        <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
          {[8, 14, 10, 18, 8].map((h, i) => (
            <div
              key={i}
              style={{
                width: "3px",
                height: `${h}px`,
                background: "#7dd3fc",
                borderRadius: "2px",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

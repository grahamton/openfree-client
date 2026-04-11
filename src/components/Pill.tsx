type PillState = "idle" | "recording" | "sending" | "error";

interface PillProps {
  state: PillState;
}

export function Pill({ state }: PillProps) {
  if (state === "idle") return null;

  const color =
    state === "recording" ? "#ef4444" :
    state === "sending"   ? "#f97316" :
                            "#ef4444"; // error

  return (
    <div
      style={{
        position: "fixed",
        bottom: "32px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 8px ${color}`,
        pointerEvents: "none",
      }}
    />
  );
}

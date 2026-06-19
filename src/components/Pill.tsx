type PillState = "idle" | "recording" | "sending" | "error";

interface PillProps {
  state: PillState;
  previewText?: string;
}

export function Pill({ state, previewText = "" }: PillProps) {
  if (state === "idle") return null;

  const dotColor =
    state === "recording" ? "#ef4444" :
    state === "sending"   ? "#f97316" :
                            "#ef4444"; // error

  let displayText = "";
  if (state === "recording") {
    displayText = previewText ? previewText : "Listening...";
  } else if (state === "sending") {
    displayText = "Processing...";
  } else if (state === "error") {
    displayText = "Error transcribing";
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "90%",
        maxWidth: "360px",
        height: "60px",
        backgroundColor: dotColor,
        backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.9))",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)",
        borderRadius: "30px",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        boxSizing: "border-box",
        pointerEvents: "none",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          backgroundColor: dotColor,
          boxShadow: `0 0 8px ${dotColor}`,
          marginRight: "12px",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          color: "rgba(255, 255, 255, 0.9)",
          fontSize: "14px",
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          flexGrow: 1,
        }}
      >
        {displayText}
      </span>
    </div>
  );
}

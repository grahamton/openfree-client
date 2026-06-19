import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Pill } from "./components/Pill";
import { Settings } from "./components/Settings";

type AppState = "idle" | "recording" | "sending" | "error";

function App() {
  const [state, setState] = useState<AppState>("idle");
  const [previewText, setPreviewText] = useState("");
  const isSettings = getCurrentWebviewWindow().label === "settings";

  useEffect(() => {
    if (isSettings) return;
    const unlistenState = listen<AppState>("dictation-state", (event) => {
      setState(event.payload);
      if (event.payload === "idle") {
        setPreviewText("");
      }
    });
    const unlistenPreview = listen<{ text: string }>("dictation-preview", (event) => {
      setPreviewText(event.payload.text);
    });
    return () => {
      unlistenState.then((f) => f());
      unlistenPreview.then((f) => f());
    };
  }, [isSettings]);

  useEffect(() => {
    if (isSettings) return;
    if (state !== "idle") {
      getCurrentWebviewWindow().show();
    } else {
      getCurrentWebviewWindow().hide();
    }
  }, [state, isSettings]);

  if (isSettings) return <Settings />;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "transparent",
        overflow: "hidden",
      }}
    >
      <Pill state={state} previewText={previewText} />
    </div>
  );
}

export default App;

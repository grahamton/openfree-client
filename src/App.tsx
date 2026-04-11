import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Pill } from "./components/Pill";
import { Settings } from "./components/Settings";

type AppState = "idle" | "recording" | "sending" | "error";

function App() {
  const [state, setState] = useState<AppState>("idle");
  const isSettings = getCurrentWebviewWindow().label === "settings";

  useEffect(() => {
    if (isSettings) return;
    const unlisten = listen<AppState>("dictation-state", (event) => {
      setState(event.payload);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [isSettings]);

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
      <Pill state={state} />
    </div>
  );
}

export default App;

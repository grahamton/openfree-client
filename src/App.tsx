import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Pill } from "./components/Pill";

type AppState = "idle" | "recording" | "sending" | "error";

function App() {
  const [state, setState] = useState<AppState>("idle");

  useEffect(() => {
    const unlisten = listen<AppState>("dictation-state", (event) => {
      setState(event.payload);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

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

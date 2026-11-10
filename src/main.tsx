import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { loadRuntimeConfig } from "@/lib/api";

// Read the optional /config.json first so the very first health check already uses the right server.
void loadRuntimeConfig().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

import React from "react";
import ReactDOM from "react-dom/client";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles/globals.css";
import "sweetalert2/dist/sweetalert2.min.css";

// 🌟 ดักจับปัญหา Dynamic Import Chunk Mismatch (เมื่อระบบมีการ Deploy โค้ดใหม่บน Vercel)
window.addEventListener("vite:preloadError", () => {
  console.warn("Vite preload error detected. Auto-reloading for latest build...");
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <SpeedInsights />
    </ErrorBoundary>
  </React.StrictMode>
);
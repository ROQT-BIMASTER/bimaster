import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startPhotoQueueProcessor } from "./lib/utils/photo-queue-processor";

// Registrar o Service Worker para funcionalidade offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('SW registrado: ', registration);
      })
      .catch((error) => {
        console.log('SW registro falhou: ', error);
      });
  });
}

// Iniciar processador de fila de análise de fotos
startPhotoQueueProcessor();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

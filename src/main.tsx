import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startPhotoQueueProcessor } from "./lib/utils/photo-queue-processor";

// Guardar referência para cleanup
let photoProcessorCleanup: (() => void) | null = null;

// Iniciar processador de fila com cleanup
photoProcessorCleanup = startPhotoQueueProcessor();

// Limpar recursos ao sair
window.addEventListener('beforeunload', () => {
  if (photoProcessorCleanup) photoProcessorCleanup();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

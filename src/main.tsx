import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startPhotoQueueProcessor } from "./lib/utils/photo-queue-processor";

// Guardar referências para cleanup
let swUpdateInterval: number | null = null;
let photoProcessorCleanup: (() => void) | null = null;

// Registrar o Service Worker para funcionalidade offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('✅ Service Worker registrado:', registration);
        
        // Verificar atualizações a cada 5 minutos (não 1 minuto)
        swUpdateInterval = window.setInterval(() => {
          registration.update();
        }, 300000); // 5 minutos
      })
      .catch((error) => {
        console.error('❌ Erro ao registrar Service Worker:', error);
      });
  });
}

// Iniciar processador de fila com cleanup
photoProcessorCleanup = startPhotoQueueProcessor();

// Limpar recursos ao sair
window.addEventListener('beforeunload', () => {
  if (swUpdateInterval) clearInterval(swUpdateInterval);
  if (photoProcessorCleanup) photoProcessorCleanup();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

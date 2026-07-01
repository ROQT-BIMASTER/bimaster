import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/fonts.css";
// Tipografia padronizada em todo o app (Projetos + Central + demais):
// DM Sans (body) e Space Grotesk (headings/display). Auto-hospedadas via
// @fontsource — sem dependência de Google Fonts CDN (funciona em CN/CSP estrita).
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource-variable/space-grotesk";
import "./index.css";


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listProjetosTool from "./tools/list-projetos";

// Build the OAuth issuer from the Supabase project ref. Vite inlines
// import.meta.env.VITE_SUPABASE_PROJECT_ID at build time, so this stays
// import-safe (no runtime env read). The fallback keeps the issuer well-formed
// during the throwaway manifest-extract eval where no token verifies anyway.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "bimaster-mcp",
  title: "Bimaster MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Bimaster ERP/PLM/CRM. Use `whoami` to verify the session, and `list_projetos` to see projects the signed-in user can access.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listProjetosTool],
});

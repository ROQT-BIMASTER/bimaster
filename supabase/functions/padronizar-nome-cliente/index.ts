import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { name } = await req.json();

    if (!name || typeof name !== "string") {
      return new Response(
        JSON.stringify({ error: "Nome inválido" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Normalização básica
    let normalized = name
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/\s+/g, " "); // Remove espaços extras

    // Remover caracteres especiais mas manter hífens e espaços
    normalized = normalized.replace(/[^\w\s-]/g, "");

    // Padrões comuns de normalização
    const patterns = [
      { from: /LTDA\.?$/i, to: "LTDA" },
      { from: /S\.?A\.?$/i, to: "SA" },
      { from: /ME\.?$/i, to: "ME" },
      { from: /EPP\.?$/i, to: "EPP" },
      { from: /EIRELI\.?$/i, to: "EIRELI" },
      { from: /CIA\.?/i, to: "CIA" },
      { from: /\bEMP\b/i, to: "EMPRESA" },
      { from: /\bCOM\b/i, to: "COMERCIO" },
      { from: /\bIND\b/i, to: "INDUSTRIA" },
    ];

    patterns.forEach(({ from, to }) => {
      normalized = normalized.replace(from, to);
    });

    // Remove espaços extras novamente após substituições
    normalized = normalized.replace(/\s+/g, " ").trim();

    return new Response(
      JSON.stringify({ 
        original: name,
        normalized,
        success: true 
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro ao padronizar nome:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

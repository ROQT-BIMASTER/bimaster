import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";


interface BrasilApiFeriado {
  date: string; // YYYY-MM-DD
  name: string;
  type: string;
}

Deno.serve(secureHandler({ auth: "none", rateLimit: 0, rateLimitPrefix: "sync-feriados" }, async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    // Auth: requires authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1, currentYear + 2];

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const year of years) {
      try {
        const resp = await fetch(
          `https://brasilapi.com.br/api/feriados/v1/${year}`,
        );
        if (!resp.ok) {
          errors.push(`Ano ${year}: HTTP ${resp.status}`);
          continue;
        }
        const feriados: BrasilApiFeriado[] = await resp.json();

        for (const f of feriados) {
          const payload = {
            data: f.date,
            nome: f.name,
            tipo: "nacional",
            uf: null as string | null,
            fonte: "brasilapi",
            ano: year,
            updated_at: new Date().toISOString(),
          };

          const { data: existing } = await supabase
            .from("feriados")
            .select("id")
            .eq("data", f.date)
            .is("uf", null)
            .eq("tipo", "nacional")
            .maybeSingle();

          if (existing) {
            const { error } = await supabase
              .from("feriados")
              .update(payload)
              .eq("id", existing.id);
            if (error) errors.push(`${f.date}: ${error.message}`);
            else updated++;
          } else {
            const { error } = await supabase.from("feriados").insert(payload);
            if (error) errors.push(`${f.date}: ${error.message}`);
            else inserted++;
          }
        }
      } catch (e) {
        errors.push(`Ano ${year}: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted,
        updated,
        years,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    logger.error("sync-feriados error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "Unknown error" }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      },
    );
  }
}));

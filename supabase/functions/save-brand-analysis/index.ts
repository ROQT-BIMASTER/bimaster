import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const ProductSchema = z
  .object({
    name: z.string().min(1).max(300),
    description: z.string().max(5000).optional().nullable(),
    category: z.string().max(200).optional().nullable(),
    sku: z.string().max(100).optional().nullable(),
  })
  .strict();

const SaveBrandSchema = z
  .object({
    brand_id: z.string().uuid(),
    brand_data: z
      .object({
        description: z.string().max(10_000).optional().default(""),
        mission: z.string().max(5000).optional().nullable(),
      })
      .passthrough(),
    products: z.array(ProductSchema).max(200).optional(),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 30, rateLimitPrefix: "save-brand-analysis" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const headers = { ...cors, "Content-Type": "application/json" };

      const body = await req.json().catch(() => ({}));
      const { brand_id, brand_data, products } = validateBody(body, SaveBrandSchema);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Ownership check (proteção IDOR) — service role bypassa RLS
      const { data: existing } = await supabase
        .from("our_brands")
        .select("created_by")
        .eq("id", brand_id)
        .maybeSingle();
      if (!existing || existing.created_by !== ctx.userId) {
        return new Response(
          JSON.stringify({ error: "Acesso negado a esta marca" }),
          { status: 403, headers }
        );
      }

      const brandDescription = `${brand_data.description ?? ""}\n\n${brand_data.mission ?? ""}`.trim();

      const { error: updateError } = await supabase
        .from("our_brands")
        .update({ description: brandDescription })
        .eq("id", brand_id);

      if (updateError) throw updateError;

      let productsInserted = 0;
      if (products && products.length > 0) {
        const productsToInsert = products.map((product) => ({
          name: product.name,
          description: product.description || null,
          category: product.category || null,
          sku: product.sku || null,
          active: true,
          created_by: ctx.userId,
        }));

        const { error: productsError, data: insertedProducts } = await supabase
          .from("our_products")
          .insert(productsToInsert)
          .select();

        if (productsError) throw productsError;

        productsInserted = insertedProducts?.length || 0;
      }

      return new Response(
        JSON.stringify({ success: true, products_inserted: productsInserted }),
        { headers }
      );
    }
  )
);

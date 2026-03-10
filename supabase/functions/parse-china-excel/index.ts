import "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert data extractor for Chinese cosmetics manufacturing spreadsheets and product images.
Your job is to extract structured product data from Excel spreadsheet content or product photos/screenshots.

ALWAYS return a JSON object using the tool provided. Extract as much data as possible from the input.

Key fields to extract:
- produto_codigo: Product code (often starts with HB-, TGV-, etc.)
- produto_nome: Product name (in English or Chinese)
- numero_item: Item number
- numero_ordem: Order number
- formula_codigo: Formula code (e.g., F-001, 01, 02)
- qty_total: Total quantity (number)
- peso_bruto_g: Gross weight in grams (number or null)
- peso_liquido_g: Net weight in grams (number or null)
- cores: Array of color objects with { grupo (group like G1, G2, A, B), cor_nome (color name), quantidade (quantity number) }

For spreadsheets:
- Look for headers like FORMULA, ITEM NUB/MUB, ORDER NUMBER, QTY, COLORS, NET, GROSS
- Colors are often grouped (G1, G2, G3 or A, B, C)
- Quantities may have "PCS" suffix

For images:
- Extract any visible product codes, names, weights, color information
- Read labels, stickers, screens, or any text visible in the image

If a field cannot be determined, set it to null (for strings) or 0 (for qty_total).
For cores array, return empty array [] if no color data found.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const contentType = req.headers.get("content-type") || "";
    let excelText = "";
    let imageBase64 = "";
    let imageMimeType = "image/png";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const imageFile = formData.get("image") as File | null;

      // Parse Excel file to text
      if (file) {
        try {
          const { default: XLSX } = await import(
            "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs"
          );
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
          });

          // Convert to readable text table
          excelText = rows
            .filter((row) => row.some((cell: any) => String(cell).trim() !== ""))
            .map((row) =>
              row.map((cell: any) => String(cell).trim()).join(" | ")
            )
            .join("\n");
        } catch (e) {
          console.error("Excel parse error:", e);
          excelText = "Failed to parse Excel file";
        }
      }

      // Handle image file
      if (imageFile) {
        const imgBuffer = await imageFile.arrayBuffer();
        imageBase64 = btoa(
          String.fromCharCode(...new Uint8Array(imgBuffer))
        );
        imageMimeType = imageFile.type || "image/png";
      }
    } else {
      // JSON body (for image-only from frontend)
      const body = await req.json();
      if (body.imageBase64) {
        imageBase64 = body.imageBase64;
        imageMimeType = body.imageMimeType || "image/png";
      }
    }

    if (!excelText && !imageBase64) {
      return new Response(
        JSON.stringify({ error: "No file or image provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build messages for AI
    const userContent: any[] = [];

    if (excelText) {
      userContent.push({
        type: "text",
        text: `Here is the spreadsheet content (rows separated by newlines, columns by |):\n\n${excelText}`,
      });
    }

    if (imageBase64) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:${imageMimeType};base64,${imageBase64}`,
        },
      });
      userContent.push({
        type: "text",
        text: "Above is a product image/screenshot. Extract all visible product data from it.",
      });
    }

    if (excelText && imageBase64) {
      userContent.push({
        type: "text",
        text: "Combine data from both the spreadsheet and the image. Prefer spreadsheet data when both have the same field.",
      });
    }

    // Use tool calling for structured output
    const model = imageBase64 ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_product_data",
                description:
                  "Extract structured product data from the spreadsheet or image",
                parameters: {
                  type: "object",
                  properties: {
                    produto_codigo: {
                      type: "string",
                      description: "Product code (e.g. HB-001, TGV-001)",
                    },
                    produto_nome: {
                      type: "string",
                      description: "Product name",
                    },
                    numero_item: {
                      type: "string",
                      description: "Item number",
                    },
                    numero_ordem: {
                      type: "string",
                      description: "Order number",
                    },
                    formula_codigo: {
                      type: "string",
                      description: "Formula code",
                    },
                    qty_total: {
                      type: "number",
                      description: "Total quantity",
                    },
                    peso_bruto_g: {
                      type: "number",
                      description: "Gross weight in grams",
                    },
                    peso_liquido_g: {
                      type: "number",
                      description: "Net weight in grams",
                    },
                    cores: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          grupo: {
                            type: "string",
                            description: "Color group (G1, G2, A, B, etc.)",
                          },
                          cor_nome: {
                            type: "string",
                            description: "Color name",
                          },
                          quantidade: {
                            type: "number",
                            description: "Quantity for this color",
                          },
                        },
                        required: ["grupo", "cor_nome", "quantidade"],
                        additionalProperties: false,
                      },
                      description: "Array of color entries",
                    },
                  },
                  required: [
                    "produto_codigo",
                    "produto_nome",
                    "numero_item",
                    "numero_ordem",
                    "formula_codigo",
                    "qty_total",
                    "peso_bruto_g",
                    "peso_liquido_g",
                    "cores",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_product_data" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", status, errorText);

      if (status === 429) {
        return new Response(
          JSON.stringify({
            error: "Limite de requisições excedido. Tente novamente em alguns segundos. 请求限制已超过，请稍后再试。",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({
            error: "Créditos de IA esgotados. Entre em contato com o administrador. AI积分已用完。",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      throw new Error(`AI gateway returned ${status}: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      throw new Error("AI did not return structured data");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    // Return the AI-extracted data
    return new Response(
      JSON.stringify({
        ...extracted,
        _ai_extracted: true,
        _model: model,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in parse-china-excel:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

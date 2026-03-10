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
- qty_total: Total quantity IN PIECES (not cartons/boxes). This is the sum of all individual color quantities.
- ctn_total: Total number of cartons/boxes (CTN), if available. This is different from qty_total.
- peso_bruto_g: Gross weight in grams (number or null)
- peso_liquido_g: Net weight in grams (number or null)
- cores: Array of color objects with { grupo (group like G1, G2, A, B), cor_nome (color name), quantidade (quantity in PIECES for this specific color) }

CRITICAL for cores extraction:
- Each color MUST have its own individual quantity in pieces (not shared across groups)
- The sum of all cores[].quantidade SHOULD equal qty_total
- If colors are grouped (G1, G2, G3 or A, B, C), preserve the group identifier
- Look carefully for per-color quantities in columns like QTY, PCS, 数量

For spreadsheets:
- Look for headers like FORMULA, ITEM NUB/MUB, ORDER NUMBER, QTY, COLORS, NET, GROSS
- Colors are often grouped (G1, G2, G3 or A, B, C)
- Quantities may have "PCS" suffix
- Distinguish between PCS (pieces) and CTN (cartons/boxes)

For images:
- Extract any visible product codes, names, weights, color information
- Read labels, stickers, screens, or any text visible in the image

If a field cannot be determined, set it to null (for strings) or 0 (for qty_total).
For cores array, return empty array [] if no color data found.`;

function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let excelText = "";
    let imageBase64 = "";
    let imageMimeType = "image/png";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const imageFile = formData.get("image") as File | null;

      // Parse Excel file to text using SheetJS
      if (file) {
        console.log("Parsing Excel file:", file.name, "size:", file.size);
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
            .filter((row: any[]) => row.some((cell: any) => String(cell).trim() !== ""))
            .map((row: any[]) =>
              row.map((cell: any) => String(cell).trim()).join(" | ")
            )
            .join("\n");

          console.log("Excel parsed successfully, text length:", excelText.length);
        } catch (e) {
          console.error("Excel parse error:", e);
          return new Response(
            JSON.stringify({ error: "Erro ao ler planilha Excel. Verifique o formato do arquivo. Excel文件读取错误" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Handle image file
      if (imageFile) {
        console.log("Processing image:", imageFile.name, "size:", imageFile.size);
        const imgBuffer = await imageFile.arrayBuffer();
        imageBase64 = uint8ArrayToBase64(new Uint8Array(imgBuffer));
        imageMimeType = imageFile.type || "image/png";
      }
    } else {
      // JSON body (for image-only from frontend)
      const body = await req.json();
      if (body.imageBase64) {
        imageBase64 = body.imageBase64;
        imageMimeType = body.imageMimeType || "image/png";
        console.log("Received image via JSON, base64 length:", imageBase64.length);
      }
    }

    if (!excelText && !imageBase64) {
      return new Response(
        JSON.stringify({ error: "Nenhum arquivo fornecido. Envie uma planilha ou imagem. 未提供文件" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages for AI
    const userContent: any[] = [];

    if (excelText) {
      // Truncate if too long to avoid token limits
      const truncated = excelText.length > 15000 ? excelText.substring(0, 15000) + "\n...(truncated)" : excelText;
      userContent.push({
        type: "text",
        text: `Here is the spreadsheet content (rows separated by newlines, columns by |):\n\n${truncated}`,
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

    const model = imageBase64 ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
    console.log("Calling AI gateway with model:", model);

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
                description: "Extract structured product data from the spreadsheet or image",
                parameters: {
                  type: "object",
                  properties: {
                    produto_codigo: { type: "string", description: "Product code" },
                    produto_nome: { type: "string", description: "Product name" },
                    numero_item: { type: "string", description: "Item number" },
                    numero_ordem: { type: "string", description: "Order number" },
                    formula_codigo: { type: "string", description: "Formula code" },
                    qty_total: { type: "number", description: "Total quantity in PIECES (sum of all color quantities)" },
                    ctn_total: { type: "number", description: "Total number of cartons/boxes (CTN)" },
                    peso_bruto_g: { type: "number", description: "Gross weight in grams" },
                    peso_liquido_g: { type: "number", description: "Net weight in grams" },
                    cores: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          grupo: { type: "string", description: "Color group" },
                          cor_nome: { type: "string", description: "Color name" },
                          quantidade: { type: "number", description: "Quantity" },
                        },
                        required: ["grupo", "cor_nome", "quantidade"],
                        additionalProperties: false,
                      },
                      description: "Array of color entries",
                    },
                  },
                  required: ["produto_codigo", "produto_nome", "numero_item", "numero_ordem", "formula_codigo", "qty_total", "peso_bruto_g", "peso_liquido_g", "cores"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_product_data" } },
        }),
      }
    );

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", status, errorText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos. 请求限制已超过" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. AI积分已用完" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Erro no serviço de IA (${status}). Tente novamente. AI服务错误` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    console.log("AI response received, choices:", aiData.choices?.length);

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiData).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "IA não retornou dados estruturados. Tente novamente. AI未返回结构化数据" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    console.log("Extracted product:", extracted.produto_codigo, extracted.produto_nome);

    return new Response(
      JSON.stringify({
        ...extracted,
        _ai_extracted: true,
        _model: model,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in parse-china-excel:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno. Tente novamente. 内部错误" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

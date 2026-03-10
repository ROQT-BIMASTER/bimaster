import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedData {
  produto_codigo: string;
  produto_nome: string;
  numero_item: string;
  numero_ordem: string;
  formula_codigo: string;
  qty_total: number;
  peso_bruto_g: number | null;
  peso_liquido_g: number | null;
  cores: { grupo: string; cor_nome: string; quantidade: number }[];
  raw_rows: any[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read file as array buffer and parse manually
    // Since we can't use exceljs in Deno easily, we'll parse the text content
    // We'll use a simple approach: read the Excel as CSV-like data using SheetJS CDN
    const { default: XLSX } = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
    
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    // Parse the specific format from the Excel
    const result: ParsedData = {
      produto_codigo: "",
      produto_nome: "",
      numero_item: "",
      numero_ordem: "",
      formula_codigo: "",
      qty_total: 0,
      peso_bruto_g: null,
      peso_liquido_g: null,
      cores: [],
      raw_rows: rows.slice(0, 30),
    };

    // Iterate rows to find data
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].map((c: any) => String(c).trim());
      
      // Header row with FORMULA, item nub, ORDER NUBER, ITEM NAME, QTY
      if (row.some((c: string) => c.includes("FORMULA") || c.includes("配方"))) {
        // Next row should have the actual data
        const dataRow = rows[i + 1]?.map((c: any) => String(c).trim()) || [];
        // Find formula by looking at column positions
        for (let j = 0; j < row.length; j++) {
          const header = row[j].toUpperCase();
          const value = dataRow[j] || "";
          if (header.includes("FORMULA") && value && !value.includes("FORMULA")) {
            result.formula_codigo = value;
          }
          if (header.includes("ITEM NAME") || header.includes("名称")) {
            result.produto_nome = value;
          }
          if ((header.includes("ITEM") && header.includes("NUB")) || header === "item nub") {
            result.produto_codigo = value;
          }
          if (header.includes("ORDER")) {
            result.numero_ordem = value;
          }
          if (header === "QTY") {
            const num = parseInt(value);
            if (!isNaN(num)) result.qty_total = num;
          }
        }
      }

      // Look for ITEM MUB row with product code
      if (row.some((c: string) => c.includes("ITEM MUB") || c.includes("ITEM NUB"))) {
        const dataRow = rows[i + 1]?.map((c: any) => String(c).trim()) || [];
        if (dataRow[0] && dataRow[0].startsWith("HB-")) {
          result.produto_codigo = dataRow[0];
        }
        // Find QTY and TOTAL QTY
        for (let j = 0; j < row.length; j++) {
          if (row[j].includes("TOTAL QTY")) {
            const num = parseInt(dataRow[j] || "0");
            if (!isNaN(num) && num > 0) result.qty_total = num;
          }
        }
      }

      // Parse color groups (COLORS /G1, /G2, /G3)
      if (row.some((c: string) => /COLORS\s*\/\s*G\d/i.test(c))) {
        const groupMatch = row.find((c: string) => /COLORS\s*\/\s*G\d/i.test(c));
        const grupo = groupMatch?.match(/G\d+/i)?.[0]?.toUpperCase() || "";
        const qtyRow = rows[i + 1]?.map((c: any) => String(c).trim()) || [];
        
        // Colors are in columns after the group label
        const startIdx = row.indexOf(groupMatch!) + 1;
        for (let j = startIdx; j < row.length; j++) {
          const corNome = row[j];
          if (corNome && !corNome.includes("CARTOON") && !corNome.includes("清装") && corNome !== "") {
            const qtyStr = qtyRow[j] || "0";
            const qty = parseInt(qtyStr.replace(/PCS/i, "").trim()) || 0;
            if (corNome.startsWith("COR") || corNome.length <= 20) {
              result.cores.push({ grupo, cor_nome: corNome, quantidade: qty });
            }
          }
        }
      }

      // Parse weights from MATERIEL row
      if (row.some((c: string) => c.includes("MATERIEL") || c.includes("net"))) {
        const dataRow = rows[i + 1]?.map((c: any) => String(c).trim()) || [];
        for (let j = 0; j < row.length; j++) {
          const header = row[j].toUpperCase();
          const value = parseFloat(dataRow[j] || "0");
          if (header.includes("MATERIEL") && header.includes("NET") && !isNaN(value)) {
            result.peso_liquido_g = value;
          }
          if (header.includes("GROSS") && !isNaN(value)) {
            result.peso_bruto_g = value;
          }
        }
      }

      // Also check data row directly for weights
      if (row.some((c: string) => c.includes("BLEND") || c.includes("STICK"))) {
        for (let j = 0; j < row.length; j++) {
          const val = parseFloat(row[j]);
          if (!isNaN(val) && val > 0 && val < 100) {
            // Could be a weight value - check previous header row
            const headerRow = rows[i - 1]?.map((c: any) => String(c).trim()) || [];
            if (headerRow[j]?.toUpperCase().includes("NET")) {
              result.peso_liquido_g = val;
            }
            if (headerRow[j]?.toUpperCase().includes("GROSS")) {
              result.peso_bruto_g = val;
            }
          }
        }
      }

      // Find product name from NAME row
      if (row[0]?.startsWith("NAME ")) {
        result.produto_nome = row[0].replace("NAME ", "").trim();
      }
    }

    // Fallback: try to find HB- code in any cell
    if (!result.produto_codigo) {
      for (const row of rows) {
        for (const cell of row) {
          const s = String(cell).trim();
          if (s.match(/^HB-[A-Z0-9]+$/)) {
            result.produto_codigo = s;
            break;
          }
        }
        if (result.produto_codigo) break;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error parsing Excel:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

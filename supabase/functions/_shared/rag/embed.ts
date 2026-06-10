// Embedding helper for copilot RAG. See RFC v4.0.0 §A2.
// Model: google/gemini-embedding-001 (3072 dims).

export const EMBED_MODEL = "google/gemini-embedding-001";
export const MODEL_DIMS = 3072;

interface EmbedResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { prompt_tokens: number; total_tokens: number };
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  if (inputs.length === 0) return [];
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`embed failed ${r.status}: ${body.slice(0, 500)}`);
  }
  const json = (await r.json()) as EmbedResponse;
  const out = json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  for (const v of out) {
    if (v.length !== MODEL_DIMS) {
      throw new Error(`embedding dim mismatch: got ${v.length}, expected ${MODEL_DIMS}`);
    }
  }
  return out;
}

export async function embedOne(input: string): Promise<number[]> {
  const [v] = await embedTexts([input]);
  return v;
}

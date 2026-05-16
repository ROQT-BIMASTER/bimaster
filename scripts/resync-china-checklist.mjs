import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DEFAULT_CATEGORIES = [
  { key: "dados_oficiais", fluxo: "china_envia", tipos: ["planilha_excel"] },
  { key: "fotos_planilha", fluxo: "china_envia", tipos: ["foto_confirmed_item","foto_cores_todas","foto_garrafa","foto_garrafa_design","foto_cores_produto","foto_embalagem_ref","foto_produto_individual","foto_cores_pesos"] },
  { key: "imagens_gerais", fluxo: "china_envia", tipos: ["foto_rotulo","foto_arte"] },
  { key: "rotulagem", fluxo: "china_envia", tipos: ["volumetria","formula","doc_regulatoria"] },
  { key: "embalagem", fluxo: "china_envia", tipos: ["faca_primaria","faca_display","faca_cartucho","faca_tester","amostra_foto","amostra_video"] },
  { key: "etiquetas", fluxo: "brasil_envia", tipos: ["etiqueta_fundo","etiqueta_tester","etiqueta_bula"] },
  { key: "artes_brasil", fluxo: "brasil_envia", tipos: ["arte_display"] },
  { key: "codigos_ean", fluxo: "brasil_envia", tipos: ["ean_unitario","ean_display","ean_caixa"] },
  { key: "solicitacao_amostras", fluxo: "brasil_envia", tipos: ["solicitacao_amostra_fotos","solicitacao_amostra_videos"] },
];

async function listAll(table, filters = {}) {
  const all = [];
  let from = 0;
  const size = 1000;
  while (true) {
    let q = supabase.from(table).select("*").range(from, from + size - 1);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < size) break;
    from += size;
  }
  return all;
}

async function computeExpected(submissaoId) {
  const [cCats, cItens, hidden] = await Promise.all([
    listAll("china_checklist_custom_categorias", { submissao_id: submissaoId }),
    listAll("china_checklist_custom_itens", { submissao_id: submissaoId }),
    listAll("china_checklist_itens_ocultos", { submissao_id: submissaoId }),
  ]);
  const hiddenSet = new Set(hidden.map(h => h.tipo_key));
  const expected = [];

  for (const cat of DEFAULT_CATEGORIES) {
    if (hiddenSet.has(`cat:${cat.key}`)) continue;
    const extras = cItens.filter(i => i.categoria_default_key === cat.key && !i.categoria_custom_id).map(i => i.tipo_key);
    for (const t of [...cat.tipos, ...extras]) {
      if (!hiddenSet.has(t)) expected.push({ fluxo: cat.fluxo, categoria_key: cat.key, item_key: t });
    }
  }
  for (const c of cCats) {
    const key = `custom_${c.id}`;
    if (hiddenSet.has(`cat:${key}`)) continue;
    const tipos = cItens.filter(i => i.categoria_custom_id === c.id).map(i => i.tipo_key);
    for (const t of tipos) {
      if (!hiddenSet.has(t)) expected.push({ fluxo: c.fluxo, categoria_key: key, item_key: t });
    }
  }
  return expected;
}

async function resync(submissaoId) {
  const expected = await computeExpected(submissaoId);
  const estados = await listAll("china_checklist_item_estado", { submissao_id: submissaoId });
  const expectedKeys = new Set(expected.map(e => `${e.fluxo}|${e.categoria_key}|${e.item_key}`));

  const orphans = estados.filter(e => !expectedKeys.has(`${e.fluxo}|${e.categoria_key}|${e.item_key}`));
  const survivors = estados.filter(e => expectedKeys.has(`${e.fluxo}|${e.categoria_key}|${e.item_key}`));
  const survivorKeys = new Set(survivors.map(e => `${e.fluxo}|${e.categoria_key}|${e.item_key}`));
  const missing = expected.filter(e => !survivorKeys.has(`${e.fluxo}|${e.categoria_key}|${e.item_key}`));

  if (orphans.length === 0 && missing.length === 0 && expected.length > 0) {
    const soma = survivors.reduce((s, e) => s + Number(e.peso_percentual || 0), 0);
    if (Math.abs(soma - 100) < 0.5) return { submissaoId, skipped: true };
  }

  if (expected.length === 0) return { submissaoId, skipped: "no expected" };

  if (orphans.length) {
    const { error } = await supabase.from("china_checklist_item_estado").delete().in("id", orphans.map(o => o.id));
    if (error) throw error;
  }

  const pesoIgual = Math.floor((100 / expected.length) * 100) / 100;
  const residuo = Math.round((100 - pesoIgual * expected.length) * 100) / 100;

  for (let i = 0; i < survivors.length; i++) {
    const e = survivors[i];
    const idx = expected.findIndex(x => `${x.fluxo}|${x.categoria_key}|${x.item_key}` === `${e.fluxo}|${e.categoria_key}|${e.item_key}`);
    const isLast = idx === expected.length - 1;
    const novoPeso = isLast ? Math.round((pesoIgual + residuo) * 100) / 100 : pesoIgual;
    if (Number(e.peso_percentual || 0) !== novoPeso) {
      const { error } = await supabase.from("china_checklist_item_estado").update({ peso_percentual: novoPeso }).eq("id", e.id);
      if (error) throw error;
    }
  }
  if (missing.length) {
    const rows = missing.map(m => {
      const idx = expected.findIndex(x => `${x.fluxo}|${x.categoria_key}|${x.item_key}` === `${m.fluxo}|${m.categoria_key}|${m.item_key}`);
      const isLast = idx === expected.length - 1;
      const peso = isLast ? Math.round((pesoIgual + residuo) * 100) / 100 : pesoIgual;
      return { submissao_id: submissaoId, fluxo: m.fluxo, categoria_key: m.categoria_key, item_key: m.item_key, peso_percentual: peso, obrigatorio: true, status: "pendente" };
    });
    const { error } = await supabase.from("china_checklist_item_estado").insert(rows);
    if (error) throw error;
  }
  return { submissaoId, deleted: orphans.length, inserted: missing.length, kept: survivors.length, total: expected.length };
}

const submissoes = await listAll("china_doc_submissoes");
console.log(`Resyncing ${submissoes.length} fichas...`);
let ok = 0, skip = 0, err = 0;
for (const s of submissoes) {
  try {
    const r = await resync(s.id);
    if (r.skipped) { skip++; } else { ok++; console.log(JSON.stringify(r)); }
  } catch (e) {
    err++;
    console.error("FAIL", s.id, e.message);
  }
}
console.log(`Done. updated=${ok} skipped=${skip} errors=${err}`);

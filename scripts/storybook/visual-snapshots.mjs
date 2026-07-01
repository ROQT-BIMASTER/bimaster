#!/usr/bin/env node
/**
 * Visual regression para stories do SmartAvatar.
 *
 * Para cada story `ui-smartavatar--*`, captura três screenshots isolados
 * (o próprio avatar, o texto do tooltip renderizado como conteúdo e o
 * fallback tipográfico) e compara pixel a pixel contra as baselines em
 * `scripts/storybook/snapshots/baseline/<story>/<slot>.png`.
 *
 * - Sem baseline → grava a atual em `baseline/` (primeira execução seed).
 * - `UPDATE_SNAPSHOTS=1` → sobrescreve baseline forçadamente.
 * - Diff acima de `SNAPSHOT_THRESHOLD` (default 0.5%) → grava PNG de diff em
 *   `snapshots/diff/` e falha o processo com exit 1.
 *
 * Rodar após `bun run build-storybook`.
 */
import http from "node:http";
import {
  existsSync,
  statSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { join, resolve, extname, dirname } from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const ROOT = resolve(process.cwd(), "storybook-static");
const SNAP_DIR = resolve(process.cwd(), "scripts/storybook/snapshots");
const BASELINE = join(SNAP_DIR, "baseline");
const ACTUAL = join(SNAP_DIR, "actual");
const DIFF = join(SNAP_DIR, "diff");
const PORT = Number(process.env.STORYBOOK_AUDIT_PORT ?? 6008);
const UPDATE = process.env.UPDATE_SNAPSHOTS === "1";
const THRESHOLD = Number(process.env.SNAPSHOT_THRESHOLD ?? 0.005); // 0.5%
const PIXEL_TOL = Number(process.env.SNAPSHOT_PIXEL_TOLERANCE ?? 0.1);

if (!existsSync(ROOT)) {
  console.error(
    `[snapshots] ${ROOT} não existe. Rode: bun run build-storybook`,
  );
  process.exit(2);
}
for (const d of [BASELINE, ACTUAL, DIFF]) mkdirSync(d, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

function serve() {
  return new Promise((res) => {
    const server = http.createServer((req, resp) => {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        let f = join(ROOT, decodeURIComponent(url.pathname));
        if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
        if (!existsSync(f)) {
          resp.writeHead(404);
          resp.end("nf");
          return;
        }
        resp.writeHead(200, {
          "content-type": MIME[extname(f)] ?? "application/octet-stream",
          "cache-control": "no-store",
        });
        resp.end(readFileSync(f));
      } catch (e) {
        resp.writeHead(500);
        resp.end(String(e));
      }
    });
    server.listen(PORT, () => res(server));
  });
}

const failures = [];
const created = [];

function ensureDir(p) {
  mkdirSync(dirname(p), { recursive: true });
}

function compare(actualPath, baselinePath, diffPath) {
  const a = PNG.sync.read(readFileSync(actualPath));
  const b = PNG.sync.read(readFileSync(baselinePath));
  if (a.width !== b.width || a.height !== b.height) {
    return {
      diffPixels: a.width * a.height,
      total: a.width * a.height,
      ratio: 1,
      sizeMismatch: { actual: [a.width, a.height], baseline: [b.width, b.height] },
    };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const diffPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: PIXEL_TOL,
  });
  const ratio = diffPixels / (a.width * a.height);
  if (ratio > THRESHOLD) {
    ensureDir(diffPath);
    writeFileSync(diffPath, PNG.sync.write(diff));
  }
  return { diffPixels, total: a.width * a.height, ratio };
}

async function captureSlot(page, locator, id, slot) {
  const outPath = join(ACTUAL, id, `${slot}.png`);
  ensureDir(outPath);
  await locator.screenshot({ path: outPath, omitBackground: false });
  const basePath = join(BASELINE, id, `${slot}.png`);
  if (UPDATE || !existsSync(basePath)) {
    ensureDir(basePath);
    copyFileSync(outPath, basePath);
    created.push(`${id}/${slot}`);
    return { seeded: true };
  }
  const diffPath = join(DIFF, id, `${slot}.png`);
  const cmp = compare(outPath, basePath, diffPath);
  return { seeded: false, ...cmp, diffPath };
}

async function run() {
  const server = await serve();
  console.log(`[snapshots] serving ${ROOT} on :${PORT}`);
  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  }
  const browser = await chromium.launch(launchOpts);
  try {
    const ctx = await browser.newContext({
      viewport: { width: 640, height: 480 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      forcedColors: "none",
      colorScheme: "light",
    });
    const page = await ctx.newPage();
    // determinismo: bloqueia imagens externas (mesma tática do audit),
    // desliga animações e caret piscando.
    await page.route("**/*", (route) => {
      const r = route.request();
      if (
        r.resourceType() === "image" &&
        !r.url().startsWith(`http://localhost:${PORT}`)
      ) {
        return route.fulfill({ status: 404, body: "" });
      }
      return route.continue();
    });
    await page.addStyleTag({
      content: `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`,
    }).catch(() => {});

    await page.goto(`http://localhost:${PORT}/index.json`);
    const raw = await page
      .locator("pre")
      .innerText()
      .catch(async () => await page.content());
    let index;
    try {
      index = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      index = m ? JSON.parse(m[0]) : { entries: {} };
    }
    const ids = Object.keys(index.entries ?? {}).filter((k) =>
      k.startsWith("ui-smartavatar--"),
    );
    if (ids.length === 0) {
      console.error("[snapshots] nenhuma story ui-smartavatar-- encontrada");
      process.exit(1);
    }
    console.log(`[snapshots] ${ids.length} stories`);

    for (const id of ids) {
      const storyRec = { id, slots: {}, status: "pass", error: null };
      report.stories.push(storyRec);

      const url = `http://localhost:${PORT}/iframe.html?id=${id}&viewMode=story`;
      await page.goto(url, { waitUntil: "networkidle" });

      const root = page.locator("span[title][aria-label]").first();
      try {
        await root.waitFor({ timeout: 5000 });
      } catch {
        storyRec.status = "fail";
        storyRec.error = "avatar não renderizou";
        failures.push({ id, reason: "avatar não renderizou" });
        continue;
      }
      await page.evaluate(() => document.fonts.ready).catch(() => {});

      const title = (await root.getAttribute("title")) ?? "";
      storyRec.title = title;
      const fb = root.locator("[aria-label]").first();

      const r1 = await captureSlot(page, root, id, "avatar");
      const r2 = (await fb.count())
        ? await captureSlot(page, fb, id, "fallback")
        : { seeded: true, skipped: true };

      await page.evaluate((t) => {
        const prev = document.getElementById("__snapshot_tooltip__");
        if (prev) prev.remove();
        const el = document.createElement("div");
        el.id = "__snapshot_tooltip__";
        el.textContent = t;
        Object.assign(el.style, {
          position: "fixed",
          left: "8px",
          top: "8px",
          padding: "6px 10px",
          background: "#111",
          color: "#fff",
          font: "500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
          borderRadius: "6px",
          zIndex: "2147483647",
          maxWidth: "480px",
          whiteSpace: "nowrap",
        });
        document.body.appendChild(el);
      }, title);
      const tooltip = page.locator("#__snapshot_tooltip__");
      const r3 = await captureSlot(page, tooltip, id, "tooltip");

      for (const [slot, r] of [
        ["avatar", r1],
        ["fallback", r2],
        ["tooltip", r3],
      ]) {
        const slotRec = {
          slot,
          status: "pass",
          ratio: r.ratio ?? 0,
          seeded: !!r.seeded,
          skipped: !!r.skipped,
          actual: r.skipped ? null : `actual/${id}/${slot}.png`,
          baseline: r.skipped ? null : `baseline/${id}/${slot}.png`,
          diff: null,
          message: null,
        };
        storyRec.slots[slot] = slotRec;

        if (r.skipped) {
          slotRec.status = "skip";
          continue;
        }
        if (r.seeded) {
          slotRec.status = "seed";
          console.log(`  · ${id}/${slot} — baseline criada`);
          continue;
        }
        if (r.sizeMismatch) {
          slotRec.status = "fail";
          slotRec.message = `size mismatch ${JSON.stringify(r.sizeMismatch)}`;
          storyRec.status = "fail";
          failures.push({
            id,
            reason: `${slot}: dimensões diferentes ${JSON.stringify(r.sizeMismatch)}`,
          });
          console.error(`  ✗ ${id}/${slot} — size mismatch`, r.sizeMismatch);
        } else if (r.ratio > THRESHOLD) {
          slotRec.status = "fail";
          slotRec.diff = `diff/${id}/${slot}.png`;
          slotRec.message = `diff ${(r.ratio * 100).toFixed(3)}% > ${(THRESHOLD * 100).toFixed(3)}%`;
          storyRec.status = "fail";
          failures.push({
            id,
            reason: `${slot}: diff ${(r.ratio * 100).toFixed(3)}% (>${(THRESHOLD * 100).toFixed(3)}%)`,
            diff: r.diffPath,
          });
          console.error(
            `  ✗ ${id}/${slot} — diff ${(r.ratio * 100).toFixed(3)}% → ${r.diffPath}`,
          );
        } else {
          console.log(
            `  ✓ ${id}/${slot} — diff ${(r.ratio * 100).toFixed(4)}%`,
          );
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - startedAt;
  report.summary = summarize(report);
  writeReport(report);

  if (created.length > 0) {
    console.log(`\n[snapshots] baselines criadas: ${created.length}`);
    console.log("           reveja e commite scripts/storybook/snapshots/baseline/");
  }
  console.log(
    `\n[snapshots] relatório: ${join(SNAP_DIR, "report.html")}`,
  );
  if (failures.length > 0) {
    console.error(`\n[snapshots] ${failures.length} regressão(ões)`);
    console.error("           inspecione scripts/storybook/snapshots/diff/");
    console.error(
      "           se a mudança for intencional: UPDATE_SNAPSHOTS=1 bun run storybook:snapshots",
    );
    process.exit(1);
  }
  console.log("\n[snapshots] OK");
}

// ---------- Relatório ----------

const report = {
  startedAt: new Date().toISOString(),
  finishedAt: null,
  durationMs: 0,
  threshold: THRESHOLD,
  pixelTolerance: PIXEL_TOL,
  updateMode: UPDATE,
  stories: [],
  summary: null,
};
const startedAt = Date.now();

function summarize(rep) {
  const s = { stories: rep.stories.length, pass: 0, fail: 0, seeded: 0, slots: { pass: 0, fail: 0, seed: 0, skip: 0 } };
  for (const st of rep.stories) {
    if (st.status === "fail") s.fail++;
    else s.pass++;
    for (const slot of Object.values(st.slots ?? {})) {
      s.slots[slot.status] = (s.slots[slot.status] ?? 0) + 1;
      if (slot.status === "seed") s.seeded++;
    }
  }
  return s;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function statusBadge(s) {
  const map = {
    pass: ["#065f46", "#d1fae5", "OK"],
    fail: ["#7f1d1d", "#fee2e2", "FAIL"],
    seed: ["#1e3a8a", "#dbeafe", "SEED"],
    skip: ["#374151", "#e5e7eb", "SKIP"],
  };
  const [fg, bg, label] = map[s] ?? map.skip;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${bg};color:${fg};font-size:11px;font-weight:600">${label}</span>`;
}

function renderStory(st) {
  const slots = ["avatar", "fallback", "tooltip"].map((k) => {
    const slot = st.slots?.[k];
    if (!slot) return `<td style="padding:6px;color:#9ca3af">—</td>`;
    const imgs = [];
    if (slot.baseline) imgs.push(`<div><div style="font-size:10px;color:#6b7280">baseline</div><img src="${esc(slot.baseline)}" alt="baseline" style="max-width:120px;border:1px solid #e5e7eb;border-radius:4px"></div>`);
    if (slot.actual) imgs.push(`<div><div style="font-size:10px;color:#6b7280">actual</div><img src="${esc(slot.actual)}" alt="actual" style="max-width:120px;border:1px solid #e5e7eb;border-radius:4px"></div>`);
    if (slot.diff) imgs.push(`<div><div style="font-size:10px;color:#b91c1c">diff</div><img src="${esc(slot.diff)}" alt="diff" style="max-width:120px;border:1px solid #fecaca;border-radius:4px"></div>`);
    return `<td style="padding:6px;vertical-align:top">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">${statusBadge(slot.status)}<span style="font-size:11px;color:#6b7280">${(slot.ratio * 100).toFixed(3)}%</span></div>
      ${slot.message ? `<div style="font-size:11px;color:#b91c1c;margin-bottom:4px">${esc(slot.message)}</div>` : ""}
      <div style="display:flex;gap:6px;flex-wrap:wrap">${imgs.join("")}</div>
    </td>`;
  }).join("");
  return `<tr style="border-top:1px solid #e5e7eb">
    <td style="padding:8px;vertical-align:top">
      <div style="font-family:ui-monospace,Menlo,monospace;font-size:12px">${esc(st.id)}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:2px">${esc(st.title ?? "")}</div>
      <div style="margin-top:6px">${statusBadge(st.status)}</div>
      ${st.error ? `<div style="font-size:11px;color:#b91c1c;margin-top:4px">${esc(st.error)}</div>` : ""}
    </td>${slots}
  </tr>`;
}

function writeReport(rep) {
  writeFileSync(join(SNAP_DIR, "report.json"), JSON.stringify(rep, null, 2));
  const s = rep.summary;
  const html = `<!doctype html><meta charset="utf-8"><title>Storybook snapshot report</title>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;background:#f9fafb;color:#111827">
<h1 style="margin:0 0 4px;font-size:20px">Storybook visual snapshots</h1>
<div style="font-size:12px;color:#6b7280;margin-bottom:16px">
  ${esc(rep.startedAt)} → ${esc(rep.finishedAt)} · ${rep.durationMs} ms · threshold ${(rep.threshold * 100).toFixed(3)}% · pixel tol ${rep.pixelTolerance}${rep.updateMode ? " · UPDATE_SNAPSHOTS=1" : ""}
</div>
<div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
  <div style="padding:10px 14px;background:#fff;border:1px solid #e5e7eb;border-radius:8px"><div style="font-size:11px;color:#6b7280">Stories</div><div style="font-size:18px;font-weight:600">${s.stories}</div></div>
  <div style="padding:10px 14px;background:#fff;border:1px solid #e5e7eb;border-radius:8px"><div style="font-size:11px;color:#6b7280">Pass</div><div style="font-size:18px;font-weight:600;color:#065f46">${s.pass}</div></div>
  <div style="padding:10px 14px;background:#fff;border:1px solid #e5e7eb;border-radius:8px"><div style="font-size:11px;color:#6b7280">Fail</div><div style="font-size:18px;font-weight:600;color:#7f1d1d">${s.fail}</div></div>
  <div style="padding:10px 14px;background:#fff;border:1px solid #e5e7eb;border-radius:8px"><div style="font-size:11px;color:#6b7280">Baselines novas</div><div style="font-size:18px;font-weight:600;color:#1e3a8a">${s.seeded}</div></div>
</div>
<table style="width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden">
  <thead style="background:#f3f4f6;text-align:left;font-size:11px;color:#374151">
    <tr><th style="padding:8px">Story</th><th style="padding:8px">avatar</th><th style="padding:8px">fallback</th><th style="padding:8px">tooltip</th></tr>
  </thead>
  <tbody>${rep.stories.map(renderStory).join("")}</tbody>
</table>
</body>`;
  writeFileSync(join(SNAP_DIR, "report.html"), html);
}

run().catch((e) => {
  console.error("[snapshots] fatal", e);
  process.exit(1);
});


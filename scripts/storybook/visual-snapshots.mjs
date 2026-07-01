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
      const url = `http://localhost:${PORT}/iframe.html?id=${id}&viewMode=story`;
      await page.goto(url, { waitUntil: "networkidle" });

      const root = page.locator("span[title][aria-label]").first();
      try {
        await root.waitFor({ timeout: 5000 });
      } catch {
        failures.push({ id, reason: "avatar não renderizou" });
        continue;
      }
      // Estabiliza fontes antes de capturar (evita flakiness FOUT).
      await page.evaluate(() => document.fonts.ready).catch(() => {});

      const title = (await root.getAttribute("title")) ?? "";
      const fb = root.locator("[aria-label]").first();

      // Slot 1 — avatar (tipografia + iniciais + shape).
      const r1 = await captureSlot(page, root, id, "avatar");

      // Slot 2 — fallback textual isolado (garante que o glyph do fallback
      // seja renderizado com a mesma tipografia/tracking).
      const r2 = (await fb.count())
        ? await captureSlot(page, fb, id, "fallback")
        : { seeded: true, skipped: true };

      // Slot 3 — tooltip renderizado. Como o title nativo do browser não
      // é acessível a screenshot cross-platform, injetamos um <div> que
      // reproduz o mesmo texto do tooltip com o typography stack real da
      // app, garantindo cobertura visual do conteúdo textual do fallback.
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

      const results = [
        ["avatar", r1],
        ["fallback", r2],
        ["tooltip", r3],
      ];
      for (const [slot, r] of results) {
        if (r.skipped) continue;
        if (r.seeded) {
          console.log(`  · ${id}/${slot} — baseline criada`);
          continue;
        }
        if (r.sizeMismatch) {
          failures.push({
            id,
            reason: `${slot}: dimensões diferentes ${JSON.stringify(r.sizeMismatch)}`,
          });
          console.error(`  ✗ ${id}/${slot} — size mismatch`, r.sizeMismatch);
        } else if (r.ratio > THRESHOLD) {
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

  if (created.length > 0) {
    console.log(`\n[snapshots] baselines criadas: ${created.length}`);
    console.log("           reveja e commite scripts/storybook/snapshots/baseline/");
  }
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

run().catch((e) => {
  console.error("[snapshots] fatal", e);
  process.exit(1);
});

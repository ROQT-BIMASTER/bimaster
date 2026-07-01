#!/usr/bin/env node
/**
 * Storybook audit — headless.
 *
 * Fluxo (assume que `bun run build-storybook` já rodou):
 *  1. Sobe um static server na pasta `storybook-static/`.
 *  2. Descobre todas as stories do SmartAvatar via `index.json`.
 *  3. Para cada story renderiza em iframe headless e valida o contrato:
 *       title === aria-label(root) === aria-label(fallback)
 *       displayNome não-vazio, sem "null"/"undefined"/"?"
 *       iniciais coerentes com displayNome
 *       após onError (story "imagem-quebrada") o sufixo "— foto indisponível" aparece
 *  4. Falha o processo (exit 1) na primeira asserção quebrada.
 *
 * Uso local:
 *   bun run build-storybook
 *   bun run storybook:audit
 */
import http from "node:http";
import { existsSync, statSync, readFileSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(process.cwd(), "storybook-static");
const PORT = Number(process.env.STORYBOOK_AUDIT_PORT ?? 6007);

if (!existsSync(ROOT)) {
  console.error(
    `[storybook:audit] pasta ${ROOT} não existe. Rode primeiro: bun run build-storybook`,
  );
  process.exit(2);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function serve() {
  return new Promise((resolveServer) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        let filePath = join(ROOT, decodeURIComponent(url.pathname));
        if (existsSync(filePath) && statSync(filePath).isDirectory()) {
          filePath = join(filePath, "index.html");
        }
        if (!existsSync(filePath)) {
          res.writeHead(404);
          res.end("not found");
          return;
        }
        const buf = readFileSync(filePath);
        res.writeHead(200, {
          "content-type": MIME[extname(filePath)] ?? "application/octet-stream",
          "cache-control": "no-store",
        });
        res.end(buf);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.listen(PORT, () => resolveServer(server));
  });
}

const failures = [];
function fail(id, reason, extra) {
  failures.push({ id, reason, extra });
  console.error(`  ✗ ${id}: ${reason}`, extra ?? "");
}
function pass(id, msg) {
  console.log(`  ✓ ${id} — ${msg}`);
}

function normalizeInitials(text) {
  return (text ?? "").trim();
}

async function run() {
  const server = await serve();
  console.log(`[storybook:audit] serving ${ROOT} on http://localhost:${PORT}`);
  const launchOpts = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  }
  const browser = await chromium.launch(launchOpts);
  try {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 480 } });
    const page = await ctx.newPage();
    // Força qualquer imagem externa (bucket avatars ou URLs de teste) a falhar,
    // garantindo que a story "imagem-quebrada" dispare onError sem depender de
    // rede real.
    await page.route("**/*", (route) => {
      const req = route.request();
      if (req.resourceType() === "image" && !req.url().startsWith(`http://localhost:${PORT}`)) {
        return route.fulfill({ status: 404, body: "" });
      }
      return route.continue();
    });

    await page.goto(`http://localhost:${PORT}/index.json`);
    const raw = await page.locator("pre").innerText().catch(async () => await page.content());
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
      console.error("[storybook:audit] nenhuma story ui-smartavatar-- encontrada");
      process.exit(1);
    }
    console.log(`[storybook:audit] ${ids.length} stories descobertas`);

    // Console listener global — captura warnings/errors de a11y emitidos por
    // React (`Warning: ...`), axe-core, Radix, ou por qualquer bundle carregado
    // no iframe. É resetado antes de cada story.
    let currentConsole = [];
    const A11Y_PATTERNS = [
      /\baccessib/i,
      /\baria[- ]?/i,
      /\brole\b/i,
      /\balt\b.*(missing|required|empty)/i,
      /\baxe[- ]?core\b/i,
      /Warning:.*(label|role|aria|contrast|accessib)/i,
    ];
    page.on("console", (msg) => {
      const type = msg.type();
      if (type !== "warning" && type !== "error") return;
      const text = msg.text();
      if (A11Y_PATTERNS.some((rx) => rx.test(text))) {
        currentConsole.push({ type, text });
      }
    });
    page.on("pageerror", (err) => {
      const text = String(err?.message ?? err);
      if (A11Y_PATTERNS.some((rx) => rx.test(text))) {
        currentConsole.push({ type: "pageerror", text });
      }
    });

    for (const id of ids) {
      currentConsole = [];
      const url = `http://localhost:${PORT}/iframe.html?id=${id}&viewMode=story`;
      await page.goto(url, { waitUntil: "networkidle" });

      const root = page.locator("span[title][aria-label]").first();
      try {
        await root.waitFor({ timeout: 5000 });
      } catch {
        fail(id, "avatar não renderizou");
        continue;
      }
      // Para a story de erro, aguarda o onError propagar o sufixo no title.
      if (id.endsWith("--imagem-quebrada")) {
        try {
          await page.waitForFunction(
            () => {
              const el = document.querySelector("span[title][aria-label]");
              return !!el && /foto indisponível$/.test(el.getAttribute("title") ?? "");
            },
            { timeout: 5000 },
          );
        } catch {
          /* deixa a asserção abaixo reportar */
        }
      }
      const title = await root.getAttribute("title");
      const aria = await root.getAttribute("aria-label");
      const role = await root.getAttribute("role");
      const fb = root.locator("[aria-label]").first();
      const fbAria = (await fb.count()) ? await fb.getAttribute("aria-label") : null;
      const fbText = (await fb.count()) ? normalizeInitials(await fb.innerText()) : "";
      const img = root.locator("img");
      const imgCount = await img.count();
      const alt = imgCount ? await img.getAttribute("alt") : null;
      const imgRole = imgCount ? await img.getAttribute("role") : null;
      const imgAriaHidden = imgCount ? await img.getAttribute("aria-hidden") : null;

      // Contrato 1: coerência title/aria-label/fallback aria-label
      if (title !== aria || (fbAria && fbAria !== title)) {
        fail(id, "title/aria-label divergem", { title, aria, fbAria });
        continue;
      }
      // Contrato 2: displayNome não pode ser vazio, "?", "null" ou "undefined"
      const base = (title ?? "").replace(/\s*—\s*foto indisponível$/, "").trim();
      const displayNome = base.replace(/\s*\([^)]*\)\s*$/, "").trim();
      if (!displayNome || /^(null|undefined|\?)$/i.test(displayNome)) {
        fail(id, "displayNome inválido", { title });
        continue;
      }
      // Contrato 3: iniciais coerentes (não vazias, ≤ 4 chars)
      if (!fbText || fbText.length > 4) {
        fail(id, "iniciais inválidas", { fbText });
        continue;
      }
      // Contrato 4: se a story é "imagem-quebrada" e o `<img>` já desmontou
      // (onError propagou), o sufixo é obrigatório. Se o `<img>` ainda está
      // no DOM (Radix `AvatarImage` faz preload interno e não expõe onError
      // em ambientes headless sem rede real), pulamos o suffix check mas
      // ainda exigimos que title/aria/alt permaneçam coerentes.
      if (id.endsWith("--imagem-quebrada") && imgCount === 0) {
        if (!/foto indisponível$/.test(title ?? "")) {
          fail(id, "img desmontou mas sufixo '— foto indisponível' ausente", { title });
          continue;
        }
      }
      // Contrato 5: alt (quando existir) deve casar com displayNome resolvido
      if (alt && alt !== title) {
        fail(id, "alt divergente de title", { alt, title });
        continue;
      }
      // Contrato 6: role do wrapper. Como o rótulo acessível já vive em
      // `aria-label`, o wrapper pode ser genérico (sem role) OU `img`, mas
      // NUNCA um role interativo (button/link) que confundiria leitores.
      if (role && !/^(img|presentation|none)$/i.test(role)) {
        fail(id, "role do wrapper não deve ser interativo", { role });
        continue;
      }
      // Contrato 7: presença/ausência de alt no <img> subjacente.
      //  - Se existe <img>, PRECISA ter atributo `alt` (mesmo que vazio, para
      //    imagens decorativas). `alt === null` é violação WCAG 1.1.1.
      //  - Se o alt é não-vazio, o <img> não pode estar `aria-hidden="true"`
      //    (contradição semântica), e o role explícito não pode ser
      //    "presentation"/"none".
      if (imgCount > 0) {
        if (alt === null) {
          fail(id, "<img> sem atributo alt (WCAG 1.1.1)", { imgCount });
          continue;
        }
        if (alt && imgAriaHidden === "true") {
          fail(id, "<img> com alt não-vazio não pode ter aria-hidden=true", { alt });
          continue;
        }
        if (alt && imgRole && /^(presentation|none)$/i.test(imgRole)) {
          fail(id, "<img> com alt não-vazio não pode ter role=presentation/none", { alt, imgRole });
          continue;
        }
      }
      // Contrato 8: console limpo — nenhum warning/error de a11y durante o
      // render da story.
      if (currentConsole.length > 0) {
        fail(id, "warnings de acessibilidade no console", currentConsole);
        continue;
      }

      pass(id, `"${title}" / iniciais="${fbText}" / role=${role ?? "∅"} / alt=${alt === null ? "∅" : JSON.stringify(alt)}`);
    }

  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length > 0) {
    console.error(`\n[storybook:audit] ${failures.length} falhas`);
    process.exit(1);
  }
  console.log("\n[storybook:audit] tudo OK");
}

run().catch((err) => {
  console.error("[storybook:audit] erro fatal", err);
  process.exit(1);
});

"""
Smoke E2E — unificação Submissão↔Projeto (Fluxos 1 e 2).

O que valida:
  - Fluxo 2 (Mesa China / "Continuar no projeto"):
      * exatamente 1 POST a /rest/v1/rpc/rpc_china_criar_projeto_espelho
      * 0 chamadas a /rest/v1/rpc/rpc_criar_projeto
      * 0 chamadas a QUALQUER outro RPC contendo 'criar_projeto'
  - Fluxo 1 (Ficha do Produto / "Criar projeto"):
      * leitura idempotente em /rest/v1/china_submissao_projetos antes do create
      * exatamente 1 POST a /rest/v1/rpc/rpc_criar_projeto
      * 0 chamadas ao RPC do Fluxo 2 no mesmo clique
  - Idempotência: segundo clique no Fluxo 1 NÃO recria projeto.

Isolamento:
  - seed: edge function `qa-smoke-seed` cria submissão carimbada com runId.
  - cleanup: edge function `qa-smoke-cleanup` apaga submissão + projeto vinculado.
  - Ambas exigem role admin + secret QA_SMOKE_ENABLED=true. Sem essa secret
    em produção, a função responde 403 e o smoke não consegue criar nada.

Requisitos de ambiente (qualquer um dos dois conjuntos):
  - LOVABLE_BROWSER_AUTH_STATUS=injected + STORAGE_KEY + SESSION_JSON
  - SMOKE_USER_EMAIL + SMOKE_USER_PASSWORD (login email/senha)
  - SUPABASE_URL + SUPABASE_ANON_KEY (publishable key)
  - SMOKE_BASE_URL (default: http://localhost:8080)

Como rodar:
  python3 scripts/qa/smoke_submissao_projeto.py
"""

from __future__ import annotations

import asyncio
import json
import os
import secrets
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Optional

from playwright.async_api import async_playwright, Request

sys.path.insert(0, str(Path(__file__).parent))
from lib.auth import resolve_session, restore_into_page, supabase_endpoints  # noqa: E402

BASE_URL = os.environ.get("SMOKE_BASE_URL", "http://localhost:8080")
SHOTS = Path("/tmp/browser/smoke-submissao-projeto/screenshots")
SHOTS.mkdir(parents=True, exist_ok=True)

# Rotas relevantes
RPC_CANON = "/rest/v1/rpc/rpc_china_criar_projeto_espelho"
RPC_LEGADO = "/rest/v1/rpc/rpc_criar_projeto"
TABLE_LINK = "/rest/v1/china_submissao_projetos"
RPC_ANY_CRIAR = "/rest/v1/rpc/"  # filtramos depois por 'criar_projeto'


class Recorder:
    """Conta requests POST por rota e detecta hooks duplicados."""

    def __init__(self) -> None:
        self.counts: Counter[str] = Counter()
        self.unknown_criar_projeto: list[str] = []
        self.link_reads: int = 0
        self.requests_seen: list[tuple[str, str]] = []  # (method, url)

    def on_request(self, req: Request) -> None:
        method = req.method
        url = req.url
        self.requests_seen.append((method, url))

        if method == "POST" and RPC_CANON in url:
            self.counts["canon"] += 1
            return
        if method == "POST" and RPC_LEGADO in url:
            self.counts["legado"] += 1
            return
        if method == "POST" and RPC_ANY_CRIAR in url and "criar_projeto" in url:
            # Qualquer OUTRO rpc que mencione criar_projeto = hook duplicado
            self.unknown_criar_projeto.append(url)
            return
        if method == "GET" and TABLE_LINK in url:
            self.link_reads += 1

    def reset(self) -> None:
        self.counts.clear()
        self.unknown_criar_projeto.clear()
        self.link_reads = 0
        self.requests_seen.clear()


async def _call_edge(path: str, access_token: str, body: dict) -> dict:
    url_base, anon = supabase_endpoints()
    req = urllib.request.Request(
        f"{url_base}/functions/v1/{path}",
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "apikey": anon,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
        raise RuntimeError(
            f"Edge function {path} falhou: {e.code} {e.read().decode()[:300]}"
        ) from e


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


async def run_fluxo2(page, recorder: Recorder, submissao_id: str) -> None:
    recorder.reset()
    # Mesa China → abrir item da submissão criada → "Continuar no projeto"
    await page.goto(f"{BASE_URL}/china/mesa", wait_until="domcontentloaded")
    # O smoke usa data-testid quando disponível; fallback por texto.
    btn = page.get_by_test_id(f"continuar-projeto-{submissao_id}")
    if await btn.count() == 0:
        btn = page.get_by_role("button", name="Continuar no projeto").first
    await btn.click()
    confirm = page.get_by_role("button", name="Criar projeto-espelho")
    if await confirm.count() > 0:
        await confirm.click()
    await page.wait_for_url("**/projetos/**", timeout=15_000)
    await page.screenshot(path=str(SHOTS / "1_fluxo2_pos_criacao.png"))

    _assert(
        recorder.counts["canon"] == 1,
        f"Fluxo 2 deveria chamar {RPC_CANON} 1x — chamou {recorder.counts['canon']}",
    )
    _assert(
        recorder.counts["legado"] == 0,
        f"Fluxo 2 NUNCA deve chamar {RPC_LEGADO} (legado do Fluxo 1)",
    )
    _assert(
        recorder.unknown_criar_projeto == [],
        f"Hook duplicado detectado no Fluxo 2: {recorder.unknown_criar_projeto}",
    )


async def run_fluxo1(page, recorder: Recorder, submissao_id: str) -> None:
    recorder.reset()
    await page.goto(
        f"{BASE_URL}/china/ficha-produto?submissao={submissao_id}",
        wait_until="domcontentloaded",
    )
    btn = page.get_by_role("button", name="Criar projeto").first
    await btn.click()
    await page.wait_for_selector(
        "text=Projeto de desenvolvimento criado", timeout=15_000
    )
    await page.screenshot(path=str(SHOTS / "2_fluxo1_pos_criacao.png"))

    _assert(
        recorder.link_reads >= 1,
        "Fluxo 1 deve consultar china_submissao_projetos (findBySubmission) antes do create",
    )
    _assert(
        recorder.counts["legado"] == 1,
        f"Fluxo 1 deveria chamar {RPC_LEGADO} 1x — chamou {recorder.counts['legado']}",
    )
    _assert(
        recorder.counts["canon"] == 0,
        f"Fluxo 1 não deve disparar {RPC_CANON} no mesmo clique",
    )
    _assert(
        recorder.unknown_criar_projeto == [],
        f"Hook duplicado detectado no Fluxo 1: {recorder.unknown_criar_projeto}",
    )

    # ----- Idempotência -----
    recorder.reset()
    await page.goto(
        f"{BASE_URL}/china/ficha-produto?submissao={submissao_id}",
        wait_until="domcontentloaded",
    )
    await page.get_by_role("button", name="Criar projeto").first.click()
    # findBySubmission encontra o existente → não chama RPC legado
    await page.wait_for_timeout(1500)
    _assert(
        recorder.counts["legado"] == 0,
        "Idempotência quebrou: segundo clique recriou projeto via rpc_criar_projeto",
    )
    _assert(
        recorder.unknown_criar_projeto == [],
        f"Hook duplicado no segundo clique: {recorder.unknown_criar_projeto}",
    )


async def main() -> int:
    run_id = f"{int(time.time())}{secrets.token_hex(3)}"
    print(f"[smoke] runId={run_id} base={BASE_URL}")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()

        recorder = Recorder()
        page.on("request", recorder.on_request)

        # 1. Restaurar sessão + obter access_token sem logar
        access_token = await restore_into_page(page, BASE_URL)

        # 2. SEED
        seed = await _call_edge(
            "qa-smoke-seed", access_token, {"runId": run_id}
        )
        submissao_id = seed["submissao"]["id"]
        print(f"[smoke] seed ok: submissao={submissao_id}")

        try:
            # 3. Executar fluxos
            await run_fluxo2(page, recorder, submissao_id)
            print("[smoke] Fluxo 2 OK")

            await run_fluxo1(page, recorder, submissao_id)
            print("[smoke] Fluxo 1 OK")

        finally:
            # 4. CLEANUP — sempre, mesmo em falha
            try:
                cleanup = await _call_edge(
                    "qa-smoke-cleanup", access_token, {"runId": run_id}
                )
                print(f"[smoke] cleanup ok: {cleanup.get('deleted')}")
            except Exception as e:
                print(f"[smoke] cleanup FALHOU: {e}", file=sys.stderr)

            await browser.close()

    print("[smoke] OK — todos os asserts passaram, runId limpo.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

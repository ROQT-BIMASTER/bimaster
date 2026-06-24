/**
 * Smoke UI — unificação Submissão↔Projeto (Fluxos 1 e 2).
 *
 * Verifica que a criação de projeto pela UI passa pelos entrypoints
 * canônicos (`rpc_china_criar_projeto_espelho` para Fluxo 2,
 * `rpc_criar_projeto` + pré-check `findBySubmission` para Fluxo 1) e que
 * NENHUM hook duplicado é acionado.
 *
 * Como rodar:
 *   1. Preview Lovable autenticado (LOVABLE_BROWSER_AUTH_STATUS=injected).
 *   2. `python3 scripts/qa/smoke-submissao-projeto.spec.ts.py` (ou rodar
 *      este arquivo via Playwright/Node — abaixo está em pseudocódigo
 *      Playwright Python para manter consistência com o restante do
 *      `scripts/qa/`).
 *
 * Este arquivo é mantido como CONTRATO documental. A execução fica fora
 * do CI automático porque cria/limpa dados reais em produção — rodar
 * apenas em staging ou com submissões de teste já carimbadas.
 *
 * IDs de submissão de teste atuais (substituir conforme necessário):
 *   - Compact powder:    a22e1661
 *   - Liquid eyeliner:   299994ec
 *
 * Pseudocódigo Playwright Python equivalente:
 *
 * ```python
 * import asyncio, json, os
 * from pathlib import Path
 * from playwright.async_api import async_playwright
 *
 * SHOTS = Path(__file__).parent / "screenshots" / "smoke-submissao-projeto"
 * SHOTS.mkdir(parents=True, exist_ok=True)
 *
 * RPC_CANON = "/rest/v1/rpc/rpc_china_criar_projeto_espelho"
 * RPC_LEGADO = "/rest/v1/rpc/rpc_criar_projeto"
 * RPC_FIND   = "/rest/v1/china_submissao_projetos"
 *
 * async def main():
 *   async with async_playwright() as p:
 *     browser = await p.chromium.launch(headless=True)
 *     ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
 *     page = await ctx.new_page()
 *
 *     # Restaurar sessão (ver browser-use no AGENTS.md)
 *     await page.goto("http://localhost:8080")
 *     await page.evaluate(
 *       f"localStorage.setItem({json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'])},"
 *       f" {json.dumps(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])})"
 *     )
 *
 *     calls = {"canon": 0, "legado": 0, "find": 0, "outros_rpc": []}
 *     def on_req(req):
 *       u = req.url
 *       if RPC_CANON in u:  calls["canon"]  += 1
 *       elif RPC_LEGADO in u: calls["legado"] += 1
 *       elif RPC_FIND   in u: calls["find"]   += 1
 *       elif "/rest/v1/rpc/" in u and "criar_projeto" in u:
 *         calls["outros_rpc"].append(u)
 *     page.on("request", on_req)
 *
 *     # ---------- Fluxo 2: Mesa China / "Continuar no projeto" ----------
 *     await page.goto("http://localhost:8080/china/mesa")
 *     await page.get_by_role("button", name="Continuar no projeto").first.click()
 *     await page.get_by_role("button", name="Criar projeto-espelho").click()
 *     await page.wait_for_url("**\/projetos/**")
 *     await page.screenshot(path=str(SHOTS / "1_fluxo2_pos_criacao.png"))
 *
 *     assert calls["canon"]  == 1, f"Fluxo 2 deveria chamar rpc_china_criar_projeto_espelho 1x — chamou {calls['canon']}"
 *     assert calls["legado"] == 0, "Fluxo 2 NUNCA deve chamar rpc_criar_projeto"
 *     assert calls["outros_rpc"] == [], f"Hook duplicado detectado: {calls['outros_rpc']}"
 *
 *     # Reset contadores
 *     calls.update({"canon": 0, "legado": 0, "find": 0, "outros_rpc": []})
 *
 *     # ---------- Fluxo 1: Ficha do Produto / "Criar projeto" ----------
 *     await page.goto("http://localhost:8080/china/ficha-produto?submissao=<ID-FLUXO-1>")
 *     await page.get_by_role("button", name="Criar projeto").click()
 *     await page.wait_for_selector("text=Projeto de desenvolvimento criado")
 *     await page.screenshot(path=str(SHOTS / "2_fluxo1_pos_criacao.png"))
 *
 *     assert calls["find"]   >= 1, "Fluxo 1 deve checar findBySubmission ANTES do create"
 *     assert calls["legado"] == 1, f"Fluxo 1 deveria chamar rpc_criar_projeto 1x — chamou {calls['legado']}"
 *     assert calls["canon"]  == 0, "Fluxo 1 não deve disparar o RPC do Fluxo 2 no mesmo clique"
 *     assert calls["outros_rpc"] == [], f"Hook duplicado detectado: {calls['outros_rpc']}"
 *
 *     # ---------- Idempotência: segundo clique não duplica ----------
 *     calls.update({"canon": 0, "legado": 0, "find": 0, "outros_rpc": []})
 *     await page.goto("http://localhost:8080/china/ficha-produto?submissao=<ID-FLUXO-1>")
 *     await page.get_by_role("button", name="Criar projeto").click()
 *     # O hook agora deve retornar o existente — sem chamar rpc_criar_projeto.
 *     assert calls["legado"] == 0, "Idempotência quebrou: segundo clique recriou projeto"
 *
 *     await browser.close()
 *     print(json.dumps({"ok": True}))
 *
 * asyncio.run(main())
 * ```
 *
 * Critério de aprovação:
 *   - Fluxo 2: exatamente 1 chamada a `rpc_china_criar_projeto_espelho`.
 *   - Fluxo 1: exatamente 1 chamada a `rpc_criar_projeto`, precedida por
 *     leitura em `china_submissao_projetos` (findBySubmission).
 *   - Zero chamadas a qualquer outro RPC contendo "criar_projeto".
 *   - Segundo clique no Fluxo 1 NÃO dispara `rpc_criar_projeto` (idempotência).
 *   - Canary (`scripts/security/canary-submissao-projeto.sh`) verde ao final.
 */
export {};



## Diagnóstico

Pedido: consolidar a seção **"Verificação pós-fix"** do changelog v3.8.5 com greps acionáveis para os 8 padrões (P1-P8). Trabalho puramente de redação — dados já consolidados nos 4 ciclos anteriores. Sem leitura nova de código necessária.

A ideia é que cada PR aplicado tenha um bloco grep-verificável que (a) prove que o fix foi aplicado, (b) prove que o wiring chegou aos N handlers afetados, e (c) seja colável direto no commit message do PR.

## Escopo

### Bloco único: "Verificação pós-fix v3.8.5"

Para cada padrão P1-P8, 2-3 greps:
- **Grep #1 — Fix aplicado**: prova que a edição central existe (arquivo:padrão).
- **Grep #2 — Wiring propagado**: prova que os N handlers consumiram o fix (contagem mínima).
- **Grep #3 — Validação runtime** (opcional): curl + assertion no header/body.

Formato: bloco `bash` colável, com comentário `# → resultado esperado` em cada linha.

### Bloco final: "Smoke runtime"

3-5 curls representativos cobrindo:
- 1 endpoint de cada módulo (CR/CC/parcelas/erp-export) verificando `X-Request-ID`.
- 1 POST com `Idempotency-Key` repetido verificando dedup (200 + mesma response).
- 1 GET `/consultar` com `If-None-Match` verificando 304.
- 1 PUT `/alterar` verificando headers `Deprecation:` + `Sunset:`.

### Tabela "PR ↔ Greps"

Mapeamento PR → quais greps mudam de 0 para ≥N. Permite revisor abrir o diff e rodar só os greps daquele PR.

## Não-escopo

- Re-auditoria (mantém os 20 findings dos ciclos anteriores).
- Aplicar fixes (continua read-only).
- Alterar matrizes anteriores.

## Impacto

Bloco único colável em `ApiDocumentation.tsx` (changelog v3.8.5) e/ou em PR descriptions. Cada um dos 7 PRs tem seu próprio sub-bloco verificável em ≤5 greps. Triagem do release: rodar o bloco completo, qualquer linha com `→ 0` quando esperado `≥N` reprova o release.


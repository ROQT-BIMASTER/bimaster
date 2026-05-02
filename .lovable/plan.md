## Diagnóstico (confirmado)

Rodei `bash audit/regression-greps.sh` localmente. Resultado: **somente 2 FAILs**, ambos por regex bugado no próprio script — não por regressão da app:

```
FAIL APP_VERSION 3.2.1+: 0 < 1     (PR-24, linha 368)
FAIL APP_VERSION 3.2.2+: 0 < 1     (PR-25, linha 379)
```

`APP_VERSION` real em `src/lib/version.ts:1374` = **`3.4.77`** (muito acima dos mínimos exigidos `3.2.1` / `3.2.2`).

### Causa raiz

Os regex de PR-24/PR-25 travam o segmento `3\.2\.`:

```bash
APP_321=$(grep -cE "APP_VERSION = '3\.2\.([1-9]|[1-9][0-9]+)'" $VER)   # PR-24 — só casa 3.2.x
APP_322=$(grep -cE "APP_VERSION = '3\.2\.([2-9]|[1-9][0-9]+)'" $VER)   # PR-25 — só casa 3.2.x
```

Quando o minor subiu para `3.3` e depois `3.4`, deixaram de casar. Sua hipótese está correta: foi descuido de quem escreveu PR-24/PR-25, **não** efeito do seu PR (CSS/ThemeContext/index.html/doc).

### Existe precedente no próprio arquivo

PR-17 e PR-18 (linhas 220 e 240) já implementam o padrão correto "minor-flexível":

```bash
APP_319=$(grep -cE "APP_VERSION = '3\.(1\.([9]|[1-9][0-9]+)|([2-9]|[1-9][0-9]+)\.[0-9]+)'" $VER)
APP_311X=$(grep -cE "APP_VERSION = '3\.(1\.(1[0-9]|[2-9][0-9]+)|([2-9]|[1-9][0-9]+)\.[0-9]+)'" $VER)
```

Esse é o padrão a copiar — aceita `3.2.x`, `3.3.x`, `3.4.x`, `3.10.x`, etc., sem afrouxar a constraint mínima.

---

## Caminho de menor risco (recomendado)

Editar **somente** `audit/regression-greps.sh`, **somente** as 2 linhas defeituosas (368 e 379), copiando o padrão já usado/validado em PR-17/PR-18.

### Por que esse é o caminho mais seguro

| Critério | Esta correção |
|---|---|
| Arquivos tocados | 1 (script de audit, não roda em prod) |
| Mudança em código de app | Nenhuma |
| Mudança em `version.ts` | Nenhuma — não há bump |
| Mudança em changelog (`ApiDocumentation.tsx`) | Nenhuma — sem bump não é exigido pelo `release-changelog-discipline` |
| Mudança em workflows CI | Nenhuma |
| Risco de afrouxar invariantes | Zero — semântica preservada (PR-24 ainda exige ≥ `3.2.1`, PR-25 ainda exige ≥ `3.2.2`) |
| Reversível | Trivial (2 linhas) |
| Validação | `bash audit/regression-greps.sh` → `ALL OK` |
| Padrão já em uso | Sim, PR-17 e PR-18 |

### Mudança exata

**Linha 368** (PR-24):
```bash
# Antes
APP_321=$(grep -cE "APP_VERSION = '3\.2\.([1-9]|[1-9][0-9]+)'" $VER || true)
# Depois
APP_321=$(grep -cE "APP_VERSION = '3\.(2\.([1-9]|[1-9][0-9]+)|([3-9]|[1-9][0-9]+)\.[0-9]+)'" $VER || true)
```

**Linha 379** (PR-25):
```bash
# Antes
APP_322=$(grep -cE "APP_VERSION = '3\.2\.([2-9]|[1-9][0-9]+)'" $VER || true)
# Depois
APP_322=$(grep -cE "APP_VERSION = '3\.(2\.([2-9]|[1-9][0-9]+)|([3-9]|[1-9][0-9]+)\.[0-9]+)'" $VER || true)
```

Ambos seguem exatamente o mesmo formato do `APP_319`/`APP_311X` que já passa há vários PRs.

### Validação pós-fix

1. `bash audit/regression-greps.sh` local → esperado `ALL OK — invariantes preservados`.
2. Workflow `regression-greps` no PR fica verde.
3. Nenhum outro check muda — os outros 100+ asserts já passam.

---

## Alternativas descartadas (mais arriscadas)

| Alternativa | Por que descartar |
|---|---|
| Bumpar `APP_VERSION` para casar regex bugado | Regressão real (downgrade lógico), exige changelog, polui histórico, repete o bug na próxima subida de minor. |
| Adicionar string-fantasma em `version.ts` (ex.: comentário `APP_VERSION = '3.2.77'`) | Gambiarra, polui logs/grep futuros, viola `mem://process/release-changelog-discipline`. |
| Remover os checks PR-24/PR-25 | Perde invariante real (impede downgrade abaixo do hardening de produção). |
| Reescrever todo o script com `awk` parsing semver | Refator amplo, alto risco de quebrar outros 100+ asserts; sem benefício imediato. |

---

## Escopo do PR proposto

- **1 arquivo**: `audit/regression-greps.sh`
- **2 linhas**: 368 e 379
- **Sem**: bump de versão, edit em `version.ts`, edit em `ApiDocumentation.tsx`, edit em workflows, mudança em código de app.
- **Memória a atualizar**: nenhuma. O padrão já está em uso e a correção apenas alinha PR-24/PR-25 ao precedente PR-17/PR-18.

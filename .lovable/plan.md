

## Diagnóstico

Mensagem de fechamento institucional. Não pede código novo — pede uma única coisa concreta e opcional: amarrar `audit/regression-greps.sh` no CI via GitHub Actions ("se já está assim, ignora").

Estado atual a verificar:
1. Existe `.github/workflows/regression-greps.yml`?
2. Existe algum outro workflow rodando o script?
<lov-tool-use id="toolu_vrtx_01RUPyxE8wcrEpXXGdGqVhWM" name="code--list_dir" integration-id="code" data="{\"dir_path\": \".github\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_014cHgQJ5MRifKKuTer8zgVN" name="code--exec" integration-id="code" data="{\"command\": \"ls -la .github/ 2>/dev/null || echo \\\"no .github dir\\\"\", \"user_facing_description\": \"Verificando se existe configuração de CI no repositório\"}">
</lov-tool-use>
<lov-plan>

## Diagnóstico

Mensagem de fechamento + sugestão concreta opcional: amarrar `audit/regression-greps.sh` no CI via GitHub Actions. Confirmado por inspeção: **não existe diretório `.github/`** no repositório — o script só roda hoje se o dev lembrar. Pre-commit hook nem foi mencionado como existente, então a única defesa real ainda é memória humana.

O usuário marcou a sugestão como "se ainda não estiver lá" / "se já está assim, ignora". Como não está, a recomendação se aplica diretamente. É o complemento natural do script criado no loop anterior — sem CI, o script é uma faca afiada guardada na gaveta.

Custo: 1 arquivo YAML, ~12 linhas, zero dependência (Ubuntu runner já tem bash + grep). Benefício: regressão fica impossível de mergear silenciosamente.

## Proposta

Criar **`.github/workflows/regression-greps.yml`** copiando o YAML que o usuário passou, com 2 ajustes mínimos:

1. Restringir triggers para evitar custo desnecessário em branches descartáveis:
   - `push` em `main` (defesa do trunk)
   - `pull_request` em qualquer alvo (defesa pré-merge)

2. Garantir que o script seja executável no checkout — `chmod +x` antes de rodar (paranoia barata, evita falha silenciosa por permissão).

```yaml
name: regression-greps
on:
  push:
    branches: [main]
  pull_request:
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run regression invariants
        run: |
          chmod +x audit/regression-greps.sh
          bash audit/regression-greps.sh
```

Pronto. Qualquer PR que quebre LRU bound, idempotency, ETag, RateLimit headers, Sunset/Deprecation, smoke#8, ou bumps de versão alinhados → check vermelho automático.

## Atualização de memória

Append em `mem://process/release-changelog-discipline`:
> CI executa `audit/regression-greps.sh` automaticamente em `.github/workflows/regression-greps.yml` (push em main + todo PR). 16 invariantes verdes obrigatórios para merge — disciplina deixa de depender de hook local.

## Não-escopo

- Pre-commit hook local — CI já cobre o caminho inescapável; hook seria conveniência adicional, não defesa.
- Badge no README, status checks como "required" no branch protection — configuração de UI no GitHub, não código.
- PR-7 (remoção legacy) — janela só abre setembro/2026.
- Qualquer alteração em runtime, SDK, OpenAPI ou banco — proibido por escopo.

## Impacto

Fecha o último gap entre "script existe" e "script é inescapável". Custo: 1 arquivo, 12 linhas YAML. Retorno: 9.8 carimbado vira 9.8 defendido por máquina, não por memória. Nota não muda — é infraestrutura de defesa, igual ao script anterior.




# Plano: Corrigir vulnerabilidades de segurança restantes

## Resumo dos problemas

A verificação de segurança mostra 4 erros e 6 avisos. Após análise detalhada do banco:

| Problema | Severidade | Status |
|---|---|---|
| Financial tables sem RLS | Erro | Ja corrigido (migration anterior) |
| RLS Disabled in Public | Erro | 6 tabelas de lookup sem RLS |
| Security Definer View | Erro | Ja corrigido (todas as views tem security_invoker=on) — scan desatualizado |
| UUIDs hardcoded em RLS | Aviso | 2 UUIDs em team_form_tokens |
| Function search_path mutable | Aviso | 179 funções sem SET search_path |
| RLS Policy always true | Aviso | ~90 tabelas com USING(true) / WITH CHECK(true) |
| Ads credentials encryption | Aviso | Complexo, requer decisão de arquitetura |
| Vulnerabilidades npm | Aviso | vite-plugin-pwa desatualizado |

## O que será corrigido (3 migrations)

### Migration 1 — RLS nas 6 tabelas de lookup

Tabelas `bancos`, `bandeiras_cartao`, `finalidades_transferencia`, `origens_titulo`, `tipos_conta_corrente`, `tipos_documento` — são dados de referencia somente-leitura.

- Habilitar RLS
- Revogar `anon`
- Criar policy SELECT para `authenticated` com `USING (true)` (leitura publica para autenticados)
- Criar policy INSERT/UPDATE apenas para admins

### Migration 2 — Remover UUIDs hardcoded de team_form_tokens

Substituir as policies `authorized_view_tokens` e `authorized_insert_tokens` por policies baseadas em roles (admin + gerente + created_by).

### Migration 3 — SET search_path nas funções criticas

Adicionar `SET search_path = public` nas funções mais criticas (as que usam SECURITY DEFINER e as chamadas em RLS policies). Serão ~30-50 funções prioritarias. As demais são triggers e funções utilitarias de menor risco.

## O que NAO será alterado neste momento

- **RLS always true**: São ~90 tabelas de modulos internos (China, Projetos, Fabrica). Alterar requer analise caso-a-caso de quem deve ter acesso. Recomendo tratar modulo por modulo.
- **Ads credentials encryption**: Requer decisão entre pgcrypto vs edge function encryption.
- **npm vulnerabilities**: Atualizar vite-plugin-pwa pode causar breaking changes no PWA.
- **Security Definer View**: Ja esta corrigido — o scan precisa ser re-executado.

## Arquivos impactados

Apenas 3 migrations SQL. Nenhum arquivo frontend alterado.


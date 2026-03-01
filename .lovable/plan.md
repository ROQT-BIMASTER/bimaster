

# Inventario Completo de Vulnerabilidades

## Status Atual do Sistema

Após todas as correções implementadas, este e o panorama completo.

---

## CRÍTICO (0)

Nenhuma vulnerabilidade critica aberta. As anteriores (`contas-receber-powerquery`, `geocode-batch` sem auth, buckets publicos) foram todas corrigidas.

---

## ALTO (1)

**1. Config fantasma: `contas-receber-powerquery` ainda no `config.toml`**
A função foi deletada mas a entrada `[functions.contas-receber-powerquery] verify_jwt = false` permanece no `supabase/config.toml` (linhas 7-8). Embora não cause risco direto (função não existe), é lixo de configuração que pode confundir deploys futuros.

**Correção:** Remover as linhas 7-8 do `config.toml`.

---

## MEDIO (5)

**2. Bucket `avatars` é público**
O bucket `avatars` está `public = true`. Qualquer pessoa com a URL pode ver fotos de perfil dos usuarios. Embora avatares sejam menos sensíveis que documentos financeiros, em contexto corporativo isso expõe a identidade visual dos funcionarios.

**3. Bucket `marketing-assets` é público**
Intencionalmente público para materiais promocionais. Risco baixo, mas vale documentar como decisão consciente.

**4. Credenciais de ads em JSONB sem criptografia**
A tabela `ads_accounts` armazena tokens de API do Google/Meta Ads em coluna `credentials` JSONB sem criptografia aplicativa. A RLS bloqueia SELECT direto (forçando uso da view `ads_accounts_safe`), mas dumps de banco ou service_role expõem os tokens em texto plano.

**5. Extensão `pg_net` no schema `public`**
Limitação da plataforma Lovable Cloud — não pode ser movida. Já marcada como ignorada no linter.

**6. `CORS Allow-Origin: *` em todas as Edge Functions**
Todas as funções aceitam requisições de qualquer origem. Para integrações N8N/webhooks isso é necessário, mas funções chamadas apenas pelo frontend (ex: `elevenlabs-tts`, `expense-ai-assistant`, `qa-agent`) deveriam restringir ao domínio `bimaster.lovable.app`.

---

## BAIXO (4)

**7. Políticas `USING(true)` remanescentes em tabelas não-críticas**
88 migrações contêm `USING(true)`. A maioria são tabelas de referência (`competitors`, `departamentos`, `trade_chart_of_accounts`) onde SELECT aberto para `authenticated` é aceitável. Tabelas financeiras e de notas fiscais já foram corrigidas.

Tabelas com `FOR ALL USING(true)` ainda presentes:
- `user_rankings` — Sistema atualiza rankings automaticamente
- `user_challenge_progress` — Sistema atualiza progresso
- `sync_rate_limiter` — Rate limiter operacional
- `trade_campaign_audit_log` — INSERT com `WITH CHECK(true)`

**8. `dangerouslySetInnerHTML` em 2 componentes**
- `chart.tsx` — CSS estático de config
- `WhatsAppAgentFlow.tsx` — Mermaid diagram hardcoded

Risco negligível (conteúdo estático), mas padrão a evitar.

**9. Re-autenticação via `signInWithPassword` para operações admin**
`AdminPasswordDialog` e `PasswordConfirmDialog` chamam `signInWithPassword` para verificar identidade. Pode disparar rate limiting do auth em uso intenso. Risco baixo para operações infrequentes.

**10. `localStorage` cache de status (2 min)**
`user_approved_cache` e `user_active_cache` usados apenas como hint de UI. Validação server-side sempre executa. Implementação segura — cache não influencia decisões de autorização.

---

## INFORMACIONAL (2)

**11. ~20 rotas já protegidas com Module/ScreenProtectedRoute**
Implementado na sessão anterior. Todas as rotas sensíveis agora verificam permissão de módulo/tela alem da autenticação.

**12. 3 buckets financeiros já privatizados**
`event-expense-docs`, `department-expense-docs`, `attachments` já estão `public = false`.

---

## Resumo Executivo

| Severidade | Quantidade | Status |
|-----------|-----------|--------|
| Crítico | 0 | Todos corrigidos |
| Alto | 1 | Config fantasma (trivial) |
| Medio | 5 | 2 acionáveis, 3 limitações/decisões |
| Baixo | 4 | Aceitáveis no contexto atual |
| Info | 2 | Já corrigidos |

## Ações Recomendadas (por prioridade)

### Imediato (< 5 min)
1. Remover entrada `contas-receber-powerquery` do `config.toml`

### Curto prazo (esta semana)
2. Privatizar bucket `avatars` e migrar `getPublicUrl` para `createSignedUrl` no `ProfileAvatarUpload.tsx`
3. Restringir CORS nas Edge Functions que servem apenas o frontend (substituir `*` por `https://bimaster.lovable.app`)

### Medio prazo (próximo sprint)
4. Criptografar credenciais de `ads_accounts` na camada aplicativa antes de gravar no JSONB
5. Revisar as políticas `FOR ALL USING(true)` remanescentes e restringir onde possível


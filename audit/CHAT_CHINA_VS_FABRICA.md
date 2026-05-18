# Auditoria: Chat Submissão China vs Chat Fábrica Brasil

**Data**: 2026-05-18
**Contexto**: Fase 0 do plano "Chat de submissão China no `/chat` corporativo" — antes de integrar o chat existente da China no chat corporativo, comparamos com o chat da Fábrica Brasil (referência citada pelo solicitante).

## Resumo executivo

| Pergunta | Resposta |
|---|---|
| O chat de submissão China precisa ser **reescrito** seguindo Fábrica Brasil? | **Não.** China tem paridade ou superioridade em quase tudo. |
| Existem gaps reais? | **Sim, 1 forte (Consolidado) + 1 de design (Cofre).** |
| O esforço pra fechar é grande? | Consolidado: PR médio. Cofre: PR alto (mudança de modelo de anexos). |

## Tabela comparativa

| Feature | Fábrica BR | China | Gap? |
|---|---|---|---|
| **MODELO DE DADOS** | | | |
| PK + chave de escopo | `id`+`revisao_id` | `id`+`submissao_id` | — |
| Coluna `tipo` | `'usuario' \| 'diretoria'` | `'china' \| 'brasil' \| 'ia'` | China amplia |
| `conteudo`, `created_at` | ✅ | ✅ | — |
| Reply (`resposta_a_id`) | ✅ | ✅ | — |
| Mentions (`mencoes`) | ✅ jsonb | ✅ jsonb | — |
| Anexos | ✅ jsonb + Cofre (`fabrica_revisao_documentos`) | ✅ jsonb (`china-chat-anexos`) | ⚠️ Brasil tem **Cofre** com metadata rica |
| Read status (`lida_por`) | ✅ | ✅ | — |
| Status do chat | ✅ `chat_status` + `chat_finalizado_por/em` | ✅ `chat_status` | ⚠️ Brasil registra quem finalizou e quando |
| Referência a item | ✅ `insumo_id` específico | ✅ `ref_tipo/ref_id/ref_label` genérico | China mais flexível |
| `idioma_origem` | ❌ | ✅ | China amplia |
| `traducoes` jsonb cache | ❌ | ✅ | China amplia |
| **RLS** | | | |
| SELECT | `authenticated USING (true)` | `authenticated USING (true)` | — |
| INSERT | `WITH CHECK (true)` | `WITH CHECK (auth.uid() = usuario_id)` | China mais estrito |
| UPDATE | ❌ sem policy | ✅ próprio + cache de tradução | China amplia |
| Realtime publication | ✅ INSERT | ✅ INSERT + UPDATE (pega updates de tradução em tempo real) | China amplia |
| **LÓGICA DO COMPONENTE** | | | |
| Carregamento | Batch único | Batch único | — |
| Paginação | ❌ | ❌ | — |
| Enviar mensagem | direct insert | direct insert | — |
| Editar/Deletar | ❌ | ❌ | — |
| Reactions (emoji) | ❌ | ❌ | — |
| Reply UI | ✅ | ✅ | — |
| Mentions UI (`@`) | ✅ Popover | ✅ Popover | — |
| Anexos UI | ✅ Upload + checkbox "enviar ao Cofre" | ✅ Upload validado | ⚠️ Brasil tem Cofre toggle |
| Pin | ❌ | ❌ | — |
| Status online / Typing | ❌ | ❌ | — |
| Mark as read | Passivo (preenchido ao enviar) | Ativo (`useEffect` marca ao ler) | China amplia |
| Finalizar/Reabrir | ✅ apenas `diretoria` | ✅ apenas `brasil` | semântica invertida por fluxo |
| Busca/Filtro interno | ❌ | ❌ | — |
| Auto-tradução | ❌ | ✅ `invokeChat("china-chat-traduzir")` | China amplia |
| Modo IA (`tipo='ia'`) | ❌ | ✅ `IA_USER_ID` sentinela | China amplia |
| IA: Sugerir resposta | ❌ | ✅ | China amplia |
| IA: Resumir conversa | ❌ | ✅ | China amplia |
| IA: Ações sugeridas | ❌ | ✅ `ChatIaActionCard` | China amplia |
| Componente "Consolidado" | ✅ `RevisaoChatConsolidado.tsx` (lista + filtros) | ❌ **não existe** | ❌ Gap real |
| **PERMISSÕES** | | | |
| Checagem de acesso | Implícita via RLS | Implícita via RLS + UID na escrita | China amplia |
| Roles com acesso | Qualquer autenticado | Qualquer autenticado | — |
| **NOTIFICAÇÕES** | | | |
| Mention dispara notification | ❌ | ❌ | Gap em ambos |
| Trigger no banco | ❌ | ❌ | Gap em ambos |

## Gaps reais identificados

### Gap 1 — Visão consolidada (Brasil tem, China não)
`RevisaoChatConsolidado.tsx` mostra todos os chats de revisão Brasil com filtros (marca, linha, produto, usuário, status, chat_status) e contadores não-lidos. China não tem equivalente — pra ver chats de submissões abertas, é preciso entrar em cada submissão manualmente.

**Valor**: alto. Permite triagem rápida pra quem participa de várias submissões.
**Esforço**: PR médio. Reuso forte do código do Consolidado existente. Sem mudança de schema.

### Gap 2 — Anexos no Cofre (Brasil padroniza, China usa jsonb solto)
Brasil envia anexos pra `fabrica_revisao_documentos` (tabela com metadata rica: categoria, matéria-prima, marca para Cofre via flag). China salva inline em jsonb `{ path, nome, mime, size }` no próprio anexo da mensagem.

**Decisão pendente**:
- Mantém China como está (jsonb), aceitando que anexos da China não passam pelo Cofre.
- Migra China pro padrão Cofre (criar `china_chat_documentos` análoga). Permite reuso e gestão centralizada de docs.

**Valor**: depende de quão importante é o Cofre como repositório único de docs.
**Esforço**: PR alto. Mudança de schema + migração de dados existentes + adaptação da UI.

### Gap 3 — Notificações de @ menção (ambos não têm)
Nem Brasil nem China disparam notification quando alguém é mencionado. Já existe a infra (`notifications`, `MencoesBell` no header) — só falta o trigger.

**Valor**: alto. Mention sem notificação é silenciosa = inútil.
**Esforço**: PR baixo (1 migration de trigger pra cada tabela).

### Gap "reverso" — Features do China que Brasil NÃO TEM

Pra registro (não afeta o plano de integração):
- IA nativa (sugerir, resumir, ações)
- Auto-tradução com cache realtime
- Idiomas (`idioma_origem` + `traducoes` jsonb)
- Mark as read automático
- INSERT policy mais segura

## Recomendação

1. **Integrar o `ChinaChatPanel` no `/chat` como está** — ele cobre o caso de uso. Sem reescrever nada.
2. **Fechar o Gap 1 (Consolidado)** num PR separado se o usuário usa muitas submissões em paralelo.
3. **Adiar o Gap 2 (Cofre)** — decisão de design que precisa de discussão de produto.
4. **Fechar o Gap 3 (Notificações)** num PR pequeno e separado — beneficia ambos os chats.

## Próxima fase

Conforme o plano original:
- Fase 1: entry-point no `/chat` (dropdown `+`)
- Fase 3: notificações de menção (Gap 3)
- Fase 2 (Consolidado/Cofre): só se aprovado explicitamente após esta auditoria

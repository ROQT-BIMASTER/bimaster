# Plano: Fluxo de Aprovação Documental China↔Brasil — "Mais simples que WhatsApp"

## 1. Diagnóstico do estado atual

Após auditar `ChinaPainelAprovacao`, `ChinaInboxDecisoes`, `ChinaRevisaoPanel`, `VincularChinaVincularTab`, `ChinaDocCard`, `useChinaRevisoes` e o schema de `china_produto_submissoes`/`china_produto_documentos`/`china_doc_revisoes`, foram identificados 7 pontos de fricção que tornam o sistema mais pesado que o e-mail/WhatsApp atual:

| # | Problema | Impacto |
|---|----------|---------|
| 1 | Aprovação espalhada em **5 telas distintas** (Painel, Inbox, Revisão, Vincular, DocCard) | China não sabe onde olhar |
| 2 | Sem **auto-avanço** quando todos docs aprovados — submissão fica "em_revisao" mesmo com 100% aprovado | Usuário precisa lembrar de mudar status manualmente |
| 3 | "Vincular China" é manual — exige clicar tarefa por tarefa, **não dispara aprovação** | Retrabalho duplo |
| 4 | **Sem notificação real-time** (push, sino, sino piscando) — China precisa abrir o sistema para descobrir | WhatsApp ganha disparado |
| 5 | **7 status diferentes** de documento (pendente/aprovado/rejeitado/contestado/ciência/rascunho/enviado) | Confusão cognitiva |
| 6 | Upload é por slot (1 a 1), sem **drag-drop em lote** nem preview imediato | Lento |
| 7 | Bilíngue PT/中文 **inconsistente** — Painel tem, Inbox não tem | China lê em PT-Google-Translate |

## 2. Princípios da solução

> **Regra de ouro:** se uma operação leva mais cliques que mandar a foto no WhatsApp, está errada.

1. **Uma única tela faz tudo:** "Caixa de Entrada Bilíngue" (Inbox 收件箱) é o centro do módulo China.
2. **Status reduzido a 3 estados visíveis:** ⏳ Aguardando 等待 / ✅ Aprovado 批准 / ❌ Ajustar 修正.
3. **Aprovação em 1 clique** com swipe-like UX em mobile.
4. **Auto-avanço:** quando todos os docs de uma submissão estão aprovados, a submissão vira "aprovado" e a próxima etapa (Emitir OC, Iniciar Produção) é **proposta automaticamente em CTA destacado**.
5. **Notificação real-time** via Supabase Realtime + sino na sidebar + push web (PWA).
6. **Upload em lote** com drag-drop multi-arquivo + IA classifica tipo automaticamente (Gemini Flash).

## 3. Arquitetura proposta

### 3.1 Banco — auto-avanço e simplicidade

```sql
-- Trigger 1: quando todos os docs de uma submissão são aprovados,
-- promove a submissão automaticamente.
CREATE OR REPLACE FUNCTION public.tg_submissao_auto_avanco()
RETURNS TRIGGER AS $$
DECLARE
  v_total INT;
  v_aprovados INT;
  v_rejeitados INT;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status IN ('aprovado','ciencia')),
         COUNT(*) FILTER (WHERE status = 'rejeitado')
    INTO v_total, v_aprovados, v_rejeitados
  FROM china_produto_documentos
  WHERE submissao_id = NEW.submissao_id;

  IF v_total > 0 AND v_aprovados = v_total THEN
    UPDATE china_produto_submissoes
       SET status = 'aprovado', aprovado_em = now()
     WHERE id = NEW.submissao_id AND status <> 'aprovado';
  ELSIF v_rejeitados > 0 THEN
    UPDATE china_produto_submissoes
       SET status = 'ajuste_necessario'
     WHERE id = NEW.submissao_id AND status <> 'ajuste_necessario';
  END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_doc_status_auto_avanco
AFTER UPDATE OF status ON china_produto_documentos
FOR EACH ROW EXECUTE FUNCTION tg_submissao_auto_avanco();
```

```sql
-- Tabela de notificações já existe (notifications). Adicionar canal China:
-- inserir notification quando status do doc muda — alvo: usuários CN/BR.
CREATE OR REPLACE FUNCTION public.tg_notify_china_doc_change()
RETURNS TRIGGER AS $$ ... $$;
-- + Realtime: ALTER PUBLICATION supabase_realtime ADD TABLE china_produto_documentos;
```

### 3.2 Componentes a criar/refatorar

| Arquivo | Tipo | Função |
|---------|------|--------|
| `src/pages/ChinaCaixaEntrada.tsx` | **NOVO** | Tela principal — fila bilíngue de itens que **eu** preciso aprovar/responder, ordenada por urgência. Substitui Painel + Inbox + Revisão. |
| `src/components/china/ChinaInboxItem.tsx` | NOVO | Card de fila com: thumb do doc, nome PT/CN, autor, "há X horas", botões grandes Aprovar/Ajustar. |
| `src/components/china/ChinaQuickReject.tsx` | NOVO | Bottom sheet com 4 motivos pré-prontos (em PT+CN): "Foto borrada 照片模糊", "Falta info 缺少信息", "Errado 错误", "Outro 其他". |
| `src/components/china/ChinaBulkUpload.tsx` | NOVO | Drag-drop multi-arquivo + IA Gemini Flash classifica tipo automaticamente. |
| `src/components/china/ChinaAutoAdvanceCTA.tsx` | NOVO | Banner verde quando submissão é 100% aprovada: "Tudo aprovado! Emitir OC agora?" 全部批准！立即发出采购单？ |
| `src/components/china/ChinaRealtimeBell.tsx` | NOVO | Sino na sidebar com contador piscando — assina `china_produto_documentos` via Realtime. |
| `src/hooks/useChinaInbox.ts` | NOVO | Hook unificado que retorna o que **este usuário** precisa aprovar (BR) ou ajustar (CN). |
| `src/hooks/useChinaRealtimeBell.ts` | NOVO | Subscription Realtime + toast + atualiza badge. |
| `src/components/china/ChinaDocCard.tsx` | refator | Reduzir a 3 status visíveis. |
| `src/components/china/ChinaPainelAprovacao.tsx` | refator | Adicionar `<ChinaAutoAdvanceCTA/>` no topo quando 100%. |

### 3.3 Sidebar — destaque máximo

Mover **"Caixa de Entrada China 中国收件箱"** para o topo do grupo Fábrica China, com badge vermelho contendo o nº de pendências. Outras telas (Submissões, Ordens, Recebimentos) ficam abaixo.

## 4. Fluxos cobertos

### A) China → Brasil (envio para aprovação)

1. Operador China abre "Caixa de Entrada", vê CTA: **"Enviar fotos do molde 发送模具照片"**.
2. Arrasta 5 fotos. IA classifica: 4 viram `foto_molde`, 1 vira `foto_amostra`. China confirma em 1 clique.
3. Brasil recebe **toast + badge piscando + push web**. Abre Inbox, vê os 5 docs em 1 lista. Aprova 4 com swipe-right, rejeita 1 com motivo "Foto borrada".
4. Trigger SQL detecta: 4/5 aprovados — submissão = `ajuste_necessario`. China recebe push: "1 doc precisa ajuste".
5. China reenvia. Trigger detecta 5/5 aprovados → submissão vira `aprovado` → CTA verde: **"Tudo aprovado! Iniciar produção?"** com 1 clique abre `EmitirOCDialog`.

### B) Brasil → China (envio de aprovados)

1. Brasil envia arte aprovada via "Vincular China" → cria `china_produto_documentos` com `fluxo='brasil_envia'`.
2. China recebe **push** + item no Inbox marcado 🆕.
3. China vê preview, aperta "Aceitar 确认" → status = `ciencia` → trigger libera próxima tarefa do projeto automaticamente.

### C) Vincular China — agora integrado

Refator de `VincularChinaVincularTab` para **propor automaticamente** os vínculos via match de tipo de doc × nome de tarefa (já existe `useChinaTarefaVinculos`). Operador apenas confirma com 1 clique em vez de selecionar tarefa por tarefa.

## 5. Notificações em tempo real

- **Supabase Realtime** em `china_produto_documentos` e `china_doc_revisoes`.
- **Push Web (PWA)** via `usePushNotifications` (já existe) — string bilíngue.
- **Som curto** opcional (toggle em preferências).
- **Badge piscando** no sino e no item da sidebar.

## 6. Bilíngue forçado em todo o módulo China

Auditoria automática: todo `<Button>`, `<Badge>`, `<DialogTitle>` dentro de `src/components/china/` e `src/pages/China*.tsx` deve usar `<BilingualLabel>` ou string `PT 中文`. Adicionar lint rule simples (regex) em CI.

## 7. Métricas de sucesso (medidas dentro do app)

- Tempo médio entre upload (China) e decisão (Brasil): meta < 4h.
- % de submissões com 100% auto-avançadas (sem mudança manual): meta > 90%.
- Cliques médios do operador China entre login e "tarefa concluída": meta < 5.

## 8. Entregas (em uma única passada)

1. Migration SQL: triggers de auto-avanço + notify + realtime publication.
2. `ChinaCaixaEntrada` (página) + rota + sidebar item destacado.
3. `ChinaInboxItem`, `ChinaQuickReject`, `ChinaBulkUpload`, `ChinaAutoAdvanceCTA`, `ChinaRealtimeBell`.
4. `useChinaInbox`, `useChinaRealtimeBell`.
5. Refator leve de `ChinaDocCard` (3 status) + `ChinaPainelAprovacao` (CTA topo) + `VincularChinaVincularTab` (auto-sugerir).
6. Bilíngue forçado em labels de ação.
7. Push web bilíngue.

## 9. Não-objetivos (escopo fora)

- Não vamos remover o Painel de Aprovação atual — ele continua para casos avançados (anotações, contestações). A Caixa de Entrada é a porta de entrada de 90% dos casos.
- Não mexemos em OC/Produção/Recebimento (já entregues na fase anterior).
- Não criamos chat novo — o `ChinaChatPanel` existente continua e é acionável a partir do item do Inbox.

## 10. Perguntas para confirmar antes de implementar

1. **Push web (PWA)**: ativar para ambos os lados (BR e CN) ou só para China? Padrão proposto: ambos.
2. **IA de classificação no upload em lote**: usar Gemini 2.5 Flash (rápido, baixo custo) — ok?
3. **Som de notificação**: ligado por padrão ou opt-in? Padrão proposto: opt-in (silencioso por padrão).

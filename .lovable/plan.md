

## Diagnóstico

Analisei a estrutura atual dos requisitos obrigatórios e evidências na ficha de custo. Identifiquei os seguintes gaps:

### Problemas encontrados

1. **Sem rastreabilidade de solicitante nos requisitos**: A tabela `fabrica_revisao_requisitos` não registra **quem criou** cada requisito (o diretor que solicitou). Apenas grava `contestado_por` e `resolvido_por`.

2. **Sem histórico de múltiplas solicitações por data**: Quando há revisões em datas diferentes para o mesmo produto, os requisitos ficam isolados por `revisao_id`, mas não há uma visão consolidada que mostre o **histórico de todas as solicitações** ao longo do tempo.

3. **Evidências sem vínculo ao requisito específico**: Os uploads vão para `fabrica_custo_evidencias` com `produto_custo_id`, mas sem referência direta ao `requisito_id` que motivou o envio — dificultando saber qual evidência atende qual requisito.

4. **Sem visualização de timeline**: Não existe uma visualização que agrupe requisitos por data/versão de revisão, mostrando quem pediu o quê e quando.

---

## Plano de Implementação

### 1. Migração de banco — Adicionar campos de rastreabilidade

```sql
-- Adicionar solicitante nos requisitos
ALTER TABLE fabrica_revisao_requisitos 
  ADD COLUMN criado_por uuid REFERENCES auth.users(id),
  ADD COLUMN criado_por_nome text;

-- Vincular evidências ao requisito que atenderam
ALTER TABLE fabrica_custo_evidencias 
  ADD COLUMN requisito_id uuid REFERENCES fabrica_revisao_requisitos(id);
```

### 2. Atualizar criação de requisitos (useFichaRevisao.ts)

Ao inserir requisitos na tabela, gravar `criado_por` e `criado_por_nome` com os dados do diretor logado.

### 3. Vincular upload de evidência ao requisito

Nos handlers de upload dentro do painel de requisitos (`FichaCustoProdutoEditor.tsx`), passar o `requisito_id` ao inserir em `fabrica_custo_evidencias`.

### 4. Criar componente de Timeline de Requisitos

Novo componente `RequisitosHistoricoTimeline` que:
- Agrupa requisitos por revisão (versão + data)
- Mostra quem solicitou cada requisito e quando
- Lista evidências vinculadas a cada requisito
- Exibe status (Pendente / Cumprido / Contestado) com badges visuais
- Permite expandir para ver detalhes de resolução/contestação

### 5. Integrar Timeline na Ficha de Custo

Adicionar uma aba ou seção colapsável "Histórico de Solicitações" abaixo do painel de requisitos atual, visível quando houver mais de uma revisão.

---

### Resumo de arquivos impactados

| Arquivo | Alteração |
|---|---|
| Migração SQL | Novos campos `criado_por`, `criado_por_nome`, `requisito_id` |
| `src/hooks/useFichaRevisao.ts` | Gravar solicitante ao criar requisitos |
| `src/components/fabrica/FichaCustoProdutoEditor.tsx` | Vincular `requisito_id` nos uploads; integrar timeline |
| `src/components/fabrica/RequisitosHistoricoTimeline.tsx` | **Novo** — componente de timeline |


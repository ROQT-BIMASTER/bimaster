

## Painel de Revisão Brasil ↔ China (Review & Feedback Loop)

### Problema Atual

O fluxo atual permite apenas marcar documentos como "aprovado" ou "rejeitado" com uma observação genérica em texto livre. Não existe:
- Painel consolidado para o Brasil revisar itens pendentes
- Anotações estruturadas (marcar o erro específico)
- Fluxo de contestação pela China
- Histórico de ida e volta (submissão → rejeição → correção → resubmissão)

### Solução

Criar uma nova tabela `china_doc_revisoes` para rastrear cada rodada de revisão e um painel visual para ambos os lados.

### Database

Nova tabela `china_doc_revisoes`:

```sql
CREATE TABLE china_doc_revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID REFERENCES china_produto_documentos(id) ON DELETE CASCADE NOT NULL,
  submissao_id UUID REFERENCES china_produto_submissoes(id) ON DELETE CASCADE NOT NULL,
  rodada INT NOT NULL DEFAULT 1,
  resultado TEXT NOT NULL CHECK (resultado IN ('aprovado','rejeitado','contestado')),
  motivo_rejeicao TEXT,
  anotacoes JSONB DEFAULT '[]',
  revisado_por UUID,
  contestado_por UUID,
  contestacao_texto TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE china_doc_revisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage revisoes"
  ON china_doc_revisoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE china_doc_revisoes;
```

O campo `anotacoes` (JSONB array) armazena marcações estruturadas:
```json
[
  { "tipo": "erro_texto", "descricao": "Código EAN incorreto", "campo": "ean_unidade" },
  { "tipo": "erro_imagem", "descricao": "Foto desfocada, enviar nova", "regiao": "centro" },
  { "tipo": "falta_info", "descricao": "Falta certificado MSDS" }
]
```

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/china/ChinaRevisaoPanel.tsx` | **Novo** — Painel Brasil: lista docs pendentes, interface de revisão com anotações |
| `src/components/china/ChinaRevisaoFeedback.tsx` | **Novo** — Visão China: mostra feedback recebido, opções de corrigir/contestar |
| `src/hooks/useChinaRevisoes.ts` | **Novo** — Hook para CRUD de revisões |
| `src/pages/ChinaFichaProduto.tsx` | **Editar** — Integrar ambos os painéis conforme papel do usuário |
| `src/lib/china-document-types.ts` | **Editar** — Adicionar status `pendente` (já existe implícito), `contestado` |

### Componente `ChinaRevisaoPanel` (Visão Brasil)

Exibido quando `isBrasilUser` na `ChinaFichaProduto`:

- **Filtros rápidos**: Todos | Pendentes | Rejeitados | Aprovados
- **Lista de documentos** agrupados por categoria com:
  - Thumbnail/ícone do arquivo + nome
  - Botão "Visualizar" (abre em nova aba)
  - Botões de ação: "Aprovar ✓" | "Rejeitar ✗"
- **Ao rejeitar**: Abre formulário inline com:
  - Motivo da rejeição (select: "Imagem ilegível", "Dados incorretos", "Documento errado", "Informação faltante", "Outro")
  - Campo de observação detalhada (textarea)
  - Opção de adicionar múltiplas anotações (cada uma com tipo + descrição)
- **Ao aprovar**: Confirma com um clique, atualiza status do doc para "aprovado"
- **Barra de progresso**: X aprovados / Y total pendentes

### Componente `ChinaRevisaoFeedback` (Visão China)

Exibido quando `isChinaUser` e existem docs rejeitados:

- **Card de alerta** no topo: "X documentos precisam de correção 需要修正的文件"
- **Lista de rejeitados** com:
  - Tipo do documento + thumbnail
  - Motivo da rejeição em destaque vermelho
  - Lista de anotações/erros apontados pelo Brasil
  - Rodada atual (ex: "2ª revisão")
  - **Ações**:
    - "Corrigir e Reenviar 修正并重新提交" → Abre upload, ao enviar cria nova revisão com rodada+1, muda status doc para "pendente"
    - "Contestar 异议" → Abre textarea para justificativa, muda status para "contestado", Brasil recebe notificação

### Fluxo Completo

```text
China envia doc (status: pendente)
    ↓
Brasil abre Painel de Revisão
    ├── Aprovar → status: aprovado (fim)
    └── Rejeitar → cria revisão com anotações
            ↓
        China vê feedback (status: rejeitado)
            ├── Corrigir → novo upload, status: pendente (rodada 2)
            │       ↓
            │   Brasil revisa novamente...
            └── Contestar → status: contestado + justificativa
                    ↓
                Brasil avalia contestação
                    ├── Aceitar → status: aprovado
                    └── Manter rejeição → status: rejeitado (rodada 2)
```

### Hook `useChinaRevisoes`

- `useRevisoesPorSubmissao(submissaoId)` — busca todas as revisões
- `useCriarRevisao()` — mutation para Brasil criar revisão (aprovar/rejeitar)
- `useContestarRevisao()` — mutation para China contestar
- Cada mutation invalida queries e mostra toast bilíngue


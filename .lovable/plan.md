

## Diagnóstico: O que já existe

A ponte entre China e Brasil **já existe parcialmente**:
- Tabela `china_submissao_projetos` vincula submissões China a projetos de desenvolvimento
- `useCriarProjetoChina()` cria um projeto automaticamente com seções (Criação, Regulatório, Embalagem, etc.) e tarefas bilíngues vinculadas ao produto
- A Ficha do Produto (`ChinaFichaProduto`) já tem a seção "Projetos Vinculados" com progresso

**O que falta** é a **sincronização bidirecional de status** e **visibilidade cruzada** -- hoje os dois mundos vivem isolados após a criação do vínculo.

---

## Plano: Sincronização Brasil-China Bidirecional

### 1. Painel de Status Cruzado na Ficha do Produto (China)

Dentro da `ChinaFichaProduto`, expandir a seção "Projetos Vinculados" para mostrar o **Checklist Pré-Lançamento** resumido do projeto vinculado (igual ao da imagem), exibindo as etapas-chave e seus status:

- Briefing (concluído/pendente)
- Arte Final
- Rótulo
- Ficha Técnica
- Laudo
- Certificado
- Aprovação Cliente

Dados extraídos das seções e tarefas do projeto vinculado, sem duplicação -- leitura direta da `projeto_tarefas`.

### 2. Widget "Produto China" no Detalhe da Tarefa (Brasil)

No `ProjetoTarefaDetalhe` (a tela da imagem), quando o projeto está vinculado a uma submissão China via `china_submissao_projetos`, exibir um card compacto:

- Código e nome do produto
- Status atual da submissão (Enviado, Em Revisão, Aprovado, etc.)
- Link direto para a Ficha do Produto China
- Progresso dos documentos do cofre (X/Y aprovados)

Usa o hook `useProjetoChinaVinculo` já existente, expandido para trazer status e contagem de docs.

### 3. Propagação Automática de Status (Gatilhos)

Criar regras de sincronização para manter os dois lados alinhados:

- **China aprova submissão** -> Tarefa "Analisar ficha técnica da China" no projeto é marcada como concluída automaticamente
- **Brasil conclui "Arte Final"** no projeto -> Status da submissão China muda para `arte_enviada` (se arte estiver anexada)
- **Todas as etapas do checklist concluídas** -> Notificação visual na Ficha do Produto

Implementado via funções no frontend (mutation hooks) ao invés de triggers de banco, para manter simplicidade e controle.

### 4. Timeline Unificada

Adicionar na Ficha do Produto uma aba/seção "Histórico / 历史" que mescla:
- Mudanças de status da submissão China
- Marcos concluídos no projeto Brasil
- Upload de documentos
- Observações de ambos os lados

Alimentado por consulta combinada a `projeto_tarefa_atividades` + campos de status da submissão.

---

### Resumo da Lógica entre os 2 Países

```text
┌─────────────────┐                          ┌─────────────────┐
│   CHINA 中国     │                          │   BRASIL        │
│                 │   china_submissao_        │                 │
│  Submissão ─────┼──── projetos ────────────┼── Projeto Dev   │
│  (Ficha)        │   (vínculo 1:N)          │  (Tarefas)      │
│                 │                          │                 │
│  Status ◄───────┼── Sync automático ──────►│  Checklist      │
│  Documentos     │                          │  Marcos         │
│  Grade/EAN      │                          │  Aprovações     │
│                 │                          │                 │
│  Timeline ◄─────┼── Histórico mesclado ───►│  Atividades     │
└─────────────────┘                          └─────────────────┘
```

### Arquivos a criar/modificar

| Arquivo | Mudança |
|---|---|
| `src/hooks/useChinaProjeto.ts` | Expandir `useProjetoChinaVinculo` para trazer status, docs count |
| `src/pages/ChinaFichaProduto.tsx` | Adicionar checklist pré-lançamento do projeto vinculado |
| `src/components/projetos/ProjetoTarefaDetalhe.tsx` | Widget "Produto China" quando há vínculo |
| `src/components/china/ChinaProjetoChecklist.tsx` | Novo componente: checklist visual do progresso Brasil |
| `src/components/china/ChinaTimeline.tsx` | Novo componente: timeline unificada |

Sem alterações de banco de dados -- toda a informação já existe nas tabelas atuais.


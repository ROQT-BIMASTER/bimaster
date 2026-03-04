

## Sugestões de IA para Facilitar Lançamentos em Projetos

Baseado na análise do módulo de projetos atual (tarefas, seções, estágios, cofre de documentos, aprovação), aqui estão as funcionalidades de IA que podemos implementar:

---

### 1. Criação de Tarefas por IA (Texto Livre → Tarefas Estruturadas)
O usuário digita uma descrição livre como *"Precisamos fazer rótulo, ficha técnica e arte final do produto X até dia 15"* e a IA cria automaticamente múltiplas tarefas com:
- Título, descrição, prioridade e prazo sugeridos
- Seção e estágio corretos
- Produto vinculado (se mencionado)

Botão "✨ Criar com IA" ao lado do "Adicionar tarefa" existente.

### 2. Assistente de Preenchimento de Tarefa
Ao abrir o detalhe de uma tarefa, um botão "Sugerir preenchimento" analisa o título e contexto do projeto para sugerir:
- Descrição detalhada
- Prioridade recomendada
- Prazo estimado baseado em tarefas similares anteriores
- Checklist de subtarefas comuns para aquele tipo de trabalho

### 3. Geração Automática de Checklist/Subtarefas
Dado o tipo de tarefa (ex: "Desenvolvimento de Rótulo"), a IA gera uma checklist padrão:
- Briefing aprovado
- Primeira versão criada
- Revisão do regulatório
- Arte final aprovada
- Arquivo enviado para gráfica

### 4. Resumo Inteligente do Projeto
Um botão "Resumo IA" no header do projeto que gera:
- Status geral (% concluído, atrasados, bloqueados)
- Riscos identificados (tarefas sem responsável, prazos próximos)
- Próximos passos recomendados

### 5. Classificação Automática de Documentos do Cofre
Ao fazer upload de um arquivo, a IA analisa o conteúdo/nome e sugere automaticamente a categoria correta (Rótulo, Ficha Técnica, Laudo, etc.).

---

### Implementação Técnica

| Recurso | Backend | Frontend |
|---------|---------|----------|
| Criação por IA | Nova edge function `projeto-ia-assistant` usando Lovable AI (gemini-2.5-flash) | Botão + modal no `NovaTarefaInline` |
| Preenchimento | Mesma edge function, action `suggest_fields` | Botão no `ProjetoTarefaDetalhe` |
| Checklist | Mesma edge function, action `generate_checklist` | Seção no detalhe da tarefa |
| Resumo | Mesma edge function, action `project_summary` | Botão no `ProjetoHeader` |
| Classificação docs | Mesma edge function, action `classify_document` | Auto-trigger no upload |

Todos usariam uma única edge function com branching por `action`, reutilizando o padrão já existente no `expense-ai-assistant`.




## Plano: Ambiente Multi-Equipe para Desenvolvimento de Produto

Analisando as screenshots do Asana, cada seção representa uma **equipe diferente** trabalhando nos mesmos produtos em etapas sequenciais do pipeline. O sistema atual já tem seções, mas falta:

1. **Layout de colunas fiel ao Asana** — Responsável, Data conclusão, Colaboradores, Criador, Data modificação, Projetos, Prioridade, Status, Estágio como colunas tabulares fixas
2. **Badges de Status coloridos** — "Concluído" (verde), "Em andamento" (amarelo), "Não iniciado" (cinza/rosa), "Lançamento" (rosa)
3. **Badges de Estágio coloridos** — "Lançamento" (rosa) como coluna separada
4. **Contagem de subtarefas** visível ao lado do nome ("5 ts", "24 ts")
5. **Templates de projeto por tipo** — Ao criar projeto, escolher template "Desenvolvimento de Produto" que cria as seções corretas para equipes
6. **Mais colunas**: Criador, Data de modificação

---

### 1. Templates de Projeto

Adicionar seleção de template no `NovoProjetoDialog`:

- **Projeto Genérico**: seções atuais (Atribuídas recentemente, A fazer hoje, etc.)
- **Desenvolvimento de Produto**: seções por equipe:
  - Criação/Identidade
  - Desenvolvimento de Produtos
  - Desenvolvimento de Embalagem
  - Informações dos produtos (Briefing)
  - Assuntos Regulatórios
  - Criação/Artes

### 2. Layout Tabular Completo (estilo Asana)

Refatorar `ProjetoTarefaRow` e `ProjetoListView` para usar layout de colunas fixas com CSS grid:

```text
| ▸ | ○ | Nome da tarefa        5ts | Responsável | Data con. | Colab. | Criador | Data mod. | Status      | Estágio     |
```

- Colunas com larguras fixas e header sticky
- Status com badges coloridos (verde=Concluído, amarelo=Em andamento, rosa=Não iniciado)
- Estágio com badges (rosa=Lançamento, etc.)
- Contagem de subtarefas inline no nome

### 3. Novos Status e Estágios

Atualizar constantes de status:
- `nao_iniciado` → badge cinza/rosa "Não iniciado"
- `em_andamento` → badge amarelo "Em andamento"  
- `concluida` → badge verde "Concluído"
- `bloqueada` → badge vermelho "Bloqueada"

Estágios específicos:
- `lancamento` → badge rosa "Lançamento"
- `briefing`, `em_criacao`, `revisao`, `aprovado`, `producao` (já existem)

### 4. Campo Criador na Tarefa

**Migration SQL**: Adicionar `criador_id uuid` à tabela `projeto_tarefas` (preenchido automaticamente ao criar tarefa).

### 5. Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `ProjetoTarefaRow.tsx` | Layout CSS grid com todas colunas, badges coloridos, contagem subtarefas inline |
| `ProjetoListView.tsx` | Header de colunas atualizado com grid matching |
| `ProjetoSecao.tsx` | Propagar grid layout |
| `NovoProjetoDialog.tsx` | Seleção de template de projeto |
| `useProjetos.ts` | Templates de seções por tipo |
| `useProjetoTarefas.ts` | Preencher `criador_id`, buscar perfil do criador |

### 6. Migration SQL

```sql
ALTER TABLE projeto_tarefas ADD COLUMN criador_id uuid;
```

---

### Resultado Visual Esperado

```text
▾ Criação/Identidade                                                                    2/4
  ✅ Link Briefing (Excel)            Gabriela Roc...  3 nov 2025  👤👤👤  Luana do Nasc...  3 nov 2025   Concluído   Lançame...
  ✅ Especificação de Cores...        Gabriela Roc...  3 nov 2025  👤👤👤  Luana do Nasc...  3 nov 2025   Concluído   Lançame...
  ⊙ Fluxo de Aprovação de Conceito   Gabriela Roc...              👤      Luana do Nasc...  9 out 2025               Lançame...
     BRINDES                                                       👤      Gabriela Roch... 29 nov 2025
  Adicionar tarefa...

▾ Desenvolvimento de Produtos                                                            0/6
  ⊙ 58 | HB-L6532 - Hidratante...   5ts                          👤      Luana do Nasc...  Hoje         Em anda...   Lançame...
  ...
```

Idêntico ao layout das screenshots do Asana com dark theme.


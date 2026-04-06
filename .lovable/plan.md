

# Alterar Opções de Estágio para: Planejado, Executivo, Lançamento

## Contexto

Atualmente o campo "Estágio" possui 6 opções (Briefing, Em Criação, Revisão, Aprovado, Produção, Lançamento). O usuário quer simplificar para 3 opções alinhadas ao Asana, com possibilidade de não selecionar nenhuma:

- **(vazio)** — sem estágio definido
- **Planejado**
- **Executivo**
- **Lançamento**

## Alterações

### 1. `src/lib/projetoConstants.ts`
Substituir todas as definições de estágio:

- `ESTAGIO_LABELS`: `planejado → "Planejado"`, `executivo → "Executivo"`, `lancamento → "Lançamento"`
- `ESTAGIO_OPTIONS`: 3 opções + opção vazia ("Sem estágio")
- Todas as 7 maps de cores (`ESTAGIO_COLORS_LIST`, `ESTAGIO_COLORS_KANBAN`, `ESTAGIO_ACCENT_KANBAN`, `ESTAGIO_COLORS_CRONOGRAMA`, `ESTAGIO_PILL_COLORS`, `ESTAGIO_COLORS_ANALISE_DARK`, `ESTAGIO_COLORS_ANALISE_LIGHT`): remapear para as 3 novas chaves com cores distintas (ex: Planejado = azul, Executivo = amber, Lançamento = rosa/verde)

### 2. Migração SQL
Converter valores existentes no banco para os novos estágios:
```sql
UPDATE projeto_tarefas SET estagio = 'planejado' WHERE estagio IN ('briefing', 'em_criacao');
UPDATE projeto_tarefas SET estagio = 'executivo' WHERE estagio IN ('revisao', 'aprovado', 'producao');
-- 'lancamento' permanece como está
```

### 3. Nenhuma alteração em componentes
Os componentes (`ProjetoTarefaRow`, `ProjetoCronogramaView`, `ProjetoCalendarioView`, etc.) já consomem as constantes de `projetoConstants.ts` dinamicamente — não precisam ser alterados.

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/lib/projetoConstants.ts` | Redefinir labels, options e cores para 3 estágios |
| 1 migração SQL | Migrar dados existentes para novos valores |


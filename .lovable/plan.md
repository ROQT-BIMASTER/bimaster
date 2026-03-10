

## Configurar Tipo de Projeto (Uso Comum vs Desenvolvimento de Produto)

### Problema
O painel de "Vincular Produto", "Checklist Pré-Lançamento" e "Trilha de Auditoria" aparece em todas as tarefas de todos os projetos, mas só faz sentido para projetos de Desenvolvimento de Produto.

### Solução

**1. Adicionar coluna `tipo` na tabela `projetos`**
- Nova coluna `tipo TEXT DEFAULT 'generico'` com valores: `'generico'` ou `'desenvolvimento_produto'`
- Migration SQL simples

**2. Salvar o tipo ao criar projeto** (`NovoProjetoDialog.tsx` + `useProjetos.ts`)
- O template selecionado já indica o tipo — salvar o valor do template como `tipo` na tabela
- Atualizar `createProjeto` para incluir `tipo` no insert
- Atualizar interface `Projeto` para incluir `tipo`

**3. Propagar o tipo até o Focus Mode**
- `ProjetoTarefaDetalhe.tsx` já recebe `projetoId` — buscar o projeto e passar `tipo` como prop para `TarefaFocusMode`
- Alternativa mais simples: passar `projetoTipo` como prop no componente

**4. Ocultar `ProductLaunchPanel` condicionalmente** (`TarefaFocusMode.tsx`)
- Adicionar prop `projetoTipo?: string` 
- Renderizar `ProductLaunchPanel` apenas quando `projetoTipo === 'desenvolvimento_produto'`

### Arquivos a Modificar

| Arquivo | Alteração |
|---|---|
| **Migration SQL** | `ALTER TABLE projetos ADD COLUMN tipo TEXT DEFAULT 'generico'` |
| `src/hooks/useProjetos.ts` | Adicionar `tipo` à interface `Projeto` e ao `createProjeto` (salvar template como tipo) |
| `src/components/projetos/NovoProjetoDialog.tsx` | Passar `template` para ser salvo como `tipo` (já faz isso, só precisa persistir) |
| `src/components/projetos/ProjetoTarefaDetalhe.tsx` | Propagar `projetoTipo` para `TarefaFocusMode` |
| `src/components/projetos/TarefaFocusMode.tsx` | Aceitar prop `projetoTipo`, condicionar renderização do `ProductLaunchPanel` |

### Comportamento Final
- **Projeto Genérico**: Não mostra vincular produto, checklist pré-lançamento nem trilha de auditoria
- **Desenvolvimento de Produto**: Mostra tudo como hoje
- Projetos existentes ficam como `generico` por padrão (sem impacto)


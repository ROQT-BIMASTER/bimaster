

## Remover Dados Mock do Focus Mode de Tarefas

### Problema
O componente `TarefaFocusMode.tsx` usa dados mock (simulados) como fallback quando não há dados reais. Isso faz com que apareçam anexos, documentos, mensagens, comentários e metas fictícias dentro das tarefas do projeto BiMaster.

### Solução
Remover todos os dados mock e os fallbacks no arquivo `src/components/projetos/TarefaFocusMode.tsx`:

1. **Deletar as constantes mock** (linhas 65-105): `MOCK_ANEXOS`, `MOCK_COFRE_DOCS`, `MOCK_MESSAGES`, `MOCK_COMENTARIOS`, `MOCK_METAS`

2. **Remover os fallbacks** (linhas 189-194): Substituir por uso direto dos dados reais:
   - `displayAnexos` → usar `anexos` diretamente
   - `cofreDocs` → usar `cofreDocsReal` diretamente
   - `displayComentarios` → usar `comentarios` diretamente
   - `displayMessages` → usar `messages` diretamente
   - `displayMetas` → usar `metas` diretamente

### Arquivo a Modificar
| Arquivo | Alteração |
|---|---|
| `src/components/projetos/TarefaFocusMode.tsx` | Remover ~45 linhas de mock data e 5 linhas de fallback |


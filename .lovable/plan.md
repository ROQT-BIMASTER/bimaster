

## Enviar ao Superior (Projetos Genéricos) vs Enviar para Validação (Desenvolvimento de Produto)

### O que muda

No detalhe da tarefa (`ProjetoTarefaDetalhe.tsx`), o comportamento será diferenciado pelo tipo do projeto:

**Projeto Genérico:**
- Ocultar o campo "Produto" (busca de produto vinculado)
- Substituir o botão "Enviar para Validação" por "Enviar ao Superior"
- Ao clicar, envia a tarefa ao superior hierárquico do usuário (via `supervisor_id` ou `gerente_id` do perfil)
- Não exige produto vinculado

**Desenvolvimento de Produto:**
- Mantém tudo como está (Produto, Enviar para Validação, checklist, etc.)

### Implementação

**Arquivo**: `src/components/projetos/ProjetoTarefaDetalhe.tsx`

1. **Ocultar campo Produto** (linhas ~533-643): Envolver com `{projetoTipo === 'desenvolvimento_produto' && (...)}` para só mostrar quando for desenvolvimento

2. **Botão "Enviar para Validação"** (linhas ~316-326): Condicionar:
   - Se `desenvolvimento_produto`: comportamento atual (valida produto vinculado, envia para validação)
   - Se `genérico`: mostrar botão "Enviar ao Superior" que:
     - Busca o `supervisor_id` ou `gerente_id` do usuário logado na tabela `profiles`
     - Atualiza a tarefa com `responsavel_id` = ID do superior e `validacao_status` = `pendente_validacao`
     - Se não encontrar superior, exibe toast de erro

3. **Nova função `handleEnviarAoSuperior`**: 
   - Busca perfil do usuário logado para pegar `supervisor_id` / `gerente_id`
   - Determina o superior (prioriza `supervisor_id`, fallback `gerente_id`)
   - Atualiza a tarefa com status de pendente e registra atividade

4. **Ícone e label**: Usar `ArrowRightLeft` ou `Send` com texto "Enviar ao Superior"

### Arquivo a Modificar

| Arquivo | Alteração |
|---|---|
| `src/components/projetos/ProjetoTarefaDetalhe.tsx` | Condicionar Produto e botão de validação pelo `projetoTipo`; adicionar `handleEnviarAoSuperior` |

### Sem mudanças no banco
Usa campos já existentes: `validacao_status`, `responsavel_id`, `supervisor_id`, `gerente_id`.


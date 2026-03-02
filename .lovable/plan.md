

## Filtrar menções (@) no chat de revisão para exibir apenas usuários relevantes

### Problema atual
A query de menções carrega **todos os perfis aprovados** do sistema (`profiles.aprovado = true`), exibindo dezenas de usuários irrelevantes no autocomplete do `@`.

### Solução
Filtrar a lista de menções no `RevisaoChatPanel` para exibir apenas:
1. **Usuários do departamento "Compras e Faturamento"** (inclui "Compras" e "Faturamento")
2. **Erika** (sem departamento vinculado, mas participante ativa)
3. **Usuários que já participaram da conversa** (ex: Leandro — diretoria)

### Implementação

**Arquivo: `src/components/fabrica/RevisaoChatPanel.tsx`**

Alterar o `useEffect` de carregamento de perfis (linha 125-129) para:

1. Buscar perfis do departamento "Compras e Faturamento" via join com `departamentos`
2. Buscar a Erika pelo nome (perfil sem departamento)
3. Buscar usuários que já enviaram mensagens nesta revisão (para incluir diretoria/outros participantes)
4. Unir os 3 grupos removendo duplicatas

A query ficará algo como:
```sql
-- Grupo 1: departamento Compras e Faturamento
SELECT p.id, p.nome FROM profiles p 
  JOIN departamentos d ON d.id = p.departamento_id 
  WHERE d.nome = 'Compras e Faturamento' AND p.aprovado = true

-- Grupo 2: Erika (busca por nome)  
SELECT p.id, p.nome FROM profiles p 
  WHERE p.nome ILIKE '%erika%' AND p.aprovado = true

-- Grupo 3: participantes da conversa atual
SELECT DISTINCT usuario_id, usuario_nome FROM fabrica_revisao_mensagens 
  WHERE revisao_id = ?
```

Esses serão combinados no código em um único `Set` de IDs para eliminar duplicatas.

### Detalhes técnicos
- A interface `PerfilUsuario` permanece inalterada (`{ id, nome }`)
- O `filteredUsuarios` com `useMemo` continua funcionando normalmente
- O efeito passa a depender de `revisaoId` para incluir participantes da conversa


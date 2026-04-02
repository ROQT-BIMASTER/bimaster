

# Corrigir filtro de membros, scroll e tamanho do dialog

## Problemas identificados

1. **Filtro com erro**: O campo de busca só filtra candidatos para adicionar, mas não filtra a lista de membros já existentes. O usuário digita "c.na" esperando filtrar membros, mas todos continuam aparecendo.
2. **Sem barra de rolagem**: O `ScrollArea` não funciona corretamente porque não tem altura fixa definida.
3. **Dialog pequeno**: `max-w-lg` (~512px) é insuficiente para o grid de seções com 2 colunas.

## Solução

### 1. Arquivo: `src/components/projetos/ProjetoMembrosDialog.tsx`

- **Aumentar tamanho do dialog**: Mudar `max-w-lg` para `max-w-2xl` (~672px)
- **Filtro dual**: O campo de busca passa a filtrar tanto candidatos (para adicionar) quanto a lista de membros existentes por nome ou email
- **Scroll funcional**: Dar ao `ScrollArea` uma altura máxima explícita (ex: `max-h-[55vh]`) para que a barra de rolagem apareça
- **Manter busca de novos membros**: Quando o texto tem 2+ chars e existem resultados não-membros, continua mostrando a lista de candidatos acima

### Lógica do filtro de membros existentes
```
const filteredMembros = search.length >= 2
  ? membros.filter(m => 
      m.profile?.nome?.toLowerCase().includes(search.toLowerCase()) ||
      m.profile?.email?.toLowerCase().includes(search.toLowerCase())
    )
  : membros;
```

Renderizar `filteredMembros` em vez de `membros` na lista.

## Resultado esperado

- Buscar "c.na" mostra apenas Claudia Tiemi Nakano na lista de membros
- Barra de rolagem visível quando há muitos membros
- Dialog mais largo para acomodar o grid de seções confortavelmente


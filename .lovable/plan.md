

# Plano: Filtro de Busca no Seletor de Lojas (MaterialOrderSheet)

## O que será feito

Substituir o `Select` simples de loja por um seletor com campo de busca que filtra por CNPJ ou razão social, permitindo encontrar rapidamente a loja desejada.

## Alterações em `src/components/trade/MaterialOrderSheet.tsx`

### Substituir o Select por um Combobox com busca

- Adicionar estado `storeSearch` para o termo de busca
- Usar `Popover` + `Command` (shadcn) para criar um combobox pesquisável
- O campo de busca filtra `stores` por `name` (razão social) ou `cnpj`
- Cada item da lista mostra o nome da loja e o CNPJ (quando disponível)
- Ao selecionar, fecha o popover e define o `lojaId`
- Placeholder: "Buscar por CNPJ ou razão social..."

### Componentes utilizados

- `Popover`, `PopoverTrigger`, `PopoverContent` (já existem no projeto)
- `Command`, `CommandInput`, `CommandEmpty`, `CommandGroup`, `CommandItem` (shadcn — verificar se existe, senão usar filtro manual com Input + lista)

## Arquivo alterado

| Arquivo | Tipo |
|---|---|
| `src/components/trade/MaterialOrderSheet.tsx` | Editar (substituir Select por Combobox com busca) |


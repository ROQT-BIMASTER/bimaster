

# Adicionar Scrollbar Visível na Aba de Evidências

## Problema
A lista de evidências usa `ScrollArea` com `max-h-60` (240px), que é muito pequeno e não mostra uma barra de rolagem visível, cortando arquivos.

## Solução
Substituir o `ScrollArea` por um `div` com `overflow-y-auto`, `max-h-[400px]` e scrollbar nativa visível (`scrollbar-thin`), seguindo o mesmo padrão já aplicado nas tabelas de insumos.

## Arquivo
| Arquivo | Ação |
|---|---|
| `src/components/fabrica/FichaAnalisePanel.tsx` | Trocar `ScrollArea className="max-h-60"` por `div` com `max-h-[400px] overflow-y-auto scrollbar-thin` nas abas Evidências e Requisitos |


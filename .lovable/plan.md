

# Profissionalizar Tabela de Ranking de Influenciadores

## Mudanças

Arquivo: `src/components/marketing/influencers/InfluencerRankingPanel.tsx`

1. **Remover emojis de medalha** — substituir por numeração simples (`1`, `2`, `3`, `#4`) com estilo tipográfico sóbrio (font-medium, text-muted-foreground)
2. **Headers com texto** — trocar ícones (Heart, Shield, Eye) por labels textuais: "Engajamento", "Autenticidade", "Alcance"
3. **Coluna de posição mais discreta** — número alinhado à direita, sem negrito exagerado, tamanho `text-sm`
4. **Barra de score simplificada** — manter a barra de progresso mas com altura menor (h-1) e cores mais sóbrias
5. **Badge de oportunidade mais limpo** — usar texto simples com cor condicional em vez de Badge com ícone
6. **Avatar mantido** — preservar avatar e badge de plataforma (são elementos profissionais)
7. **Linha de destaque para top 3** — fundo sutil `bg-muted/30` nos 3 primeiros ao invés de emojis

Resultado: tabela limpa, estilo dashboard corporativo, sem elementos lúdicos.


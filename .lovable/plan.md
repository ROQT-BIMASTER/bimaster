

## Mapa Mental Visual Moderno — Plano

### Problema Atual
O mapa mental usa Mermaid.js que renderiza diagramas simples em SVG preto e branco, sem interatividade nem visual moderno.

### Solução
Substituir o Mermaid.js por um **mapa mental visual interativo e moderno** construído com React puro, usando dados estruturados em JSON (em vez de sintaxe Mermaid). O componente renderizará um fluxograma com:

- **Nós coloridos por tipo** (problema = vermelho, oportunidade = verde, decisão = azul, tarefa = amarelo)
- **Linhas de conexão SVG** entre nós pai e filhos
- **Ícones** em cada nó (usando Lucide icons)
- **Layout radial/hierárquico** automático calculado em código
- **Animações** de entrada (fade-in + scale)
- **Zoom e pan** via mouse/touch
- **Responsivo** com scroll horizontal em mobile

### Mudanças Necessárias

**1. Edge Function `meeting-analyze`**
- Trocar `mermaid_mindmap` (string Mermaid) por `mindmap_data` (JSON estruturado)
- Formato JSON:
```json
{
  "root": "Tema da Reunião",
  "children": [
    {
      "label": "Problemas",
      "type": "problema",
      "children": [
        { "label": "Distribuição", "type": "problema" },
        { "label": "Baixa presença digital", "type": "problema" }
      ]
    },
    {
      "label": "Oportunidades",
      "type": "oportunidade",
      "children": [...]
    },
    {
      "label": "Decisões",
      "type": "decisao",
      "children": [...]
    },
    {
      "label": "Tarefas",
      "type": "tarefa",
      "children": [...]
    }
  ]
}
```

**2. Novo componente `MeetingMindMap.tsx`** (reescrita completa)
- Renderiza o JSON como fluxograma visual com SVG paths para conexões + divs posicionados para nós
- Cores por tipo: problema (red), oportunidade (green), decisão (blue), tarefa (amber), risco (orange)
- Ícone por tipo de nó
- Layout hierárquico calculado (árvore top-down ou radial)
- Container com zoom (CSS transform) e drag para pan
- Botões de zoom +/- e reset
- Gradiente de fundo sutil para visual premium

**3. Migração do campo no banco**
- O campo `mermaid_mindmap` (text) será reutilizado para armazenar o JSON serializado
- Parsing no frontend: `JSON.parse(meeting.mermaid_mindmap)` com fallback para Mermaid syntax legada

**4. Página `ReuniaoDetalhe.tsx`**
- Atualizar para passar dados parseados ao novo componente
- Adicionar botão de fullscreen para o mapa mental

### Resultado Visual Esperado
Um fluxograma moderno estilo whiteboard com nós arredondados coloridos, linhas curvas de conexão, ícones, animações suaves, e controles de zoom — sem dependências externas pesadas.


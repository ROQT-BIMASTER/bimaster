

# Melhoria Profissional do Menu Lateral

## Problema Identificado pelo Usuário
A seção de admin no footer (LGPD, Config. Menu, Rel. Segurança, etc.) não tem seta para recolher/expandir — ocupa espaço fixo.

## Análise Completa — 6 Melhorias Profissionais

### 1. Footer Admin — Collapsible com seta (pedido do usuário)

A seção admin (linhas 1186-1201) é renderizada diretamente sem toggle. Adicionar um `Collapsible` com seta `ChevronUp/ChevronDown` e label "Administração" para expandir/recolher os 9 links admin.

```text
ANTES:  LGPD / Config. Menu / Rel. Segurança... (sempre visível, sem controle)
DEPOIS: ▾ Administração (9)    ← clica para recolher
          LGPD
          Config. Menu
          ...
```

### 2. Módulos com 1 sub-item — Link direto, sem collapsible

Atualmente Composição, Amostras, Embalagem, Etiqueta/Bula e Reuniões usam `Collapsible` para mostrar **um único link**. Isso é clique desnecessário. Converter para `MenuItemLink` direto.

```text
ANTES:  ▾ Composição         (clica → abre → Checklist Composição)
DEPOIS: 🧪 Composição        (clica → navega direto)
```

Módulos afetados: `composicao`, `amostras`, `analise_embalagem`, `etiqueta_bula`, `reunioes`.

### 3. Sub-item count dinâmico no ModuleHeader

Atualmente o `subItemCount` só é passado manualmente em "Central de Inteligência" (hardcoded `8`). Calcular automaticamente baseado nos itens filtrados por permissão para cada módulo.

### 4. Busca rápida no topo do menu

Adicionar um campo de busca (`Search` icon + input) acima do filtro de módulos que filtra itens em tempo real por título. Padrão profissional em sidebars corporativas com muitos itens.

### 5. Mini-mode (collapse para ícones)

Adicionar `collapsible="icon"` ao `<Sidebar>` para que o `SidebarTrigger` no header recolha a sidebar para uma faixa estreita com apenas ícones. Atualmente o sidebar não tem mini-mode definido.

### 6. Scroll indicator visual

Módulos longos (Trade, Financeiro, Comercial) usam `ScrollArea` com `max-h` fixo mas sem indicador visual de que há mais itens. Adicionar um gradient fade sutil no bottom quando há overflow.

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `src/components/dashboard/AppSidebar.tsx` | Todas as 6 melhorias |

## O que NÃO muda

- Lógica de permissões, rotas, categorias do DB
- Module filter dropdown
- Financeiro subgroups
- Auto-expand por rota ativa


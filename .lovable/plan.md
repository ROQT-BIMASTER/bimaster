## Objetivo

Liberar acesso, no menu lateral, **apenas** à tela de Influenciadores do módulo Marketing — sem mostrar as demais sub-telas (Dashboards, WhatsApp, ElevenLabs, Mission Control, Redes Sociais, Overview, Design Studio).

## Contexto encontrado

- A tela "Influenciadores" hoje é uma **aba** (`value="influencers"`) dentro de `SocialMediaMonitoring`, renderizada em `/dashboard/marketing/social` (página `SocialNetworksPage` → na verdade rota usa `SocialMediaMonitoring`).
- O menu lateral (`src/components/dashboard/AppSidebar.tsx`) hoje monta o módulo Marketing como um submenu (`marketingSubMenus`) com 5 itens + overview. Tudo gated pelas permissões `MARKETING_DASHBOARD` e `MARKETING_SOCIAL`.
- A aba inicial é fixa em `useState("accounts")` — precisamos permitir abrir direto em "influencers" via querystring.

## Mudanças (somente UI / sidebar)

### 1. `src/components/marketing/SocialMediaMonitoring.tsx`
- Ler `?tab=` da URL (`useSearchParams`) para definir `activeTab` inicial. Se `tab=influencers`, abre direto na aba Influenciadores. Mantém comportamento padrão (`accounts`) quando ausente.

### 2. `src/components/dashboard/AppSidebar.tsx` — submenu Marketing
Substituir o submenu atual por uma versão enxuta que mostra **apenas Influenciadores**:

```tsx
case "marketing":
  return (
    <ModuleSubmenu icon={Users} title={t("module.marketing")} colorKey="marketing">
      <MenuItemLink
        to="/dashboard/marketing/social?tab=influencers"
        icon={Users}
        title="Influenciadores"
        colorKey="marketing"
      />
    </ModuleSubmenu>
  );
```

- Remover a renderização do item "Overview" e dos 5 sub-itens (`marketingSubMenus`) **somente da exibição** — não apago as rotas nem as permissões, para que possam ser reativadas no futuro só revertendo este bloco.
- Atualizar `getSubItemCount("marketing")` para retornar `1` (fixo), evitando o badge mostrar contagem das telas escondidas.
- Manter o gate de visibilidade do módulo Marketing como está (quem já vê Marketing continuará vendo — agora só com o item Influenciadores).

### 3. Sem mudanças em
- Rotas (`App.tsx`), páginas, permissões (`MARKETING_*`), backend, RLS — nada disso é alterado. A liberação é apenas de **navegação**.
- O Design Studio (case `design_studio`) permanece como está — é módulo separado.

## Resultado esperado

No menu lateral, ao expandir "Marketing", o usuário verá apenas:
- **Influenciadores** → abre `/dashboard/marketing/social?tab=influencers` já posicionado na aba correta.

As demais telas continuam acessíveis por URL direta (caso alguém precise via link), mas não aparecem mais no menu.

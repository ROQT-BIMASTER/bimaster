## Problema identificado

1. A rota `/dashboard/marketing/social` na verdade renderiza `src/pages/Marketing.tsx`, que é um **menu de cards** (DashCortex, Power BI, Redes Sociais, etc.). Por isso o link `/dashboard/marketing/social?tab=influencers` cai num menu, não na aba Influenciadores.
2. O componente `<SocialMediaMonitoring />` (que contém a aba Influenciadores) só é montado quando o usuário clica no card "Redes Sociais" e troca o `activeSection` interno para `"social"`.
3. Hoje o sidebar mostra o item "Influenciadores" para todos — precisamos de **admin = vê tudo**, **demais = só Influenciadores**.

## Solução

### 1. Página dedicada para Influenciadores
Criar uma rota direta que monta o `InfluencerDashboard` sem precisar passar pelo menu de cards do Marketing nem pelas abas do `SocialMediaMonitoring`.

- **Nova página**: `src/pages/marketing/InfluencersPage.tsx`
  - Usa `DashboardLayout`
  - Renderiza header simples ("Influenciadores — Central de Inteligência") + `<InfluencerDashboard />` direto
- **Nova rota** em `src/App.tsx`:
  ```tsx
  <Route path="/dashboard/marketing/influencers" 
    element={<ModuleRoute moduleCode="marketing">
      <ScreenProtectedRoute screenCode="marketing_social">
        <InfluencersPage />
      </ScreenProtectedRoute>
    </ModuleRoute>} />
  ```
  - Mantém o gate `marketing_social` que o usuário já tem (mesmo screenCode usado hoje pelas outras telas de marketing).

### 2. Sidebar: admin vê tudo, usuário comum vê só Influenciadores
Em `src/components/dashboard/AppSidebar.tsx`, no `case "marketing"`:

```tsx
case "marketing":
  return (
    <ModuleSubmenu icon={BarChart3} title={t("module.marketing")} colorKey="marketing">
      {/* Sempre visível: Influenciadores */}
      <MenuItemLink
        to="/dashboard/marketing/influencers"
        icon={Users}
        title="Influenciadores"
        colorKey="marketing"
      />
      {/* Só admin vê o restante */}
      {isAdmin && hasPermission("MARKETING_DASHBOARD") && (
        <MenuItemLink to="/dashboard/marketing" icon={Home} title={t("marketing.overview")} colorKey="marketing" end />
      )}
      {isAdmin && marketingSubMenus.filter(i => hasPermission(i.screenCode)).map(item => (
        <MenuItemLink key={item.url} to={item.url} icon={item.icon} title={item.title} colorKey="marketing" />
      ))}
    </ModuleSubmenu>
  );
```

E o badge de contagem:
```tsx
case "marketing":
  return isAdmin
    ? filterItems(marketingSubMenus).length + (hasPermission("MARKETING_DASHBOARD") ? 1 : 0) + 1
    : 1;
```

### 3. Reverter o querystring no `SocialMediaMonitoring`
Como agora a tela de Influenciadores tem rota própria, a leitura de `?tab=` no `SocialMediaMonitoring` não é mais necessária para o caso do usuário comum. Mas mantém o hook `useSearchParams` que já adicionei — é inofensivo e útil para deep-linking de admins. **Sem mudanças adicionais aqui.**

## Resultado

- **Admin**: continua vendo no sidebar → Overview, Dashboards, WhatsApp, ElevenLabs, Mission Control, Redes Sociais **+ Influenciadores** (novo atalho direto).
- **Usuário comum (com `marketing_social`)**: vê apenas → **Influenciadores**, que abre direto na tela completa, sem passar pelo menu de cards do Marketing.

## Arquivos alterados

- `src/pages/marketing/InfluencersPage.tsx` (novo)
- `src/App.tsx` (nova rota)
- `src/components/dashboard/AppSidebar.tsx` (gate por `isAdmin` no submenu Marketing)

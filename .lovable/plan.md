

# Fix: Atualização de Versão no PWA (iPhone) + Botão "Atualizar Versão"

## Problema

No iPhone (PWA standalone), o Service Worker não detecta atualizações de forma confiável — o evento `onNeedRefresh` pode nunca disparar. Resultado: a versão exibida fica antiga e o usuário não tem como forçar a atualização.

## Solução

### 1. Página "Instalar App" — Adicionar seção de versão e atualização

No `src/pages/InstalarApp.tsx`:
- Exibir versão atual (`appVersion`) sempre visível
- Adicionar botão **"Verificar Atualização"** que chama `forceUpdate()` — sempre disponível, independente do estado do SW
- Quando `needRefresh` estiver ativo, exibir botão **"Atualizar Versão"** em destaque (substituindo "Instalar Agora")
- Quando já instalado, trocar card de instalação por card de versão/atualização

### 2. Sidebar — Label dinâmico

No `src/components/dashboard/AppSidebar.tsx`:
- Quando `needRefresh === true`, mudar o label do menu de "Instalar App" para "Atualizar App" com badge visual

### 3. PWAContext — Verificação ativa de atualização

No `src/contexts/PWAContext.tsx`:
- Adicionar método `checkForUpdate()` que força `registration.update()` manualmente e retorna se há atualização
- Expor no contexto para uso na página

### 4. PWAUpdatePrompt — Botão "Atualizar" sempre funcional

No `src/components/pwa/PWAUpdatePrompt.tsx`:
- Quando `needRefresh` não dispara mas versão no localStorage difere, oferecer `forceUpdate()` como fallback

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/InstalarApp.tsx` | Seção de versão + botões atualizar/verificar |
| `src/contexts/PWAContext.tsx` | Método `checkForUpdate()` |
| `src/components/dashboard/AppSidebar.tsx` | Label dinâmico com badge |
| `src/components/pwa/PWAUpdatePrompt.tsx` | Fallback para forceUpdate |




# Adicionar Botão "Voltar" nas Telas Admin sem Navegação

## Problema

Três telas do menu de administração não possuem botão de voltar, dificultando a navegação:

1. **Trilha de Auditoria de Acessos** (`TrilhaAuditoriaAcessos.tsx`)
2. **Verificação de APIs** (`APIHealthCheck.tsx`)
3. **Permissões por Módulo** (`PermissoesModulo.tsx` / `ModulePermissionsIndex.tsx`)

As demais telas admin (Simulação, Security Explorer, AP Central, Fila ERP, Sync Cadastros, Conciliação) já possuem botão de voltar.

## Solução

Adicionar `Button variant="ghost" size="icon"` com `ArrowLeft` e `navigate(-1)` no header de cada página, seguindo o padrão já usado nas outras telas admin.

## Alterações

### 1. `src/pages/TrilhaAuditoriaAcessos.tsx`
- Importar `ArrowLeft` de lucide-react, `useNavigate` de react-router-dom, `Button`
- Adicionar botão de voltar antes do ícone `Footprints` no header (linha 40)

### 2. `src/pages/APIHealthCheck.tsx`
- Importar `ArrowLeft`, `useNavigate`, adicionar `navigate(-1)` button
- Reestruturar o header (linha 41) para incluir botão de voltar à esquerda

### 3. `src/components/configuracoes/permissoes-modulo/ModulePermissionsIndex.tsx`
- Importar `ArrowLeft`, `useNavigate`, `Button`
- Adicionar botão de voltar no topo do componente


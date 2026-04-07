

# Centralizar Telas Admin no Menu — Acesso Rápido

## Problema

Existem **13 telas administrativas** registradas como rotas no sistema que **não aparecem no menu lateral**, tornando-as acessíveis apenas via URL direta. Isso dificulta a operação do administrador.

## Telas Faltantes Identificadas

| Tela | Rota | Categoria |
|---|---|---|
| Painel de Segurança | `/dashboard/seguranca-dashboard` | Segurança |
| Security Explorer | `/dashboard/security-explorer` | Segurança |
| Permissões por Módulo | `/dashboard/configuracoes/permissoes-modulo` | Acesso |
| API Health Check | `/dashboard/configuracoes/api-health` | Monitoramento |
| Simulação de Dados | `/dashboard/simulacao` | Ferramentas |
| Config Fornecedores | `/dashboard/configuracoes/fornecedores-visibilidade` | Configuração |
| Painel AP Central | `/dashboard/financeiro/ap-central` | Financeiro Admin |
| Fila Exportação ERP | `/dashboard/financeiro/contas-a-pagar/exportacao-erp` | Financeiro Admin |
| Sync Cadastros AP | `/dashboard/financeiro/contas-a-pagar/sync-cadastros` | Financeiro Admin |
| Conciliação Manual AP | `/dashboard/financeiro/contas-a-pagar/conciliacao` | Financeiro Admin |

## Solução

Reorganizar o bloco "Administração" no footer da sidebar em **sub-grupos visuais** com separadores, agrupando logicamente:

### Estrutura proposta

```text
Administração (collapsible)
├── 🔒 Segurança & Auditoria
│   ├── Painel Segurança        (NEW)
│   ├── Security Explorer       (NEW)
│   ├── Rel. Segurança          (existing)
│   └── Auditoria               (move from "Geral")
│
├── 👥 Acesso & Permissões
│   ├── Config. Acesso          (existing)
│   ├── Permissões Módulo       (NEW)
│   ├── LGPD                    (existing)
│   └── Config Fornecedores     (NEW)
│
├── 💰 Governança Financeira
│   ├── Painel AP Central       (NEW)
│   ├── Fila Exportação ERP     (NEW)
│   ├── Sync Cadastros AP       (NEW)
│   ├── Conciliação Manual AP   (NEW)
│   ├── Rel. AP Module          (existing)
│   └── Rel. AP x ERP           (existing)
│
├── ⚙️ Sistema & Integrações
│   ├── Config. Menu            (existing)
│   ├── API Health              (NEW)
│   ├── Rel. APIs               (existing)
│   ├── Rel. Desenvolvimento    (existing)
│   ├── Portal ERP              (existing, conditional)
│   ├── Asana Sync              (existing)
│   └── Simulação de Dados      (NEW)
```

## Alterações Técnicas

### Arquivo: `src/components/dashboard/AppSidebar.tsx`

1. **Reorganizar bloco admin** (linhas 1360-1399): Substituir a lista flat por sub-grupos com labels visuais (pequenos separadores de texto)
2. **Mover "Auditoria"** da seção "Geral" para dentro do grupo "Segurança & Auditoria"
3. **Adicionar 10 novos MenuItemLink** com ícones apropriados
4. **Atualizar o badge counter** de `8`/`9` para contagem dinâmica real
5. **Manter o collapsible** existente — apenas expandir o conteúdo interno

### Detalhes de implementação

- Sub-grupos usam um `<span>` com classes `text-[10px] font-semibold uppercase text-muted-foreground` como separador visual (sem accordion extra)
- Ícones: `ShieldCheck` (Painel Segurança), `Search` (Explorer), `Users` (Permissões), `HeartPulse` (API Health), `Database` (Simulação), `Eye` (Fornecedores Visib.), `Landmark` (AP Central), `Upload` (Exportação ERP), `RefreshCw` (Sync Cadastros), `GitCompare` (Conciliação)
- Items financeiros admin condicionados a `hasModulePermission("financeiro")`


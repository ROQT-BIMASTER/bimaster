
# Plano: Botão de Navegação para Tela de Aprovação

## Objetivo
Adicionar um botão contextual na tela de Campanhas Trade Marketing que direciona para a tela de Aprovações, visível apenas para usuários com permissão de administrador ou supervisor.

## Contexto
- A tela de campanhas mostra itens com status "Aguardando Aprovação"
- Usuários autorizados (admin/supervisor) precisam navegar para `/dashboard/trade/financeiro/aprovacoes` para aprovar
- Atualmente não há link direto na tela de campanhas

---

## Implementacao

### Arquivo: `src/pages/TradeCampaigns.tsx`

**Alteracoes:**

1. **Importar icone adicional:**
   - Adicionar `ClipboardCheck` (ou similar) do `lucide-react`

2. **Calcular campanhas pendentes:**
   - Adicionar metrica: `pendingApproval = campaigns.filter(c => c.status === 'pending_approval').length`

3. **Adicionar botao condicional no header:**
   - Posicionar ao lado do botao "Nova Campanha"
   - Visivel apenas se `isAdminOrSupervisor === true`
   - Mostrar badge com contador de pendentes quando > 0
   - Usar `Link` do react-router-dom para navegacao

---

## Layout do Header

```text
Antes:
+------------------------------------------------+
|  Campanhas Trade Marketing        [+ Nova Camp] |
+------------------------------------------------+

Depois:
+------------------------------------------------------------+
|  Campanhas Trade Marketing   [Aprovacoes (3)] [+ Nova Camp] |
+------------------------------------------------------------+
```

---

## Codigo Proposto

```tsx
// Junto aos outros calculos de metricas
const pendingApproval = campaigns.filter(c => c.status === "pending_approval").length;

// No header, antes do Dialog de Nova Campanha
{isAdminOrSupervisor && (
  <Link to="/dashboard/trade/financeiro/aprovacoes">
    <Button variant="outline">
      <ClipboardCheck className="mr-2 h-4 w-4" />
      Aprovacoes
      {pendingApproval > 0 && (
        <Badge variant="destructive" className="ml-2">
          {pendingApproval}
        </Badge>
      )}
    </Button>
  </Link>
)}
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/TradeCampaigns.tsx` | Adicionar botao de navegacao para aprovacoes |

---

## Beneficios

- **Navegacao direta**: Facilita o acesso a tela de aprovacoes sem sair do contexto
- **Indicador visual**: Badge mostra quantas campanhas aguardam aprovacao
- **Seguranca mantida**: Botao so aparece para usuarios autorizados (admin/supervisor)
- **UX melhorada**: Fluxo mais fluido entre gestao e aprovacao de campanhas

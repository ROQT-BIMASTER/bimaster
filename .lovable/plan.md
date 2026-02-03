
# Plano: Correcao da Tela de Aprovacoes para Exibir Campanhas Pendentes

## Diagnostico

Apos analise detalhada, identifiquei que:

1. **A campanha existe no banco** com `status = 'pending_approval'` (confirmado via SQL)
2. **O codigo esta correto** - o hook `usePendingCampaigns` foi implementado corretamente
3. **A requisicao nao esta sendo feita** - nos logs de rede, a query com filtro `status=eq.pending_approval` nao aparece

## Causa Raiz

O problema e que a pagina de aprovacoes esta usando um **cache antigo do React Query**. A requisicao que deveria ser feita pelo hook `usePendingCampaigns`:

```
GET /trade_campaigns?...&status=eq.pending_approval&...
```

**Nao esta aparecendo nos logs de rede**, indicando que:
- A pagina nao foi recarregada apos as alteracoes
- O React Query esta servindo dados do cache (staleTime de 1 minuto)

## Solucao Proposta

Para garantir que funcione corretamente e evitar problemas de cache futuros:

### 1. Adicionar Botao de Atualizar na Tela de Aprovacoes

**Arquivo:** `src/pages/TradeAprovacoes.tsx`

Adicionar um botao "Atualizar" no header que forca o refetch de todos os dados:

```typescript
<Button variant="outline" size="sm" onClick={handleRefetch}>
  <RefreshCw className="h-4 w-4 mr-2" />
  Atualizar
</Button>
```

### 2. Reduzir o staleTime do Hook de Campanhas Pendentes

**Arquivo:** `src/hooks/useTradeData.ts`

Alterar o staleTime de 60 segundos para 30 segundos para dados de aprovacao:

```typescript
staleTime: 30 * 1000, // 30 segundos - aprovacoes precisam ser mais atualizadas
```

### 3. Forcar Refetch ao Montar o Componente

**Arquivo:** `src/pages/TradeAprovacoes.tsx`

Adicionar um `refetchOnMount: 'always'` ou chamar refetch no useEffect para garantir dados frescos:

```typescript
useEffect(() => {
  handleRefetch();
}, []);
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/TradeAprovacoes.tsx` | Adicionar botao Atualizar + forcar refetch ao montar |
| `src/hooks/useTradeData.ts` | Reduzir staleTime do hook de campanhas pendentes |

---

## Acao Imediata para o Usuario

Enquanto implemento a correcao, voce pode:

1. **Recarregar a pagina com Ctrl+Shift+R** (limpa cache) enquanto estiver na tela de aprovacoes
2. A aba "Campanhas" devera aparecer com o badge mostrando "1" pendente

---

## Beneficios da Correcao

- **Dados sempre atualizados**: Botao de refresh permite atualizar manualmente
- **Menor tempo de cache**: Dados de aprovacao serao mais frescos
- **Melhor UX**: Usuario tera controle sobre quando atualizar os dados

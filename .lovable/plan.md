

# Solucionar Problema de Cache - Tour Button Nao Aparece

## Diagnostico

Apos revisao completa do codigo, todos os arquivos estao corretos:

| Arquivo | Status |
|---------|--------|
| src/pages/TradeStores.tsx | TourButton importado e renderizado (linhas 18, 425-431) |
| src/components/tour/index.ts | Exporta tradeStoresTourSteps e TRADE_STORES_TOUR_ID |
| src/components/tour/tours/tradeStoresTour.ts | Arquivo existe com 4 steps |
| src/components/tour/TourButton.tsx | Componente renderiza botao flutuante |
| src/components/tour/TourProvider.tsx | Provider configurado corretamente |
| src/App.tsx | TourProvider envolvendo AppContent (linha 399-405) |

**Conclusao:** O codigo esta correto, o problema e de cache do navegador ou Service Worker servindo versao antiga.

## Acoes

### 1. Incrementar Versao do App
Atualizar `src/lib/version.ts`:
- De: `APP_VERSION = '1.0.6'`
- Para: `APP_VERSION = '1.0.7'`

Isso forcara limpeza de caches automaticamente.

### 2. Adicionar data-tour aos Elementos
Confirmar que os atributos data-tour estao nos elementos corretos de TradeStores.tsx:
- `[data-tour="stores-header"]` - Wrapper do header
- `[data-tour="stores-actions"]` - Div dos botoes
- `[data-tour="stores-filters"]` - Wrapper dos filtros
- `[data-tour="stores-list"]` - Wrapper da lista

### 3. Verificar Estrutura do TradeStores.tsx
Garantir que os data-tour attributes estao presentes:

```text
<div data-tour="stores-header">
  <TradePageHeader ... />
</div>

<div data-tour="stores-filters">
  <TradeFilters ... />
</div>

<div data-tour="stores-list">
  <MobileDataList ... />
</div>
```

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| src/lib/version.ts | Incrementar versao para 1.0.7 |
| src/pages/TradeStores.tsx | Confirmar/adicionar data-tour attributes |

## Teste Apos Implementacao

1. Recarregar a pagina com Ctrl+Shift+R (hard reload)
2. Verificar se o botao de interrogacao aparece no canto inferior direito
3. Clicar no botao e iniciar o tour
4. Verificar se todos os 4 passos funcionam

## Nota Tecnica

O TourButton renderiza um botao flutuante com:
- Posicao: `fixed bottom-6 right-6`
- Z-index: 50
- Formato: Circular, 48x48px
- Icone: HelpCircle (interrogacao)
- Cor: Primary (destaque)


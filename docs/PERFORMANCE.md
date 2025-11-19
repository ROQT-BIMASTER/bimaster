# Performance Monitoring & Optimization

Guia de monitoramento e otimização de performance do BiMaster/Union CRM.

## 📊 Sistema de Monitoramento

### Performance Monitor

O projeto inclui um sistema completo de monitoramento de performance em `src/lib/utils/performance-monitor.ts`.

#### Uso Básico

```typescript
import { performanceMonitor } from '@/lib/utils/performance-monitor';

// Medir operação assíncrona
const data = await performanceMonitor.measureAsync(
  'api.fetch-prospects',
  async () => {
    return await supabase.from('prospects').select('*');
  },
  { table: 'prospects' }
);

// Medir operação síncrona
const result = performanceMonitor.measure(
  'component.render',
  () => {
    return expensiveCalculation();
  }
);

// Registrar métrica customizada
performanceMonitor.recordMetric('custom.operation', 150, {
  userId: 'abc123',
  action: 'export'
});
```

#### Obter Resumo

```typescript
// Resumo geral
const summary = performanceMonitor.getSummary();
console.log('Métricas:', summary.metrics);
console.log('Médias:', summary.averages);
console.log('Warnings:', summary.warnings);

// Filtrar por nome
const apiMetrics = performanceMonitor.getSummary('api.response');

// Exportar para análise
const export = performanceMonitor.exportMetrics();
downloadFile('performance-report.json', export);
```

### Web Vitals

O sistema monitora automaticamente:

- **LCP (Largest Contentful Paint)**: Target < 2.5s
- **FID (First Input Delay)**: Target < 100ms
- **CLS (Cumulative Layout Shift)**: Target < 0.1

```typescript
// Métricas são registradas automaticamente
// Visualizar no console (DEV mode)
const navMetrics = performanceMonitor.getNavigationMetrics();
console.log('Navigation Metrics:', navMetrics);
```

## 🎯 Thresholds e Alertas

### Limites Configurados

```typescript
WARNING_THRESHOLDS = {
  'api.response': 3000,      // 3s
  'component.render': 1000,  // 1s
  'query.execution': 2000,   // 2s
  'page.load': 5000,         // 5s
}
```

### Warnings Automáticos

O sistema emite warnings automaticamente quando limites são excedidos:

```
⚠️ Performance warning: api.response levou 3500ms (limite: 3000ms)
```

## 🚀 Otimizações Implementadas

### 1. Code Splitting e Lazy Loading

```typescript
// Exemplo de lazy loading de rotas
const Marketing = lazy(() => import('@/pages/Marketing'));
const TradeModule = lazy(() => import('@/pages/modules/TradeModule'));

// Uso
<Suspense fallback={<LoadingSpinner />}>
  <Marketing />
</Suspense>
```

### 2. TanStack Query Cache

```typescript
// Configuração de cache inteligente
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000, // 10 minutos
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});
```

### 3. Memory Management

```typescript
import { MemoryManager } from '@/lib/utils/memory-manager';

// Iniciar monitoramento automático
const memoryManager = MemoryManager.getInstance();
memoryManager.startMonitoring(60000); // A cada 1 minuto

// Verificar uso de memória
const usage = memoryManager.getMemoryUsage();
if (usage && usage.used / usage.limit > 0.9) {
  console.warn('Memória crítica!');
  memoryManager.performCleanup();
}
```

### 4. Offline Support

```typescript
import { OfflineManager } from '@/lib/utils/offline-manager';

// Salvar para uso offline
const offlineManager = OfflineManager.getInstance();
offlineManager.saveForOffline('prospects', data);

// Recuperar quando offline
if (!offlineManager.isOnline()) {
  const cachedData = offlineManager.getOfflineData('prospects');
  // Usar dados em cache
}
```

## 📈 Métricas de Performance

### Targets

| Métrica | Target | Atual |
|---------|--------|-------|
| Bundle Size | < 500KB | ~450KB |
| FCP (First Contentful Paint) | < 1.8s | ~1.5s |
| LCP (Largest Contentful Paint) | < 2.5s | ~2.2s |
| TTI (Time to Interactive) | < 3.5s | ~3.0s |
| TBT (Total Blocking Time) | < 300ms | ~250ms |

### Como Medir

```bash
# Build de produção
npm run build

# Analisar bundle
npm run build -- --mode analyze

# Performance audit com Lighthouse
npx lighthouse https://seu-app.lovable.app --view
```

## 🔧 Ferramentas de Debug

### React DevTools Profiler

```typescript
import { Profiler } from 'react';

<Profiler id="Dashboard" onRender={onRenderCallback}>
  <Dashboard />
</Profiler>

function onRenderCallback(
  id, phase, actualDuration, baseDuration, startTime, commitTime
) {
  performanceMonitor.recordMetric(`component.${id}.${phase}`, actualDuration);
}
```

### Network Waterfall

```typescript
// Visualizar timing de requisições
performance.getEntriesByType('resource').forEach(resource => {
  console.log(resource.name, resource.duration);
});
```

## 🎨 Otimizações de Rendering

### 1. Memoização

```typescript
import { memo, useMemo, useCallback } from 'react';

// Component memoization
const ExpensiveComponent = memo(({ data }) => {
  return <div>{/* render */}</div>;
});

// Value memoization
const sortedData = useMemo(() => {
  return data.sort((a, b) => a.value - b.value);
}, [data]);

// Function memoization
const handleClick = useCallback(() => {
  doSomething();
}, []);
```

### 2. Virtualization

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: 10000,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 35,
});

// Renderizar apenas itens visíveis
{rowVirtualizer.getVirtualItems().map(virtualRow => (
  <div key={virtualRow.index}>
    {items[virtualRow.index]}
  </div>
))}
```

## 📱 Mobile Performance

### Touch Responsiveness

```css
/* Otimizar touch targets */
button, a {
  min-width: 44px;
  min-height: 44px;
}

/* Prevenir tap delay */
* {
  touch-action: manipulation;
}
```

### Image Optimization

```typescript
// Lazy loading de imagens
<img 
  src={imageUrl} 
  loading="lazy" 
  decoding="async"
  alt="description"
/>

// Responsive images
<img 
  srcSet={`
    ${smallUrl} 400w,
    ${mediumUrl} 800w,
    ${largeUrl} 1200w
  `}
  sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px"
/>
```

## 🔍 Debugging Performance Issues

### 1. Identificar Componentes Lentos

```typescript
// Adicionar performance marks
performance.mark('component-start');
// ... código do componente
performance.mark('component-end');
performance.measure('component-duration', 'component-start', 'component-end');

const measure = performance.getEntriesByName('component-duration')[0];
console.log('Duração:', measure.duration);
```

### 2. Analisar Re-renders

```typescript
// Detectar re-renders desnecessários
useEffect(() => {
  console.log('Component re-rendered');
}, [/* deps */]);

// Ou usar React DevTools Profiler
```

### 3. Memory Leaks

```typescript
// Verificar memory leaks
const memoryLeakDetector = setInterval(() => {
  const usage = memoryManager.getMemoryUsage();
  if (usage) {
    console.log(`Memory: ${(usage.used / 1024 / 1024).toFixed(2)} MB`);
  }
}, 5000);

// Limpar no unmount
useEffect(() => {
  return () => clearInterval(memoryLeakDetector);
}, []);
```

## 📊 Relatórios de Performance

### Gerar Relatório

```typescript
// Exportar métricas
const report = performanceMonitor.exportMetrics();

// Enviar para analytics (se configurado)
fetch('/api/analytics', {
  method: 'POST',
  body: report,
});

// Ou salvar localmente
console.log('Performance Report:', JSON.parse(report));
```

### Dashboards Recomendados

- **Lovable Analytics**: Built-in analytics no Lovable Cloud
- **Google Analytics**: Para métricas de usuário
- **Sentry Performance**: Para monitoring em produção (recomendado para implementação futura)

## 🎯 Best Practices

### ✅ DO

- Use code splitting para rotas
- Implemente lazy loading de componentes pesados
- Cache dados com TanStack Query
- Minimize re-renders com memo e useMemo
- Monitore métricas continuamente

### ❌ DON'T

- Não carregue tudo no bundle principal
- Não faça operações pesadas no render
- Não ignore warnings de performance
- Não use inline functions em props sem useCallback
- Não deixe memory leaks de event listeners

## 📚 Recursos

- [Web Vitals](https://web.dev/vitals/)
- [React Performance](https://react.dev/learn/render-and-commit)
- [Vite Performance](https://vitejs.dev/guide/performance.html)
- [TanStack Query Performance](https://tanstack.com/query/latest/docs/react/guides/performance)

---

**Última atualização:** 2025-01-19  
**Versão:** 1.0.0

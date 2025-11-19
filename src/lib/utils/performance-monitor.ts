/**
 * Performance Monitoring System
 * 
 * Sistema de monitoramento de performance para rastrear métricas críticas
 * e identificar gargalos na aplicação.
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PerformanceSummary {
  metrics: PerformanceMetric[];
  averages: Record<string, number>;
  warnings: string[];
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 1000; // Limitar memória
  private readonly WARNING_THRESHOLDS = {
    'api.response': 3000, // 3s
    'component.render': 1000, // 1s
    'query.execution': 2000, // 2s
    'page.load': 5000, // 5s
  };

  private constructor() {
    this.initWebVitals();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Inicializa monitoramento de Web Vitals
   */
  private initWebVitals() {
    if (typeof window === 'undefined') return;

    // Monitorar Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          
          this.recordMetric('web.lcp', lastEntry.renderTime || lastEntry.loadTime, {
            element: lastEntry.element?.tagName,
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Monitorar First Input Delay (FID)
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.recordMetric('web.fid', entry.processingStart - entry.startTime, {
              eventType: entry.name,
            });
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Monitorar Cumulative Layout Shift (CLS)
        let clsScore = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsScore += entry.value;
              this.recordMetric('web.cls', clsScore);
            }
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        console.warn('Erro ao inicializar Web Vitals:', error);
      }
    }
  }

  /**
   * Registra uma métrica de performance
   */
  recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    // Limitar tamanho do array para evitar memory leak
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    // Verificar se excede threshold de warning
    const threshold = this.WARNING_THRESHOLDS[name as keyof typeof this.WARNING_THRESHOLDS];
    if (threshold && value > threshold) {
      console.warn(`⚠️ Performance warning: ${name} levou ${value}ms (limite: ${threshold}ms)`, metadata);
    }

    // Log em desenvolvimento
    if (import.meta.env.DEV) {
      console.log(`📊 Performance: ${name} = ${value.toFixed(2)}ms`, metadata);
    }
  }

  /**
   * Mede o tempo de execução de uma função
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Mede o tempo de execução de uma função síncrona
   */
  measure<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const startTime = performance.now();
    
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Obtém resumo de performance
   */
  getSummary(filterName?: string): PerformanceSummary {
    const filtered = filterName
      ? this.metrics.filter(m => m.name === filterName)
      : this.metrics;

    // Calcular médias por tipo de métrica
    const averages: Record<string, number> = {};
    const groups = filtered.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = [];
      }
      acc[metric.name].push(metric.value);
      return acc;
    }, {} as Record<string, number[]>);

    Object.entries(groups).forEach(([name, values]) => {
      averages[name] = values.reduce((sum, val) => sum + val, 0) / values.length;
    });

    // Identificar warnings
    const warnings: string[] = [];
    Object.entries(averages).forEach(([name, avg]) => {
      const threshold = this.WARNING_THRESHOLDS[name as keyof typeof this.WARNING_THRESHOLDS];
      if (threshold && avg > threshold) {
        warnings.push(`${name}: média de ${avg.toFixed(2)}ms excede limite de ${threshold}ms`);
      }
    });

    return {
      metrics: filtered,
      averages,
      warnings,
    };
  }

  /**
   * Limpa métricas antigas
   */
  clearOldMetrics(olderThanMs: number = 3600000) { // 1 hora por padrão
    const cutoff = Date.now() - olderThanMs;
    const initialLength = this.metrics.length;
    
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    
    const removed = initialLength - this.metrics.length;
    if (removed > 0) {
      console.log(`🗑️ Removidas ${removed} métricas antigas de performance`);
    }
  }

  /**
   * Exporta métricas para análise
   */
  exportMetrics(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: this.getSummary(),
      rawMetrics: this.metrics,
    }, null, 2);
  }

  /**
   * Obtém métricas de navegação
   */
  getNavigationMetrics() {
    if (typeof window === 'undefined' || !window.performance?.getEntriesByType) {
      return null;
    }

    const [navigation] = window.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    
    if (!navigation) return null;

    return {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      ttfb: navigation.responseStart - navigation.requestStart,
      download: navigation.responseEnd - navigation.responseStart,
      domInteractive: navigation.domInteractive - navigation.fetchStart,
      domComplete: navigation.domComplete - navigation.fetchStart,
      loadComplete: navigation.loadEventEnd - navigation.fetchStart,
    };
  }
}

// Export singleton
export const performanceMonitor = PerformanceMonitor.getInstance();

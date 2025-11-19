/**
 * Monitor de memória para detectar alto uso e forçar limpeza
 */
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private warningThreshold = 0.8; // 80% da memória
  private monitorInterval: number | null = null;
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new MemoryMonitor();
    }
    return this.instance;
  }
  
  startMonitoring() {
    // Verificar se o navegador suporta performance.memory (Chrome/Edge)
    if ('performance' in window && 'memory' in performance) {
      this.monitorInterval = window.setInterval(() => {
        const memory = (performance as any).memory;
        const usedPercentage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        if (usedPercentage > this.warningThreshold) {
          console.warn('⚠️ Alto uso de memória detectado:', Math.round(usedPercentage * 100) + '%');
          this.triggerCleanup();
        }
      }, 30000); // Verificar a cada 30 segundos
    } else {
      console.log('📊 Memory monitoring não disponível neste navegador');
    }
  }
  
  triggerCleanup() {
    // Disparar evento customizado para forçar limpeza
    window.dispatchEvent(new CustomEvent('force-memory-cleanup'));
  }
  
  destroy() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
}

// Exportar instância singleton
export const memoryMonitor = MemoryMonitor.getInstance();

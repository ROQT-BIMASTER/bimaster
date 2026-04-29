/**
 * Sistema de logging estruturado.
 *
 * Duas APIs coexistem:
 *
 * 1. **API estruturada** (recomendada para código novo):
 *    `logger.info('User signed in', { userId, action: 'sign_in' })`
 *
 * 2. **API variádica** (drop-in replacement de console.* — usada pelo codemod):
 *    `logger.log('value:', x, y)` ⇆ `console.log('value:', x, y)`
 *
 * Em produção, apenas `error` é repassado ao console (e futuramente a um
 * coletor externo como Sentry). `debug`, `info` e `warn` são silenciosos
 * fora de DEV, eliminando ruído sem perder observabilidade real.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  userId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private minLevel: LogLevel = this.isDevelopment ? 'debug' : 'info';

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.minLevel];
  }

  /**
   * Caminho variádico — usado quando a chamada veio de console.* via codemod
   * ou quando passar contexto estruturado seria ruído. Em DEV imprime tudo;
   * em produção silencia tudo exceto error.
   */
  private rawLog(level: LogLevel, args: unknown[]) {
    if (!this.shouldLog(level)) return;
    if (this.isDevelopment) {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      fn(...args);
      return;
    }
    if (level === 'error') {
      console.error(...args);
      // TODO: coletor externo (Sentry/Logtail) — captureException(args[0])
    }
  }

  private structuredLog(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (!this.shouldLog(level)) return;
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;

    if (this.isDevelopment) {
      const styles: Record<LogLevel, string> = {
        debug: 'color: #888',
        info: 'color: #2196F3',
        warn: 'color: #FF9800',
        error: 'color: #F44336',
      };
      console.log(`%c${formatted}`, styles[level]);
      if (error) console.error(error);
      return;
    }
    if (level === 'error') {
      console.error(formatted);
      if (error) console.error(error);
    }
  }

  // --- API estruturada -----------------------------------------------------
  debug(message: string, context?: LogContext) {
    // Aceita também uso variádico: logger.debug('x', obj, obj2)
    if (typeof message !== 'string' || (arguments.length > 2)) {
      this.rawLog('debug', Array.from(arguments));
      return;
    }
    this.structuredLog('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    if (typeof message !== 'string' || (arguments.length > 2)) {
      this.rawLog('info', Array.from(arguments));
      return;
    }
    this.structuredLog('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    if (typeof message !== 'string' || (arguments.length > 2)) {
      this.rawLog('warn', Array.from(arguments));
      return;
    }
    this.structuredLog('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    if (typeof message !== 'string' || (arguments.length > 3)) {
      this.rawLog('error', Array.from(arguments));
      return;
    }
    this.structuredLog('error', message, context, error instanceof Error ? error : undefined);
  }

  // --- Drop-in console.* aliases -------------------------------------------
  /** Equivalente a console.log — silencioso em produção. */
  log(...args: unknown[]) { this.rawLog('debug', args); }

  // --- Helpers de domínio --------------------------------------------------
  apiCall(endpoint: string, method: string, duration?: number) {
    this.structuredLog('info', `API Call: ${method} ${endpoint}`, {
      action: 'api_call',
      metadata: { method, endpoint, duration },
    });
  }

  userAction(action: string, userId?: string, metadata?: Record<string, any>) {
    this.structuredLog('info', `User Action: ${action}`, { userId, action, metadata });
  }

  performance(metric: string, value: number, context?: LogContext) {
    this.structuredLog('debug', `Performance: ${metric} = ${value}ms`, {
      ...context,
      action: 'performance',
      metadata: { metric, value },
    });
  }
}

export const logger = new Logger();

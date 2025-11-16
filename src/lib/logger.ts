/**
 * Sistema de logging estruturado para produção
 * Substitui console.log com níveis e contexto adequados
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
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context);

    // Em desenvolvimento, usar console colorido
    if (this.isDevelopment) {
      const styles: Record<LogLevel, string> = {
        debug: 'color: #888',
        info: 'color: #2196F3',
        warn: 'color: #FF9800',
        error: 'color: #F44336',
      };
      
      console.log(`%c${formattedMessage}`, styles[level]);
      if (error) console.error(error);
      return;
    }

    // Em produção, enviar para serviço externo (Sentry, etc)
    // Por enquanto, manter apenas errors no console
    if (level === 'error') {
      console.error(formattedMessage);
      if (error) console.error(error);
      
      // TODO: Enviar para Sentry
      // if (window.Sentry) {
      //   window.Sentry.captureException(error || new Error(message), {
      //     contexts: { custom: context },
      //     level: level as any,
      //   });
      // }
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, context, error);
  }

  // Métodos específicos para casos comuns
  apiCall(endpoint: string, method: string, duration?: number) {
    this.info(`API Call: ${method} ${endpoint}`, {
      action: 'api_call',
      metadata: { method, endpoint, duration },
    });
  }

  userAction(action: string, userId?: string, metadata?: Record<string, any>) {
    this.info(`User Action: ${action}`, {
      userId,
      action,
      metadata,
    });
  }

  performance(metric: string, value: number, context?: LogContext) {
    this.debug(`Performance: ${metric} = ${value}ms`, {
      ...context,
      action: 'performance',
      metadata: { metric, value },
    });
  }
}

export const logger = new Logger();

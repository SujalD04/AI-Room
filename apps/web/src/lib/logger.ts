/**
 * Simple frontend logger to unify console outputs and make it easier
 * to integrate with external monitoring services (Sentry, DataDog, etc.) later.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class FrontendLogger {
    private isProduction = process.env.NODE_ENV === 'production';

    private formatMessage(level: LogLevel, message: string, context?: any) {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` \nContext: ${JSON.stringify(context, null, 2)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
    }

    debug(message: string, context?: any) {
        if (!this.isProduction) {
            console.debug(this.formatMessage('debug', message, context));
        }
    }

    info(message: string, context?: any) {
        console.info(this.formatMessage('info', message, context));
    }

    warn(message: string, context?: any) {
        console.warn(this.formatMessage('warn', message, context));
    }

    error(message: string, error?: any, context?: any) {
        console.error(this.formatMessage('error', message, context));
        if (error) {
            console.error(error);
        }
        // In the future, send to Sentry here:
        // Sentry.captureException(error);
    }
}

export const logger = new FrontendLogger();

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * LoggerMiddleware
 *
 * Logs every incoming HTTP request with:
 *   - ISO timestamp
 *   - HTTP method
 *   - Original URL (including query string)
 *   - Outgoing status code
 *   - Response time in milliseconds
 *   - Requesting IP address
 *
 * Register globally in AppModule:
 *
 *   export class AppModule implements NestModule {
 *     configure(consumer: MiddlewareConsumer) {
 *       consumer.apply(LoggerMiddleware).forRoutes('*');
 *     }
 *   }
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const startTime = Date.now();

    // Hook into the response finish event so we can log the status code and
    // the total round-trip time once the response has been sent.
    res.on('finish', () => {
      const { statusCode } = res;
      const elapsed = Date.now() - startTime;
      const timestamp = new Date().toISOString();

      const logLine = `[${timestamp}] ${method} ${originalUrl} ${statusCode} ${elapsed}ms — ${ip}`;

      if (statusCode >= 500) {
        this.logger.error(logLine);
      } else if (statusCode >= 400) {
        this.logger.warn(logLine);
      } else {
        this.logger.log(logLine);
      }
    });

    next();
  }
}

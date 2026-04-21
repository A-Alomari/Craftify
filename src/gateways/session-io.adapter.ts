import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication } from '@nestjs/common';
import { ServerOptions, Server } from 'socket.io';

/**
 * SessionIoAdapter
 *
 * Extends the default NestJS IoAdapter so that each Socket.io connection
 * goes through the same express-session middleware as HTTP requests.
 *
 * This allows gateways to read `socket.handshake.session.user` for
 * authentication and personalised room management without a separate
 * JWT handshake.
 *
 * Usage (main.ts):
 *   app.useWebSocketAdapter(new SessionIoAdapter(app));
 */
export class SessionIoAdapter extends IoAdapter {
  private readonly sessionMiddleware: (req: any, res: any, next: () => void) => void;

  constructor(app: INestApplication) {
    super(app);

    // Retrieve the session middleware registered in main.ts bootstrap.
    // The Express instance stores it under the 'sessionMiddleware' key.
    const httpAdapter = app.getHttpAdapter();
    const expressApp  = httpAdapter.getInstance() as {
      get: (key: string) => any;
    };
    this.sessionMiddleware = expressApp.get('sessionMiddleware');
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;

    if (!this.sessionMiddleware) {
      return server;
    }

    /**
     * Apply the session middleware to the Socket.io handshake so that
     * `socket.handshake.session` is populated before any gateway code runs.
     *
     * We wrap the middleware call to match Socket.io's expected signature:
     *   (socket, next) => void
     */
    server.use((socket: any, next: (err?: Error) => void) => {
      // socket.request is the underlying Node.js IncomingMessage; we cast
      // it to the shape express-session expects.
      const req: any = socket.request;
      const res: any = socket.request.res ?? {
        getHeader: () => '',
        setHeader: () => {},
      };

      this.sessionMiddleware(req, res, (err?: any) => {
        if (err) {
          next(new Error('Session middleware error'));
          return;
        }
        // Make the session available as socket.handshake.session for
        // consistency with the gateway code.
        socket.handshake.session = req.session;
        next();
      });
    });

    return server;
  }
}

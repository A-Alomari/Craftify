import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * ChatGateway
 *
 * Handles real-time messaging notifications over Socket.io.
 *
 * This gateway shares the same namespace ('/') as AuctionGateway so that a
 * single Socket.io connection from the browser can handle both auction
 * real-time updates and chat notifications.
 *
 * Room convention (shared with AuctionGateway):
 *   user-{id}  — private channel for each authenticated user.
 *
 * Events emitted to clients:
 *   newConversation  — a new chat message was received (to recipient's room)
 *
 * Note: The 'joinUser' event is also handled by AuctionGateway.  Having two
 * handlers on the same namespace is safe because Socket.io delivers events to
 * all registered handlers; the duplicate room join is idempotent.
 */
@WebSocketGateway({
  cors:      { origin: '*' },
  namespace: '/',
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // -------------------------------------------------------------------------
  // Public API — called by UserController / MessagesService after saving a
  // new message to the database.
  // -------------------------------------------------------------------------

  /**
   * Notify a user that they have a new incoming message.
   *
   * @param receiverId  Database ID of the recipient user.
   * @param messageData Data shape expected by the client-side handler
   *                    (sender name, snippet, conversation ID, timestamp …).
   */
  notifyNewMessage(
    receiverId: number,
    messageData: Record<string, unknown>,
  ): void {
    this.server.to(`user-${receiverId}`).emit('newConversation', messageData);
    this.logger.debug(`Notified user-${receiverId} of new message`);
  }

  // -------------------------------------------------------------------------
  // Room management
  // -------------------------------------------------------------------------

  /**
   * Client-side emits 'joinUser' after connecting so it can receive private
   * events targeted at its user ID.
   *
   * The client must be authenticated; unauthenticated sockets are silently
   * ignored (no error is emitted to avoid leaking user-existence information).
   */
  @SubscribeMessage('joinUser')
  handleJoinUser(@ConnectedSocket() client: Socket): void {
    const session = (client.handshake as any).session;
    const userId  = session?.user?.id;

    if (!userId) return;

    const room = `user-${userId}`;
    void client.join(room);
    this.logger.debug(`${client.id} joined personal room ${room} (via ChatGateway)`);
  }
}

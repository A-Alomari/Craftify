import {
  Controller,
  Get,
  Post,
  Delete,
  Req,
  Res,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../../common/guards/auth.guard';

type CraftifyRequest = Request & {
  session: Record<string, any> & {
    user?: { id: number; role: string };
  };
  flash?: (type: string, message?: string) => string[];
  csrfToken?: () => string;
};

@Controller('user')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private flash(req: CraftifyRequest, type: string): string {
    if (typeof req.flash !== 'function') return '';
    const msgs = req.flash(type);
    return Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : '';
  }

  private csrf(req: CraftifyRequest): string {
    return typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  }

  // =========================================================================
  // GET /user/notifications
  // =========================================================================

  @Get('notifications')
  @UseGuards(AuthGuard)
  async showNotifications(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Query('page') pageStr?: string,
  ): Promise<void> {
    const userId = req.session.user!.id;
    const page = parseInt(pageStr || '1', 10) || 1;

    const result = await this.notificationsService.findByUserId(
      userId,
      page,
      20,
    );
    const unreadCount = await this.notificationsService.getUnreadCount(userId);

    res.render('user/notifications', {
      title: 'Notifications - Craftify',
      user: req.session.user,
      notifications: result.notifications,
      pagination: result.pagination,
      unreadCount,
      csrfToken: this.csrf(req),
      flashError: this.flash(req, 'error_msg'),
      flashSuccess: this.flash(req, 'success_msg'),
    });
  }

  // =========================================================================
  // POST /user/notifications/:id/read — mark single notification read
  // =========================================================================

  @Post('notifications/:id/read')
  @UseGuards(AuthGuard)
  async markRead(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.session.user!.id;
    await this.notificationsService.markAsRead(id, userId);
    return void res.redirect('/user/notifications');
  }

  // =========================================================================
  // POST /user/notifications/read-all — mark all read
  // =========================================================================

  @Post('notifications/read-all')
  @UseGuards(AuthGuard)
  async markAllRead(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.session.user!.id;
    await this.notificationsService.markAllAsRead(userId);
    req.flash?.('success_msg', 'All notifications marked as read');
    return void res.redirect('/user/notifications');
  }

  // =========================================================================
  // DELETE /user/notifications/:id  (also reachable via method-override POST)
  // =========================================================================

  @Delete('notifications/:id')
  @UseGuards(AuthGuard)
  async deleteNotification(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.session.user!.id;
    await this.notificationsService.delete(id, userId);
    return void res.redirect('/user/notifications');
  }

  // method-override fallback
  @Post('notifications/:id/delete')
  @UseGuards(AuthGuard)
  async deleteNotificationPost(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    return this.deleteNotification(id, req, res);
  }
}

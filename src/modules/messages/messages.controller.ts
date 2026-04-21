import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { MessagesService } from './messages.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ActiveGuard } from '../../common/guards/roles.guard';

type CraftifyRequest = Request & {
  session: Record<string, any> & {
    user?: {
      id: number;
      name: string;
      email: string;
      role: string;
      avatar: string | null;
    };
  };
  flash?: (type: string, message?: string) => string[];
  csrfToken?: () => string;
};

// ---------------------------------------------------------------------------
// Multer storage for message image attachments
// ---------------------------------------------------------------------------

const messageImageStorage = diskStorage({
  destination: '.uploads',
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `msg-${uuidv4()}${ext}`);
  },
});

@Controller('user')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  private flash(req: CraftifyRequest, type: string): string {
    if (typeof req.flash !== 'function') return '';
    const msgs = req.flash(type);
    return Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : '';
  }

  private csrf(req: CraftifyRequest): string {
    return typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  }

  private isXhr(req: Request): boolean {
    return (
      !!(req as any).xhr ||
      String(req.headers['x-requested-with'] || '').toLowerCase() === 'xmlhttprequest'
    );
  }

  // =========================================================================
  // GET /user/messages — inbox: list of conversation threads
  // =========================================================================

  @Get('messages')
  @UseGuards(AuthGuard, ActiveGuard)
  async showMessages(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.session.user!.id;
    const conversations = await this.messagesService.getConversations(userId);

    res.render('user/messages', {
      title: 'Messages - Craftify',
      user: req.session.user,
      conversations,
      pagination: null,
      csrfToken: this.csrf(req),
      flashError: this.flash(req, 'error_msg'),
      flashSuccess: this.flash(req, 'success_msg'),
    });
  }

  // =========================================================================
  // GET /user/messages/:userId — single conversation thread
  // =========================================================================

  @Get('messages/:userId')
  @UseGuards(AuthGuard, ActiveGuard)
  async showConversation(
    @Param('userId', ParseIntPipe) otherUserId: number,
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Query('page') pageStr?: string,
  ): Promise<void> {
    const currentUserId = req.session.user!.id;
    const page = parseInt(pageStr || '1', 10) || 1;

    try {
      const [otherUser, artisanProfile, threadResult, conversations] =
        await Promise.all([
          this.messagesService.findUserById(otherUserId),
          this.messagesService.findArtisanProfileByUserId(otherUserId),
          this.messagesService.getThread(currentUserId, otherUserId, page, 30),
          this.messagesService.getConversations(currentUserId),
        ]);

      if (!otherUser) {
        req.flash?.('error_msg', 'User not found');
        return void res.redirect('/user/messages');
      }

      res.render('user/conversation', {
        title: `Conversation with ${otherUser.name} - Craftify`,
        user: req.session.user,
        currentUser: req.session.user,
        otherUser,
        artisanProfile,
        messages: threadResult.messages,
        pagination: threadResult.pagination,
        conversations,
        csrfToken: this.csrf(req),
        flashError: this.flash(req, 'error_msg'),
        flashSuccess: this.flash(req, 'success_msg'),
      });
    } catch (err: any) {
      req.flash?.('error_msg', err.message || 'Could not load conversation');
      return void res.redirect('/user/messages');
    }
  }

  // =========================================================================
  // POST /user/messages — send a message (supports AJAX + standard form)
  // =========================================================================

  @Post('messages')
  @UseGuards(AuthGuard, ActiveGuard)
  @UseInterceptors(
    FileInterceptor('message_image', {
      storage: messageImageStorage,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|webp|gif)$/i;
        if (!allowed.test(extname(file.originalname))) {
          return cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async sendMessage(
    @Req() req: CraftifyRequest,
    @Res() res: Response,
    @Body()
    body: {
      receiver_id?: string;
      content?: string;
    },
    @UploadedFile() imageFile?: Express.Multer.File,
  ): Promise<void> {
    const senderId = req.session.user!.id;
    const receiverId = parseInt(String(body.receiver_id || ''), 10);
    const content = String(body.content || '').trim();
    const imageUrl = imageFile ? `/uploads/${imageFile.filename}` : undefined;

    if (!receiverId || isNaN(receiverId)) {
      if (this.isXhr(req)) {
        return void res
          .status(400)
          .json({ success: false, error: 'Invalid recipient' });
      }
      req.flash?.('error_msg', 'Invalid recipient');
      return void res.redirect('/user/messages');
    }

    if (!content && !imageUrl) {
      if (this.isXhr(req)) {
        return void res
          .status(400)
          .json({ success: false, error: 'Message content cannot be empty' });
      }
      req.flash?.('error_msg', 'Message content cannot be empty');
      return void res.redirect(`/user/messages/${receiverId}`);
    }

    try {
      const message = await this.messagesService.create({
        senderId,
        receiverId,
        content,
        imageUrl,
      });

      if (this.isXhr(req)) {
        return void res.json({
          success: true,
          message: {
            id: message.id,
            content: message.content,
            image_url: message.image_url,
            sender_id: message.sender_id,
            receiver_id: message.receiver_id,
            created_at: message.created_at,
            is_read: message.is_read,
          },
        });
      }

      return void res.redirect(`/user/messages/${receiverId}`);
    } catch (err: any) {
      if (this.isXhr(req)) {
        return void res
          .status(400)
          .json({ success: false, error: err.message });
      }
      req.flash?.('error_msg', err.message || 'Failed to send message');
      return void res.redirect(`/user/messages/${receiverId}`);
    }
  }
}

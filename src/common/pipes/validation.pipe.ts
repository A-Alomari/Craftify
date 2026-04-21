import {
  ValidationPipe,
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// globalValidationPipe
//
// Attach this in main.ts via app.useGlobalPipes(globalValidationPipe).
//
// - transform: true          → converts plain request body objects to typed class instances
// - whitelist: true          → strips properties not declared in the DTO
// - forbidNonWhitelisted:    → false (silently strip, do not throw on extra keys)
// - skipMissingProperties    → true (useful for PATCH requests; don't require all fields)
// - validationError.target   → false (don't expose the whole target object in error payloads)
// ---------------------------------------------------------------------------

export const globalValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: false,
  skipMissingProperties: true,
  validationError: { target: false },
});

// ---------------------------------------------------------------------------
// FlashValidationPipe
//
// A custom pipe intended for controller methods that handle traditional HTML
// form submissions (not XHR/API calls). Instead of throwing a 400
// BadRequestException that the exception filter would need to interpret, it:
//   1. Validates the incoming body against the provided DTO class.
//   2. On validation failure, flashes all error messages via connect-flash
//      and redirects back to the previous page.
//   3. On success, returns the transformed DTO instance.
//
// Usage in a controller method:
//
//   @Post('register')
//   async register(
//     @Body(new FlashValidationPipe()) body: RegisterDto,
//     @Req() req: Request,
//   ) { ... }
// ---------------------------------------------------------------------------

@Injectable()
export class FlashValidationPipe implements PipeTransform<any> {
  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    // Only validate when a metatype (DTO class) is provided
    if (!metadata.metatype || !this.isValidatable(metadata.metatype)) {
      return value;
    }

    // Convert plain object → typed DTO instance
    const object = plainToInstance(metadata.metatype, value, {
      enableImplicitConversion: true,
    });

    // Run class-validator decorators
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: false,
      skipMissingProperties: true,
    });

    if (errors.length === 0) {
      return object;
    }

    // Flatten all constraint messages into a single array
    const messages: string[] = errors.flatMap((err) =>
      err.constraints ? Object.values(err.constraints) : [],
    );

    // If we have access to the request context (passed by a middleware or
    // interceptor that attaches it) we can flash and redirect. Otherwise
    // fall back to a standard BadRequestException so the global filter can
    // handle it.
    const req = (metadata as any).req as (Request & {
      flash?: (type: string, message: string) => void;
    }) | undefined;

    const res = (metadata as any).res as Response | undefined;

    if (req?.flash && res) {
      messages.forEach((msg) => req.flash!('error_msg', msg));
      const referer = req.headers.referer as string | undefined;
      res.redirect(referer || '/');
      // Returning undefined causes NestJS to stop the handler — the response
      // has already been committed by the redirect above.
      return undefined;
    }

    // Fallback: throw a structured error the global filter can handle
    throw new BadRequestException(messages);
  }

  private isValidatable(metatype: any): boolean {
    const primitives: any[] = [String, Boolean, Number, Array, Object];
    return !primitives.includes(metatype);
  }
}

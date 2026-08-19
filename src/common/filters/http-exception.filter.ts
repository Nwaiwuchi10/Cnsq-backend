// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ServerErrorService } from 'src/server-error/server-error.service';

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly errorService: ServerErrorService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const stack = exception instanceof Error ? exception.stack : null;
    const messageContent =
      exception instanceof HttpException
        ? (exception.getResponse() as any)?.message || exception.message
        : (exception as Error)?.message || 'Something went wrong';

    // Log to console (as before)
    console.error('Uncaught Exception:', exception);

    // Persist to Database if it's a 500 error or not an HttpException
    if (status === HttpStatus.INTERNAL_SERVER_ERROR || !(exception instanceof HttpException)) {
      await this.errorService.create({
        message: messageContent,
        stack: stack ?? undefined,
        path: request.url,
        method: request.method,
        statusCode: status,
        staffId: (request as any).staffId || (request as any).userId || undefined,
      });
    }

    let message =
      exception instanceof HttpException
        ? (exception.getResponse() as any)?.message || exception.message
        : 'Something went wrong on our server. Please try again later.';

    // Normalize message if it's an array
    if (Array.isArray(message)) {
      message = message.join(', ');
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

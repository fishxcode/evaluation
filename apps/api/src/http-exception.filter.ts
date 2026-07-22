import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

function codeFor(status: number) {
  if (status === HttpStatus.NOT_FOUND) return "not_found";
  if (status === HttpStatus.UNAUTHORIZED) return "unauthorized";
  if (status === HttpStatus.FORBIDDEN) return "forbidden";
  if (status === HttpStatus.BAD_REQUEST) return "bad_request";
  return "internal_error";
}

function messageFor(exception: unknown) {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    if (typeof response === "string") return response;
    if (response && typeof response === "object" && "message" in response) {
      const message = (response as { message: string | string[] }).message;
      return Array.isArray(message) ? message.join("; ") : message;
    }
  }
  return exception instanceof Error ? exception.message : "Unexpected error";
}

/** Convert thrown exceptions to the shared response envelope.
 * 将异常转换为统一响应包络。 */
@Catch()
export class HttpEnvelopeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(status).json({
      data: null,
      meta: { statusCode: status },
      error: {
        code: codeFor(status),
        message: messageFor(exception),
      },
    });
  }
}

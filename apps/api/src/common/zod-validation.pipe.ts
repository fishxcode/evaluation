/**
 * ZodValidationPipe — validates query/body against a Zod schema and returns
 * 400 with a clear message on failure. This is where the pageSize<=100 rule
 * (8.1) is ENFORCED at the DTO layer — no silent truncation.
 * ZodValidationPipe——用 Zod schema 校验 query/body，失败返回 400 及清晰消息。
 * 分页 pageSize<=100 规则在此 DTO 层强制——绝不静默截断。
 */
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first?.path.join('.') ?? '';
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: path ? `${path}: ${first?.message}` : (first?.message ?? 'Validation failed'),
        details: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}

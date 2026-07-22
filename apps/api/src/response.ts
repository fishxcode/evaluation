/** Build a successful response envelope.
 * 构造成功响应包络。 */
export function ok<T>(data: T, meta: Record<string, unknown> = {}) {
  return { data, meta, error: null };
}

/** Build an error response envelope.
 * 构造错误响应包络。 */
export function fail(
  code: string,
  message: string,
  meta: Record<string, unknown> = {},
) {
  return { data: null, meta, error: { code, message } };
}

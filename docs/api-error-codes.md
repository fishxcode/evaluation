# API Error Codes

All errors return the unified envelope `{ data: null, error: { code, message, details? } }`.

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid query/body (e.g. `pageSize>100`, `pageSize<1`, bad sort field). `details[]` lists each Zod issue. |
| 401 | `UNAUTHORIZED` | Missing/invalid admin JWT or wrong `REFRESH_TOKEN`. |
| 403 | `FORBIDDEN` | Valid JWT but insufficient role. |
| 404 | `NOT_FOUND` | Unknown model/lab id. |
| 429 | `RATE_LIMITED` | Exceeded 120 req / 60s per IP. |
| 500 | `INTERNAL` | Unexpected server error (logged server-side). |

## Pagination contract (8.1)

- `page` ≥ 1 (default 1), `pageSize` 1–100 (default 20).
- `pageSize > 100` or `< 1` → **400**, never silent truncation.
- Every list response includes `meta: { page, pageSize, total, totalPages }`.

## Auth schemes (distinct, per 9.1)

- **`POST /refresh`**: simple bearer `REFRESH_TOKEN`.
- **`/admin/*`**: JWT from `POST /admin/login` (bcrypt-verified creds), `role=admin` required, enforced by `JwtAuthGuard` at controller level.

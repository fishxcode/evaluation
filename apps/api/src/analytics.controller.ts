import { Body, Controller, Headers, Inject, Post, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AnalyticsService } from "./analytics.service.js";
import { ApiEnvelopeResponse } from "./dto.js";
import { ok } from "./response.js";

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Public analytics endpoint for lightweight page-view counting.
 * 用于轻量页面访问计数的公开分析端点。 */
@ApiTags("analytics")
@Controller()
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
  ) {}

  @Post("analytics/page-view")
  @ApiOperation({
    summary: "Record a public page view.\n记录一次公开页面访问。",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string", example: "/en/models" },
      },
    },
  })
  @ApiEnvelopeResponse({
    status: 201,
    dataSchema: {
      type: "object",
      required: ["counted", "pageViews", "updatedAt"],
      properties: {
        counted: { type: "boolean" },
        pageViews: { type: "number" },
        updatedAt: { type: "string" },
        byPath: { type: "object", additionalProperties: { type: "number" } },
      },
    },
  })
  pageView(
    @Body("path") pagePath: string | undefined,
    @Headers("x-page-session") sessionId: string | undefined,
    @Headers("user-agent") userAgent: string | undefined,
    @Headers("x-forwarded-for") forwardedFor: string | string[] | undefined,
    @Req() request: { ip?: string },
  ) {
    const ip = firstHeader(forwardedFor)?.split(",")[0]?.trim() ?? request.ip;
    return ok(
      this.analytics.recordPageView({
        pagePath: pagePath ?? "/",
        ...(sessionId ? { sessionId } : {}),
        ...(ip ? { ip } : {}),
        ...(userAgent ? { userAgent } : {}),
      }),
    );
  }
}

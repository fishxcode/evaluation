import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { refreshDataPipeline, type PipelineDownloader } from "./pipeline";

const fetchedAt = "2026-07-22T14:00:00.000Z";

function apiFixture(name = "GPT-4o") {
  return JSON.stringify({
    openai: {
      id: "openai",
      name: "OpenAI",
      models: {
        "gpt-4o": {
          id: "gpt-4o",
          name,
          description: "Provider description",
          attachment: true,
          reasoning: false,
          tool_call: true,
          structured_output: true,
          temperature: true,
          release_date: "2024-05-13",
          last_updated: "2024-08-06",
          modalities: { input: ["text"], output: ["text"] },
          open_weights: false,
          limit: { context: 128000, output: 16384 },
          cost: { input: 2.5, output: 10 },
        },
      },
    },
  });
}

function catalogFixture(name = "GPT-4o") {
  return JSON.stringify({
    providers: {},
    models: {
      "openai/gpt-4o": {
        id: "openai/gpt-4o",
        name,
        description: "Catalog description",
        attachment: true,
        reasoning: false,
        tool_call: true,
        structured_output: true,
        temperature: true,
        release_date: "2024-05-13",
        last_updated: "2024-08-06",
        modalities: { input: ["text"], output: ["text"] },
        open_weights: false,
        limit: { context: 128000, output: 16384 },
      },
    },
  });
}

function labsFixture() {
  return `<script id="search-index" type="application/json">[
    {"type":"lab","id":"openai","title":"OpenAI","modelCount":1,"providerCount":1}
  ]</script>`;
}

async function makeRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "models-dev-pipeline-"));
}

function createDownloader(bodies: Record<string, string>): PipelineDownloader {
  return async (source, request) => {
    if (request.ifNoneMatch === `"${source.id}-etag"`) {
      return { notModified: true, etag: request.ifNoneMatch, durationMs: 1 };
    }
    return {
      body: bodies[source.id] ?? "",
      etag: `"${source.id}-etag"`,
      durationMs: 1,
    };
  };
}

describe("refreshDataPipeline", () => {
  it("publishes merged data and source metadata from downloaded snapshots", async () => {
    const rootDir = await makeRoot();

    const result = await refreshDataPipeline({
      rootDir,
      now: () => fetchedAt,
      downloader: createDownloader({
        api: apiFixture(),
        catalog: catalogFixture(),
        labs: labsFixture(),
      }),
    });

    const metadata = JSON.parse(
      await fs.readFile(
        path.join(rootDir, "data/merged/metadata.json"),
        "utf8",
      ),
    );
    const dataset = JSON.parse(
      await fs.readFile(path.join(rootDir, "data/merged/models.json"), "utf8"),
    );

    expect(result.changed).toBe(true);
    expect(metadata.modelCount).toBe(1);
    expect(metadata.sourceStatus.api).toMatchObject({
      status: "downloaded",
      etag: '"api-etag"',
    });
    expect(metadata.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(dataset.models[0].offerings[0].pricing.input).toBe(2.5);
  });

  it("uses etag metadata to skip unchanged downloads on repeat runs", async () => {
    const rootDir = await makeRoot();
    const downloader = createDownloader({
      api: apiFixture(),
      catalog: catalogFixture(),
      labs: labsFixture(),
    });

    await refreshDataPipeline({ rootDir, now: () => fetchedAt, downloader });
    const second = await refreshDataPipeline({
      rootDir,
      now: () => "2026-07-22T14:01:00.000Z",
      downloader,
    });

    const metadata = JSON.parse(
      await fs.readFile(
        path.join(rootDir, "data/merged/metadata.json"),
        "utf8",
      ),
    );
    expect(second.changed).toBe(false);
    expect(metadata.sourceStatus.api.status).toBe("skipped");
    expect(metadata.sourceStatus.catalog.status).toBe("skipped");
    expect(metadata.sourceStatus.labs.status).toBe("skipped");
  });

  it("keeps the previous published files when new raw data cannot be parsed", async () => {
    const rootDir = await makeRoot();
    await refreshDataPipeline({
      rootDir,
      now: () => fetchedAt,
      downloader: createDownloader({
        api: apiFixture(),
        catalog: catalogFixture(),
        labs: labsFixture(),
      }),
    });
    const before = await fs.readFile(
      path.join(rootDir, "data/merged/models.json"),
      "utf8",
    );

    await expect(
      refreshDataPipeline({
        rootDir,
        now: () => "2026-07-22T14:02:00.000Z",
        force: true,
        downloader: createDownloader({
          api: "{bad-json",
          catalog: catalogFixture(),
          labs: labsFixture(),
        }),
      }),
    ).rejects.toThrow();

    const after = await fs.readFile(
      path.join(rootDir, "data/merged/models.json"),
      "utf8",
    );
    expect(after).toBe(before);
  });
});

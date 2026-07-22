import { describe, expect, it } from "vitest";
import { mergeCatalogApiAndLabs, parseLabsFromHtml } from "./index";

describe("parseLabsFromHtml", () => {
  it("extracts lab records from the embedded search index", () => {
    const html = `<script id="search-index" type="application/json">[
      {"type":"lab","id":"openai","title":"OpenAI","href":"/labs/openai","logo":"/logos/labs/openai.svg","modelCount":56,"providerCount":67,"releaseDate":"2026-07-09","description":"OpenAI models.","updated":"2026-07-09"},
      {"type":"provider","id":"openai","title":"OpenAI"}
    ]</script>`;

    const labs = parseLabsFromHtml(html);

    expect(labs).toHaveLength(1);
    expect(labs[0]).toMatchObject({
      id: "openai",
      name: "OpenAI",
      modelCount: 56,
      providerCount: 67,
      description: "OpenAI models.",
    });
  });
});

describe("mergeCatalogApiAndLabs", () => {
  it("keeps catalog metadata and attaches provider pricing as an offering", () => {
    const dataset = mergeCatalogApiAndLabs({
      fetchedAt: "2026-07-22T13:29:27.000Z",
      api: {
        openai: {
          id: "openai",
          name: "OpenAI",
          npm: "@ai-sdk/openai",
          env: ["OPENAI_API_KEY"],
          doc: "https://platform.openai.com/docs/models",
          models: {
            "gpt-4o": {
              id: "gpt-4o",
              name: "GPT-4o",
              description: "Provider description",
              attachment: true,
              reasoning: false,
              tool_call: true,
              structured_output: true,
              temperature: true,
              release_date: "2024-05-13",
              last_updated: "2024-08-06",
              modalities: { input: ["text", "image"], output: ["text"] },
              open_weights: false,
              limit: { context: 128000, output: 16384 },
              cost: { input: 2.5, output: 10, cache_read: 1.25 },
            },
          },
        },
      },
      catalog: {
        providers: {},
        models: {
          "openai/gpt-4o": {
            id: "openai/gpt-4o",
            name: "GPT-4o",
            description: "Catalog description",
            family: "gpt",
            attachment: true,
            reasoning: false,
            tool_call: true,
            structured_output: true,
            temperature: true,
            release_date: "2024-05-13",
            last_updated: "2024-08-06",
            modalities: { input: ["text", "image", "pdf"], output: ["text"] },
            open_weights: false,
            limit: { context: 128000, output: 16384 },
            benchmarks: [
              {
                name: "Aider Polyglot",
                score: 23.1,
                metric: "percent correct",
                source: "https://aider.chat/docs/leaderboards/",
                date: "2024-12-30",
              },
            ],
          },
        },
      },
      labs: [
        {
          id: "openai",
          name: "OpenAI",
          href: "/labs/openai",
          logo: "/logos/labs/openai.svg",
          modelCount: 56,
          providerCount: 67,
          updatedAt: "2026-07-09",
        },
      ],
    });

    expect(dataset.models).toHaveLength(1);
    expect(dataset.models[0]).toMatchObject({
      id: "openai/gpt-4o",
      lab: { id: "openai", name: "OpenAI" },
      description: "Catalog description",
      benchmarks: [{ benchmark: "Aider Polyglot", score: 23.1 }],
      offerings: [
        {
          provider: { id: "openai", name: "OpenAI" },
          providerModelId: "gpt-4o",
          pricing: { input: 2.5, output: 10, cachedInput: 1.25 },
        },
      ],
    });
    expect(dataset.metadata.quarantine).toHaveLength(0);
  });

  it("quarantines invalid normalized records instead of publishing them", () => {
    const dataset = mergeCatalogApiAndLabs({
      fetchedAt: "2026-07-22T13:29:27.000Z",
      api: {},
      catalog: {
        providers: {},
        models: {
          "bad/model": {
            id: "",
            name: "",
            description: "Invalid because id and name are empty",
            attachment: false,
            reasoning: false,
            tool_call: false,
            release_date: "2026-01-01",
            last_updated: "2026-01-02",
            modalities: { input: ["text"], output: ["text"] },
            open_weights: false,
            limit: { context: 1 },
          },
        },
      },
      labs: [],
    });

    expect(dataset.models).toHaveLength(0);
    expect(dataset.metadata.quarantine).toHaveLength(1);
    expect(dataset.metadata.quarantine[0]?.id).toBe("bad/model");
  });
});

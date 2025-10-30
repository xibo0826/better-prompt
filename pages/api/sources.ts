import type { Source } from "@/types";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom/worker";
import { cleanSourceText } from "@/utils/sources";

export const runtime = 'edge';

export const config = {
  runtime: 'edge',
};

const EXCLUDE_DOMAINS = ["google", "facebook", "twitter", "instagram", "youtube", "tiktok"];
const SOURCE_COUNT = 4;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const searchHandler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { query } = (await req.json()) as { query?: string };
    const trimmedQuery = query?.trim();

    if (!trimmedQuery) {
      return json({ sources: [] }, 400);
    }

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmedQuery)}`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });

    if (!searchResponse.ok) {
      throw new Error(`Failed to fetch search results: ${searchResponse.status}`);
    }

    const searchHtml = await searchResponse.text();
    const { document: searchDocument } = parseHTML(searchHtml);
    const linkElements = Array.from(searchDocument.querySelectorAll("a"));

    const rawLinks = linkElements
      .map((anchor) => anchor.getAttribute("href") || "")
      .filter((href) => href.startsWith("/url?q="))
      .map((href) => href.replace("/url?q=", "").split("&")[0]);

    const uniqueLinks: string[] = [];
    for (const link of rawLinks) {
      try {
        const domain = new URL(link).hostname;
        if (EXCLUDE_DOMAINS.some((site) => domain.includes(site))) continue;
        if (uniqueLinks.some((stored) => new URL(stored).hostname === domain)) continue;
        uniqueLinks.push(link);
      } catch {
        continue;
      }
      if (uniqueLinks.length >= SOURCE_COUNT) break;
    }

    const sources = await Promise.all(
      uniqueLinks.slice(0, SOURCE_COUNT).map(async (link) => {
        try {
          const response = await fetch(link, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            },
          });

          if (!response.ok) return null;

          const html = await response.text();
          const { document } = parseHTML(html);
          const parsed = new Readability(document).parse();

          if (!parsed?.textContent) return null;

          const snippet = cleanSourceText(parsed.textContent).slice(0, 1500);

          return { url: link, text: snippet };
        } catch (error) {
          console.error("Failed to parse source:", error);
          return null;
        }
      })
    );

    const filteredSources = sources.filter((source): source is Source => Boolean(source));

    return json({ sources: filteredSources });
  } catch (error) {
    console.error("Source handler error:", error);
    return json({ sources: [] }, 500);
  }
};

export default searchHandler;

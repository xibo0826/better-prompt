import { SearchQuery, Source } from "@/types";
import { IconArrowRight, IconBolt, IconSearch } from "@tabler/icons-react";
import { FC, KeyboardEvent, useEffect, useRef, useState } from "react";

const QUICK_LINKS = [
  { label: "ChatGPT", href: "https://chat.openai.com/" },
  { label: "Google AI Studio", href: "https://aistudio.google.com/" },
  { label: "Claude", href: "https://claude.ai/" },
  { label: "Grok", href: "https://grok.x.ai/" },
  { label: "Dreamina", href: "https://dreamina.com/" },
];

interface SearchProps {
  onSearch: (searchResult: SearchQuery) => void;
  onAnswerUpdate: (answer: string) => void;
  onDone: (done: boolean) => void;
}

export const Search: FC<SearchProps> = ({ onSearch, onAnswerUpdate, onDone }) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [query, setQuery] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const getSid = () => {
    let sid = sessionStorage.getItem("sid");
    if (!sid) {
      sid = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) + Date.now();
      sessionStorage.setItem("sid", sid);
    }
    return sid;
  };

  const handleSearch = async () => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      alert("Please enter a query");
      return;
    }

    setLoading(true);
    await handleStream(normalizedQuery);
  };

  const fetchSources = async (search: string): Promise<Source[]> => {
    const response = await fetch("/api/sources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: search })
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const { sources }: { sources: Source[] } = await response.json();

    return sources;
  };

  const handleStream = async (normalizedQuery: string) => {
    try {
      // const prompt = endent`Provide a 2-3 sentence answer to the query based on the following sources. Be original, concise, accurate, and helpful. Cite sources as [1] or [2] or [3] after each sentence (not just the very end) to back up your answer (Ex: Correct: [1], Correct: [2][3], Incorrect: [1, 2]).

      // ${sources.map((source, idx) => `Source [${idx + 1}]:\n${source.text}`).join("\n\n")}
      // `;
      let sourceLinks: string[] = [];
      try {
        const sources = await fetchSources(normalizedQuery);
        sourceLinks = sources.map((source) => source.url);
      } catch (sourceError) {
        console.error("Failed to fetch sources:", sourceError);
      }

      const sid = getSid();
      const prompt = normalizedQuery;
      onSearch({ query: normalizedQuery, sourceLinks });
      const response = await fetch("/api/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": sid,
        },
        body: JSON.stringify({ prompt, apiKey })
      });

      if (!response.ok) {
        setLoading(false);
        throw new Error(response.statusText);
      }

      setLoading(false);
      // onSearch({ query, sourceLinks: sources.map((source) => source.url) });

      const data = response.body;

      if (!data) {
        return;
      }

      const reader = data.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        onAnswerUpdate(chunkValue);
      }

      onDone(true);
    } catch (err) {
      onAnswerUpdate("Error");
      onDone(true);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  // const handleSave = () => {
  //   if (apiKey.length !== 51) {
  //     alert("Please enter a valid API key.");
  //     return;
  //   }

  //   localStorage.setItem("CLARITY_KEY", apiKey);

  //   setShowSettings(false);
  //   inputRef.current?.focus();
  // };

  // const handleClear = () => {
  //   localStorage.removeItem("CLARITY_KEY");

  //   setApiKey("");
  // };

  useEffect(() => {
    // const CLARITY_KEY = localStorage.getItem("CLARITY_KEY");
    // if (CLARITY_KEY) {
    //   setApiKey(CLARITY_KEY);
    // } else {
    //   setShowSettings(true);
    // }

    inputRef.current?.focus();
  }, []);

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center pt-64 sm:pt-72 flex-col">
          <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <div className="mt-8 text-2xl">Getting answer...</div>
        </div>
      ) : (
        <div className="mx-auto flex h-full w-full max-w-[750px] flex-col items-center space-y-6 px-3 pt-32 sm:pt-64">
          <div className="flex items-center">
            <IconBolt size={36} />
            <div className="ml-1 text-center text-4xl">Better Prompt</div>
          </div>

          {true ? (
            <div className="relative w-full">
              {/* <IconSearch className="text=[#D4D4D8] absolute top-3 w-10 left-1 h-6 rounded-full opacity-50 sm:left-3 sm:top-4 sm:h-8" /> */}

              <textarea
                ref={inputRef}
                rows={3}
                className="w-full resize-y rounded-2xl border border-zinc-600 bg-[#2A2A31] pr-12 pl-5 pt-3 pb-3 text-base leading-6 text-[#D4D4D8] focus:border-zinc-800 focus:bg-[#18181C] focus:outline-none focus:ring-2 focus:ring-zinc-800 sm:text-lg"
                placeholder="What do you want to do..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />

              <button>
                <IconArrowRight
                  onClick={handleSearch}
                  className="absolute right-3 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-blue-500 p-1 hover:cursor-pointer hover:bg-blue-600 sm:right-4 sm:h-10 sm:w-10"
                />
              </button>
            </div>
          ) : (
            <div className="text-center text-[#D4D4D8]">Please enter your OpenAI API key.</div>
          )}

          <div className="w-full">
            <div className="flex flex-wrap gap-3">
              {QUICK_LINKS.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline inline-flex items-center px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20 hover:text-blue-100"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* <button
            className="flex cursor-pointer items-center space-x-2 rounded-full border border-zinc-600 px-3 py-1 text-sm text-[#D4D4D8] hover:text-white"
            onClick={() => setShowSettings(!showSettings)}
          >
            {showSettings ? "Hide" : "Show"} Settings
          </button> */}

          {/* {showSettings && (
            <>
              <input
                type="password"
                className="max-w-[400px] block w-full rounded-md border border-gray-300 p-2 text-black shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);

                  if (e.target.value.length !== 51) {
                    setShowSettings(true);
                  }
                }}
              />

              <div className="flex space-x-2">
                <div
                  className="flex cursor-pointer items-center space-x-2 rounded-full border border-zinc-600 bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
                  onClick={handleSave}
                >
                  Save
                </div>

                <div
                  className="flex cursor-pointer items-center space-x-2 rounded-full border border-zinc-600 bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                  onClick={handleClear}
                >
                  Clear
                </div>
              </div>
            </>
          )} */}
        </div>
      )}
    </>
  );
};

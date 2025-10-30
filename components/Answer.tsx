import { SearchQuery } from "@/types";
import { IconLoader2, IconReload, IconSend } from "@tabler/icons-react";
import type { FC, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface AnswerProps {
  searchQuery: SearchQuery;
  answer: string;
  done: boolean;
  onReset: () => void;
  /** User messages shown in the right sidebar (chronological). */
  userMessages: string[];
  /** Callback for the bottom input submission. */
  onSend: (value: string) => void;
  /** Indicates whether a request is in-flight (disables send button). */
  sending?: boolean;
}

type AnswerEntry = {
  id: string;
  question: string;
  content: string;
  sourceLinks: string[];
  isStreaming?: boolean;
};

export const Answer: FC<AnswerProps> = ({
  searchQuery,
  answer,
  done,
  onReset,
  userMessages,
  onSend,
  sending = false,
}) => {
  const [input, setInput] = useState("");
  const [answerHistory, setAnswerHistory] = useState<AnswerEntry[]>([]);
  const lastSavedAnswerRef = useRef<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const streamingEntry = useMemo<AnswerEntry | null>(() => {
    const trimmed = answer.trim();
    if (!trimmed || done) return null;

    return {
      id: "streaming",
      question: searchQuery.query,
      content: trimmed,
      sourceLinks: searchQuery.sourceLinks,
      isStreaming: true,
    };
  }, [answer, done, searchQuery]);

  const answerEntries = useMemo(() => {
    const entries = [...answerHistory];
    const trimmed = answer.trim();

    if (streamingEntry) {
      entries.push(streamingEntry);
    } else if (done && trimmed) {
      const lastContent = entries[entries.length - 1]?.content;
      if (lastContent !== trimmed) {
        entries.push({
          id: "pending-final",
          question: searchQuery.query,
          content: trimmed,
          sourceLinks: searchQuery.sourceLinks,
        });
      }
    }

    return entries;
  }, [answer, answerHistory, done, searchQuery, streamingEntry]);

  useEffect(() => {
    if (!done) return;

    const trimmed = answer.trim();
    if (!trimmed || lastSavedAnswerRef.current === trimmed) {
      return;
    }

    setAnswerHistory((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        question: searchQuery.query,
        content: trimmed,
        sourceLinks: searchQuery.sourceLinks,
      },
    ]);

    lastSavedAnswerRef.current = trimmed;
  }, [answer, done, searchQuery]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim() && !sending) {
      handleSend();
    }
  };

  const handleSend = () => {
    const value = input.trim();
    if (!value || sending) return;
    onSend(value);
    setInput("");
  };

  const handleResetClick = () => {
    setAnswerHistory([]);
    lastSavedAnswerRef.current = "";
    onReset();
  };

  const hasAnswers = answerEntries.length > 0;

  return (
    <div className="relative min-h-[100dvh]">
      {/* Two-column layout */}
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 pb-36 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
        {/* Left: AI answers */}
        <div className="min-w-0 space-y-8">
          {!hasAnswers ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 text-sm text-zinc-400">
              Responses will appear here.
            </div>
          ) : (
            answerEntries.map((entry, index) => (
              <article
                key={`${entry.id}-${index}`}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-sm shadow-black/20 backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-blue-500">
                      Answer {index + 1}
                    </div>
                    <h2 className="mt-2 break-words text-lg font-semibold leading-7 text-white">
                      {entry.question || "Answer"}
                    </h2>
                  </div>
                  {entry.isStreaming && (
                    <IconLoader2 className="h-5 w-5 animate-spin text-blue-400" />
                  )}
                </div>

                <div className="prose prose-invert mt-4 max-w-none break-words text-base leading-7">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {injectSourceLinks(entry.content, entry.sourceLinks)}
                  </ReactMarkdown>
                </div>

                {entry.sourceLinks.length > 0 && (
                  <div className="mt-5 border-t border-zinc-800 pt-4">
                    <div className="text-xs uppercase tracking-wide text-blue-500">
                      Sources
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-400">
                      {entry.sourceLinks.map((link, linkIndex) => (
                        <li key={`${entry.id}-source-${linkIndex}`}>
                          [{linkIndex + 1}]{" "}
                          <a
                            className="text-blue-400 hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                            href={link}
                          >
                            {formatSourceLabel(link)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        {/* Right: message history */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div className="mb-2 text-sm uppercase tracking-wide text-zinc-400">
              Your Messages
            </div>
            {userMessages?.length ? (
              <div className="flex-1">
                <ul className="max-h-[60vh] space-y-3 overflow-auto pr-1">
                  {userMessages.map((message, index) => (
                    <li
                      key={`${message}-${index}`}
                      className="rounded-xl bg-zinc-900/60 p-3"
                    >
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        Question {index + 1}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
                        {message}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-sm text-zinc-500">No messages yet</div>
            )}
            {done && hasAnswers && (
              <button
                className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-blue-500 px-4 hover:bg-blue-600"
                onClick={handleResetClick}
              >
                <IconReload size={18} />
                <span className="ml-2">Ask New Question</span>
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Bottom composer */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-800 bg-neutral-950/70 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/40">
        <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or continue the chat..."
              className="flex-1 rounded-xl border border-zinc-800 bg-neutral-900 px-4 py-3 outline-none placeholder:text-zinc-500"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="inline-flex items-center rounded-xl bg-blue-500 px-4 py-3 text-sm font-medium hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconSend size={16} />
              )}
              <span className="ml-2">{sending ? "Sending..." : "Send"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const injectSourceLinks = (content: string, sourceLinks: string[]) => {
  return content.replace(/\[(\d+)\]/g, (match, indexStr) => {
    const linkIndex = parseInt(indexStr, 10) - 1;
    const link = sourceLinks[linkIndex];
    if (!link) return match;
    return `[${indexStr}](${link})`;
  });
};

const formatSourceLabel = (url: string) => {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
};

const MarkdownCodeBlock: NonNullable<Components["code"]> = ({
  inline,
  className,
  children,
  ...props
}) => {
  const isPromptBlock = !inline && className?.includes("language-prompt");
  const [copied, setCopied] = useState(false);
  const codeContent = String(children ?? "").replace(/\n$/, "");

  useEffect(() => {
    if (!copied) return;
    const timeoutId = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeoutId);
  }, [copied]);

  const handleCopy = async () => {
    if (!isPromptBlock || !codeContent) return;

    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        console.warn("Clipboard API is not available.");
        return;
      }
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
    } catch (error) {
      console.error("Failed to copy prompt:", error);
    }
  };

  if (inline) {
    return (
      <code
        className="rounded bg-zinc-800 px-1.5 py-[1px] text-sm"
        {...props}
      >
        {children}
      </code>
    );
  }

  if (isPromptBlock) {
    return (
      <div className="group relative">
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-0 top-0 inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-200 shadow hover:bg-zinc-800 focus:outline-none focus-visible:ring focus-visible:ring-blue-500"
        >
          {copied ? "Copied!" : "Copy Prompt"}
        </button>
        <pre className="overflow-auto rounded-xl bg-zinc-900 p-4 pr-24">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  }

  return (
    <pre className="overflow-auto rounded-xl bg-zinc-900 p-4">
      <code className={className} {...props}>
        {children}
      </code>
    </pre>
  );
};

const markdownComponents: Components = {
  a: ({ node, href, ...props }) => {
    const isAnchorLink = href?.startsWith("#") ?? false;
    return (
      <a
        href={href}
        target={isAnchorLink ? undefined : "_blank"}
        rel={isAnchorLink ? undefined : "noopener noreferrer"}
        className="text-blue-400 hover:underline"
        {...props}
      />
    );
  },
  code: MarkdownCodeBlock,
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-800" {...props} />
    </div>
  ),
};

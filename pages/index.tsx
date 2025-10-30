import { Answer } from "@/components/Answer";
import { Search } from "@/components/Search";
import type { SearchQuery, Source } from "@/types";
import Head from "next/head";
import { useCallback, useState } from "react";

const defaultQuery: SearchQuery = { query: "", sourceLinks: [] };

export default function Home() {
  const [searchQuery, setSearchQuery] = useState<SearchQuery>(defaultQuery);
  const [answer, setAnswer] = useState<string>("");
  const [done, setDone] = useState<boolean>(false);
  const [userMessages, setUserMessages] = useState<string[]>([]);
  const [sending, setSending] = useState<boolean>(false);
  const [chatActive, setChatActive] = useState<boolean>(false);

  const handleSearchResult = useCallback((result: SearchQuery) => {
    setSearchQuery(result);
    setUserMessages((prev) => [...prev, result.query]);
    setAnswer("");
    setDone(false);
    setSending(true);
    setChatActive(true);
  }, []);

  const handleAnswerUpdate = useCallback((value: string) => {
    setChatActive(true);
    setAnswer((prev) => prev + value);
    if (value === "Error") {
      setDone(true);
      setSending(false);
    }
  }, []);

  const handleDone = useCallback((isDone: boolean) => {
    setDone(isDone);
    setSending(false);
  }, []);

  const handleReset = useCallback(() => {
    setAnswer("");
    setSearchQuery(defaultQuery);
    setDone(false);
    setUserMessages([]);
    setSending(false);
    setChatActive(false);
    sessionStorage.setItem("sid", "");
  }, []);

  const getSid = () => {
    let sid = sessionStorage.getItem("sid");
    if (!sid) {
      sid = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) + Date.now();
      sessionStorage.setItem("sid", sid);
    }
    return sid;
  };

  const handleFollowUp = useCallback(async (message: string) => {
    const prompt = message.trim();
    if (!prompt) return;

    setUserMessages((prev) => [...prev, prompt]);
    setAnswer("");
    setDone(false);
    setSending(true);
    setChatActive(true);
    setSearchQuery({ query: prompt, sourceLinks: [] });

    try {
      const sourcesResponse = await fetch("/api/sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: prompt }),
      });

      if (!sourcesResponse.ok) {
        throw new Error(sourcesResponse.statusText);
      }

      const { sources }: { sources: Source[] } = await sourcesResponse.json();
      const sourceLinks = sources.map((source) => source.url);

      setSearchQuery({ query: prompt, sourceLinks });

      const sid = getSid();
      const answerResponse = await fetch("/api/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": sid,
        },
        body: JSON.stringify({ prompt, apiKey: "" }),
      });

      if (!answerResponse.ok || !answerResponse.body) {
        throw new Error(answerResponse.statusText);
      }

      const reader = answerResponse.body.getReader();
      const decoder = new TextDecoder();
      let doneReading = false;

      while (!doneReading) {
        const { value, done: readerDone } = await reader.read();
        doneReading = readerDone;
        if (value) {
          const chunkValue = decoder.decode(value, { stream: !readerDone });
          setAnswer((prev) => prev + chunkValue);
        }
      }

      const remaining = decoder.decode();
      if (remaining) {
        setAnswer((prev) => prev + remaining);
      }

      setDone(true);
    } catch (error) {
      console.error(error);
      setAnswer("Error");
      setDone(true);
    } finally {
      setSending(false);
    }
  }, []);

  return (
    <>
      <Head>
        <title>Better Prompt</title>
        <meta name="description" content="AI-powered Prompt." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
      </Head>
      <div className="h-screen overflow-auto bg-[#18181C] text-[#D4D4D8]">
        {chatActive ? (
          <Answer
            searchQuery={searchQuery}
            answer={answer}
            done={done}
            onReset={handleReset}
            userMessages={userMessages}
            onSend={handleFollowUp}
            sending={sending}
          />
        ) : (
          <Search
            onSearch={handleSearchResult}
            onAnswerUpdate={handleAnswerUpdate}
            onDone={handleDone}
          />
        )}
      </div>
    </>
  );
}

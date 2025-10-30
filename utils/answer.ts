import { OpenAIModel } from "@/types";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export const OpenAIStream = async (prompt: string, apiKey: string, sid: string) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch(`${process.env.N8N_CHAT_COMPLETIONS_URL}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.N8N_BEARER} || ${apiKey}`,
      "X-Session-Id": sid,
    },
    method: "POST",
    body: JSON.stringify({
      model: OpenAIModel.DAVINCI_TURBO,
      messages: [
        { role: "system", content: "You are a helpful assistant that accurately answers the user's queries based on the given text." },
        { role: "user", content: prompt }
      ],
      max_tokens: 120,
      temperature: 0.0,
      stream: true
    })
  });

  if (res.status !== 200) {
    throw new Error("OpenAI API returned an error");
  }

  // 内容类型用于分支：SSE / JSON / 纯文本
  const ct = res.headers.get("content-type") || "";

  // —— 情况 1：OpenAI 兼容的 SSE —— //
  if (ct.includes("text/event-stream")) {
    const stream = new ReadableStream({
      async start(controller) {
        const onParse = (event: ParsedEvent | ReconnectInterval) => {
          if (event.type !== "event") return;
          const data = event.data;
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            // 兼容 OpenAI SSE 帧
            const json = JSON.parse(data);
            const text = json?.choices?.[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            // 有些服务会发非 JSON 的 data 片段
            controller.enqueue(encoder.encode(data));
          }
        };

        const parser = createParser(onParse);
        const reader = res.body!.getReader();

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            parser.feed(decoder.decode(value, { stream: true }));
          }
        } catch (e) {
          controller.error(e);
        } finally {
          controller.close();
        }
      },
    });
    return stream;
  }

  // —— 情况 2：一次性 JSON（非流） —— //
  if (ct.includes("application/json")) {
    const json = await res.json();
    // 兼容 OpenAI 格式或你自定义的格式
    const text =
      json?.choices?.[0]?.message?.content ??
      json?.choices?.[0]?.delta?.content ??
      json?.content ??
      JSON.stringify(json);

    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    });
  }

  // —— 情况 3：纯文本（可能是 chunked 也可能一次性） —— //
  // 这里做一个“直接透传”的 reader → controller 复制
  if (res.body) {
    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) controller.enqueue(value);
          }
        } catch (e) {
          controller.error(e);
        } finally {
          controller.close();
        }
      },
    });
    return stream;
  }

  // 兜底
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(""));
      controller.close();
    },
  });
};

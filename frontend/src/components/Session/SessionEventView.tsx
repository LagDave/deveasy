import type { SessionEvent } from "../../hooks/useSession";

/**
 * Renders a single stream-json event. Known event types (user/assistant text,
 * tool-use, tool-result, result) get a structured view; anything unknown falls
 * back to a raw <pre> so CLI schema drift never loses information (§ risk: drift).
 */

interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
  tool_use_id?: string;
  is_error?: boolean;
}

function extractBlocks(event: SessionEvent): ContentBlock[] {
  const message = event.message as { content?: unknown } | undefined;
  const content = message?.content;
  if (Array.isArray(content)) return content as ContentBlock[];
  return [];
}

function RawFallback({ event }: { event: SessionEvent }) {
  return (
    <div className="session-event raw">
      <span className="eyebrow">{event.type ?? "unknown"}</span>
      <pre>{JSON.stringify(event, null, 2)}</pre>
    </div>
  );
}

function TextBlock({ text, role }: { text: string; role: string }) {
  return (
    <div className={`session-bubble ${role}`}>
      <span className="eyebrow">{role}</span>
      <p className="session-text">{text}</p>
    </div>
  );
}

function ToolUseBlock({ block }: { block: ContentBlock }) {
  return (
    <div className="session-event tool-use">
      <span className="eyebrow">tool · {block.name ?? "unknown"}</span>
      <pre>{JSON.stringify(block.input ?? {}, null, 2)}</pre>
    </div>
  );
}

function ToolResultBlock({ block }: { block: ContentBlock }) {
  const body =
    typeof block.content === "string" ? block.content : JSON.stringify(block.content, null, 2);
  return (
    <div className={`session-event tool-result${block.is_error ? " error" : ""}`}>
      <span className="eyebrow">tool result{block.is_error ? " · error" : ""}</span>
      <pre>{body}</pre>
    </div>
  );
}

export function SessionEventView({ event }: { event: SessionEvent }) {
  const role = event.type === "assistant" ? "assistant" : event.type === "user" ? "user" : "system";

  if (event.type === "assistant" || event.type === "user") {
    const blocks = extractBlocks(event);
    if (blocks.length === 0) return <RawFallback event={event} />;
    return (
      <>
        {blocks.map((block, i) => {
          if (block.type === "text" && typeof block.text === "string") {
            return <TextBlock key={i} text={block.text} role={role} />;
          }
          if (block.type === "tool_use") return <ToolUseBlock key={i} block={block} />;
          if (block.type === "tool_result") return <ToolResultBlock key={i} block={block} />;
          return <RawFallback key={i} event={block as SessionEvent} />;
        })}
      </>
    );
  }

  // result / system / error / unknown event types -> raw fallback.
  return <RawFallback event={event} />;
}

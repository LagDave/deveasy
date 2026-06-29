import { useEffect, useRef } from "react";
import type { SessionEvent } from "../../hooks/useSession";
import { SessionEventView } from "./SessionEventView";

/**
 * Renders the accumulated event stream and auto-scrolls to the latest as it grows.
 * A component renders; the hook owns the data (Constitution §13.3).
 */
export function SessionTranscript({ events }: { events: SessionEvent[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  if (events.length === 0) {
    return <p className="muted">No messages yet. Send a turn to start the conversation.</p>;
  }

  return (
    <div className="session-transcript">
      {events.map((event, i) => (
        <SessionEventView key={i} event={event} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

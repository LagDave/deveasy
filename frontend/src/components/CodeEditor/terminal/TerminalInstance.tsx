import { useTerminalSocket } from "../../../hooks/useTerminalSocket";

/** One live terminal: a container the xterm.js instance attaches to (logic in the hook). */
interface Props {
  terminalId: string;
}

export function TerminalInstance({ terminalId }: Props) {
  const containerRef = useTerminalSocket(terminalId);
  return <div ref={containerRef} className="h-full w-full overflow-hidden bg-[#0b0b0b] p-2" />;
}

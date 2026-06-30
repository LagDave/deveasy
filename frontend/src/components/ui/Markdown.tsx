import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders Claude's markdown into the DevEasy dark theme. Element renderers are
 * styled by hand (no typography plugin) so code, lists, headings, and links match
 * the rest of the UI. Used for assistant messages.
 */
const components: Components = {
  h1: ({ children }) => <h1 className="mb-2 mt-3 font-mono text-lg font-semibold tracking-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-3 font-mono text-base font-semibold tracking-tight">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-3 font-mono text-sm font-semibold tracking-tight text-ink">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1 mt-2 font-mono text-xs font-semibold uppercase tracking-wide text-muted">{children}</h4>,
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-faint">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-faint">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2 hover:opacity-80">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-line-strong pl-3 text-muted">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-line" />,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-line bg-bg p-3 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) return <code className="font-mono text-xs">{children}</code>;
    return (
      <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[0.85em] text-accent">{children}</code>
    );
  },
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-line px-2 py-1 text-left font-mono text-xs text-muted">{children}</th>,
  td: ({ children }) => <td className="border border-line px-2 py-1">{children}</td>,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

import { useState } from "react";
import { Icon } from "../ui/Icon";
import { formatChoiceAnswer, type WizardQuestion } from "./wizardProtocol";

/**
 * Renders a parsed wizard question as interactive controls — single (buttons),
 * multi (checkboxes + confirm), or text (input + send) — and reports the
 * human-readable answer up via onSubmit. Disables itself once answered so a
 * question is never answered twice (§13.2: rendering only, no fetch).
 */
export function WizardChoice({
  question,
  onSubmit,
}: {
  question: WizardQuestion;
  onSubmit: (answerText: string) => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [other, setOther] = useState("");

  const submit = (values: string[], typed?: string) => {
    if (submitted) return;
    const answer =
      question.type === "text"
        ? formatChoiceAnswer(question, [typed ?? ""])
        : typed
          ? `${typed} [${question.id}=other]`
          : formatChoiceAnswer(question, values);
    setSubmitted(true);
    onSubmit(answer);
  };

  const toggle = (value: string) => {
    setChecked((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  return (
    <div className="surface mt-3 flex flex-col gap-3 px-4 py-3.5">
      <p className="m-0 text-sm font-medium text-ink">{question.prompt}</p>

      {question.type === "single" && (
        <div className="flex flex-col gap-2">
          {question.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={submitted}
              onClick={() => submit([opt.value])}
              className="card-hover surface-2 flex flex-col items-start gap-0.5 px-3.5 py-2.5 text-left disabled:opacity-50"
            >
              <span className="text-sm text-ink">{opt.label}</span>
              {opt.hint && <span className="text-xs text-faint">{opt.hint}</span>}
            </button>
          ))}
        </div>
      )}

      {question.type === "multi" && (
        <div className="flex flex-col gap-2">
          {question.options.map((opt) => (
            <label
              key={opt.value}
              className={`surface-2 flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5 ${submitted ? "opacity-50" : "card-hover"}`}
            >
              <input
                type="checkbox"
                disabled={submitted}
                checked={checked.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="mt-0.5 accent-accent"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm text-ink">{opt.label}</span>
                {opt.hint && <span className="text-xs text-faint">{opt.hint}</span>}
              </span>
            </label>
          ))}
          <button
            type="button"
            disabled={submitted || checked.length === 0}
            onClick={() => submit(checked)}
            className="btn btn-primary self-start"
          >
            <Icon name="send" size={14} />
            Confirm selection
          </button>
        </div>
      )}

      {question.type === "text" && (
        <TextReply disabled={submitted} onSend={(value) => submit([value], value)} />
      )}

      {question.allowOther && question.type !== "text" && (
        <div className="border-t border-line pt-3">
          <span className="eyebrow mb-1.5 block">Or type your own</span>
          <TextReply
            disabled={submitted}
            value={other}
            onChange={setOther}
            onSend={(value) => submit([], value)}
          />
        </div>
      )}
    </div>
  );
}

/** Small free-text input + send button shared by the text and "other" branches. */
function TextReply({
  disabled,
  value,
  onChange,
  onSend,
}: {
  disabled: boolean;
  value?: string;
  onChange?: (next: string) => void;
  onSend: (value: string) => void;
}) {
  const [internal, setInternal] = useState("");
  const controlled = value !== undefined;
  const text = controlled ? value : internal;
  const setText = controlled ? (onChange ?? (() => {})) : setInternal;
  const trimmed = text.trim();

  return (
    <div className="flex items-center gap-2">
      <input
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && trimmed) {
            e.preventDefault();
            onSend(trimmed);
          }
        }}
        placeholder="Type your answer…"
        className="field flex-1"
      />
      <button
        type="button"
        disabled={disabled || !trimmed}
        onClick={() => onSend(trimmed)}
        className="btn btn-primary"
      >
        <Icon name="send" size={14} />
        Send
      </button>
    </div>
  );
}

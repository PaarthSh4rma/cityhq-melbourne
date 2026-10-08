"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { request } from "@/lib/api";
import type { Reply, View } from "@/lib/types";
export default function Operator({
  navigate,
  onClose,
  open = true,
}: {
  navigate: (view: View) => void;
  onClose: () => void;
  open?: boolean;
}) {
  const [messages, setMessages] = useState<
    { question: string; reply?: Reply; error?: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => previous?.focus();
  }, [open]);
  useEffect(() => () => controller.current?.abort(), []);
  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { question }]);
    controller.current = new AbortController();
    const timeout = setTimeout(() => controller.current?.abort(), 30000);
    try {
      const reply = await request<Reply>(
        "/operator",
        controller.current.signal,
        { question },
      );
      setMessages((m) =>
        m.map((v, i) => (i === m.length - 1 ? { ...v, reply } : v)),
      );
    } catch {
      setMessages((m) =>
        m.map((v, i) =>
          i === m.length - 1
            ? {
                ...v,
                error:
                  "Unable to reach CityHQ. Please retry when the API is available.",
              }
            : v,
        ),
      );
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }
  return (
    <div
      className="operator-panel"
      style={{ display: open ? undefined : "none" }}
      role="region"
      aria-label="CITYHQ Operator"
      ref={panel}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} /> GROUNDED INTELLIGENCE
          </span>
          <h2>CITYHQ Operator</h2>
        </div>
        <button onClick={onClose} aria-label="Close operator">
          <X size={18} />
        </button>
      </div>
      <p className="muted">
        Ask your city signals. Deterministic queries, sourced answers.
      </p>
      <div className="suggestions">
        {[
          "What’s happening in Melbourne right now?",
          "Why is the activity score elevated?",
          "Which sources are unavailable?",
          "What is the forecast based on?",
        ].map((q) => (
          <button key={q} disabled={busy} onClick={() => ask(q)}>
            {q}
          </button>
        ))}
      </div>
      <div className="conversation" aria-live="polite">
        {messages.map((m, i) => (
          <article key={i}>
            <p className="question">{m.question}</p>
            <p>{m.reply?.answer || m.error || "Querying city signals…"}</p>
            {m.reply && (
              <>
                <div className="caption">
                  {m.reply.references.map((r, i) => (
                    <span key={i}>
                      {r.source} · {r.status}{" "}
                    </span>
                  ))}
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate(m.reply!.navigation as View)}
                >
                  Open relevant view →
                </button>
              </>
            )}
          </article>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <label className="sr-only" htmlFor="operator-question">
          Ask CityHQ
        </label>
        <input
          id="operator-question"
          maxLength={1000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about Melbourne…"
        />
        <button disabled={busy || !input.trim()} aria-label="Send question">
          <ArrowUp size={19} />
        </button>
      </form>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => setMessages([])}
      >
        Clear conversation
      </button>
    </div>
  );
}

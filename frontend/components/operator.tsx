"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { melbourneTime, request } from "@/lib/api";
import { validateAction, VIEWS, type Action } from "@/lib/commands";
import type { Reply, View } from "@/lib/types";
export function OperatorCore({ state = "standby" }: { state?: string }) {
  return (
    <div
      className={`operator-core ${state === "querying" ? "processing" : ""}`}
      aria-hidden="true"
    >
      <div className="core-orbit orbit-a" />
      <div className="core-orbit orbit-b" />
      <div className="core-orbit orbit-c" />
      <div className="core-nucleus">
        <Sparkles size={21} />
      </div>
      <i />
      <i />
      <i />
    </div>
  );
}
export default function Operator({
  navigate,
  onClose,
  onAction,
  open = true,
}: {
  navigate: (view: View) => void;
  onClose: () => void;
  onAction?: (action: Action) => void;
  open?: boolean;
}) {
  const [messages, setMessages] = useState<
    { question: string; reply?: Reply; error?: string; actions?: Action[] }[]
  >([]);
  const [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [state, setState] = useState("standby");
  const controller = useRef<AbortController | null>(null),
    panel = useRef<HTMLDivElement>(null),
    end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => previous?.focus();
  }, [open]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (open) end.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages, open]);
  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setInput("");
    setBusy(true);
    setState("querying");
    setMessages((m) => [...m.slice(-29), { question }]);
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 30000);
    try {
      const reply = await request<Reply>("/operator", abort.signal, {
        question,
      });
      const actions = (Array.isArray(reply.actions) ? reply.actions : [])
        .map(validateAction)
        .filter((a): a is Action => a !== null);
      setMessages((m) =>
        m.map((v, i) => (i === m.length - 1 ? { ...v, reply, actions } : v)),
      );
      actions.forEach((a) => onAction?.(a));
      setState("response ready");
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
      setState("connection error");
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
            <Sparkles size={14} /> CITY INTERFACE / 01
          </span>
          <h2>CITYHQ Operator</h2>
        </div>
        <button onClick={onClose} aria-label="Close operator">
          <X size={18} />
        </button>
      </div>
      <div className="operator-identity">
        <OperatorCore state={state} />
        <div>
          <span className="eyebrow">{state.toUpperCase()}</span>
          <p>
            Your city.
            <br />
            <strong>Within reach.</strong>
          </p>
        </div>
      </div>
      <p className="caption">
        Grounded, deterministic queries. Validated map and dashboard controls.
        No external language-model service.
      </p>
      <div className="suggestions">
        {[
          "Show Melbourne Park",
          "Compare last six hours",
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
      <div
        className="conversation"
        role="log"
        aria-label="Operator transcript"
        aria-live="polite"
        aria-busy={busy}
      >
        {messages.map((m, i) => (
          <article key={i}>
            <p className="question">{m.question}</p>
            <p>{m.reply?.answer || m.error || "Querying city signals…"}</p>
            {m.reply && (
              <>
                <div className="operator-actions">
                  {m.actions?.map((action, j) => (
                    <span className="badge" key={j}>
                      {action.type.replaceAll("_", " ")}
                      {onAction ? " · applied" : " · available"}
                    </span>
                  ))}
                </div>
                <details>
                  <summary>Sources & supporting data</summary>
                  {m.reply.references.map((r, j) => (
                    <div className="source-reference" key={j}>
                      <strong>
                        {r.source} · {r.status}
                        {r.origin_status === "demo" ? " · DEMO" : ""}
                      </strong>
                      <p>
                        Observed {melbourneTime(r.observed_at)} · retrieved{" "}
                        {melbourneTime(r.fetched_at)}
                        {r.stale ? " · STALE" : ""}
                      </p>
                      {r.limitations?.map((l) => (
                        <p key={l}>{l}</p>
                      ))}
                    </div>
                  ))}
                  {!m.reply.references.length && (
                    <p className="caption">
                      {m.reply.intent === "map_focus"
                        ? "Verified geographic catalogue; no live activity claim."
                        : "No live source references for this query. Inspect the returned metadata below."}
                    </p>
                  )}
                  <pre>
                    {JSON.stringify(
                      m.reply.supporting_data || {},
                      null,
                      2,
                    ).slice(0, 12000)}
                  </pre>
                </details>
                {VIEWS.includes(m.reply.navigation as View) && (
                  <button
                    className="text-button"
                    onClick={() => navigate(m.reply!.navigation as View)}
                  >
                    Open relevant view →
                  </button>
                )}
              </>
            )}
          </article>
        ))}
        <div ref={end} />
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
          placeholder="Ask, focus, compare…"
        />
        <button disabled={busy || !input.trim()} aria-label="Send question">
          <ArrowUp size={19} />
        </button>
      </form>
      <div className="operator-footer">
        <span className="caption">SESSION ONLY · NO CHAT STORAGE</span>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            setMessages([]);
            setState("standby");
          }}
        >
          Clear conversation
        </button>
      </div>
    </div>
  );
}

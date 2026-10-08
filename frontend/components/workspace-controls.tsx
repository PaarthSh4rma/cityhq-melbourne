"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Command, Search, X } from "lucide-react";
import { PLACES } from "@/lib/geography";
import { VIEWS, type Action } from "@/lib/commands";
import type { Meta } from "@/lib/types";
function Dialog({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (open && !d?.open) d?.showModal();
    if (!open && d?.open) d.close();
    return () => {
      if (d?.open) d.close();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="workspace-dialog"
      aria-label={label}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
export function CommandPalette({
  open,
  onClose,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  onAction: (action: Action) => void;
}) {
  const [query, setQuery] = useState("");
  const commands: { label: string; action: Action }[] = [
    ...VIEWS.map((view) => ({
      label: `Open ${view}`,
      action: { type: "navigate_dashboard" as const, view },
    })),
    ...PLACES.map((place) => ({
      label: `Focus ${place.label}`,
      action: { type: "focus_map_location" as const, location: place.id },
    })),
    {
      label: "Compare last six hours",
      action: { type: "select_time_range", hours: 6 },
    },
  ];
  return (
    <Dialog open={open} onClose={onClose} label="Command palette">
      <div className="panel-heading">
        <span className="eyebrow">
          <Command size={15} /> CITY COMMANDS
        </span>
        <button onClick={onClose} aria-label="Close command palette">
          <X size={18} />
        </button>
      </div>
      <label className="command-search">
        <Search size={18} />
        <input
          autoFocus
          aria-label="Search commands"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a place or workspace…"
        />
      </label>
      <div className="command-results">
        {commands
          .filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
          .map((c) => (
            <button
              key={c.label}
              onClick={() => {
                onAction(c.action);
                onClose();
                setQuery("");
              }}
            >
              {c.label}
              <span>↵</span>
            </button>
          ))}
      </div>
      <p className="caption">
        ⌘ / Ctrl K to open · Escape to close · Tab to select
      </p>
    </Dialog>
  );
}
export function BootSequence({
  sources,
  reduced,
  replay,
  onDone,
}: {
  sources: { name: string; meta?: Meta; error: string | null }[];
  reduced: boolean;
  replay: number;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (reduced) return;
    const first = !sessionStorage.getItem("cityhq-boot-seen");
    if (!first && !replay) return;
    sessionStorage.setItem("cityhq-boot-seen", "yes");
    const start = setTimeout(() => setOpen(true), 0),
      end = setTimeout(() => {
        setOpen(false);
        onDone?.();
      }, 2800);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
  }, [replay, reduced, onDone]);
  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      label="CityHQ connection briefing"
    >
      <div className="boot-mark">
        <Command size={42} />
      </div>
      <span className="eyebrow">CITYHQ // MELBOURNE</span>
      <h2>Establishing city context.</h2>
      <p>Current connection state. Missing feeds stay visible.</p>
      <div className="boot-sources">
        {sources.map((s) => (
          <div key={s.name}>
            <span>{s.name}</span>
            <strong>
              {s.error
                ? "API unreachable"
                : s.meta?.stale
                  ? "stale capture"
                  : s.meta?.status || "Checking source…"}
            </strong>
          </div>
        ))}
      </div>
      <button autoFocus onClick={() => setOpen(false)}>
        Enter workspace / Skip
      </button>
    </Dialog>
  );
}

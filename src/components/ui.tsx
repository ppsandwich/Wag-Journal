import { useEffect, useId, useRef } from "react";
import type { ReactNode, FormEvent } from "react";
import {
  Footprints,
  Droplets,
  Utensils,
  Volleyball,
  GraduationCap,
  House,
  Moon,
  ArrowUpRight,
  X,
} from "lucide-react";
import type { Activity } from "../lib/domain";
export const activityIcons = {
  outside: Footprints,
  potty: Droplets,
  meal: Utensils,
  play: Volleyball,
  training: GraduationCap,
  crate: House,
  sleep: Moon,
};
export function ActivityIcon({
  type,
  size = 24,
}: {
  type: Activity;
  size?: number;
}) {
  const Icon = activityIcons[type];
  return (
    <span className={`activity-icon ${type}`}>
      <Icon size={size} strokeWidth={1.65} aria-hidden="true" />
    </span>
  );
}
export function Puppy({ size = 100 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M27 101c-5-23 7-43 32-43h20c24 0 39 16 34 41l-5 15H32z"
        fill="#E5EDE4"
      />
      <g
        stroke="#355C49"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M43 47c-4-20-21-11-22 7s6 20 16 9m66-16c4-20 21-11 22 7s-6 20-16 9"
          fill="#F4DFD2"
        />
        <path
          d="M43 41q29-22 58 0l6 31c0 18-12 28-35 28S37 90 37 72z"
          fill="#FFFDF8"
        />
        <path d="M64 73q8 9 16 0M72 80v8m-9 0q9 6 18 0M45 107l-4 17m54-17 6 17M26 94q-15-10-13-25" />
        <path d="M53 59h1m36 0h1" strokeWidth="5" />
      </g>
      <path
        d="M112 22l4-7m3 16 8-1"
        stroke="#9A7450"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="modal-heading">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Puppy size={94} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function SectionTitle({
  title,
  aside,
}: {
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {aside}
    </div>
  );
}
export function LinkButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
      <ArrowUpRight size={16} />
    </button>
  );
}
export function submit(handler: (data: FormData) => Promise<void> | void) {
  return async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await handler(new FormData(e.currentTarget));
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("wag-error", {
          detail:
            error instanceof Error
              ? error.message
              : "The change could not be saved. Please try again.",
        }),
      );
    }
  };
}

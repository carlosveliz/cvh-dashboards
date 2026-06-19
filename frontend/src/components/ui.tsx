import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent ${className}`}
    />
  );
}

export function FullSpinner() {
  return (
    <div className="flex h-full min-h-[40vh] w-full items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-fg/20 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`card w-full ${width} p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl text-fg">{title}</h2>
          <button onClick={onClose} className="btn-ghost -mr-2 p-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const isExcel = type === "excel";
  return (
    <span
      className={`badge ${isExcel ? "bg-accent-soft text-accent" : "bg-primary-soft text-primary"}`}
    >
      {isExcel ? "Excel" : "HTML"}
    </span>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="mt-2 text-sm text-danger">{children}</p>;
}

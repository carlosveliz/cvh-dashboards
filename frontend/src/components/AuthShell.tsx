import type { ReactNode } from "react";

/** Dark institutional hero + glassmorphism card shared by all auth screens. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-institutional flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong w-full max-w-md p-8 text-white">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-5 inline-flex items-center rounded-2xl bg-white px-5 py-3 shadow-glow">
            <img src="/bionet-logo.png" alt="BioNet" className="h-10 w-auto" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-1 text-sm font-light text-dark-muted-fg">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

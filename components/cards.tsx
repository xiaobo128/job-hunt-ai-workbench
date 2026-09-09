import clsx from "clsx";

export function StatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-ink">{value}</div>
      <div className="mt-3 text-sm text-slate-500">{hint}</div>
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  className,
  children
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={clsx("rounded-3xl border border-line bg-white p-5 shadow-card", className)}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-accentSoft px-3 py-1 text-xs font-medium text-accent">
      {children}
    </span>
  );
}

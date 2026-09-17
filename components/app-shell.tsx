export function PageShell({
  title,
  description,
  action,
  children,
  className
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-5 ${className ?? ""}`}>
      <header className="border-b border-line pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">{description}</p>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </header>
      {children}
    </div>
  );
}

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
    <div className={`space-y-4 ${className ?? ""}`}>
      <header className="rounded-3xl border border-line bg-white/80 px-5 py-4 shadow-card backdrop-blur md:px-6 md:py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold leading-tight text-ink md:text-3xl">{title}</h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </header>
      {children}
    </div>
  );
}

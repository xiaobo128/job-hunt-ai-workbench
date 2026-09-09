function LoadingCard() {
  return <div className="h-32 animate-pulse rounded-3xl border border-line bg-white/70 shadow-card" />;
}

export default function Loading() {
  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-line bg-white/80 p-6 shadow-card backdrop-blur">
        <div className="h-5 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-48 animate-pulse rounded-2xl bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded-full bg-slate-100" />
        <div className="mt-2 h-4 w-full max-w-xl animate-pulse rounded-full bg-slate-100" />
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <LoadingCard />
        <LoadingCard />
      </div>
    </div>
  );
}

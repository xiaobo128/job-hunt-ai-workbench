import Link from "next/link";
import { redirectIfLoggedIn, registerUser } from "@/app/auth-actions";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await redirectIfLoggedIn();
  const { error } = await searchParams;

  return (
    <div className="rounded-[28px] border border-line bg-white/90 p-8 shadow-card backdrop-blur">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">求职工作台</div>
      <h1 className="mt-3 text-3xl font-semibold text-ink">创建账号</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        创建账号后，集中管理你的岗位、进度与候选人资料。
      </p>

      {error ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {error === "email_taken" ? "这个邮箱已经注册过了。" : "请填写有效信息，密码至少 6 位。"}
        </div>
      ) : null}

      <form action={registerUser} className="mt-6 space-y-4">
        <label className="block text-sm text-slate-600">
          昵称
          <input
            name="name"
            className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
            placeholder="例如：Wendy"
          />
        </label>
        <label className="block text-sm text-slate-600">
          邮箱
          <input
            name="email"
            type="email"
            required
            className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
            placeholder="例如：name@example.com"
          />
        </label>
        <label className="block text-sm text-slate-600">
          密码
          <input
            name="password"
            type="password"
            required
            className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
            placeholder="至少 6 位"
          />
        </label>
        <button className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">
          注册并进入工作台
        </button>
      </form>

      <div className="mt-6 text-sm text-slate-500">
        已有账号？{" "}
        <Link href="/login" className="text-accent underline-offset-4 hover:underline">
          去登录
        </Link>
      </div>
    </div>
  );
}

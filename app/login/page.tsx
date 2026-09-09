import Link from "next/link";
import { loginUser, redirectIfLoggedIn } from "@/app/auth-actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await redirectIfLoggedIn();
  const { error } = await searchParams;

  return (
    <div className="rounded-[28px] border border-line bg-white/90 p-8 shadow-card backdrop-blur">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">AI 求职中枢</div>
      <h1 className="mt-3 text-3xl font-semibold text-ink">登录求职工作台</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        先把账号体系跑通，后面再接真实 OCR、LLM 与云部署。当前版本支持邮箱加密码登录。
      </p>

      {error ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {error === "invalid_credentials" ? "邮箱或密码不正确。" : "登录失败，请检查输入。"}
        </div>
      ) : null}

      <form action={loginUser} className="mt-6 space-y-4">
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
        <button className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">登录</button>
      </form>

      <div className="mt-4 rounded-2xl bg-panel px-4 py-3 text-sm text-slate-600">
        演示账号：`demo@jobworkbench.local` / `demo123456`
      </div>

      <div className="mt-6 text-sm text-slate-500">
        还没有账号？{" "}
        <Link href="/register" className="text-accent underline-offset-4 hover:underline">
          去注册
        </Link>
      </div>
    </div>
  );
}

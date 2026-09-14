"use client";

import { useMemo, useState } from "react";
import { agentHandoffTasks, buildAgentHandoff, type AgentHandoffInput, type AgentHandoffTask } from "@/lib/agent-handoff-client";

export function AgentHandoffPanel({ input }: { input: AgentHandoffInput }) {
  const [task, setTask] = useState<AgentHandoffTask>("interview");
  const [message, setMessage] = useState<string | null>(null);
  const handoff = useMemo(() => buildAgentHandoff(input, task), [input, task]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`已复制${label}`);
    } catch {
      setMessage("复制失败，请检查浏览器剪贴板权限。");
    }
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-card">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">用 Agent 准备</h2>
        <p className="mt-1 text-sm text-slate-500">选择任务后复制，再粘贴到 Codex App。仅包含已确认或已保存的事实。</p>
      </div>
      <div className="space-y-3">
        <label className="block text-sm text-slate-600">
          任务
          <select value={task} onChange={(event) => setTask(event.target.value as AgentHandoffTask)} className="mt-2 h-10 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none">
            {agentHandoffTasks.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy(handoff.prompt, " Prompt")} className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white">Copy Prompt</button>
          <button type="button" onClick={() => copy(handoff.json, " JSON context")} className="inline-flex h-10 items-center justify-center rounded-xl border border-line px-4 text-sm font-medium text-ink">Copy JSON context</button>
          <button type="button" onClick={() => copy(handoff.markdown, " Markdown context")} className="inline-flex h-10 items-center justify-center rounded-xl border border-line px-4 text-sm font-medium text-ink">Copy Markdown context</button>
        </div>
        {message ? <p role="status" className="text-sm text-slate-500">{message}</p> : null}
        {handoff.context.dataQuality.warnings.length ? (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            <div className="font-medium">数据质量提示</div>
            <ul className="mt-1 list-disc pl-5">{handoff.context.dataQuality.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

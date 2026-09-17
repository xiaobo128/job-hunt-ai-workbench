"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { agentHandoffTasks, buildAgentHandoff, type AgentHandoffInput, type AgentHandoffTask } from "@/lib/agent-handoff-client";

export function AgentHandoffPanel({ input }: { input: AgentHandoffInput }) {
  const [task, setTask] = useState<AgentHandoffTask>("interview");
  const [message, setMessage] = useState<string | null>(null);
  const [copiedContext, setCopiedContext] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handoff = useMemo(() => buildAgentHandoff(input, task), [input, task]);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function copy(value: string, label: string, isPrimary = false) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`已复制${label}`);
      if (isPrimary) {
        setCopiedContext(true);
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setCopiedContext(false), 1800);
      }
    } catch {
      setMessage("复制失败，请检查浏览器剪贴板权限。");
    }
  }

  const warnings = handoff.context.dataQuality.warnings;
  const importantWarnings = warnings.filter((warning) => /没有可用的已确认|岗位公司名称|岗位名称|岗位职责|岗位要求/.test(warning));

  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-card">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">准备 AI 上下文</h2>
        <p className="mt-1 text-sm text-slate-500">将岗位、已确认简历、投递状态和相关通知整理成标准上下文，可直接交给 ChatGPT、Codex 或其他 Agent。</p>
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy(handoff.markdown, " AI Context", true)} className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white">{copiedContext ? "已复制" : "复制 AI Context"}</button>
          <details className="relative">
            <summary className="inline-flex h-10 cursor-pointer list-none items-center justify-center rounded-xl border border-line px-4 text-sm font-medium text-ink">更多 <span aria-hidden="true" className="ml-1">▾</span></summary>
            <div className="absolute right-0 z-10 mt-2 w-52 space-y-1 rounded-xl border border-line bg-white p-2 shadow-card">
              <button type="button" onClick={() => copy(handoff.markdown, " Markdown context")} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel">复制 Markdown</button>
              <button type="button" onClick={() => copy(handoff.json, " JSON context")} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel">复制 JSON</button>
              <button type="button" onClick={() => copy(handoff.prompt, "完整 Prompt")} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel">复制完整 Prompt</button>
              <label className="mt-1 block border-t border-line px-3 pt-2 text-xs text-slate-500">Prompt 任务
                <select value={task} onChange={(event) => setTask(event.target.value as AgentHandoffTask)} className="mt-1 h-8 w-full rounded-lg border border-line bg-panel px-2 text-sm text-ink">
                  {agentHandoffTasks.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            </div>
          </details>
        </div>
        {message ? <p role="status" className="text-sm text-slate-500">{message}</p> : null}
        {warnings.length ? (
          <div className="text-sm leading-6 text-slate-500">
            <p>上下文完整度：有 {warnings.length} 项缺失{importantWarnings.length ? `；重要缺失：${importantWarnings.join("；")}` : ""}</p>
            <details className="mt-1">
              <summary className="cursor-pointer text-slate-600">查看完整度详情</summary>
              <ul className="mt-1 list-disc pl-5">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </details>
          </div>
        ) : null}
      </div>
    </section>
  );
}

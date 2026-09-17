"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { agentHandoffTasks, buildAgentHandoff, type AgentHandoffInput, type AgentHandoffTask } from "@/lib/agent-handoff-client";

export function AgentHandoffPanel({ input }: { input: AgentHandoffInput }) {
  const [task, setTask] = useState<AgentHandoffTask>("interview");
  const [message, setMessage] = useState<string | null>(null);
  const [copiedContext, setCopiedContext] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const handoff = useMemo(() => buildAgentHandoff(input, task), [input, task]);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  useEffect(() => {
    if (!helpOpen) return;

    function closeHelpOnOutsidePointer(event: PointerEvent) {
      if (!helpRef.current?.contains(event.target as Node)) setHelpOpen(false);
    }

    function closeHelpOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setHelpOpen(false);
    }

    document.addEventListener("pointerdown", closeHelpOnOutsidePointer);
    document.addEventListener("keydown", closeHelpOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeHelpOnOutsidePointer);
      document.removeEventListener("keydown", closeHelpOnEscape);
    };
  }, [helpOpen]);

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
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">准备 AI 上下文</h2>
          <p className="mt-1 text-sm text-slate-500">将岗位、已确认简历、投递状态和相关通知整理成标准上下文，可直接交给 ChatGPT、Codex 或其他 Agent。</p>
        </div>
        <div
          ref={helpRef}
          className="relative shrink-0"
          onMouseEnter={() => setHelpOpen(true)}
          onMouseLeave={() => setHelpOpen(false)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setHelpOpen(false);
          }}
        >
          <button
            type="button"
            aria-label="如何使用 AI Context"
            aria-controls="agent-handoff-help"
            aria-expanded={helpOpen}
            onFocus={() => setHelpOpen(true)}
            onClick={() => setHelpOpen(true)}
            className="inline-flex size-8 cursor-help items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 10.5v5" strokeLinecap="round" />
              <path d="M12 7.5h.01" strokeLinecap="round" strokeWidth="2.5" />
            </svg>
          </button>
          {helpOpen ? (
            <div id="agent-handoff-help" role="tooltip" className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-line bg-white p-3 text-[13px] leading-5 text-slate-600 shadow-card">
              <p className="font-semibold text-ink">如何使用 AI Context</p>
              <p className="mt-2">“复制 AI Context”会整理当前岗位、已确认简历、投递状态和相关通知，适合直接粘贴到 ChatGPT、Codex 或其他 Agent 中继续分析。</p>
              <dl className="mt-3 space-y-2">
                <div>
                  <dt className="font-medium text-ink">AI Context</dt>
                  <dd>适合日常使用，直接粘贴给 ChatGPT / Codex。</dd>
                </div>
                <div>
                  <dt className="font-medium text-ink">JSON</dt>
                  <dd>适合 API、脚本或自动化 Agent。</dd>
                </div>
                <div>
                  <dt className="font-medium text-ink">完整 Prompt</dt>
                  <dd>在 AI Context 后附加当前任务要求，可直接让 AI 开始岗位分析、简历修改或面试准备。</dd>
                </div>
              </dl>
              <p className="mt-3 text-slate-500">“Prompt 任务”只影响“复制完整 Prompt”。</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy(handoff.markdown, " AI Context", true)} className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white">{copiedContext ? "已复制 AI Context" : "复制 AI Context"}</button>
          <details className="relative">
            <summary className="inline-flex h-10 cursor-pointer list-none items-center justify-center rounded-xl border border-line px-4 text-sm font-medium text-ink">更多 <span aria-hidden="true" className="ml-1">▾</span></summary>
            <div className="absolute right-0 z-10 mt-2 w-52 space-y-1 rounded-xl border border-line bg-white p-2 shadow-card">
              <button type="button" onClick={() => copy(handoff.json, " JSON context")} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel">复制 JSON</button>
              <button type="button" onClick={() => copy(handoff.prompt, "完整 Prompt")} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel">复制完整 Prompt</button>
              <label className="mt-1 block border-t border-line px-3 pt-2 text-xs text-slate-500">Prompt 任务
                <select value={task} onChange={(event) => setTask(event.target.value as AgentHandoffTask)} className="mt-1 h-8 w-full rounded-lg border border-line bg-panel px-2 text-sm text-ink">
                  {agentHandoffTasks.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <span className="mt-1 block text-[12px] text-slate-400">仅影响完整 Prompt</span>
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

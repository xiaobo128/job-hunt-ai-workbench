"use client";

import { TailorPendingButton, TailorPendingNotice } from "@/components/tailor-pending";

type Option = {
  id: string;
  label: string;
};

type Props = {
  jobs: Option[];
  resumes: Option[];
  createTailorAdvice: (formData: FormData) => Promise<void>;
  createTailorDraft: (formData: FormData) => Promise<void>;
  triggerExternalTailor: (formData: FormData) => Promise<void>;
  initialJobLeadId?: string;
  initialResumeId?: string;
};

export function TailorStartForm({
  jobs,
  resumes,
  createTailorAdvice,
  createTailorDraft,
  triggerExternalTailor,
  initialJobLeadId,
  initialResumeId
}: Props) {
  const isUnavailable = jobs.length === 0 || resumes.length === 0;
  const selectedJobLeadId = jobs.some((job) => job.id === initialJobLeadId) ? initialJobLeadId : jobs[0]?.id;
  const selectedResumeId = resumes.some((resume) => resume.id === initialResumeId) ? initialResumeId : resumes[0]?.id;

  return (
    <form className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm text-slate-600">
          目标岗位
          <select
            name="jobLeadId"
            defaultValue={selectedJobLeadId}
            className="mt-2 h-10 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none"
            disabled={jobs.length === 0}
          >
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-600">
          使用简历
          <select
            name="resumeId"
            defaultValue={selectedResumeId}
            className="mt-2 h-10 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none"
            disabled={resumes.length === 0}
          >
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm text-slate-600">
        个性化要求
        <textarea
          name="customInstructions"
          rows={4}
          className="mt-2 w-full rounded-2xl border border-line bg-panel px-3.5 py-3 text-sm leading-6 outline-none"
          placeholder="例如：删除期望城市 / 薪资；把项目经历放到教育经历前；强化 B 端产品和数据分析表达。"
        />
      </label>

      {isUnavailable ? (
        <div className="rounded-2xl bg-panel px-4 py-3 text-sm text-slate-600">
          需要先准备至少 1 个岗位和 1 份简历，才能发起微调。
        </div>
      ) : null}

      <div className="grid gap-2 md:grid-cols-3">
        <TailorPendingButton
          formAction={createTailorAdvice}
          idleText="生成匹配分析"
          pendingText="正在生成匹配分析..."
          className="w-full border border-line bg-white text-ink"
        />
        <TailorPendingButton
          formAction={triggerExternalTailor}
          idleText="交给外部 Agent"
          pendingText="正在发送给外部 Agent..."
          className="w-full border border-accent bg-white text-accent"
        />
        <TailorPendingButton
          formAction={createTailorDraft}
          idleText="生成完整草稿"
          pendingText="正在生成完整草稿..."
          className="w-full bg-accent text-white"
        />
      </div>

      <TailorPendingNotice text="正在处理本次微调请求，请稍候，不要重复点击。" />
    </form>
  );
}

import { CopyTextButton } from "@/components/copy-text-button";
import type { ResumeAnalysis } from "@/lib/resume-analysis";

const dimensions: Array<{ key: keyof ResumeAnalysis; title: string }> = [
  { key: "education", title: "教育背景" }, { key: "specialRequirements", title: "特殊要求" }, { key: "workExperience", title: "工作与实习经历" }, { key: "projectExperience", title: "项目经历" }, { key: "skills", title: "技能匹配" }, { key: "domainRelevance", title: "领域相关性" }, { key: "strengths", title: "综合优势" }
];

export function ResumeAnalysisView({ analysis, evidence }: { analysis: ResumeAnalysis; evidence: Record<keyof ResumeAnalysis, string[]> }) {
  return <div className="mt-3 space-y-3">{dimensions.map(({ key, title }) => {
    const dimension = analysis[key];
    const ratingText = dimension.rating === null ? "—" : `${"★".repeat(dimension.rating)}${"☆".repeat(5 - dimension.rating)}`;
    return <section key={key} className="rounded-2xl border border-line bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-medium text-ink">{title}</h3><span aria-label={dimension.rating === null ? "未评分" : `评分 ${dimension.rating} / 5`} className="text-sm tracking-wide text-amber-600">{ratingText}</span></div><AnalysisField label="差距" value={dimension.gap} /><AnalysisField label="建议" value={dimension.suggestion} copyable /><div className="mt-3"><div className="text-xs font-medium text-slate-500">简历证据</div><div className="mt-1 space-y-1 text-sm leading-6 text-slate-700">{evidence[key].length ? evidence[key].map((text, index) => <div key={`${key}-${index}`}>{text}</div>) : <div>—</div>}</div></div></section>;
  })}</div>;
}

function AnalysisField({ label, value, copyable = false }: { label: string; value: string | null; copyable?: boolean }) {
  return <div className="mt-3"><div className="flex items-center gap-2 text-xs font-medium text-slate-500"><span>{label}</span>{copyable && value ? <CopyTextButton text={value} /> : null}</div><div className="mt-1 text-sm leading-6 text-slate-700">{value || "—"}</div></div>;
}

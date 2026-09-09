import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/app-shell";
import { Panel } from "@/components/cards";
import { getJobById } from "@/lib/queries";

export default async function JobSourcePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) {
    notFound();
  }

  const artifactNames = parseStringArray(job.artifactNamesJson);
  const artifactUrls = parseStringArray(job.artifactUrlsJson);
  const artifacts =
    artifactUrls.length > 0
      ? artifactUrls.map((url, index) => ({
          url,
          name: artifactNames[index] || `原始附件 ${index + 1}`
        }))
      : job.artifactUrl
        ? [{ url: job.artifactUrl, name: job.artifactName || "原始附件" }]
        : [];

  return (
    <PageShell
      title="原始内容"
      description="这里保留最初导入的文本和图片，方便回看岗位来源。"
      action={
        <Link href={`/jobs/${job.id}`} className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm">
          返回岗位详情
        </Link>
      }
    >
      <div className="space-y-4">
        <Panel title="最初输入的文本">
          <div className="rounded-3xl border border-line bg-panel px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
            {job.rawContent || "当时没有额外输入文本。"}
          </div>
        </Panel>

        <Panel title="最初导入的图片 / 附件">
          {artifacts.length === 0 ? (
            <div className="rounded-2xl bg-panel px-4 py-3 text-sm text-slate-500">没有保存原始图片或附件。</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {artifacts.map((artifact, index) => (
                <div key={`${artifact.url}-${index}`} className="rounded-3xl border border-line bg-white p-4">
                  {isImageUrl(artifact.url) ? (
                    <a href={artifact.url} target="_blank" className="block overflow-hidden rounded-2xl bg-panel">
                      <img src={artifact.url} alt={artifact.name} className="h-auto w-full object-cover" />
                    </a>
                  ) : null}
                  <div className="mt-3 text-sm font-medium text-ink">{artifact.name}</div>
                  <a href={artifact.url} target="_blank" className="mt-2 block text-sm text-accent underline-offset-4 hover:underline">
                    打开原始文件
                  </a>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}

function parseStringArray(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(url);
}

"use client";

import { useMemo, useRef, useState } from "react";
import { importExcelJobRows, readExcelJobImport } from "@/app/actions";

const fields = [
  ["company", "公司"], ["role", "岗位"], ["city", "Base"], ["stage", "进度"], ["appliedAt", "投递日期"], ["applyUrl", "投递链接"], ["source", "来源"], ["note", "备注"]
] as const;
type Field = (typeof fields)[number][0];
type WorkbookData = Awaited<ReturnType<typeof readExcelJobImport>>;

function hasUnrecognizedDate(value: string) {
  if (!value) return false;
  return !(/^[0-9]+(?:\.[0-9]+)?$/.test(value) || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value) || /^\d{1,2}[-.]\d{1,2}$/.test(value) || /^\d{1,2}月\d{1,2}日$/.test(value));
}

export function ExcelJobImport({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<WorkbookData | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<Field, number>>>({});
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [forceDuplicates, setForceDuplicates] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number; failures: string[] } | null>(null);

  async function read(selectedFile: File, sheetName?: string) {
    setLoading(true); setError(""); setResult(null);
    try {
      const next = await readExcelJobImport(selectedFile, sheetName);
      setData(next); setMapping(next.mapping); setIncluded(new Set(next.rows.map((row) => row.rowNumber))); setForceDuplicates(new Set());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Excel 读取失败"); }
    finally { setLoading(false); }
  }
  const preview = useMemo(() => data?.rows.map((row) => {
    const value = (field: Field) => mapping[field] === undefined ? "" : row.values[mapping[field]!]?.trim() || "";
    const invalid = !value("company") || !value("role");
    const appliedAt = value("appliedAt");
    return { ...row, company: value("company"), role: value("role"), city: value("city"), stage: value("stage"), source: value("source"), appliedAt, applyUrl: value("applyUrl"), note: value("note"), invalid, dateWarning: hasUnrecognizedDate(appliedAt), duplicate: data.duplicateRowNumbers.includes(row.rowNumber) };
  }) ?? [], [data, mapping]);
  const validSelected = preview.filter((row) => included.has(row.rowNumber) && !row.invalid);
  const duplicateSelected = validSelected.filter((row) => row.duplicate && !forceDuplicates.has(row.rowNumber)).length;

  async function submit() {
    setLoading(true); setError("");
    try {
      setResult(await importExcelJobRows(JSON.stringify(validSelected.map((row) => ({ ...row, importDuplicate: forceDuplicates.has(row.rowNumber) })) )));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "导入失败"); }
    finally { setLoading(false); }
  }
  if (result) return <div className="mt-5 space-y-4"><div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800"><div className="font-semibold">导入完成</div><div className="mt-1">成功：{result.created}　跳过重复：{result.skipped}　失败：{result.failures.length}</div></div>{result.failures.length ? <div className="max-h-28 overflow-auto text-sm text-rose-700">{result.failures.map((failure) => <div key={failure}>{failure}</div>)}</div> : null}<a href="/jobs" className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-medium text-white">查看岗位工作台</a></div>;
  return <div className="mt-5 space-y-4">
    <div className="rounded-2xl border border-dashed border-line bg-panel p-4"><input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(event) => { const next = event.target.files?.[0]; if (next) { setFile(next); void read(next); } }} /><button type="button" onClick={() => inputRef.current?.click()} className="rounded-xl border border-line bg-white px-4 py-2 text-sm text-ink">上传 Excel</button><span className="ml-3 text-xs text-slate-500">仅 .xlsx，最大 5MB；不会执行公式或宏。</span>{file ? <div className="mt-2 text-sm text-slate-600">{file.name}</div> : null}</div>
    {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    {data ? <><label className="block text-sm text-slate-600">工作表<select value={data.selectedSheet} onChange={(event) => file && void read(file, event.target.value)} className="ml-3 h-9 rounded-xl border border-line bg-white px-3 text-sm">{data.sheetNames.map((sheet) => <option key={sheet}>{sheet}</option>)}</select></label>
      <div><div className="mb-2 text-sm font-medium text-ink">字段匹配</div><div className="grid gap-2 sm:grid-cols-2">{fields.map(([field, label]) => <label key={field} className="flex items-center justify-between gap-2 rounded-xl border border-line p-2 text-sm"><span>{label}</span><select value={mapping[field] ?? ""} onChange={(event) => { const next = event.target.value === "" ? undefined : Number(event.target.value); setMapping((current) => { const copy = { ...current }; if (next === undefined) delete copy[field]; else { for (const key of Object.keys(copy) as Field[]) if (key !== field && copy[key] === next) delete copy[key]; copy[field] = next; } return copy; }); }} className="max-w-[170px] rounded-lg border border-line bg-white px-2 py-1"><option value="">不导入</option>{data.headers.map((header, index) => <option key={index} value={index}>{header}</option>)}</select></label>)}</div></div>
      <div className="text-sm text-slate-600">已读取 {preview.length} 条：可导入 {preview.filter((row) => !row.invalid).length}，可能重复 {data.duplicateRowNumbers.length}，无法导入 {preview.filter((row) => row.invalid).length}。</div>
      <div className="max-h-64 overflow-auto rounded-2xl border border-line"><table className="min-w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="p-2">导入</th><th>公司</th><th>岗位</th><th>Base</th><th>投递日期</th><th>进度</th><th>来源</th><th className="p-2">状态</th></tr></thead><tbody>{preview.map((row) => <tr key={row.rowNumber} className="border-t border-line"><td className="p-2"><input type="checkbox" checked={included.has(row.rowNumber)} disabled={row.invalid} onChange={() => setIncluded((current) => { const next = new Set(current); next.has(row.rowNumber) ? next.delete(row.rowNumber) : next.add(row.rowNumber); return next; })} /></td><td>{row.company}</td><td>{row.role}</td><td>{row.city}</td><td>{row.appliedAt}</td><td>{row.stage}</td><td>{row.source}</td><td className={row.invalid ? "p-2 text-rose-600" : row.duplicate || row.dateWarning ? "p-2 text-amber-600" : "p-2 text-emerald-700"}>{row.invalid ? `无法导入：缺少${!row.company ? "公司" : "岗位"}` : row.duplicate ? <label><input type="checkbox" checked={forceDuplicates.has(row.rowNumber)} onChange={() => setForceDuplicates((current) => { const next = new Set(current); next.has(row.rowNumber) ? next.delete(row.rowNumber) : next.add(row.rowNumber); return next; })} /> 可能重复，仍导入</label> : row.dateWarning ? "日期格式无法识别，将留空" : "可导入"}</td></tr>)}</tbody></table></div>
      <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="h-10 rounded-xl border border-line px-4 text-sm">取消</button><button type="button" disabled={loading || validSelected.length === 0} onClick={() => void submit()} className="h-10 rounded-xl bg-ink px-4 text-sm font-medium text-white disabled:opacity-60">{loading ? "正在处理…" : `确认导入 ${validSelected.length} 个岗位${duplicateSelected ? `（将跳过 ${duplicateSelected} 个重复）` : ""}`}</button></div>
    </> : null}
  </div>;
}

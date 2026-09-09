"use client";

import { useRouter } from "next/navigation";

type JobDetailReturnButtonProps = {
  href: string;
  formId: string;
  initialSnapshot: string;
};

const TRACKED_FIELD_NAMES = [
  "parseNote",
  "companyName",
  "roleTitle",
  "sourceName",
  "sourceUrl",
  "city",
  "seniority",
  "salaryRange",
  "responsibilitiesText",
  "requirementsText"
];

function buildSnapshot(form: HTMLFormElement) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(
    TRACKED_FIELD_NAMES.map((fieldName) => [fieldName, String(formData.get(fieldName) ?? "")])
  );
  return JSON.stringify(payload);
}

export function JobDetailReturnButton({ href, formId, initialSnapshot }: JobDetailReturnButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="inline-flex h-10 items-center justify-center rounded-xl border border-line px-4 text-sm font-medium text-ink"
      onClick={() => {
        const form = document.getElementById(formId);
        if (!(form instanceof HTMLFormElement)) {
          router.push(href);
          return;
        }

        const currentSnapshot = buildSnapshot(form);
        if (currentSnapshot === initialSnapshot) {
          router.push(href);
          return;
        }

        const shouldSave = window.confirm(
          "当前信息还没有保存。是否先保存当前信息再返回？\n\n点击“确定”会先保存并返回，点击“取消”将直接返回且不保存。"
        );

        if (shouldSave) {
          const redirectInput = form.querySelector('input[name="redirectTo"]');
          if (redirectInput instanceof HTMLInputElement) {
            redirectInput.value = href;
          }
          form.requestSubmit();
          return;
        }

        router.push(href);
      }}
    >
      返回
    </button>
  );
}

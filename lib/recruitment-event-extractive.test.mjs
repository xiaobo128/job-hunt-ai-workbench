import assert from "node:assert/strict";
import test from "node:test";

import { locateSourceExcerpt, validateSourceExcerpts } from "./recruitment-event-extractive.ts";

const content = `您好，现邀请您参加产品经理岗位的线上面试。

请在2026-10-05 23:59之前完成面试。
面试过程中请确保网络稳定，面试中途请勿退出。
请提前准备身份证和个人作品集。`;

test("keeps Chinese recruitment requirements and actions as source excerpts", () => {
  const actions = validateSourceExcerpts(content, [
    "请在2026-10-05 23:59之前完成面试",
    "Complete the interview before the deadline"
  ]);
  const requirements = validateSourceExcerpts(content, [
    "面试过程中请确保网络稳定，面试中途请勿退出。",
    "Ensure stable internet connection",
    "请提前准备身份证和个人作品集。"
  ]);

  assert.deepEqual(actions, ["请在2026-10-05 23:59之前完成面试"]);
  assert.deepEqual(requirements, [
    "面试过程中请确保网络稳定，面试中途请勿退出。",
    "请提前准备身份证和个人作品集。"
  ]);
  for (const excerpt of [...actions, ...requirements]) assert.ok(content.includes(excerpt));
});

test("allows only whitespace and line-break normalization and returns the raw source slice", () => {
  const wrappedContent = "请提前准备身份证和\n个人作品集。";
  assert.equal(
    locateSourceExcerpt(wrappedContent, "请提前准备身份证和 个人作品集。"),
    "请提前准备身份证和\n个人作品集。"
  );
});

test("drops paraphrases, translations, and invented facts", () => {
  assert.equal(locateSourceExcerpt(content, "请保持良好网络环境"), null);
  assert.equal(validateSourceExcerpts(content, ["Do not exit during the interview"]), null);
});

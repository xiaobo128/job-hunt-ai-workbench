export type ResumeSectionKey =
  | "basic"
  | "summary"
  | "education"
  | "internship"
  | "project"
  | "skills"
  | "other"
  | "custom";

export type ResumeSection = {
  key: ResumeSectionKey;
  title: string;
  blocks: string[][];
};

export type ResumeTemplateModel = {
  displayTitle: string;
  header: {
    name: string | null;
    contactLines: string[];
    photoSlot: {
      reserved: boolean;
    };
  };
  sections: ResumeSection[];
};

type SectionAlias = {
  key: ResumeSectionKey;
  title?: string;
  preserveOriginalTitle?: boolean;
};

const SECTION_ALIASES = new Map<string, SectionAlias>([
  ["基本信息", { key: "basic", title: "基本信息" }],
  ["个人信息", { key: "basic", title: "基本信息" }],
  ["联系方式", { key: "basic", title: "基本信息" }],
  ["个人简介", { key: "summary", title: "个人简介" }],
  ["个人优势", { key: "summary", title: "个人优势" }],
  ["个人总结", { key: "summary", title: "个人简介" }],
  ["自我评价", { key: "summary", title: "个人简介", preserveOriginalTitle: true }],
  ["自我介绍", { key: "summary", title: "个人简介", preserveOriginalTitle: true }],
  ["教育经历", { key: "education", title: "教育经历" }],
  ["教育背景", { key: "education", title: "教育经历" }],
  ["学历背景", { key: "education", title: "教育经历" }],
  ["实习经历", { key: "internship", title: "实习经历" }],
  ["工作经历", { key: "internship", title: "工作经历", preserveOriginalTitle: true }],
  ["相关经历", { key: "internship", title: "相关经历", preserveOriginalTitle: true }],
  ["项目经历", { key: "project", title: "项目经历" }],
  ["项目经验", { key: "project", title: "项目经历" }],
  ["科研经历", { key: "project", title: "科研经历", preserveOriginalTitle: true }],
  ["科研项目", { key: "project", title: "科研项目", preserveOriginalTitle: true }],
  ["技能", { key: "skills", title: "技能 / 能力" }],
  ["技能能力", { key: "skills", title: "技能 / 能力" }],
  ["专业技能", { key: "skills", title: "专业技能", preserveOriginalTitle: true }],
  ["核心技能", { key: "skills", title: "核心技能", preserveOriginalTitle: true }],
  ["能力标签", { key: "skills", title: "能力标签", preserveOriginalTitle: true }],
  ["证书", { key: "other", title: "证书", preserveOriginalTitle: true }],
  ["校园经历", { key: "other", title: "校园经历", preserveOriginalTitle: true }],
  ["学生工作", { key: "other", title: "学生工作", preserveOriginalTitle: true }],
  ["社团经历", { key: "other", title: "社团经历", preserveOriginalTitle: true }],
  ["获奖经历", { key: "other", title: "获奖经历", preserveOriginalTitle: true }],
  ["获奖情况", { key: "other", title: "获奖情况", preserveOriginalTitle: true }],
  ["其他经历", { key: "other", title: "其他经历" }],
  ["补充信息", { key: "other", title: "补充信息" }],
  ["附加信息", { key: "other", title: "补充信息" }]
]);

export function buildResumeTemplateModel(input: { title: string; body: string }) {
  const displayTitle = input.title.trim() || "定制简历";
  const normalizedBody = input.body.replace(/\r\n/g, "\n").trim();

  if (!normalizedBody) {
    return {
      displayTitle,
      header: {
        name: null,
        contactLines: [],
        photoSlot: {
          reserved: true
        }
      },
      sections: [
        {
          key: "summary",
          title: "个人简介",
          blocks: [["当前没有可导出的简历正文。"]]
        }
      ]
    } satisfies ResumeTemplateModel;
  }

  const lines = normalizedBody.split("\n").map((line) => line.replace(/\t/g, "    ").trimEnd());
  const preface: string[] = [];
  const parsedSections: Array<{ key: ResumeSectionKey; title: string; lines: string[] }> = [];
  let currentSection: { key: ResumeSectionKey; title: string; lines: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = detectSectionHeading(line);

    if (heading) {
      if (currentSection && currentSection.lines.some((item) => item.trim())) {
        parsedSections.push(currentSection);
      }

      currentSection = {
        key: heading.key,
        title: heading.title,
        lines: []
      };
      continue;
    }

    if (!currentSection) {
      preface.push(rawLine);
      continue;
    }

    currentSection.lines.push(rawLine);
  }

  if (currentSection && currentSection.lines.some((item) => item.trim())) {
    parsedSections.push(currentSection);
  }

  const { name, contactLines, summaryBlocks } = splitPreface(preface);
  const sections: ResumeSection[] = [];

  if (summaryBlocks.length > 0) {
    sections.push({
      key: "summary",
      title: "个人简介",
      blocks: summaryBlocks
    });
  }

  for (const section of parsedSections) {
    const blocks = splitIntoBlocks(section.lines);

    if (blocks.length === 0) {
      continue;
    }

    const previous = sections.at(-1);

    if (previous && previous.title === section.title && previous.key === section.key) {
      previous.blocks.push(...blocks);
      continue;
    }

    sections.push({
      key: section.key,
      title: section.title,
      blocks
    });
  }

  if (sections.length === 0) {
    const fallbackBlocks = splitIntoBlocks(preface);

    sections.push({
      key: "basic",
      title: "基本信息",
      blocks: fallbackBlocks.length > 0 ? fallbackBlocks : [["当前没有可导出的简历正文。"]]
    });
  }

  return {
    displayTitle,
    header: {
      name,
      contactLines,
      photoSlot: {
        reserved: true
      }
    },
    sections
  } satisfies ResumeTemplateModel;
}

function splitPreface(lines: string[]) {
  let name: string | null = null;
  const contactLines: string[] = [];
  const workingLines = [...lines];

  while (workingLines[0] !== undefined && !workingLines[0].trim()) {
    workingLines.shift();
  }

  if (workingLines[0] && looksLikeNameLine(workingLines[0])) {
    name = workingLines.shift()!.trim();
  }

  while (workingLines[0] !== undefined) {
    const current = workingLines[0];

    if (!current.trim()) {
      workingLines.shift();
      continue;
    }

    if (contactLines.length < 2 && looksLikeContactLine(current)) {
      contactLines.push(current.trim());
      workingLines.shift();
      continue;
    }

    break;
  }

  return {
    name,
    contactLines,
    summaryBlocks: splitIntoBlocks(workingLines)
  };
}

function splitIntoBlocks(lines: string[]) {
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
      continue;
    }

    current.push(trimmed);
  }

  if (current.length > 0) {
    blocks.push(current);
  }

  return blocks;
}

function detectSectionHeading(line: string) {
  if (!line) {
    return null;
  }

  const plain = cleanHeadingText(line);

  if (!plain) {
    return null;
  }

  const directAlias = SECTION_ALIASES.get(plain);

  if (directAlias) {
    return {
      key: directAlias.key,
      title: directAlias.preserveOriginalTitle ? plain : directAlias.title || plain
    };
  }

  const normalized = normalizeAliasKey(plain);
  const normalizedAlias = Array.from(SECTION_ALIASES.entries()).find(([alias]) => normalizeAliasKey(alias) === normalized)?.[1];

  if (normalizedAlias) {
    return {
      key: normalizedAlias.key,
      title: normalizedAlias.preserveOriginalTitle ? plain : normalizedAlias.title || plain
    };
  }

  if (!looksLikeCustomHeading(plain)) {
    return null;
  }

  return {
    key: "custom" as const,
    title: plain
  };
}

function cleanHeadingText(line: string) {
  return line
    .replace(/^[（(]?[一二三四五六七八九十0-9]+[)）.、\s-]*/u, "")
    .replace(/^[第]\s*[一二三四五六七八九十0-9]+\s*[部分章节项节]?/u, "")
    .replace(/[：:]+$/u, "")
    .trim();
}

function normalizeAliasKey(value: string) {
  return value.replace(/[\s/｜|·•\-()（）【】\[\]「」]+/gu, "");
}

function looksLikeNameLine(value: string) {
  const trimmed = value.trim();

  if (!trimmed || trimmed.length > 20) {
    return false;
  }

  if (looksLikeContactLine(trimmed)) {
    return false;
  }

  return !/[：:，,。；;@/\\]/u.test(trimmed);
}

function looksLikeContactLine(value: string) {
  const trimmed = value.trim();

  return (
    /@/u.test(trimmed) ||
    /(?:微信|电话|手机|邮箱|github|领英|linkedin|location|现居|求职意向)/iu.test(trimmed) ||
    /\d{6,}/u.test(trimmed) ||
    /[｜|/]/u.test(trimmed)
  );
}

function looksLikeCustomHeading(value: string) {
  if (value.length === 0 || value.length > 16) {
    return false;
  }

  if (/[0-9@]/u.test(value)) {
    return false;
  }

  if (/[，,。；;！!？?]/u.test(value)) {
    return false;
  }

  return !looksLikeContactLine(value);
}

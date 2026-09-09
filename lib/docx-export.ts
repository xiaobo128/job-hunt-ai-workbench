import { Buffer } from "buffer";
import { buildResumeTemplateModel, type ResumeSection, type ResumeSectionKey } from "@/lib/resume-template";

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PAGE_WIDTH = 11906;
const PAGE_MARGIN_LEFT = 900;
const PAGE_MARGIN_RIGHT = 900;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN_LEFT - PAGE_MARGIN_RIGHT;
const HEADER_LEFT_WIDTH = 7800;
const HEADER_RIGHT_WIDTH = CONTENT_WIDTH - HEADER_LEFT_WIDTH;
const PHOTO_BOX_HEIGHT = 1800;

export function buildDocxBuffer(input: { title: string; body: string }) {
  const model = buildResumeTemplateModel(input);
  const normalizedTitle = escapeXml(model.displayTitle);
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
    },
    {
      name: "docProps/core.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${normalizedTitle}</dc:title>
  <dc:creator>Job Hunt AI Workbench</dc:creator>
  <cp:lastModifiedBy>Job Hunt AI Workbench</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`
    },
    {
      name: "docProps/app.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Job Hunt AI Workbench</Application>
</Properties>`
    },
    {
      name: "word/_rels/document.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
    },
    {
      name: "word/styles.xml",
      content: buildStylesXml()
    },
    {
      name: "word/document.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
  <w:body>
    ${renderDocumentBody(model)}
    <w:sectPr>
      <w:pgSz w:w="${PAGE_WIDTH}" w:h="16838"/>
      <w:pgMar w:top="960" w:right="${PAGE_MARGIN_RIGHT}" w:bottom="960" w:left="${PAGE_MARGIN_LEFT}" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`
    }
  ];

  return {
    buffer: createZipBuffer(files),
    mimeType: DOCX_MIME_TYPE
  };
}

function renderDocumentBody(model: ReturnType<typeof buildResumeTemplateModel>) {
  const elements: string[] = [createHeaderTable(model)];

  for (const [sectionIndex, section] of model.sections.entries()) {
    elements.push(createParagraph(section.title, { styleId: "ResumeSectionTitle" }));

    if (section.key === "education" || section.key === "internship" || section.key === "project") {
      for (const block of section.blocks) {
        elements.push(renderTimelineBlock(section, block));
      }
    } else if (section.key === "skills") {
      for (const block of section.blocks) {
        elements.push(renderSkillBlock(block));
      }
    } else {
      for (const block of section.blocks) {
        elements.push(renderPlainBlock(section, block));
      }
    }

    if (sectionIndex < model.sections.length - 1) {
      elements.push(createParagraph(" ", { styleId: "ResumeSectionSpacer" }));
    }
  }

  return elements.join("");
}

function createHeaderTable(model: ReturnType<typeof buildResumeTemplateModel>) {
  const leftCellContent = [
    createParagraph(model.header.name || model.displayTitle, { styleId: "ResumeName" }),
    ...(model.header.contactLines.length > 0
      ? model.header.contactLines.map((line) => createParagraph(line, { styleId: "ResumeContacts" }))
      : [createParagraph("联系方式待补充", { styleId: "ResumeContactsMuted" })])
  ].join("");

  const rightCellContent = model.header.photoSlot.reserved
    ? createParagraph("照片", { styleId: "ResumePhotoPlaceholder" })
    : createParagraph(" ", { styleId: "ResumePhotoPlaceholder" });

  return createTable({
    columnWidths: [HEADER_LEFT_WIDTH, HEADER_RIGHT_WIDTH],
    rows: [
      {
        height: PHOTO_BOX_HEIGHT,
        cells: [
          {
            width: HEADER_LEFT_WIDTH,
            content: leftCellContent,
            verticalAlign: "top",
            borders: "none",
            margins: { top: 40, right: 160, bottom: 40, left: 0 }
          },
          {
            width: HEADER_RIGHT_WIDTH,
            content: rightCellContent,
            verticalAlign: "center",
            borders: "photo",
            margins: { top: 80, right: 80, bottom: 80, left: 80 }
          }
        ]
      }
    ],
    layout: "fixed",
    margins: { top: 0, right: 0, bottom: 120, left: 0 }
  });
}

function renderTimelineBlock(section: ResumeSection, block: string[]) {
  const entry = parseTimelineEntry(section.key, block);

  if (!entry) {
    return renderPlainBlock(section, block);
  }

  const widths =
    section.key === "education"
      ? [1700, 6200, CONTENT_WIDTH - 1700 - 6200]
      : [1700, 5000, CONTENT_WIDTH - 1700 - 5000];

  const detailLines = entry.details.flatMap((line) => splitBulletLine(line));
  const detailContent =
    detailLines.length > 0
      ? detailLines.map((line) => createParagraph(line, { styleId: line.startsWith("- ") ? "ResumeBullet" : "ResumeBody" })).join("")
      : createParagraph(" ", { styleId: "ResumeDetailSpacer" });

  return createTable({
    columnWidths: widths,
    rows: [
      {
        cells: [
          {
            width: widths[0],
            content: createParagraph(entry.columns[0] || "", { styleId: "ResumeMetaLeft" }),
            verticalAlign: "top"
          },
          {
            width: widths[1],
            content: createParagraph(entry.columns[1] || "", { styleId: "ResumeMetaMain" }),
            verticalAlign: "top"
          },
          {
            width: widths[2],
            content: createParagraph(entry.columns[2] || "", { styleId: "ResumeMetaRight" }),
            verticalAlign: "top"
          }
        ]
      },
      {
        cells: [
          {
            width: CONTENT_WIDTH,
            gridSpan: 3,
            content: detailContent,
            verticalAlign: "top",
            margins: { top: 40, right: 0, bottom: 60, left: 0 }
          }
        ]
      }
    ],
    layout: "fixed",
    margins: { top: 0, right: 0, bottom: 40, left: 0 }
  });
}

function renderSkillBlock(block: string[]) {
  const parts = block.flatMap((line) => splitSkillLine(line));

  return parts
    .map((line) => createParagraph(line, { styleId: line.startsWith("- ") ? "ResumeBullet" : "ResumeBody" }))
    .join("");
}

function renderPlainBlock(section: ResumeSection, block: string[]) {
  const entry = splitSectionBlock(section, block);
  const content: string[] = [];

  if (entry.heading) {
    content.push(createParagraph(entry.heading, { styleId: "ResumeItemTitle" }));
  }

  for (const line of entry.lines.flatMap((item) => splitBulletLine(item))) {
    content.push(createParagraph(line, { styleId: line.startsWith("- ") ? "ResumeBullet" : "ResumeBody" }));
  }

  if (content.length === 0) {
    content.push(createParagraph(" ", { styleId: "ResumeDetailSpacer" }));
  }

  return content.join("");
}

function splitSectionBlock(section: ResumeSection, block: string[]) {
  if (block.length <= 1) {
    return {
      heading: null,
      lines: block
    };
  }

  const firstLine = block[0].trim();
  const remainingLines = block.slice(1);

  if (!firstLine || /^\s*[-*•]+\s+/u.test(firstLine)) {
    return {
      heading: null,
      lines: block
    };
  }

  if (shouldPromoteBlockHeading(section.key, firstLine, remainingLines)) {
    return {
      heading: firstLine,
      lines: remainingLines
    };
  }

  return {
    heading: null,
    lines: block
  };
}

function shouldPromoteBlockHeading(sectionKey: ResumeSectionKey, firstLine: string, remainingLines: string[]) {
  if (remainingLines.length === 0) {
    return false;
  }

  if (sectionKey === "summary" || sectionKey === "skills" || sectionKey === "basic") {
    return false;
  }

  if (firstLine.length <= 38) {
    return true;
  }

  return /[｜|·•/()（）\-]|20\d{2}|至今|负责|有限公司|大学|学院/u.test(firstLine);
}

function parseTimelineEntry(sectionKey: ResumeSectionKey, block: string[]) {
  if (block.length === 0) {
    return null;
  }

  const [firstLine, ...detailLines] = block.map((line) => line.trim()).filter(Boolean);

  if (!firstLine) {
    return null;
  }

  const separated = splitHeaderColumns(firstLine);

  if (separated.length >= 3) {
    return {
      columns: [separated[0], separated[1], separated.slice(2).join(" / ")],
      details: detailLines
    };
  }

  if (separated.length === 2) {
    if (sectionKey === "education") {
      const inferredEducation = inferEducationColumns(separated[0], separated[1]);

      if (inferredEducation) {
        return {
          columns: inferredEducation,
          details: detailLines
        };
      }
    }

    return {
      columns: [separated[0], separated[1], ""],
      details: detailLines
    };
  }

  if (sectionKey === "education") {
    const inferredEducation = inferEducationColumns(firstLine);

    if (inferredEducation) {
      return {
        columns: inferredEducation,
        details: detailLines
      };
    }
  }

  const inferredTimeline = inferTimelineColumns(firstLine);

  if (inferredTimeline) {
    return {
      columns: inferredTimeline,
      details: detailLines
    };
  }

  return null;
}

function splitHeaderColumns(line: string) {
  const normalized = line
    .replace(/\s*[｜|丨]\s*/gu, "|")
    .replace(/\s*\/\s*/gu, "|")
    .replace(/\t+/gu, "|")
    .replace(/\s{2,}/gu, "|");

  return normalized
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function inferEducationColumns(timeOrLine: string, maybeRest?: string) {
  const combined = maybeRest ? `${timeOrLine} ${maybeRest}`.trim() : timeOrLine.trim();
  const timeMatch = combined.match(/^((?:19|20)\d{2}[./年\-]\d{1,2}(?:[./月\-]\d{0,2})?\s*(?:至今|[-–—~至]\s*(?:19|20)\d{2}[./年\-]?\d{0,2}(?:[./月\-]?\d{0,2})?)?)/u);
  const degreeMatch = combined.match(/(博士研究生|硕士研究生|本科|硕士|博士|学士|大专|专科|高中|中专|MBA|EMBA)$/u);

  if (!timeMatch && !degreeMatch && !maybeRest) {
    return null;
  }

  const time = timeMatch?.[1]?.trim() || timeOrLine.trim();
  let rest = combined.slice(timeMatch?.[0]?.length || 0).trim();
  let degree = "";

  if (degreeMatch) {
    degree = degreeMatch[1].trim();
    rest = rest.replace(new RegExp(`${degreeMatch[1]}$`, "u"), "").trim();
  }

  if (maybeRest && !degree) {
    const parts = splitHeaderColumns(maybeRest);

    if (parts.length >= 2) {
      rest = parts[0];
      degree = parts.slice(1).join(" / ");
    } else {
      rest = maybeRest.trim();
    }
  }

  if (!rest) {
    return null;
  }

  return [time, rest, degree];
}

function inferTimelineColumns(line: string) {
  const timeMatch = line.match(/^((?:19|20)\d{2}[./年\-]\d{1,2}(?:[./月\-]\d{0,2})?\s*(?:至今|[-–—~至]\s*(?:19|20)\d{2}[./年\-]?\d{0,2}(?:[./月\-]?\d{0,2})?)?)/u);

  if (!timeMatch) {
    return null;
  }

  const time = timeMatch[1].trim();
  const rest = line.slice(timeMatch[0].length).trim();

  if (!rest) {
    return null;
  }

  const parts = splitHeaderColumns(rest);

  if (parts.length >= 2) {
    return [time, parts[0], parts.slice(1).join(" / ")];
  }

  return [time, rest, ""];
}

function splitBulletLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed) {
    return [];
  }

  const bulletMatch = trimmed.match(/^[-*•]\s*(.+)$/u);

  if (bulletMatch) {
    return [`- ${bulletMatch[1].trim()}`];
  }

  return [trimmed];
}

function splitSkillLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed) {
    return [];
  }

  if (/^[-*•]\s+/u.test(trimmed)) {
    return splitBulletLine(trimmed);
  }

  const parts = trimmed
    .split(/[；;]+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts.map((part) => `- ${part}`);
  }

  return [trimmed];
}

function createParagraph(
  text: string,
  options: {
    styleId: string;
  }
) {
  return `<w:p><w:pPr><w:pStyle w:val="${options.styleId}"/></w:pPr><w:r>${buildRunProperties(options.styleId)}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function buildRunProperties(styleId: string) {
  if (styleId === "ResumeSectionSpacer" || styleId === "ResumeDetailSpacer") {
    return `<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>`;
  }

  return "<w:rPr/>";
}

function createTable(input: {
  columnWidths: number[];
  rows: Array<{
    height?: number;
    cells: Array<{
      width: number;
      content: string;
      gridSpan?: number;
      verticalAlign?: "top" | "center";
      borders?: "none" | "default" | "photo";
      margins?: { top?: number; right?: number; bottom?: number; left?: number };
    }>;
  }>;
  layout?: "fixed" | "autofit";
  margins?: { top?: number; right?: number; bottom?: number; left?: number };
}) {
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${CONTENT_WIDTH}" w:type="dxa"/>
      <w:tblLayout w:type="${input.layout === "autofit" ? "autofit" : "fixed"}"/>
      <w:tblCellMar>
        <w:top w:w="${input.margins?.top ?? 0}" w:type="dxa"/>
        <w:left w:w="${input.margins?.left ?? 0}" w:type="dxa"/>
        <w:bottom w:w="${input.margins?.bottom ?? 0}" w:type="dxa"/>
        <w:right w:w="${input.margins?.right ?? 0}" w:type="dxa"/>
      </w:tblCellMar>
      <w:tblBorders>
        <w:top w:val="nil"/>
        <w:left w:val="nil"/>
        <w:bottom w:val="nil"/>
        <w:right w:val="nil"/>
        <w:insideH w:val="nil"/>
        <w:insideV w:val="nil"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${input.columnWidths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>
    ${input.rows
      .map(
        (row) => `<w:tr>
          ${row.height ? `<w:trPr><w:trHeight w:val="${row.height}" w:hRule="atLeast"/></w:trPr>` : ""}
          ${row.cells
            .map(
              (cell) => `<w:tc>
                <w:tcPr>
                  <w:tcW w:w="${cell.width}" w:type="dxa"/>
                  ${cell.gridSpan ? `<w:gridSpan w:val="${cell.gridSpan}"/>` : ""}
                  <w:vAlign w:val="${cell.verticalAlign || "top"}"/>
                  ${buildCellBorders(cell.borders)}
                  ${buildCellMargins(cell.margins)}
                </w:tcPr>
                ${cell.content}
              </w:tc>`
            )
            .join("")}
        </w:tr>`
      )
      .join("")}
  </w:tbl>`;
}

function buildCellBorders(mode: "none" | "default" | "photo" = "default") {
  if (mode === "none") {
    return `<w:tcBorders>
      <w:top w:val="nil"/>
      <w:left w:val="nil"/>
      <w:bottom w:val="nil"/>
      <w:right w:val="nil"/>
    </w:tcBorders>`;
  }

  if (mode === "photo") {
    return `<w:tcBorders>
      <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
      <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
      <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
      <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
    </w:tcBorders>`;
  }

  return "";
}

function buildCellMargins(margins?: { top?: number; right?: number; bottom?: number; left?: number }) {
  return `<w:tcMar>
    <w:top w:w="${margins?.top ?? 0}" w:type="dxa"/>
    <w:left w:w="${margins?.left ?? 0}" w:type="dxa"/>
    <w:bottom w:w="${margins?.bottom ?? 0}" w:type="dxa"/>
    <w:right w:w="${margins?.right ?? 0}" w:type="dxa"/>
  </w:tcMar>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="宋体" w:cs="Arial"/>
        <w:lang w:val="zh-CN" w:eastAsia="zh-CN"/>
        <w:sz w:val="20"/>
        <w:szCs w:val="20"/>
        <w:color w:val="1F2937"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="48" w:line="320" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ResumeName">
    <w:name w:val="Resume Name"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:jc w:val="left"/>
      <w:spacing w:before="0" w:after="60" w:line="360" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="黑体" w:cs="Arial"/>
      <w:b/>
      <w:sz w:val="30"/>
      <w:szCs w:val="30"/>
      <w:color w:val="111827"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ResumeContacts">
    <w:name w:val="Resume Contacts"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:jc w:val="left"/>
      <w:spacing w:before="0" w:after="20" w:line="300" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:sz w:val="18"/>
      <w:szCs w:val="18"/>
      <w:color w:val="475569"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ResumeContactsMuted">
    <w:name w:val="Resume Contacts Muted"/>
    <w:basedOn w:val="ResumeContacts"/>
    <w:rPr>
      <w:color w:val="94A3B8"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ResumePhotoPlaceholder">
    <w:name w:val="Resume Photo Placeholder"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:jc w:val="center"/>
      <w:spacing w:before="0" w:after="0" w:line="260" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:sz w:val="18"/>
      <w:szCs w:val="18"/>
      <w:color w:val="94A3B8"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ResumeSectionTitle">
    <w:name w:val="Resume Section Title"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="120" w:after="120" w:line="300" w:lineRule="auto"/>
      <w:pBdr>
        <w:bottom w:val="single" w:sz="10" w:space="6" w:color="94A3B8"/>
      </w:pBdr>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="黑体" w:cs="Arial"/>
      <w:b/>
      <w:sz w:val="22"/>
      <w:szCs w:val="22"/>
      <w:color w:val="0F172A"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ResumeItemTitle">
    <w:name w:val="Resume Item Title"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="0" w:after="30" w:line="320" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="21"/>
      <w:szCs w:val="21"/>
      <w:color w:val="111827"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ResumeBody">
    <w:name w:val="Resume Body"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="0" w:after="42" w:line="320" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:sz w:val="20"/>
      <w:szCs w:val="20"/>
      <w:color w:val="1F2937"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ResumeBullet">
    <w:name w:val="Resume Bullet"/>
    <w:basedOn w:val="ResumeBody"/>
    <w:pPr>
      <w:ind w:left="360" w:hanging="180"/>
      <w:spacing w:before="0" w:after="36" w:line="320" w:lineRule="auto"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ResumeMetaLeft">
    <w:name w:val="Resume Meta Left"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:jc w:val="left"/>
      <w:spacing w:before="0" w:after="12" w:line="280" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="19"/>
      <w:szCs w:val="19"/>
      <w:color w:val="334155"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ResumeMetaMain">
    <w:name w:val="Resume Meta Main"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:jc w:val="left"/>
      <w:spacing w:before="0" w:after="12" w:line="280" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="20"/>
      <w:szCs w:val="20"/>
      <w:color w:val="111827"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ResumeMetaRight">
    <w:name w:val="Resume Meta Right"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:jc w:val="right"/>
      <w:spacing w:before="0" w:after="12" w:line="280" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:sz w:val="19"/>
      <w:szCs w:val="19"/>
      <w:color w:val="334155"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ResumeDetailSpacer">
    <w:name w:val="Resume Detail Spacer"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="0" w:after="16" w:line="20" w:lineRule="auto"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ResumeSectionSpacer">
    <w:name w:val="Resume Section Spacer"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="0" w:after="36" w:line="20" w:lineRule="auto"/>
    </w:pPr>
  </w:style>
</w:styles>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function createZipBuffer(files: Array<{ name: string; content: string }>) {
  const localFileBuffers: Buffer[] = [];
  const centralDirectoryBuffers: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, "utf8");
    const contentBuffer = Buffer.from(file.content, "utf8");
    const crc32 = calculateCrc32(contentBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc32 >>> 0, 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localFile = Buffer.concat([localHeader, nameBuffer, contentBuffer]);
    localFileBuffers.push(localFile);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc32 >>> 0, 16);
    centralHeader.writeUInt32LE(contentBuffer.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralDirectoryBuffers.push(Buffer.concat([centralHeader, nameBuffer]));
    offset += localFile.length;
  }

  const centralDirectory = Buffer.concat(centralDirectoryBuffers);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(files.length, 8);
  endOfCentralDirectory.writeUInt16LE(files.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localFileBuffers, centralDirectory, endOfCentralDirectory]);
}

function calculateCrc32(input: Buffer) {
  let crc = 0xffffffff;

  for (const byte of input) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

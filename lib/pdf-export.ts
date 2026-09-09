import { Buffer } from "buffer";

const PDF_MIME_TYPE = "application/pdf";
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT_MARGIN = 54;
const TOP_MARGIN = 56;
const BOTTOM_MARGIN = 56;
const TITLE_FONT_SIZE = 18;
const TITLE_LINE_HEIGHT = 26;
const BODY_FONT_SIZE = 11;
const BODY_LINE_HEIGHT = 16;
const TITLE_MAX_UNITS = 22;
const BODY_MAX_UNITS = 42;

export function buildPdfBuffer(input: { title: string; body: string }) {
  const title = input.title.trim() || "定制简历";
  const body = input.body.trim() || "定制简历内容为空。";
  const titleLines = wrapText(title, TITLE_MAX_UNITS);
  const bodyLines = splitBodyLines(body);
  const firstPageBodyCapacity = Math.max(
    1,
    Math.floor((PAGE_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN - titleLines.length * TITLE_LINE_HEIGHT - 20) / BODY_LINE_HEIGHT)
  );
  const followingPageBodyCapacity = Math.max(1, Math.floor((PAGE_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN) / BODY_LINE_HEIGHT));
  const pages = paginateBodyLines(bodyLines, firstPageBodyCapacity, followingPageBodyCapacity).map((lines, index) => ({
    titleLines: index === 0 ? titleLines : [],
    bodyLines: lines
  }));

  const objects: Buffer[] = [];
  const pageObjectIds: number[] = [];
  const fontObjectId = pages.length * 2 + 3;
  const cidFontObjectId = pages.length * 2 + 4;
  const descriptorObjectId = pages.length * 2 + 5;

  objects.push(Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "utf8"));
  objects.push(
    Buffer.from(
      `<< /Type /Pages /Count ${pages.length} /Kids [${pages
        .map((_, index) => `${index * 2 + 3} 0 R`)
        .join(" ")}] >>`,
      "utf8"
    )
  );

  for (const [index, page] of pages.entries()) {
    const pageObjectId = index * 2 + 3;
    const contentObjectId = index * 2 + 4;
    pageObjectIds.push(pageObjectId);

    objects.push(
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
        "utf8"
      )
    );

    const content = buildPageContent(page.titleLines, page.bodyLines);
    const stream = Buffer.from(content, "utf8");
    objects.push(
      Buffer.concat([
        Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "utf8"),
        stream,
        Buffer.from("\nendstream", "utf8")
      ])
    );
  }

  objects.push(
    Buffer.from(
      `<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${cidFontObjectId} 0 R] >>`,
      "utf8"
    )
  );
  objects.push(
    Buffer.from(
      `<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /FontDescriptor ${descriptorObjectId} 0 R /DW 1000 >>`,
      "utf8"
    )
  );
  objects.push(
    Buffer.from(
      "<< /Type /FontDescriptor /FontName /STSong-Light /Flags 4 /FontBBox [-25 -254 1000 880] /Ascent 880 /Descent -120 /CapHeight 700 /ItalicAngle 0 /StemV 80 /MissingWidth 500 >>",
      "utf8"
    )
  );

  return {
    buffer: buildPdfDocument(objects),
    mimeType: PDF_MIME_TYPE
  };
}

function splitBodyLines(body: string) {
  return body
    .split(/\r?\n/)
    .flatMap((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return [""];
      }

      return wrapText(trimmed, BODY_MAX_UNITS);
    });
}

function paginateBodyLines(lines: string[], firstPageCapacity: number, followingPageCapacity: number) {
  const pages: string[][] = [];
  let cursor = 0;
  let capacity = firstPageCapacity;

  while (cursor < lines.length) {
    pages.push(lines.slice(cursor, cursor + capacity));
    cursor += capacity;
    capacity = followingPageCapacity;
  }

  if (pages.length === 0) {
    pages.push([""]);
  }

  return pages;
}

function buildPageContent(titleLines: string[], bodyLines: string[]) {
  const commands: string[] = [];

  if (titleLines.length > 0) {
    const titleStartY = PAGE_HEIGHT - TOP_MARGIN - TITLE_FONT_SIZE;
    commands.push("BT");
    commands.push(`/F1 ${TITLE_FONT_SIZE} Tf`);
    commands.push(`${TITLE_LINE_HEIGHT} TL`);
    commands.push(`1 0 0 1 ${LEFT_MARGIN} ${titleStartY.toFixed(2)} Tm`);

    for (const [index, line] of titleLines.entries()) {
      if (index > 0) {
        commands.push("T*");
      }

      commands.push(`${encodePdfHexText(line)} Tj`);
    }

    commands.push("ET");
  }

  const bodyStartY =
    PAGE_HEIGHT -
    TOP_MARGIN -
    (titleLines.length > 0 ? titleLines.length * TITLE_LINE_HEIGHT + 28 : BODY_FONT_SIZE + 4);

  commands.push("BT");
  commands.push(`/F1 ${BODY_FONT_SIZE} Tf`);
  commands.push(`${BODY_LINE_HEIGHT} TL`);
  commands.push(`1 0 0 1 ${LEFT_MARGIN} ${bodyStartY.toFixed(2)} Tm`);

  for (const [index, line] of bodyLines.entries()) {
    if (index > 0) {
      commands.push("T*");
    }

    commands.push(`${encodePdfHexText(line || " ")} Tj`);
  }

  commands.push("ET");

  return commands.join("\n");
}

function encodePdfHexText(value: string) {
  const buffer = Buffer.alloc(value.length * 2);

  for (let index = 0; index < value.length; index += 1) {
    buffer.writeUInt16BE(value.charCodeAt(index), index * 2);
  }

  return `<${buffer.toString("hex").toUpperCase()}>`;
}

function wrapText(value: string, maxUnits: number) {
  const lines: string[] = [];
  let current = "";
  let width = 0;

  for (const char of value) {
    const charWidth = getCharWidth(char);

    if (current && width + charWidth > maxUnits) {
      lines.push(current);
      current = char;
      width = charWidth;
      continue;
    }

    current += char;
    width += charWidth;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function getCharWidth(char: string) {
  const code = char.charCodeAt(0);
  return code <= 0x7f ? 0.55 : 1;
}

function buildPdfDocument(objects: Buffer[]) {
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xD0\xD0\xD0\xD0\n", "binary")];
  const offsets = [0];
  let cursor = parts[0].length;

  objects.forEach((object, index) => {
    offsets.push(cursor);
    const wrapped = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, "utf8"), object, Buffer.from("\nendobj\n", "utf8")]);
    parts.push(wrapped);
    cursor += wrapped.length;
  });

  const xrefOffset = cursor;
  const xrefLines = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];

  for (let index = 1; index < offsets.length; index += 1) {
    xrefLines.push(`${offsets[index].toString().padStart(10, "0")} 00000 n `);
  }

  parts.push(Buffer.from(`${xrefLines.join("\n")}\n`, "utf8"));
  parts.push(
    Buffer.from(
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
      "utf8"
    )
  );

  return Buffer.concat(parts);
}

import { PDFParse } from 'pdf-parse';

export interface TextSection {
  title: string;
  text: string;
  pageStart?: number;
  pageEnd?: number;
  chapterTitle?: string;
}

export function splitText(text: string, title = 'Notes'): TextSection[] {
  const cleaned = text.replace(/\r/g, '').replaceAll(String.fromCharCode(0), '').trim();
  if (cleaned.length < 40)
    throw new Error('Not enough readable text. Scanned PDFs need OCR before import.');
  const blocks = cleaned.split(/(?=^#{1,3} .+$)|\n(?=(?:Chapter|Section)\s+\d+[:.\s])/m);
  const sections: TextSection[] = [];
  let currentChapter = title;
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.trim().split('\n');
    const heading = lines[0].replace(/^#+\s*/, '').trim();
    const blockTitle = heading.length <= 120 ? heading : title;
    if (/^#\s+/.test(lines[0]) || /^(Chapter|Part)\s+\d+/i.test(lines[0]))
      currentChapter = blockTitle;
    const paragraphs: string[] = [];
    let remaining = block.trim();
    while (remaining.length > 5000) {
      let boundary = remaining.lastIndexOf('\n', 5000);
      if (boundary < 2500) boundary = remaining.lastIndexOf(' ', 5000);
      if (boundary < 2500) boundary = 5000;
      paragraphs.push(remaining.slice(0, boundary));
      remaining = remaining.slice(boundary).trim();
    }
    if (remaining) paragraphs.push(remaining);
    for (const [index, paragraph] of paragraphs.entries()) {
      if (paragraph.trim().length < 40 && paragraphs.length === 1) continue;
      sections.push({
        title: `${blockTitle}${paragraphs.length > 1 ? ` - part ${index + 1}` : ''}`,
        text: paragraph.trim(),
        chapterTitle: currentChapter,
      });
    }
  }
  if (!sections.length) throw new Error('Not enough readable text to create sections.');
  return sections;
}

export async function extractDocument(
  buffer: Buffer,
  filename: string,
  perPage = false,
): Promise<TextSection[]> {
  if (!filename.toLowerCase().endsWith('.pdf'))
    return splitText(buffer.toString('utf8'), filename.replace(/\.[^.]+$/, ''));
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    if (perPage) {
      const pages = result.pages
        .filter((page) => page.text.trim().length > 5)
        .map((page) => ({
          title: `Page ${page.num}`,
          text: page.text.trim(),
          pageStart: page.num,
          pageEnd: page.num,
        }));
      if (!pages.length)
        throw new Error('No readable text found. Scanned PDFs need OCR before import.');
      return pages;
    }
    const lineFrequency = new Map<string, number>();
    for (const page of result.pages) {
      const uniqueLines = new Set(page.text.split('\n').map((line) => line.trim().toLowerCase()));
      for (const line of uniqueLines) lineFrequency.set(line, (lineFrequency.get(line) ?? 0) + 1);
    }
    const repeatedThreshold = Math.max(3, Math.ceil(result.pages.length * 0.15));
    const sections: TextSection[] = [];
    let pending = '';
    let start = 1;
    for (const page of result.pages) {
      if (!pending) start = page.num;
      pending += `\n${page.text}`;
      if (pending.length >= 4000 || page.num === result.pages.length) {
        if (pending.trim().length >= 40) {
          const heading = pending
            .trim()
            .split('\n')
            .find(
              (line) =>
                line.trim().length > 5 &&
                line.trim().length < 100 &&
                (lineFrequency.get(line.trim().toLowerCase()) ?? 0) < repeatedThreshold &&
                !/copyright|©|all rights reserved|https?:\/\/|www\.|^--\s*\d+/i.test(line),
            );
          sections.push({
            title: heading?.trim() ?? `Pages ${start}-${page.num}`,
            text: pending.trim(),
            pageStart: start,
            pageEnd: page.num,
          });
        }
        pending = '';
      }
    }
    if (!sections.length)
      throw new Error('No readable text found. Scanned PDFs need OCR before import.');
    return sections;
  } finally {
    await parser.destroy();
  }
}

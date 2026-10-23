import { PDFParse } from 'pdf-parse';

export interface TextSection {
  title: string;
  text: string;
  pageStart?: number;
  pageEnd?: number;
}

export function splitText(text: string, title = 'Notes'): TextSection[] {
  const cleaned = text.replace(/\r/g, '').replaceAll(String.fromCharCode(0), '').trim();
  if (cleaned.length < 40) throw new Error('Not enough readable text. Scanned PDFs need OCR before import.');
  const blocks = cleaned.split(/(?=^#{1,3} .+$)|\n(?=(?:Chapter|Section)\s+\d+[:.\s])/m);
  const sections: TextSection[] = [];
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.trim().split('\n');
    const heading = lines[0].replace(/^#+\s*/, '').trim();
    const blockTitle = heading.length <= 120 ? heading : title;
    const paragraphs = block.match(/[\s\S]{1,5000}(?:\n|$)/g) ?? [block];
    for (const [index, paragraph] of paragraphs.entries()) {
      if (paragraph.trim().length < 40) continue;
      sections.push({ title: `${blockTitle}${paragraphs.length > 1 ? ` - part ${index + 1}` : ''}`, text: paragraph.trim() });
    }
  }
  return sections;
}

export async function extractDocument(buffer: Buffer, filename: string): Promise<TextSection[]> {
  if (!filename.toLowerCase().endsWith('.pdf')) return splitText(buffer.toString('utf8'), filename.replace(/\.[^.]+$/, ''));
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const sections: TextSection[] = [];
    let pending = '';
    let start = 1;
    for (const page of result.pages) {
      if (!pending) start = page.num;
      pending += `\n${page.text}`;
      if (pending.length >= 4000 || page.num === result.pages.length) {
        if (pending.trim().length >= 40) {
          const heading = pending.trim().split('\n').find(line => line.trim().length > 5 && line.trim().length < 100);
          sections.push({ title: heading?.trim() ?? `Pages ${start}-${page.num}`, text: pending.trim(), pageStart: start, pageEnd: page.num });
        }
        pending = '';
      }
    }
    if (!sections.length) throw new Error('No readable text found. Scanned PDFs need OCR before import.');
    return sections;
  } finally {
    await parser.destroy();
  }
}
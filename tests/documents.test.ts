import { describe, expect, it } from 'vitest';
import { extractDocument, splitText } from '../server/documents';

describe('document sectioning', () => {
  it('preserves markdown section boundaries', () => {
    const sections = splitText('# Networking\nA VPC isolates resources in a virtual network for your account.\n## Subnets\nA subnet is a range of IP addresses inside a single availability zone.');
    expect(sections.map(section => section.title)).toEqual(['Networking', 'Subnets']);
  });
  it('rejects empty documents', () => expect(() => splitText('')).toThrow('readable text'));
  it('keeps long content rather than silently truncating it', () => {
    const text = 'This paragraph explains a useful networking concept.\n'.repeat(400);
    const sections = splitText(text);
    expect(sections.length).toBeGreaterThan(1);
    expect(sections.map(section => section.text).join('\n').replace(/\s/g, '')).toBe(text.replace(/\s/g, ''));
  });
  it('reads UTF-8 notes', async () => {
    const sections = await extractDocument(Buffer.from('# IAM\nUse IAM roles for workloads instead of long-lived access keys.'), 'notes.md');
    expect(sections[0].title).toBe('IAM');
  });
});
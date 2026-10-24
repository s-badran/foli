import { awsChapters } from './aws';

export const AWS_SLIDES_HASH = 'e95a915c20193e621e3773fefb98b4ad4bae53a8477fea0b9f07d7b552d5c06b';
const catalog = [
  { sourceHash: AWS_SLIDES_HASH, label: 'Tutor-authored AWS SAA-C03 v2', chapters: awsChapters },
];

export function findTutorPack(sourceHash: string | undefined) {
  return catalog.find((pack) => pack.sourceHash === sourceHash);
}

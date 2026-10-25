import { describe, expect, it } from 'vitest';
import { shuffleQuizOptions } from '../shared/quiz';

const quiz = [
  { options: ['A', 'B', 'C', 'D'] },
  { options: ['A', 'B'] },
  { options: ['only one'] },
];

describe('shuffleQuizOptions', () => {
  it('returns a permutation of every question options', () => {
    for (let run = 0; run < 25; run += 1) {
      const orders = shuffleQuizOptions(quiz);
      expect(orders).toHaveLength(quiz.length);
      orders.forEach((order, index) => {
        expect([...order].sort()).toEqual(quiz[index].options.map((_, position) => position));
      });
    }
  });

  it('never repeats the previous display order', () => {
    const random = () => 0;
    const first = shuffleQuizOptions(quiz, undefined, random);
    const second = shuffleQuizOptions(quiz, first, random);
    expect(second[0]).not.toEqual(first[0]);
    expect(second[1]).not.toEqual(first[1]);
    expect(second[2]).toEqual([0]);
  });

  it('handles missing quiz content', () => {
    expect(shuffleQuizOptions([])).toEqual([]);
  });
});

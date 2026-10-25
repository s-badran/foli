/**
 * Display-order shuffling for quiz options.
 *
 * Stored quizzes keep a canonical option order so `correctIndex` stays valid and
 * historical attempts remain comparable. The UI shuffles the *display* order on
 * every attempt and submits the original option indices, which keeps scoring and
 * section practice untouched while removing position memory as a shortcut.
 */

export interface ShuffleSource {
  options: string[];
  correctIndex: number;
}

function permutation(length: number): number[] {
  return Array.from({ length }, (_, index) => index);
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function sameOrder(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * One display order per question, e.g. `[[2, 0, 3, 1], [1, 0]]`.
 * A retry is guaranteed to differ from its previous order for every question
 * with at least two options, and the correct option is moved to a new display
 * slot when it would otherwise land in the same place. That keeps position
 * memory ("the answer is always C") from inflating a retry score.
 */
export function shuffleQuizOptions(
  quiz: ShuffleSource[],
  previous?: number[][],
  random: () => number = Math.random,
): number[][] {
  return quiz.map((question, questionIndex) => {
    const base = permutation(question.options.length);
    if (base.length < 2) return base;
    const prior = previous?.[questionIndex];
    const order = shuffled(base, random);
    if (prior && sameOrder(order, prior)) {
      [order[0], order[1]] = [order[1], order[0]];
    }
    const correct = question.correctIndex;
    if (prior && prior.length === order.length && correct >= 0 && correct < order.length) {
      const slot = order.indexOf(correct);
      if (slot === prior.indexOf(correct)) {
        const swap = (slot + 1) % order.length;
        [order[slot], order[swap]] = [order[swap], order[slot]];
      }
    }
    return order;
  });
}

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
 * with at least two options, so answers never sit in the same slots twice.
 */
export function shuffleQuizOptions(
  quiz: ShuffleSource[],
  previous?: number[][],
  random: () => number = Math.random,
): number[][] {
  return quiz.map((question, questionIndex) => {
    const base = permutation(question.options.length);
    if (base.length < 2) return base;
    const order = shuffled(base, random);
    if (previous?.[questionIndex] && sameOrder(order, previous[questionIndex])) {
      [order[0], order[1]] = [order[1], order[0]];
    }
    return order;
  });
}

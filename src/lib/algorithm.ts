import { CellState } from "./cellState";

interface Terms {
  minMaxTerms: number[];
  dontcares: number[];
}

// ex: implicant = 1-0- (where - is a dash) would be represented as:
// ones = 8 (0b1000)
// dashes = 5 (0b0101)
// minterms = [8  (0b1000),
//             9  (0b1001),
//             12 (0b1100),
//             13 (0b1101)]
//
// 8 + 9  first combine to 100-
// 12 + 13 then combine to 110-
// then 100- and 110- combine to 1-0-
//
export class Implicant {
  readonly ones: number; // binary representation of the 1s in the implicant
  readonly dashes: number; // binary representation of the cancelled bits in the implicant
  readonly terms: number[]; // original terms (min/max terms + dontcares) covered by the implicant

  covered: number[] = []; // just the min/max terms covered by the implicant (for building the coverage map)

  constructor(ones: number, dashes: number, terms: number[]) {
    this.ones = ones;
    this.dashes = dashes;
    this.terms = terms;
  }

  static fromMinMaxTerm(minMaxTerm: number): Implicant {
    return new Implicant(minMaxTerm, 0, [minMaxTerm]);
  }

  key(): string {
    return `${this.ones}|${this.dashes}`;
  }
}

// A function's outputs indexed by term number, exposing the term groupings
// (minterms / maxterms / don't-cares) the minimizer works from.
export class Table {
  outputs: CellState[];

  constructor(outputs: CellState[]) {
    this.outputs = outputs;
  }

  get numVars(): number {
    return Math.log2(this.outputs.length);
  }

  private termsWith(state: CellState): number[] {
    return this.outputs.flatMap((s, i) => (s === state ? [i] : []));
  }

  get minterms(): number[] {
    return this.termsWith(CellState.True);
  }

  get maxterms(): number[] {
    return this.termsWith(CellState.False);
  }

  get dontcares(): number[] {
    return this.termsWith(CellState.Any);
  }

  toTerms(isPOS: boolean): Terms {
    return {
      minMaxTerms: isPOS ? this.maxterms : this.minterms,
      dontcares: this.dontcares,
    };
  }
}

// count # of 1-bits (popcount)
function countOnes(x: number): number {
  let count = 0;
  while (x) {
    count += x & 1;
    x >>= 1;
  }
  return count;
}

// check if 2 implicants can be combined: differ in exactly one bit and have the same dashes
function canCombine(a: Implicant, b: Implicant): boolean {
  if (a.dashes !== b.dashes) {
    return false;
  }
  return countOnes(a.ones ^ b.ones) === 1;
}

// combine 2 implicants into a new implicant with the differing bit as a dash
function combine(a: Implicant, b: Implicant): Implicant {
  return new Implicant(
    a.ones & b.ones, // common 1s (1 & 1 = 1), differing bits (1 & 0 = 0)
    a.dashes | (a.ones ^ b.ones), // set the differing bit as 1 (0 | 1 = 1) @ diff pos
    [...a.terms, ...b.terms],
  );
}

// implicants are any group of 1s (or 1s and xs) in a k-map
// prime implicants are maximal implicants (cannot be grown further)
function findPrimeImplicants(terms: Terms): Implicant[] {
  let frontier = [...terms.minMaxTerms, ...terms.dontcares].map(
    Implicant.fromMinMaxTerm,
  );

  const primeImplicants: Implicant[] = [];

  // similar to BFS: repeatedly combine adjacent implicants until no more combinations are possible
  while (frontier.length > 0) {
    // newFrontier is a map to de-duplicate combined implicants (multiple pairs can combine to the same implicant)
    const newFrontier: Map<string, Implicant> = new Map();
    // implicants that could not be combined are prime implicants
    // `used` tracks which implicants were combined
    const used = new Set<string>();

    for (let i = 0; i < frontier.length; i++) {
      for (let j = i + 1; j < frontier.length; j++) {
        const a = frontier[i];
        const b = frontier[j];

        if (canCombine(a, b)) {
          const combined = combine(a, b);

          newFrontier.set(combined.key(), combined);
          used.add(a.key());
          used.add(b.key());
        }
      }
    }

    for (const implicant of frontier) {
      if (!used.has(implicant.key())) {
        primeImplicants.push(implicant);
      }
    }

    frontier = Array.from(newFrontier.values());
  }

  const minMaxTerms = new Set(terms.minMaxTerms);
  for (const implicant of primeImplicants) {
    // only the original min/max terms (not dontcares) need to be covered by the prime implicants
    implicant.covered = implicant.terms.filter((t) => minMaxTerms.has(t));
  }

  return primeImplicants;
}

// search steps before settling for the best cover found so far: up to 7
// variables the minimum turns up well within this; a few 8-variable functions
// would otherwise take minutes, and may get a few more groups than the minimum
const SEARCH_BUDGET = 4000;

// find a "cover": a subset of prime implicants that minimally cover all min/max terms together
//
// "minimal" means fewest prime implicants, and among those, the most dashes in
// total (fewest literals in the expression).
//
// this is the set cover problem, solved exactly by branch and bound:
// 1. reduce the problem as far as possible without guessing:
//   a. essential prime implicants: if a min/max term is covered by only one PI,
//      that PI must be in every cover, so take it
//   b. row dominance: if PI b covers every still-uncovered term that PI a
//      covers, and has at least as many dashes, any cover using a can swap in b
//      and be no worse, so drop a
//   c. column dominance: if every PI covering term s also covers term t, then
//      covering s covers t too, so stop tracking t
//   (each step can expose more of the others, so repeat until none applies)
// 2. prune a branch as soon as it provably can't beat the best cover found so far
// 3. if terms remain (a "cyclic core"), pick the remaining term with the fewest
//    covering PIs: one of them must be chosen, so try each in turn and recurse
//
// state is kept in flag arrays, which stay cheap to test and copy at every
// step: uncovered[t] is 1 while the t-th min/max term still needs covering, and
// available[p] is 1 while the p-th PI may still be chosen
function selectCover(
  primeImplicants: Implicant[],
  minMaxTerms: number[],
): Implicant[] {
  const termCount = minMaxTerms.length;
  const termOf = new Map(minMaxTerms.map((m, i) => [m, i]));
  // the min/max terms each PI covers, the PIs covering each min/max term, and
  // a lookup of whether PI p covers term t (covers[p * termCount + t])
  const termsOf = primeImplicants.map((pi) =>
    pi.covered.map((m) => termOf.get(m)!),
  );
  const coverers: number[][] = minMaxTerms.map(() => []);
  const covers = new Uint8Array(primeImplicants.length * termCount);
  termsOf.forEach((terms, p) => {
    for (const t of terms) {
      coverers[t].push(p);
      covers[p * termCount + t] = 1;
    }
  });
  const dashes = primeImplicants.map((pi) => countOnes(pi.dashes));

  // uncovered with the given PI's terms crossed off
  const take = (uncovered: Uint8Array, p: number) => {
    const next = uncovered.slice();
    for (const t of termsOf[p]) next[t] = 0;
    return next;
  };

  let best: number[] | null = null;
  let bestDashes = -1;
  let steps = 0;

  const search = (
    uncovered: Uint8Array,
    available: Uint8Array,
    chosen: number[],
    chosenDashes: number,
  ): void => {
    if (++steps > SEARCH_BUDGET && best !== null) return;

    // the uncovered terms a PI still covers
    const left = (p: number) => termsOf[p].filter((t) => uncovered[t]);
    // the uncovered terms, each with the PIs still available to cover it
    let terms: { index: number; pis: number[] }[];

    // 1. reduce until nothing more can be taken or dropped
    for (;;) {
      terms = [];
      for (let t = 0; t < termCount; t++) {
        if (uncovered[t])
          terms.push({
            index: t,
            pis: coverers[t].filter((p) => available[p]),
          });
      }
      if (terms.length === 0) {
        if (
          best === null ||
          chosen.length < best.length ||
          (chosen.length === best.length && chosenDashes > bestDashes)
        ) {
          best = chosen;
          bestDashes = chosenDashes;
        }
        return;
      }

      // a. essential. taking one can't make another term lone (any term
      // sharing its PI is now covered), so take them all in one sweep
      const lone = terms.filter((t) => t.pis.length === 1);
      if (lone.length > 0) {
        available = available.slice();
        for (const { index, pis } of lone) {
          const p = pis[0];
          if (!uncovered[index]) continue;
          uncovered = take(uncovered, p);
          available[p] = 0;
          chosen = [...chosen, p];
          chosenDashes += dashes[p];
        }
        continue;
      }

      // b. row dominance. b can only dominate a if it covers a's first
      // uncovered term, so only those PIs need checking (on an exact tie, the
      // lower-numbered PI is kept)
      const dropped: number[] = [];
      available.forEach((isAvailable, a) => {
        if (!isAvailable) return;
        const mine = left(a);
        if (mine.length === 0) {
          dropped.push(a); // covers nothing new
          return;
        }
        const dominated = coverers[mine[0]].some((b) => {
          if (b === a || !available[b]) return false;
          if (!mine.every((t) => covers[b * termCount + t])) return false;
          // b covers a superset, so the sets are equal exactly when the sizes are
          const same = left(b).length === mine.length;
          return (
            dashes[b] > dashes[a] ||
            (dashes[b] === dashes[a] && (!same || b < a))
          );
        });
        if (dominated) dropped.push(a);
      });
      if (dropped.length > 0) {
        available = available.slice();
        for (const p of dropped) available[p] = 0;
        continue;
      }

      // c. column dominance. s can only dominate t if every PI covering s
      // covers t, so s's first PI is among t's (on a tie, the lower-numbered
      // term is kept)
      const byFirstPI = new Map<number, typeof terms>();
      for (const t of terms) {
        const list = byFirstPI.get(t.pis[0]) ?? [];
        list.push(t);
        byFirstPI.set(t.pis[0], list);
      }
      const dominated = terms.filter((t) =>
        t.pis.some((p) =>
          (byFirstPI.get(p) ?? []).some(
            (s) =>
              s !== t &&
              s.pis.every((q) => covers[q * termCount + t.index]) &&
              (s.pis.length < t.pis.length || s.index < t.index),
          ),
        ),
      );
      if (dominated.length > 0) {
        uncovered = uncovered.slice();
        for (const t of dominated) uncovered[t.index] = 0;
        continue;
      }
      break;
    }

    // the most constrained (fewest covering PIs) terms first
    terms.sort((x, y) => x.pis.length - y.pis.length);

    // 2. bound: terms that share no PI each need a PI of their own, so at least
    // this many more PIs are needed
    const free = uncovered.slice();
    let needed = 0;
    for (const { index, pis } of terms) {
      if (!free[index]) continue;
      needed++;
      for (const p of pis) for (const t of termsOf[p]) free[t] = 0;
    }
    if (best !== null) {
      const count = chosen.length + needed;
      if (count > best.length) return;
      // to win on a tie the needed PIs must add more dashes, and at best
      // they're the ones left with the most
      if (count === best.length) {
        const mostDashes = dashes
          .filter((_, p) => available[p])
          .sort((a, b) => b - a)
          .slice(0, needed)
          .reduce((sum, d) => sum + d, 0);
        if (chosenDashes + mostDashes <= bestDashes) return;
      }
    }

    // 3. branch on the most constrained term: one of its PIs must be chosen;
    // try the PIs covering the most uncovered terms (then most dashes) first.
    // once a PI's branch is done, every cover containing it has been seen, so
    // later branches leave it out
    const gain = new Map(terms[0].pis.map((p) => [p, left(p).length]));
    const options = [...terms[0].pis].sort(
      (a, b) => gain.get(b)! - gain.get(a)! || dashes[b] - dashes[a],
    );
    const rest = available.slice();
    for (const p of options) {
      rest[p] = 0;
      search(
        take(uncovered, p),
        rest.slice(),
        [...chosen, p],
        chosenDashes + dashes[p],
      );
    }
  };

  search(
    new Uint8Array(termCount).fill(1),
    new Uint8Array(primeImplicants.length).fill(1),
    [],
    0,
  );

  // a search cut short can keep a PI whose terms the others all cover; drop
  // those, fewest dashes first (a complete search never keeps one)
  const picked = [...best!].sort((a, b) => dashes[a] - dashes[b]);
  for (const p of [...picked]) {
    const covered = termsOf[p].every((t) =>
      picked.some((q) => q !== p && covers[q * termCount + t]),
    );
    if (covered) picked.splice(picked.indexOf(p), 1);
  }

  return picked.sort((a, b) => a - b).map((p) => primeImplicants[p]);
}

// The minimal set of prime implicants (groups) chosen to cover the function.
// For SOP these are groups of minterms; for POS, groups of maxterms.
export function computeCover(table: Table, isPOS: boolean): Implicant[] {
  const { minMaxTerms, dontcares } = table.toTerms(isPOS);
  const implicants = findPrimeImplicants({ minMaxTerms, dontcares });
  return selectCover(implicants, minMaxTerms);
}

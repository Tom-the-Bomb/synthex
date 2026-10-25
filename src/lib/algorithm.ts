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

// count # of 1-bits (popcount). Accepts a number (variable masks, <= 8 bits) or a
// bigint (sets of min/max terms, which can exceed 32 bits).
function countOnes(x: number | bigint): number {
  let n = BigInt(x);
  let count = 0;
  while (n) {
    count += Number(n & 1n);
    n >>= 1n;
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

  for (const implicant of primeImplicants) {
    // only the original min/max terms (not dontcares) need to be covered by the prime implicants
    implicant.covered = implicant.terms.filter((t) =>
      terms.minMaxTerms.includes(t),
    );
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
// sets of min/max terms are bitmasks (bigint, since there can be up to 256
// terms): bit i is the i-th min/max term
function selectCover(
  primeImplicants: Implicant[],
  minMaxTerms: number[],
): Implicant[] {
  const termBits = minMaxTerms.map((_, i) => 1n << BigInt(i));
  const termOf = new Map(minMaxTerms.map((m, i) => [m, i]));
  const indexOfBit = new Map(termBits.map((bit, i) => [bit, i]));
  // the min/max terms each PI covers, and its dash count (the tiebreaker)
  const masks = primeImplicants.map((pi) =>
    pi.covered.reduce((mask, m) => mask | termBits[termOf.get(m)!], 0n),
  );
  const dashes = primeImplicants.map((pi) => countOnes(pi.dashes));
  // the PIs covering each min/max term
  const coverers: number[][] = minMaxTerms.map(() => []);
  primeImplicants.forEach((pi, p) => {
    for (const m of pi.covered) coverers[termOf.get(m)!].push(p);
  });

  let best: number[] | null = null;
  let bestDashes = -1;
  let steps = 0;

  const search = (
    uncovered: bigint,
    available: Set<number>,
    chosen: number[],
    chosenDashes: number,
  ): void => {
    if (++steps > SEARCH_BUDGET && best !== null) return;

    // the uncovered terms, each with the PIs still available to cover it
    let terms: { index: number; pis: number[] }[];

    // 1. reduce until nothing more can be taken or dropped
    for (;;) {
      if (uncovered === 0n) {
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

      terms = [];
      termBits.forEach((bit, index) => {
        if ((uncovered & bit) !== 0n)
          terms.push({
            index,
            pis: coverers[index].filter((p) => available.has(p)),
          });
      });
      const byIndex = new Map(terms.map((t) => [t.index, t]));

      // a. essential
      const lone = terms.find((t) => t.pis.length === 1);
      if (lone) {
        const p = lone.pis[0];
        uncovered &= ~masks[p];
        available = new Set(available);
        available.delete(p);
        chosen = [...chosen, p];
        chosenDashes += dashes[p];
        continue;
      }

      // b. row dominance. b can only dominate a if it covers a's first
      // uncovered term, so only those PIs need checking (on an exact tie, the
      // lower-numbered PI is kept)
      const dropped = [...available].filter((a) => {
        const ma = masks[a] & uncovered;
        if (ma === 0n) return true; // covers nothing new
        const first = byIndex.get(indexOfBit.get(ma & -ma)!)!;
        return first.pis.some((b) => {
          const mb = masks[b] & uncovered;
          return (
            b !== a &&
            (ma & mb) === ma &&
            (dashes[b] > dashes[a] ||
              (dashes[b] === dashes[a] && (ma !== mb || b < a)))
          );
        });
      });
      if (dropped.length > 0) {
        available = new Set(available);
        for (const p of dropped) available.delete(p);
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
      let dominated = 0n;
      for (const t of terms) {
        const covering = new Set(t.pis);
        const isDominated = t.pis.some((p) =>
          (byFirstPI.get(p) ?? []).some(
            (s) =>
              s !== t &&
              s.pis.every((q) => covering.has(q)) &&
              (s.pis.length < t.pis.length || s.index < t.index),
          ),
        );
        if (isDominated) dominated |= termBits[t.index];
      }
      if (dominated !== 0n) {
        uncovered &= ~dominated;
        continue;
      }
      break;
    }

    // the most constrained (fewest covering PIs) terms first
    terms.sort((x, y) => x.pis.length - y.pis.length);

    // 2. bound: terms that share no PI each need a PI of their own, so at least
    // this many more PIs are needed
    let free = uncovered;
    let needed = 0;
    for (const { index, pis } of terms) {
      if ((free & termBits[index]) === 0n) continue;
      needed++;
      for (const p of pis) free &= ~masks[p];
    }
    if (best !== null) {
      const count = chosen.length + needed;
      if (count > best.length) return;
      // to win on a tie the needed PIs must add more dashes, and at best
      // they're the ones left with the most
      if (count === best.length) {
        const mostDashes = [...available]
          .map((p) => dashes[p])
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
    const gain = new Map(
      terms[0].pis.map((p) => [p, countOnes(masks[p] & uncovered)]),
    );
    const options = [...terms[0].pis].sort(
      (a, b) => gain.get(b)! - gain.get(a)! || dashes[b] - dashes[a],
    );
    const rest = new Set(available);
    for (const p of options) {
      rest.delete(p);
      search(
        uncovered & ~masks[p],
        new Set(rest),
        [...chosen, p],
        chosenDashes + dashes[p],
      );
    }
  };

  const all = termBits.reduce((mask, bit) => mask | bit, 0n);
  search(all, new Set(primeImplicants.keys()), [], 0);

  // a search cut short can keep a PI whose terms the others all cover; drop
  // those, fewest dashes first (a complete search never keeps one)
  const picked = [...best!].sort((a, b) => dashes[a] - dashes[b]);
  for (const p of [...picked]) {
    const others = picked
      .filter((q) => q !== p)
      .reduce((mask, q) => mask | masks[q], 0n);
    if ((masks[p] & ~others) === 0n) picked.splice(picked.indexOf(p), 1);
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

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

export class Table {
  inputs: number[] = [];
  outputs: CellState[] = [];

  constructor(inputs: number[] = [], outputs: CellState[] = []) {
    this.inputs = inputs;
    this.outputs = outputs;
  }

  get numVars(): number {
    return Math.log2(this.inputs.length);
  }

  get minterms(): number[] {
    return this.inputs.filter((_, i) => this.outputs[i] === CellState.True);
  }

  get maxterms(): number[] {
    return this.inputs.filter((_, i) => this.outputs[i] === CellState.False);
  }

  get dontcares(): number[] {
    return this.inputs.filter((_, i) => this.outputs[i] === CellState.Any);
  }

  toTerms(isPOS: boolean): Terms {
    return isPOS
      ? { minMaxTerms: this.maxterms, dontcares: this.dontcares }
      : { minMaxTerms: this.minterms, dontcares: this.dontcares };
  }
}

// gray code of an index: gray(0,1,2,3,...) = 0 (00), 1 (01), 3 (11), 2 (10), 6 (110), 7 (111), 5 (101), 4 (100), ...
// consecutive indices differ in exactly one bit, which is precisely why adjacent K-map cells differ in a single variable.
function gray(x: number) {
  return x ^ (x >> 1);
}

// term = gray(row) * (number of columns) + gray(col)
//
// multiplying the binary equiv of the MS graycode part
// by the column count shifts the row bits to the left of the column bits
// i.e. a * c = a << i where c=2^i (where i = # bits/vars per col, c = # cols)
//
function gridToTerms(grid: CellState[][], isPOS: boolean): Terms {
  const minMaxTerms = [];
  const dontcares = [];
  const cols = grid[0].length;

  const target = isPOS ? CellState.False : CellState.True;

  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < cols; j++) {
      const term = gray(i) * cols + gray(j);
      if (grid[i][j] === CellState.Any) {
        dontcares.push(term);
      } else if (grid[i][j] === target) {
        minMaxTerms.push(term);
      }
    }
  }

  return { minMaxTerms, dontcares };
}

// count # of 1-bits
function countOnes(x: number): number {
  let count = 0;
  while (x) {
    count += x & 1;
    x >>= 1;
  }
  return count;
}

// count # of 1-bits in a bigint (cover bitmasks can exceed 32 bits)
function countOnesBig(x: bigint): number {
  let count = 0;
  while (x) {
    count += Number(x & 1n);
    x >>= 1n;
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

// implement P + PQ  = P
// drop PQ if as P already exists in SOP
// => drop any product that is a superset of another product (contains another product as subset)
function absorb(products: bigint[]): bigint[] {
  // (p1 & p2) === p2
  //
  // Ex:
  // p1      = 1011 (P1, P3, P4)
  // p2      = 0011     (P3, P4)
  // p1 & p2 = 0011 = p2 => p1 is a superset of p2, so we can drop p1
  // p1 has all the bits of p2, and maybe more => p1 is redundant superset
  //
  // NOTE: each product is saying that the AND of all its
  // 1-bits represents the set of PIs that are needed to cover
  // so that's why a superset product is redundant as it covers the same, just with more 1-bits / pis.
  return products.filter(
    (p1) => !products.some((p2) => p1 !== p2 && (p1 & p2) === p2),
  );
}

// find a "cover": a subset of prime implicants that minimally cover all min/max terms together
function selectCover(
  primeImplicants: Implicant[],
  minMaxTerms: number[],
): Implicant[] {
  // build a map of min/max term -> indices of prime implicants that cover it
  // initialize values with empty arrays for all min/max terms
  const minMaxTermToPIs: Map<number, number[]> = new Map(
    minMaxTerms.map((m) => [m, []]),
  );
  for (const [idx, pi] of primeImplicants.entries()) {
    for (const minMaxTerm of pi.covered) {
      minMaxTermToPIs.get(minMaxTerm)!.push(idx);
    }
  }

  // Petrick's method:
  //
  // assign a boolean var P_i to each prime implicant (1 if selected, 0 if not)
  // for each min/max term, write a sum term: P_i + P_j + ... for all prime implicants that cover the min/max term
  // since you just need 1 of the covering prime implicants to cover the min/max term
  //
  // multiply all the sum terms together (distribute) to get a product of sums expression (all min/max terms covered)
  //
  // the solution is the values of P_i that result in the POS = 1
  //
  // method to solve:
  // 1. multiply out to a SOP
  // 2. apply:
  //   a. Idempotency: P * P = P (only need 1 of the same prime implicant)
  //   b. Absorption:  P + PQ = P if {P} already works, then {P, Q} is just a bigger implicant that's wasteful
  //

  // for our programmatic computation:
  // we store a set of prime implicants as a bigint
  // where its i-th bit represents the presence or absence (1 or 0) of the i-th prime implicant
  // (bigint, not number, since there can be >32 prime implicants for n>=5 variables)
  //
  // original POS expanded => SOP
  // in which each element in `sop` is an option to cover the entire function,
  // and each option is a product: a combination of PIs, (AND) represented as a bitmask
  let sop = [0n];

  for (const PIs of minMaxTermToPIs.values()) {
    // distribution: multiply current SOP with the new sum term (PIs)
    // product * (P_i + P_j + ...) = product * P_i + product * P_j + ...
    //
    // since we are using bitmasks:
    // more specifically product * P_i means set i-th bit of product to 1
    // since P_i is just a single bit (1, as we are including it!)
    const newSop = sop.flatMap((product) =>
      PIs.map((idx) => product | (1n << BigInt(idx))),
    );

    // use set to de-duplicate SOP terms -> apply absorption
    sop = absorb([...new Set(newSop)]);
  }

  // tiebreaker: choose product term with least # of actual terms within its PIs
  const numDashes = (product: bigint): number => {
    let count = 0;
    for (let i = 0; i < primeImplicants.length; i++) {
      if (product & (1n << BigInt(i))) {
        count += countOnes(primeImplicants[i].dashes);
      }
    }
    return count;
  };

  // choose term out of SOP with least 1s => least PIs
  const min = sop.reduce((a, b) => {
    const APICount = countOnesBig(a);
    const BPICount = countOnesBig(b);

    return APICount === BPICount
      ? numDashes(a) > numDashes(b)
        ? a
        : b
      : APICount < BPICount
        ? a
        : b;
  });

  // convert bitmask back to prime implicants
  // i-th bit is 1 => i-th PI selected
  return primeImplicants.filter((_, i) => (min & (1n << BigInt(i))) !== 0n);
}

// convert a list of prime implicants to a string expression (SOP or POS) in LaTeX format
function implicantsToExpression(
  implicants: Implicant[],
  numVars: number,
  isPOS: boolean,
): string {
  if (implicants.length === 0) {
    // if no implicants, then function is always False (for SOP) or always True (for POS)
    return isPOS ? "1" : "0";
  }

  return implicants
    .map((implicant) => {
      const term = [];

      for (let i = numVars - 1; i >= 0; i--) {
        const mask = 1 << i;

        if ((implicant.dashes & mask) !== 0) {
          continue;
        } else if (((implicant.ones & mask) !== 0) !== isPOS) {
          // if isPOS=true and (bit is 1)=false => x_i
          // if isPOS=false and (bit is 1)=true => x_i
          //
          // => (bit is 1) !== isPOS => x_i
          term.push(`x_{${i + 1}}`);
        } else {
          term.push(`\\overline{x_{${i + 1}}}`);
        }
      }
      if (term.length === 0) {
        return isPOS ? "0" : "1";
      }

      if (!isPOS) {
        return term.join("\\,");
      }
      // a single-literal sum term needs no wrapping parentheses
      return term.length === 1 ? term[0] : `(${term.join(" + ")})`;
    })
    .join(isPOS ? "\\," : " + ");
}

function termsAndVars(
  cells: CellState[][] | Table,
  isPOS: boolean,
): Terms & { numVars: number } {
  if (cells instanceof Table) {
    return { ...cells.toTerms(isPOS), numVars: cells.numVars };
  }
  return {
    ...gridToTerms(cells, isPOS),
    numVars: Math.log2(cells.length * cells[0].length),
  };
}

// The minimal set of prime implicants (groups) chosen to cover the function.
// For SOP these are groups of minterms; for POS, groups of maxterms.
export function computeCover(
  cells: CellState[][] | Table,
  isPOS: boolean,
): Implicant[] {
  const { minMaxTerms, dontcares } = termsAndVars(cells, isPOS);
  const implicants = findPrimeImplicants({ minMaxTerms, dontcares });
  return selectCover(implicants, minMaxTerms);
}

// convert a list of cells (or a Table) to a string expression (SOP or POS) in LaTeX format
export default function computeExpression(
  cells: CellState[][] | Table,
  isPOS: boolean,
): string {
  const { numVars } = termsAndVars(cells, isPOS);
  return implicantsToExpression(computeCover(cells, isPOS), numVars, isPOS);
}

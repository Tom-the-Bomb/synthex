import { computeCover, type Implicant, type Table } from "./algorithm";

// Presentation layer: turns a minimized cover (Implicant[]) into a displayable
// boolean expression. Kept separate from algorithm.ts so the minimizer stays
// pure math with no knowledge of LaTeX / rendering.

export interface Literal {
  bit: number; // 0-based bit index; the variable shown is x_{bit + 1}
  complemented: boolean;
}

// The literals of an implicant: which variables survive (dashes are dropped) and
// whether each is complemented. A bit that is 1 gives an uncomplemented literal
// for SOP but a complemented one for POS (and vice versa), i.e. complemented when
// (bit is 1) === isPOS. Shared by the LaTeX (Output) and DOM (K-map) renderers.
export function implicantLiterals(
  implicant: Implicant,
  numVars: number,
  isPOS: boolean,
): Literal[] {
  const literals: Literal[] = [];
  for (let bit = numVars - 1; bit >= 0; bit--) {
    const mask = 1 << bit;
    if (implicant.dashes & mask) {
      continue;
    }
    literals.push({
      bit,
      complemented: ((implicant.ones & mask) !== 0) === isPOS,
    });
  }
  return literals;
}

// convert a single prime implicant to its LaTeX literal:
// a product of literals for SOP, a (parenthesised) sum for POS
function implicantLatex(
  implicant: Implicant,
  numVars: number,
  isPOS: boolean,
): string {
  const literals = implicantLiterals(implicant, numVars, isPOS);
  if (literals.length === 0) {
    return isPOS ? "0" : "1";
  }
  const parts = literals.map(({ bit, complemented }) =>
    complemented ? `\\overline{x_{${bit + 1}}}` : `x_{${bit + 1}}`,
  );
  if (!isPOS) {
    return parts.join("\\,");
  }
  // a single-literal sum term needs no wrapping parentheses
  return parts.length === 1 ? parts[0] : `(${parts.join(" + ")})`;
}

// The LaTeX literals of the minimized cover, one per group (an SOP product or a
// POS sum term), or a single "1"/"0" when the function is constant.
export function minimizedTerms(table: Table, isPOS: boolean): string[] {
  const cover = computeCover(table, isPOS);
  if (cover.length === 0) {
    // no implicants => function is always False (SOP) or always True (POS)
    return [isPOS ? "1" : "0"];
  }
  return cover.map((implicant) =>
    implicantLatex(implicant, table.numVars, isPOS),
  );
}

// the join between cover terms: " + " for an SOP sum, juxtaposition for a POS product
export function coverSeparator(isPOS: boolean): string {
  return isPOS ? "\\," : " + ";
}

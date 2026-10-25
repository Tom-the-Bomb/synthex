import type { Implicant } from "./algorithm";

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

// one implicant as a product of literals (SOP) or a parenthesised sum (POS)
function formatImplicant(
  implicant: Implicant,
  numVars: number,
  isPOS: boolean,
  literal: (literal: Literal) => string,
  and: string,
): string {
  const parts = implicantLiterals(implicant, numVars, isPOS).map(literal);
  if (parts.length === 0) {
    return isPOS ? "0" : "1";
  }
  if (!isPOS) {
    return parts.join(and);
  }
  // a single-literal sum term needs no wrapping parentheses
  return parts.length === 1 ? parts[0] : `(${parts.join(" + ")})`;
}

const latexLiteral = ({ bit, complemented }: Literal) =>
  complemented ? `\\overline{x_{${bit + 1}}}` : `x_{${bit + 1}}`;

const textLiteral = ({ bit, complemented }: Literal) =>
  `x${bit + 1}${complemented ? "'" : ""}`;

export function implicantLatex(
  implicant: Implicant,
  numVars: number,
  isPOS: boolean,
): string {
  return formatImplicant(implicant, numVars, isPOS, latexLiteral, "\\,");
}

// The LaTeX terms of a minimized cover, one per group, or a single "1"/"0"
// when the function is constant.
export function coverTerms(
  cover: Implicant[],
  numVars: number,
  isPOS: boolean,
): string[] {
  // no implicants => function is always False (SOP) or always True (POS)
  if (cover.length === 0) {
    return [isPOS ? "1" : "0"];
  }
  return cover.map((implicant) => implicantLatex(implicant, numVars, isPOS));
}

// A minimized cover in the expression input's syntax, so a copied answer
// pastes straight back in.
export function coverText(
  cover: Implicant[],
  numVars: number,
  isPOS: boolean,
): string {
  if (cover.length === 0) {
    return isPOS ? "1" : "0";
  }
  return cover
    .map((implicant) =>
      formatImplicant(implicant, numVars, isPOS, textLiteral, ""),
    )
    .join(isPOS ? "" : " + ");
}

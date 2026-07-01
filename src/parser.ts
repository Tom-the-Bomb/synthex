import { CellState } from "./cellState";
import { MAX_VARS } from "./kmap";

type Token =
  | { type: "var"; index: number; pos: number }
  | { type: "const"; value: boolean; pos: number }
  | { type: "or"; pos: number }
  | { type: "and"; pos: number }
  | { type: "not"; pos: number } // prefix ! or ~
  | { type: "prime"; pos: number } // postfix '
  | { type: "("; pos: number }
  | { type: ")"; pos: number };

type Node =
  | { kind: "var"; index: number }
  | { kind: "const"; value: boolean }
  | { kind: "not"; arg: Node }
  | { kind: "and"; left: Node; right: Node }
  | { kind: "or"; left: Node; right: Node };

const label = (token: Token): string => {
  switch (token.type) {
    case "var":
      return `x${token.index}`;
    case "const":
      return token.value ? "1" : "0";
    case "or":
      return "+";
    case "and":
      return "*";
    case "not":
      return "!";
    case "prime":
      return "'";
    default:
      return token.type;
  }
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    const pos = i;
    if (/\s/.test(c)) {
      i++;
    } else if (c === "x" || c === "X") {
      i++;
      if (input[i] === "_") {
        i++;
      }
      let digits = "";
      while (i < input.length && input[i] >= "0" && input[i] <= "9") {
        digits += input[i++];
      }
      if (digits === "") {
        throw new Error(
          `expected a variable index after "x" (position ${pos + 1})`,
        );
      }
      tokens.push({ type: "var", index: Number(digits), pos });
    } else if (c === "0" || c === "1") {
      tokens.push({ type: "const", value: c === "1", pos });
      i++;
    } else if (c === "+" || c === "|") {
      tokens.push({ type: "or", pos });
      i++;
    } else if (c === "*" || c === "." || c === "&") {
      tokens.push({ type: "and", pos });
      i++;
    } else if (c === "!" || c === "~") {
      tokens.push({ type: "not", pos });
      i++;
    } else if (c === "'") {
      tokens.push({ type: "prime", pos });
      i++;
    } else if (c === "(") {
      tokens.push({ type: "(", pos });
      i++;
    } else if (c === ")") {
      tokens.push({ type: ")", pos });
      i++;
    } else {
      throw new Error(`unexpected character "${c}" (position ${pos + 1})`);
    }
  }
  return tokens;
}

function parse(tokens: Token[]): Node {
  let pos = 0;
  const peek = () => tokens[pos];

  const startsFactor = (token: Token): boolean =>
    token.type === "var" ||
    token.type === "const" ||
    token.type === "(" ||
    token.type === "not";

  function parseOr(): Node {
    let node = parseAnd();
    while (peek()?.type === "or") {
      pos++;
      node = { kind: "or", left: node, right: parseAnd() };
    }
    return node;
  }

  function parseAnd(): Node {
    let node = parseUnary();
    for (let token = peek(); token; token = peek()) {
      if (token.type === "and") {
        pos++;
      } else if (!startsFactor(token)) {
        break;
      }
      node = { kind: "and", left: node, right: parseUnary() };
    }
    return node;
  }

  function parseUnary(): Node {
    if (peek()?.type === "not") {
      pos++;
      return { kind: "not", arg: parseUnary() };
    }
    let node = parsePrimary();
    while (peek()?.type === "prime") {
      pos++;
      node = { kind: "not", arg: node };
    }
    return node;
  }

  function parsePrimary(): Node {
    const token = peek();
    if (!token) {
      throw new Error("unexpected end of expression");
    }
    if (token.type === "(") {
      pos++;
      const inner = parseOr();
      if (peek()?.type !== ")") {
        throw new Error('expected ")"');
      }
      pos++;
      return inner;
    }
    if (token.type === "var") {
      pos++;
      return { kind: "var", index: token.index };
    }
    if (token.type === "const") {
      pos++;
      return { kind: "const", value: token.value };
    }
    throw new Error(`unexpected "${label(token)}" (position ${token.pos + 1})`);
  }

  const node = parseOr();
  const trailing = peek();
  if (trailing) {
    throw new Error(
      `unexpected "${label(trailing)}" (position ${trailing.pos + 1})`,
    );
  }
  return node;
}

function evaluate(node: Node, assignment: number): boolean {
  switch (node.kind) {
    case "var":
      return ((assignment >> (node.index - 1)) & 1) === 1;
    case "const":
      return node.value;
    case "not":
      return !evaluate(node.arg, assignment);
    case "and":
      return (
        evaluate(node.left, assignment) && evaluate(node.right, assignment)
      );
    case "or":
      return (
        evaluate(node.left, assignment) || evaluate(node.right, assignment)
      );
  }
}

function highestVar(node: Node): number {
  switch (node.kind) {
    case "var":
      return node.index;
    case "const":
      return 0;
    case "not":
      return highestVar(node.arg);
    case "and":
    case "or":
      return Math.max(highestVar(node.left), highestVar(node.right));
  }
}

// Parse a boolean expression into a truth table, or throw an Error describing
// why it is invalid. The table uses at least `minVars` variables, growing only
// if the expression references a higher-indexed variable.
export function parseExpression(
  input: string,
  minVars = 1,
): { numVars: number; outputs: CellState[] } {
  if (input.trim() === "") {
    throw new Error("enter an expression");
  }
  const ast = parse(tokenize(input));
  const highest = highestVar(ast);
  if (highest > MAX_VARS) {
    throw new Error(`x${highest} exceeds the maximum of ${MAX_VARS} variables`);
  }
  const numVars = Math.max(highest, minVars);
  const outputs = Array.from({ length: 1 << numVars }, (_, term) =>
    evaluate(ast, term) ? CellState.True : CellState.False,
  );
  return { numVars, outputs };
}

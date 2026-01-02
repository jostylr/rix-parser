/**
 * Math Oracle Language Tokenizer
 * Implements tokenization according to the specification in tokenizing-spec.txt
 */

// Unicode patterns for identifiers
const identifierStart = /[\p{L}]/u;
const identifierPart = /[\p{L}\p{N}]/u;

// Symbol patterns (sorted longest to shortest for maximal munch)
const symbols = [
  ":=:",
  ":>=:",
  ":<=:",
  ":>:",
  ":<:",
  ":=>",
  ":->",
  "||>",
  "|>>",
  "|>:",
  "|>?",
  "|>",
  "/%",
  "//",
  "/^",
  "/~",
  "::+",
  ":~/",
  ":/:",
  ":~",
  ":/%",
  "::",
  ":+",
  ":%",
  "{{",
  "}}",
  "<=",
  ">=",
  "==",
  "!=",
  "->",
  "=>",
  "**",
  "?<=",
  "?>=",
  "?<",
  "?>",
  "?=",
  "??",
  "?:",
  "|^:",
  "|+",
  "|*",
  "|:",
  "|;",
  "|^",
  "|?",
  "~{",
  "~[",
  ":=",
  "%",
  ",",
  ";",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  "+",
  "-",
  "*",
  "/",
  "^",
  "_",
  ".",
  "~",
  "@",
  "'",
  ":",
  "?",
];

function tokenize(input) {
  const tokens = [];
  let position = 0;

  while (position < input.length) {
    const startPos = position;

    // Skip whitespace
    while (position < input.length && /\s/.test(input[position])) {
      position++;
    }

    if (position >= input.length) {
      // Add End token with any remaining whitespace
      tokens.push({
        type: "End",
        original: input.slice(startPos),
        value: null,
        pos: [startPos, startPos, input.length],
      });
      break;
    }

    let token = null;

    // Try to match numbers first (before comments, since numbers can contain #)
    token = tryMatchNumber(input, position);
    if (!token) {
      // Try to match strings (quotes, backticks, comments)
      token = tryMatchString(input, position);
    }
    if (!token) {
      // Try to match identifiers
      token = tryMatchIdentifier(input, position);
    }
    if (!token) {
      // Try to match semicolon sequences first (before general symbols)
      token = tryMatchSemicolonSequence(input, position);
    }
    if (!token) {
      // Try to match symbols
      token = tryMatchSymbol(input, position);
    }

    if (token) {
      // Include whitespace from startPos in the original
      const whitespace = input.slice(startPos, position);
      token.original = whitespace + token.original;
      // Update pos to account for whitespace - keep value position as set by token creators
      token.pos[0] = startPos;
      // Don't override pos[1] for strings, as they set it correctly for delimiter handling
      if (token.type !== "String") {
        token.pos[1] = position;
      }
      tokens.push(token);
      position += token.original.length - whitespace.length;
    } else {
      // If nothing matched, skip this character
      position++;
    }
  }

  // Always add End token if not already added
  if (tokens.length === 0 || tokens[tokens.length - 1].type !== "End") {
    tokens.push({
      type: "End",
      original: "",
      value: null,
      pos: [input.length, input.length, input.length],
    });
  }

  return tokens;
}

function tryMatchString(input, position) {
  const remaining = input.slice(position);

  // Try line comments (# marker)
  const lineCommentMatch = remaining.match(/^#(.*)$/m);
  if (lineCommentMatch) {
    return {
      type: "String",
      original: lineCommentMatch[0],
      value: lineCommentMatch[1],
      kind: "comment",
      pos: [position, position + 1, position + lineCommentMatch[0].length],
    };
  }

  // Try block comments
  const blockCommentMatch = remaining.match(/^\/(\*+)/);
  if (blockCommentMatch) {
    const starCount = blockCommentMatch[1].length;
    const fullPattern = new RegExp(
      `^\\/\\*{${starCount}}([\\s\\S]*?)\\*{${starCount}}\\/`,
    );
    const match = remaining.match(fullPattern);
    if (match) {
      return {
        type: "String",
        original: match[0],
        value: match[1],
        kind: "comment",
        pos: [
          position,
          position + blockCommentMatch[0].length,
          position + match[0].length,
        ],
      };
    }
    // If we reach here, block comment was not closed - throw error
    const remainder = input.slice(position);
    throw new Error(
      `Delimiter unmatched. Need ${starCount} stars followed by slash. Remainder: "${remainder}" at position ${position}`,
    );
  }

  // Try double quotes - only throw error if we found opening quotes but no closing
  const quoteMatch = remaining.match(/^("+)/);
  if (quoteMatch) {
    const quoteCount = quoteMatch[1].length;
    let searchPos = position + quoteCount;

    while (searchPos < input.length) {
      const foundQuotes = input.slice(searchPos).match(/^("+)/);
      if (foundQuotes && foundQuotes[1].length === quoteCount) {
        const content = input.slice(position + quoteCount, searchPos);
        const original = input.slice(position, searchPos + quoteCount);

        return {
          type: "String",
          original: original,
          value: content,
          kind: "quote",
          pos: [position, position + quoteCount, searchPos + quoteCount],
        };
      }
      searchPos++;
    }
    // Unmatched quote delimiter - throw error only if we started parsing quotes
    const remainder = input.slice(position);
    throw new Error(
      `Delimiter unmatched. Need ${quoteCount} closing quotes. Remainder: "${remainder}" at position ${position}`,
    );
  }

  // Try backticks - only throw error if we found opening backticks but no closing
  const backtickMatch = remaining.match(/^(`+)/);
  if (backtickMatch) {
    const backtickCount = backtickMatch[1].length;
    let searchPos = position + backtickCount;

    while (searchPos < input.length) {
      const foundBackticks = input.slice(searchPos).match(/^(`+)/);
      if (foundBackticks && foundBackticks[1].length === backtickCount) {
        const content = input.slice(position + backtickCount, searchPos);
        const original = input.slice(position, searchPos + backtickCount);
        return {
          type: "String",
          original: original,
          value: content,
          kind: "backtick",
          pos: [position, position + backtickCount, searchPos + backtickCount],
        };
      }
      searchPos++;
    }
    // Unmatched backtick delimiter - throw error only if we started parsing backticks
    const remainder = input.slice(position);
    throw new Error(
      `Delimiter unmatched. Need ${backtickCount} closing backticks. Remainder: "${remainder}" at position ${position}`,
    );
  }

  return null;
}

function tryMatchNumber(input, position) {
  const remaining = input.slice(position);
  let match;
  // console.log("tryMatchNumber", remaining);

  // Check if it starts with a digit, minus followed by digit, or decimal point followed by digit
  // OR if it starts with a prefix pattern (0 followed by letter)
  if (!/^(-?\d|-?\.\d)/.test(remaining)) {
    return null;
  }

  // Try all number patterns (longest first for maximal munch)

  // Prefix Patterns (0x..., 0b..., 0k..., etc.)
  // Must check these before standard decimal patterns to avoid catching '0' as Integer(0) and 'x' as Identifier

  // Prefix Interval: 0x1:0xA or 0x1:10
  match = remaining.match(
    /^-?(?:0[a-zA-Z][0-9a-zA-Z]*(?:\.[0-9a-zA-Z]*)?|(?:\d+\.\.\d+\/\d+|\d+\.\d+#\d+|\.\d+#\d+|\d+#\d+|\d+\/\d+|\d+\.\d+|\.\d+|\d+)):-?(?:0[a-zA-Z][0-9a-zA-Z]*(?:\.[0-9a-zA-Z]*)?|(?:\d+\.\.\d+\/\d+|\d+\.\d+#\d+|\.\d+#\d+|\d+#\d+|\d+\/\d+|\d+\.\d+|\.\d+|\d+))/,
  );
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Prefix Mixed Number: 0xA..B/C or 0xA..0xB/0xC
  match = remaining.match(/^-?0[a-zA-Z][0-9a-zA-Z]*\.\.0?[a-zA-Z]?[0-9a-zA-Z]*\/0?[a-zA-Z]?[0-9a-zA-Z]*/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Prefix Rational: 0xA/0xB or 0xA/B or A/0xB
  match = remaining.match(/^-?0[a-zA-Z][0-9a-zA-Z]*\/0?[a-zA-Z]?[0-9a-zA-Z]*/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Prefix Decimal: 0xA.B
  match = remaining.match(/^-?0[a-zA-Z][0-9a-zA-Z]*\.[0-9a-zA-Z]*/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Prefix Integer: 0xA, 0b101
  match = remaining.match(/^-?0[a-zA-Z][0-9a-zA-Z]*/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Complex intervals with all number types (including leading decimal)
  match = remaining.match(
    /^-?(?:\d+\.\.\d+\/\d+|\d+\.\d+#\d+|\.\d+#\d+|\d+#\d+|\d+\/\d+|\d+\.\d+|\.\d+|\d+):-?(?:\d+\.\.\d+\/\d+|\d+\.\d+#\d+|\.\d+#\d+|\d+#\d+|\d+\/\d+|\d+\.\d+|\.\d+|\d+)/,
  );
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Scientific notation with various bases (including leading decimal)
  match = remaining.match(
    /^-?(?:\d+(?:\.\d+)?(?:#\d+)?|\.\d+(?:#\d+)?|\d+\.\.\d+\/\d+|\d+\/\d+|\d+\.\d+|\.\d+|\d+)[Ee][+-]?\d+/,
  );
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Mixed numbers
  match = remaining.match(/^-?\d+\.\.\d+\/\d+/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Repeating decimals (form: digits.digits#digits, including leading decimal)
  match = remaining.match(/^-?(?:\d+\.\d+#\d+|\.\d+#\d+)/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Repeating decimals (form: digits#digits)
  match = remaining.match(/^-?\d+#\d+/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Decimals with interval notation
  match = remaining.match(/^-?\d+\.\d+\[[^\]]+\]/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Simple intervals (including leading decimal)
  match = remaining.match(
    /^-?(?:\d+(?:\.\d+)?|\.\d+):-?(?:\d+(?:\.\d+)?|\.\d+)/,
  );
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Rationals (no spaces allowed)
  match = remaining.match(/^-?\d+\/\d+/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Decimals (including leading decimal)
  match = remaining.match(/^-?(?:\d+\.\d+|\.\d+)/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Integers
  match = remaining.match(/^-?\d+/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  return null;
}

function tryMatchIdentifier(input, position) {
  const remaining = input.slice(position);

  // Check for placeholder pattern (_1, _2, __1, etc.)
  if (remaining[0] === "_") {
    const placeholderMatch = remaining.match(/^_+(\d+)/);
    if (placeholderMatch) {
      const original = placeholderMatch[0];
      const place = parseInt(placeholderMatch[1], 10);
      return {
        type: "PlaceHolder",
        original: original,
        place: place,
        pos: [position, position, position + original.length],
      };
    }
    return null;
  }

  // Check if first character is a valid identifier start
  if (!identifierStart.test(remaining[0])) {
    return null;
  }

  let length = 1;
  while (length < remaining.length && identifierPart.test(remaining[length])) {
    length++;
  }

  const original = remaining.slice(0, length);
  const firstChar = original[0];
  const isCapital = firstChar.toUpperCase() === firstChar;
  const kind = isCapital ? "System" : "User";

  // Normalize case: convert rest to match first character's case
  let value;
  if (isCapital) {
    value = firstChar + original.slice(1).toUpperCase();
  } else {
    value = firstChar + original.slice(1).toLowerCase();
  }

  return {
    type: "Identifier",
    original: original,
    value: value,
    kind: kind,
    pos: [position, position, position + length],
  };
}

function tryMatchSemicolonSequence(input, position) {
  const remaining = input.slice(position);

  // Match consecutive semicolons (not separated by spaces)
  const match = remaining.match(/^;+/);
  if (match) {
    const sequence = match[0];
    const count = sequence.length;

    // Only create SemicolonSequence tokens for multiple consecutive semicolons
    if (count > 1) {
      return {
        type: "SemicolonSequence",
        original: sequence,
        value: sequence,
        count: count,
        pos: [position, position, position + sequence.length],
      };
    }
    // For single semicolons, let the regular symbol tokenizer handle it
  }

  return null;
}

function tryMatchSymbol(input, position) {
  const remaining = input.slice(position);

  // Try to match symbols using maximal munch (longest first)
  for (const symbol of symbols) {
    if (remaining.startsWith(symbol)) {
      return {
        type: "Symbol",
        original: symbol,
        value: symbol,
        pos: [position, position, position + symbol.length],
      };
    }
  }

  // If no multi-character symbol matches, try single characters
  if (remaining.length > 0) {
    const char = remaining[0];
    // Check if it's a symbol character (not letter, digit, or whitespace)
    if (!/[\w\s\p{L}\p{N}]/u.test(char)) {
      return {
        type: "Symbol",
        original: char,
        value: char,
        pos: [position, position, position + 1],
      };
    }
  }

  return null;
}

export { tokenize };

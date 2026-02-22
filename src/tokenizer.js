/**
 * Math Oracle Language Tokenizer
 * Implements tokenization according to the specification in tokenizing-spec.txt
 */

// Unicode patterns for identifiers
const identifierStart = /[\p{L}_]/u;
const identifierPart = /[\p{L}\p{N}_]/u;

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
  "//=",
  "**=",
  "|>&&",
  "|>||",
  "|>>",
  "|:>",
  "|>:",
  "|>?",
  "|><",
  "|<>",
  "|;",
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
  // Brace sigil containers (must come before single {)
  "{+",
  "{*",
  "{&&",
  "{||",
  "{=",
  "{?",
  "{;",
  "{|",
  "{:",
  "{@",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "^=",
  "<=",
  ">=",
  "==",
  "!=",
  "&&",
  "||",
  ">:",
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
  // System function prefix (must come before single @)
  "@_",
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
  // Double-dot and dot-pipe operators (before single .)
  "..",
  "|.",
  ".|",
  // Mutation prefix
  "{!",
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
  "=",
  "'",
  ":",
  "?",
];

/**
 * Convert a character offset to {line, col} (both 1-indexed).
 */
function posToLineCol(input, pos) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < pos && i < input.length; i++) {
    if (input[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

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

    // Try comments FIRST (before numbers, to avoid # conflicts)
    token = tryMatchComment(input, position);
    if (!token) {
      // Try to match numbers first (before strings/identifiers)
      token = tryMatchNumber(input, position);
    }
    if (!token) {
      // Try to match strings (quotes, backticks)
      token = tryMatchString(input, position);
    }
    if (!token) {
      // Try to match @OuterIdentifier
      token = tryMatchOuterIdentifier(input, position);
    }
    if (!token) {
      // Try to match @_ system function refs (before identifiers and symbols)
      token = tryMatchSystemFunctionRef(input, position);
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
      // Don't override pos[1] for strings or comments, as they set it correctly
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

function tryMatchComment(input, position) {
  const remaining = input.slice(position);

  if (!remaining.startsWith("##")) return null;

  // Potential multi-line comment: ##tag##
  // Find the next ##
  let tagEndIndex = -1;
  let hasSpaceInTag = false;
  for (let i = 2; i < remaining.length - 1; i++) {
    if (remaining[i] === "#" && remaining[i + 1] === "#") {
      tagEndIndex = i;
      break;
    }
    if (/\s/.test(remaining[i])) {
      hasSpaceInTag = true;
      // We don't break yet, we might find a ## later and decide it's a line comment
      // but the user requirement says "no spaces in the tag allowed up to ##"
      // So if we find whitespace, it CANNOT be a tag.
      break;
    }
  }

  if (tagEndIndex !== -1 && !hasSpaceInTag) {
    // Found a tag!
    const tag = remaining.slice(2, tagEndIndex);
    const normalizedTag = tag.toLowerCase();
    const openDelimiter = `##${tag}##`;
    const closeDelimiter = `##${normalizedTag}##`; // Not strictly how to search, we need to match it case-insensitively

    // Search for the closing delimiter
    let searchPos = tagEndIndex + 2;
    while (searchPos < remaining.length - (normalizedTag.length + 4) + 1) {
      // Look for the next ##
      const potentialCloseStart = remaining.indexOf("##", searchPos);
      if (potentialCloseStart === -1) break;

      const potentialCloseTagEnd = remaining.indexOf(
        "##",
        potentialCloseStart + 2,
      );
      if (potentialCloseTagEnd === -1) break;

      const foundTag = remaining
        .slice(potentialCloseStart + 2, potentialCloseTagEnd)
        .toLowerCase();
      if (foundTag === normalizedTag) {
        // Found it!
        const totalLength = potentialCloseTagEnd + 2;
        const value = remaining.slice(tagEndIndex + 2, potentialCloseStart);
        return {
          type: "String",
          original: remaining.slice(0, totalLength),
          value: value,
          kind: "comment",
          pos: [position, position + tagEndIndex + 2, position + totalLength],
        };
      }
      searchPos = potentialCloseStart + 1;
    }

    // If we get here, it was meant to be a multi-line comment but was never closed
    const { line, col } = posToLineCol(input, position);
    throw new Error(
      `Unclosed multi-line comment with tag "${tag}" at line ${line}:${col}`,
    );
  }

  // If it's not a multi-line tag, it's a line comment
  let lineEndIndex = remaining.indexOf("\n");
  if (lineEndIndex === -1) lineEndIndex = remaining.length;

  return {
    type: "String",
    original: remaining.slice(0, lineEndIndex),
    value: remaining.slice(2, lineEndIndex),
    kind: "comment",
    pos: [position, position + 2, position + lineEndIndex],
  };
}

function tryMatchString(input, position) {
  const remaining = input.slice(position);

  // Block comments (/* ... */)
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
    const { line, col } = posToLineCol(input, position);
    throw new Error(
      `Delimiter unmatched at line ${line}:${col}. Need ${starCount} stars followed by slash.`,
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
    const { line, col } = posToLineCol(input, position);
    throw new Error(
      `Delimiter unmatched at line ${line}:${col}. Need ${quoteCount} closing quotes.`,
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
    const { line, col } = posToLineCol(input, position);
    throw new Error(
      `Delimiter unmatched at line ${line}:${col}. Need ${backtickCount} closing backticks.`,
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
    /^-?(?:(?:0z\[\d+\]|0[a-zA-Z])[0-9a-zA-Z]*(?:\.[0-9a-zA-Z]*)?|(?:\d+\.\.\d+\/\d+|\d+\.\d+#\d+|\.\d+#\d+|\d+#\d+|\d+\/\d+|\d+\.\d+|\.\d+|\d+)):-?(?:(?:0z\[\d+\]|0[a-zA-Z])[0-9a-zA-Z]*(?:\.[0-9a-zA-Z]*)?|(?:\d+\.\.\d+\/\d+|\d+\.\d+#\d+|\.\d+#\d+|\d+#\d+|\d+\/\d+|\d+\.\d+|\.\d+|\d+))/,
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
  match = remaining.match(/^-?(?:0z\[\d+\]|0[a-zA-Z])[0-9a-zA-Z]*\.\.(?:0z\[\d+\]|0[a-zA-Z])?[0-9a-zA-Z]*\/(?:0z\[\d+\]|0[a-zA-Z])?[0-9a-zA-Z]*/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Prefix Rational: 0xA/0xB or 0xA/B or A/0xB
  match = remaining.match(/^-?(?:0z\[\d+\]|0[a-zA-Z])[0-9a-zA-Z]*\/(?:0z\[\d+\]|0[a-zA-Z])?[0-9a-zA-Z]*/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Prefix Decimal: 0xA.B
  match = remaining.match(/^-?(?:0z\[\d+\]|0[a-zA-Z])[0-9a-zA-Z]*\.[0-9a-zA-Z]*/);
  if (match) {
    return {
      type: "Number",
      original: match[0],
      value: match[0],
      pos: [position, position, position + match[0].length],
    };
  }

  // Prefix Integer: 0xA, 0b101, 0z[10]10
  match = remaining.match(/^-?(?:0z\[\d+\]|0[a-zA-Z])[0-9a-zA-Z]*/);
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
  // Strict mode: Only allow 'E', not 'e'
  match = remaining.match(
    /^-?(?:\d+(?:\.\d+)?(?:#\d+)?|\.\d+(?:#\d+)?|\d+\.\.\d+\/\d+|\d+\/\d+|\d+\.\d+|\.\d+|\d+)(?:E|_\^)[+-]?\d+/,
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

function tryMatchSystemFunctionRef(input, position) {
  const remaining = input.slice(position);

  // Match @_ followed by an identifier: @_ASSIGN, @_ADD, etc.
  if (remaining.startsWith("@_") && remaining.length > 2 && identifierStart.test(remaining[2])) {
    let length = 3; // @_ + first char
    while (length < remaining.length && identifierPart.test(remaining[length])) {
      length++;
    }
    const original = remaining.slice(0, length);
    const name = remaining.slice(2, length); // Strip @_ prefix for value
    // System function refs are always uppercase-normalized
    const value = name.toUpperCase();
    return {
      type: "Identifier",
      original: original,
      value: value,
      kind: "SystemFunction",
      pos: [position, position, position + length],
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

  if (original === "_") {
    return null; // standalone underscore is a symbol/null, not an identifier
  }

  let firstLetter = null;
  for (let i = 0; i < original.length; i++) {
    if (/[\p{L}]/u.test(original[i])) {
      firstLetter = original[i];
      break;
    }
  }

  const isCapital = firstLetter !== null && firstLetter.toUpperCase() === firstLetter;
  const kind = isCapital ? "System" : "User";

  // Normalize case: convert rest to match first character's case
  const value = isCapital ? original.toUpperCase() : original.toLowerCase();

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

function tryMatchOuterIdentifier(input, position) {
  const remaining = input.slice(position);

  // Match @ followed by an identifier
  if (remaining.startsWith("@_")) {
    return null; // Let tryMatchSystemFunctionRef or tryMatchSymbol handle it
  }

  if (remaining.startsWith("@") && remaining.length > 1 && identifierStart.test(remaining[1])) {
    let length = 2; // @ + first char
    while (length < remaining.length && identifierPart.test(remaining[length])) {
      length++;
    }
    const original = remaining.slice(0, length);
    const name = remaining.slice(1, length); // Strip @ prefix

    let firstLetter = null;
    for (let i = 0; i < name.length; i++) {
      if (/[\p{L}]/u.test(name[i])) {
        firstLetter = name[i];
        break;
      }
    }

    const isCapital = firstLetter !== null && firstLetter.toUpperCase() === firstLetter;
    const kind = isCapital ? "System" : "User";

    // Normalize case: convert rest to match first character's case
    const value = isCapital ? name.toUpperCase() : name.toLowerCase();

    return {
      type: "OuterIdentifier",
      original: original,
      value: value, // The normalized name without the @
      kind: kind,
      pos: [position, position, position + length],
    };
  }

  return null;
}

export { tokenize, posToLineCol };

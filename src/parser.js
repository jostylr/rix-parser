/**
 * RiX Language Pratt Parser
 * Implements a Pratt parser for the RiX mathematical expression language
 */

import { tokenize, posToLineCol } from "./tokenizer.js";

// Precedence levels (higher numbers bind tighter)
const PRECEDENCE = {
  STATEMENT: 0,
  ASSIGNMENT: 10, // :=, :=:, :>:, etc.
  PIPE: 20, // |>, ||>, |>>, etc.
  ARROW: 25, // ->, =>, :-> for function definitions
  LOGICAL_OR: 30, // OR (if system identifier)
  LOGICAL_AND: 40, // AND (if system identifier)
  CONDITION: 45, // ? operator for conditions
  EQUALITY: 50, // =, ?=, !=
  COMPARISON: 60, // <, >, <=, >=, ?<, ?>, etc.
  INTERVAL: 70, // :
  ADDITION: 80, // +, -
  MULTIPLICATION: 90, // *, /, //, %, /^, /~, /%
  EXPONENTIATION: 100, // ^, **
  UNARY: 110, // unary -, +, NOT
  CALCULUS: 115, // derivatives ('), integrals (')
  POSTFIX: 120, // function calls, array access
  PROPERTY: 130, // .
};

// Symbol table for operators and their parsing behavior
const SYMBOL_TABLE = {
  // Assignment operators (right associative)
  ":=": {
    precedence: PRECEDENCE.ASSIGNMENT,
    associativity: "right",
    type: "infix",
  },
  ":=:": {
    precedence: PRECEDENCE.ASSIGNMENT,
    associativity: "right",
    type: "infix",
  },
  ":<:": {
    precedence: PRECEDENCE.ASSIGNMENT,
    associativity: "right",
    type: "infix",
  },
  ":>:": {
    precedence: PRECEDENCE.ASSIGNMENT,
    associativity: "right",
    type: "infix",
  },
  ":<=:": {
    precedence: PRECEDENCE.ASSIGNMENT,
    associativity: "right",
    type: "infix",
  },
  ":>=:": {
    precedence: PRECEDENCE.ASSIGNMENT,
    associativity: "right",
    type: "infix",
  },
  ":=>": {
    precedence: PRECEDENCE.ASSIGNMENT,
    associativity: "right",
    type: "infix",
  },

  // Pipe operators (left associative)
  "|>": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "||>": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|>>": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|:>": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|>:": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|>?": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|>&&": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|>||": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|><": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|>/|": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|>#|": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|>//": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|>/": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|<>": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|+": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|*": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|:": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|;": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|^": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|^:": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },
  "|?": { precedence: PRECEDENCE.PIPE, associativity: "left", type: "infix" },

  // Assignment operators
  "+=": { precedence: PRECEDENCE.ASSIGNMENT, associativity: "right", type: "infix" },
  "-=": { precedence: PRECEDENCE.ASSIGNMENT, associativity: "right", type: "infix" },
  "*=": { precedence: PRECEDENCE.ASSIGNMENT, associativity: "right", type: "infix" },
  "/=": { precedence: PRECEDENCE.ASSIGNMENT, associativity: "right", type: "infix" },
  "//=": { precedence: PRECEDENCE.ASSIGNMENT, associativity: "right", type: "infix" },
  "%=": { precedence: PRECEDENCE.ASSIGNMENT, associativity: "right", type: "infix" },
  "^=": { precedence: PRECEDENCE.ASSIGNMENT, associativity: "right", type: "infix" },
  "**=": { precedence: PRECEDENCE.ASSIGNMENT, associativity: "right", type: "infix" },
  "=": {
    precedence: PRECEDENCE.ASSIGNMENT,
    associativity: "right",
    type: "infix",
  },
  "?=": {
    precedence: PRECEDENCE.EQUALITY,
    associativity: "left",
    type: "infix",
  },
  "!=": {
    precedence: PRECEDENCE.EQUALITY,
    associativity: "left",
    type: "infix",
  },
  "==": {
    precedence: PRECEDENCE.EQUALITY,
    associativity: "left",
    type: "infix",
  },

  // Comparison operators
  "<": {
    precedence: PRECEDENCE.COMPARISON,
    associativity: "left",
    type: "infix",
  },
  ">": {
    precedence: PRECEDENCE.COMPARISON,
    associativity: "left",
    type: "infix",
  },
  "<=": {
    precedence: PRECEDENCE.COMPARISON,
    associativity: "left",
    type: "infix",
  },
  ">=": {
    precedence: PRECEDENCE.COMPARISON,
    associativity: "left",
    type: "infix",
  },
  "?<": {
    precedence: PRECEDENCE.COMPARISON,
    associativity: "left",
    type: "infix",
  },
  "?>": {
    precedence: PRECEDENCE.COMPARISON,
    associativity: "left",
    type: "infix",
  },
  "?<=": {
    precedence: PRECEDENCE.COMPARISON,
    associativity: "left",
    type: "infix",
  },
  "?>=": {
    precedence: PRECEDENCE.COMPARISON,
    associativity: "left",
    type: "infix",
  },

  // Logical aliases
  "&&": {
    precedence: PRECEDENCE.LOGICAL_AND,
    associativity: "left",
    type: "infix",
  },
  "||": {
    precedence: PRECEDENCE.LOGICAL_OR,
    associativity: "left",
    type: "infix",
  },

  // Interval operators / ternary colon
  ":": {
    precedence: PRECEDENCE.INTERVAL,
    associativity: "left",
    type: "infix",
  },

  // Interval stepping
  ":+": {
    precedence: PRECEDENCE.INTERVAL,
    associativity: "left",
    type: "infix",
  },

  // Interval division
  "::": {
    precedence: PRECEDENCE.INTERVAL,
    associativity: "left",
    type: "infix",
  },
  ":/:": {
    precedence: PRECEDENCE.INTERVAL,
    associativity: "left",
    type: "infix",
  },

  // Interval mediants
  ":~": {
    precedence: PRECEDENCE.INTERVAL,
    associativity: "left",
    type: "infix",
  },
  ":~/": {
    precedence: PRECEDENCE.INTERVAL,
    associativity: "left",
    type: "infix",
  },

  // Random interval operations
  ":%": {
    precedence: PRECEDENCE.INTERVAL,
    associativity: "left",
    type: "infix",
  },
  ":/%": {
    precedence: PRECEDENCE.INTERVAL,
    associativity: "left",
    type: "infix",
  },

  // Infinite ranges
  "::+": {
    precedence: PRECEDENCE.INTERVAL,
    associativity: "left",
    type: "infix",
  },

  // Addition/subtraction
  "+": {
    precedence: PRECEDENCE.ADDITION,
    associativity: "left",
    type: "infix",
    prefix: true,
  },
  "-": {
    precedence: PRECEDENCE.ADDITION,
    associativity: "left",
    type: "infix",
    prefix: true,
  },

  // Multiplication/division
  "*": {
    precedence: PRECEDENCE.MULTIPLICATION,
    associativity: "left",
    type: "infix",
  },
  "/": {
    precedence: PRECEDENCE.MULTIPLICATION,
    associativity: "left",
    type: "infix",
  },
  "//": {
    precedence: PRECEDENCE.MULTIPLICATION,
    associativity: "left",
    type: "infix",
  },
  "%": {
    precedence: PRECEDENCE.MULTIPLICATION,
    associativity: "left",
    type: "infix",
  },
  "/^": {
    precedence: PRECEDENCE.MULTIPLICATION,
    associativity: "left",
    type: "infix",
  },
  "/~": {
    precedence: PRECEDENCE.MULTIPLICATION,
    associativity: "left",
    type: "infix",
  },
  "/%": {
    precedence: PRECEDENCE.MULTIPLICATION,
    associativity: "left",
    type: "infix",
  },

  // Exponentiation (right associative)
  "^": {
    precedence: PRECEDENCE.EXPONENTIATION,
    associativity: "right",
    type: "infix",
  },
  "**": {
    precedence: PRECEDENCE.EXPONENTIATION,
    associativity: "right",
    type: "infix",
  },

  // Function arrow (right associative)
  "->": { precedence: PRECEDENCE.ARROW, associativity: "right", type: "infix" },
  "=>": {
    precedence: PRECEDENCE.ASSIGNMENT,
    associativity: "right",
    type: "infix",
  },
  ":->": {
    precedence: PRECEDENCE.ASSIGNMENT,
    associativity: "right",
    type: "infix",
  },

  // Condition operator
  "?": {
    precedence: PRECEDENCE.CONDITION,
    associativity: "left",
    type: "infix",
  },

  // Ternary operator
  "??": {
    precedence: PRECEDENCE.CONDITION,
    associativity: "right",
    type: "infix",
  },
  "?:": {
    precedence: PRECEDENCE.CONDITION,
    associativity: "right",
    type: "infix",
  },

  // Property access
  ".": {
    precedence: PRECEDENCE.PROPERTY,
    associativity: "left",
    type: "infix",
  },

  // Postfix metadata operators (highest precedence)
  "@": {
    precedence: PRECEDENCE.POSTFIX,
    associativity: "left",
    type: "postfix",
  },

  // Unit operators (postfix)
  "~[": {
    precedence: PRECEDENCE.POSTFIX,
    associativity: "left",
    type: "postfix",
  },
  "~{": {
    precedence: PRECEDENCE.POSTFIX,
    associativity: "left",
    type: "postfix",
  },

  // Calculus operators
  "'": {
    precedence: PRECEDENCE.CALCULUS,
    associativity: "left",
    type: "calculus",
  },

  // Grouping
  "(": { precedence: 0, type: "grouping" },
  ")": { precedence: 0, type: "grouping" },
  "[": { precedence: PRECEDENCE.POSTFIX, type: "postfix" },
  "]": { precedence: 0, type: "grouping" },
  "{": { precedence: 0, type: "grouping" },
  "}": { precedence: 0, type: "grouping" },
  "{{": { precedence: 0, type: "codeblock" },
  "}}": { precedence: 0, type: "codeblock" },

  // Brace sigil containers
  "{=": { precedence: 0, type: "brace_sigil" },
  "{?": { precedence: 0, type: "brace_sigil" },
  "{;": { precedence: 0, type: "brace_sigil" },
  "{|": { precedence: 0, type: "brace_sigil" },
  "{:": { precedence: 0, type: "brace_sigil" },
  "{@": { precedence: 0, type: "brace_sigil" },

  // Mutation brace
  "{!": { precedence: 0, type: "brace_sigil" },

  // Double-dot (external property access)
  "..": { precedence: PRECEDENCE.PROPERTY, associativity: "left", type: "infix" },
  // Dot-pipe operators
  ".|": { precedence: PRECEDENCE.PROPERTY, associativity: "left", type: "postfix" },
  "|.": { precedence: PRECEDENCE.PROPERTY, associativity: "left", type: "postfix" },

  // Separators
  ",": { precedence: 5, associativity: "left", type: "infix" },
  ";": {
    precedence: PRECEDENCE.STATEMENT,
    associativity: "left",
  },
  "|": { precedence: 0, type: "separator" },
  "|}": { precedence: 0, type: "separator" },
};

class Parser {
  constructor(tokens, systemLookup, source = "") {
    this.tokens = tokens;
    this.systemLookup = systemLookup || (() => ({ type: "identifier" }));
    this.source = source;
    this.position = 0;
    this.current = null;
    this.skippedComments = [];
    this.advance();
  }

  advance() {
    do {
      if (this.position < this.tokens.length) {
        this.current = this.tokens[this.position];
        this.position++;
      } else {
        this.current = {
          type: "End",
          value: null,
          pos: [this.tokens.length, this.tokens.length, this.tokens.length],
        };
        break;
      }
      if (this.current.type === "String" && this.current.kind === "comment") {
        this.skippedComments.push(this.current);
      }
    } while (this.current.type === "String" && this.current.kind === "comment");
    return this.current;
  }

  peek() {
    let tempPos = this.position;
    while (tempPos < this.tokens.length) {
      const token = this.tokens[tempPos];
      if (token.type === "String" && token.kind === "comment") {
        tempPos++;
        continue;
      }
      return token;
    }
    return { type: "End", value: null };
  }

  createNode(type, properties = {}) {
    const node = {
      type,
      pos: properties.pos || this.current.pos,
      original: properties.original || this.current.original,
      ...properties,
    };
    return node;
  }

  error(message) {
    const pos = this.current ? this.current.pos : [0, 0, 0];
    if (this.source) {
      const { line, col } = posToLineCol(this.source, pos[0]);
      throw new Error(`Parse error at line ${line}, column ${col} (position ${pos[0]}): ${message}`);
    }
    throw new Error(`Parse error at position ${pos[0]}: ${message}`);
  }

  // Get symbol info, including system identifier lookup
  getSymbolInfo(token) {
    if (token.type === "Symbol") {
      return SYMBOL_TABLE[token.value] || { precedence: 0, type: "unknown" };
    } else if (token.type === "SemicolonSequence") {
      // Semicolon sequences should not be treated as binary operators
      return { precedence: 0, type: "separator" };
    } else if (token.type === "Identifier" && token.kind === "System") {
      const systemInfo = this.systemLookup(token.value);
      // Convert system lookup result to symbol table format
      if (systemInfo.type === "operator") {
        return {
          precedence: systemInfo.precedence || PRECEDENCE.MULTIPLICATION,
          associativity: systemInfo.associativity || "left",
          type: systemInfo.operatorType || "infix",
        };
      }
    }
    return null;
  }

  // Parse expression with given minimum precedence
  parseExpression(minPrec = 0) {
    const left = this.parsePrefix();
    return this.parseExpressionRec(left, minPrec, false);
  }

  // Parse prefix expressions (literals, unary operators, grouping)
  parsePrefix() {
    const token = this.current;

    switch (token.type) {
      case "Number":
        this.advance();
        return this.createNode("Number", {
          value: token.value,
          original: token.original,
        });

      case "String":
        this.advance();
        if (token.kind === "backtick") {
          return this.parseEmbeddedLanguage(token);
        } else {
          return this.createNode("String", {
            value: token.value,
            kind: token.kind,
            original: token.original,
          });
        }

      case "RegexLiteral":
        this.advance();
        return this.createNode("RegexLiteral", {
          pattern: token.pattern,
          flags: token.flags,
          mode: token.mode,
          original: token.original,
        });

      case "Identifier":
        this.advance();
        if (token.kind === "SystemFunction") {
          return this.createNode("SystemFunctionRef", {
            name: token.value,
            original: token.original,
          });
        } else if (token.kind === "System") {
          const systemInfo = this.systemLookup(token.value);
          return this.createNode("SystemIdentifier", {
            name: token.value,
            systemInfo: systemInfo,
            original: token.original,
          });
        } else {
          return this.createNode("UserIdentifier", {
            name: token.value,
            original: token.original,
          });
        }

      case "OuterIdentifier":
        this.advance();
        return this.createNode("OuterIdentifier", {
          name: token.value,
          original: token.original,
        });

      case "PlaceHolder":
        this.advance();
        return this.createNode("PlaceHolder", {
          place: token.place,
          original: token.original,
        });

      case "Symbol":
        if (token.value === "(") {
          return this.parseGrouping();
        } else if (token.value === "[") {
          return this.parseArray();
        } else if (token.value === "{") {
          return this.parseBraceContainer();
        } else if (token.value === "{{") {
          return this.parseCodeBlock();
        } else if (token.value === "{=" || token.value === "{?" || token.value === "{;" || token.value === "{|" || token.value === "{:" || token.value === "{@") {
          return this.parseBraceSigil(token.value);
        } else if (token.value === "{+" || token.value === "{*" || token.value === "{&&" || token.value === "{||") {
          return this.parseOperatorBrace(token.value);
        } else if (token.value === "{!") {
          return this.parseBraceSigil(token.value);
        } else if (token.value === "@") {
          // @ followed by { or brace sigil = deferred block: @{; ...}, @{? ...}, @{...}
          this.advance(); // consume '@'
          const nextVal = this.current.value;
          if (nextVal === "{" || nextVal === "{;" || nextVal === "{?" || nextVal === "{=" || nextVal === "{|" || nextVal === "{:" || nextVal === "{@" || nextVal === "{{") {
            let inner;
            if (nextVal === "{") {
              inner = this.parseBraceContainer();
            } else if (nextVal === "{{") {
              inner = this.parseCodeBlock();
            } else {
              inner = this.parseBraceSigil(nextVal);
            }
            return this.createNode("DeferredBlock", {
              body: inner,
              pos: token.pos,
              original: token.original,
            });
          }

          // Feature: @+ directly references ADD system function, @* to MUL, etc.
          const operatorToSystem = {
            "+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV", "//": "INTDIV", "%": "MOD", "^": "POW",
            "=": "EQ", "!=": "NEQ", "<": "LT", ">": "GT", "<=": "LTE", ">=": "GTE",
            "&&": "AND", "||": "OR", "!": "NOT"
          };

          if (operatorToSystem[nextVal]) {
            const opToken = this.current;
            this.advance(); // consume the operator symbol
            const sysName = operatorToSystem[nextVal];
            return this.createNode("SystemIdentifier", {
              name: sysName,
              systemInfo: this.systemLookup(sysName),
              original: token.original + opToken.original
            });
          }

          // Bare @ — treat as user identifier for postfix @(...) syntax
          return this.createNode("UserIdentifier", {
            name: "@",
            original: token.original,
          });
        } else if (token.value === "+" || token.value === "-" || token.value === "!") {
          return this.parseUnaryOperator();
        } else if (token.value === "'") {
          // Leading quote for integral
          return this.parseIntegral();
        } else if (token.value === "_") {
          // Underscore is always a null symbol
          this.advance();
          return this.createNode("NULL", {
            original: token.original,
          });
        } else {
          this.error(`Unexpected token in prefix position: ${token.value}`);
        }
        break;

      default:
        this.error(`Unexpected token: ${token.type}`);
    }
  }

  // Parse infix expressions (binary operators, function calls, etc.)
  parseInfix(left, symbolInfo) {
    const operator = this.current;

    // Special case for function calls - check if we have an identifier followed by '('
    if (
      operator.value === "(" &&
      (left.type === "UserIdentifier" || left.type === "SystemIdentifier" || left.type === "SystemFunctionRef")
    ) {
      // Lowercase letter-based user identifiers followed by ( are implicit multiplication: f(x) = f * (x)
      // Uppercase (System/SystemFunctionRef) are function calls: F(x), @_ASSIGN(x)
      // Operator-symbol identifiers (+, *, <, etc.) remain function calls
      if (left.type === "UserIdentifier" && /^[\p{L}]/u.test(left.name)) {
        // Implicit multiplication: parse the grouped expression and create MUL
        const grouping = this.parseGrouping();
        return this.createNode("ImplicitMultiplication", {
          left: left,
          right: grouping,
          pos: left.pos,
          original: left.original + operator.original,
        });
      }

      this.advance(); // consume '('
      const args = this.parseFunctionCallArgs();
      if (this.current.value !== ")") {
        this.error("Expected closing parenthesis in function call");
      }
      this.advance(); // consume ')'

      // SystemFunctionRef calls produce SystemCall nodes
      if (left.type === "SystemFunctionRef") {
        return this.createNode("SystemCall", {
          name: left.name,
          arguments: args,
          pos: left.pos,
          original: left.original + operator.original,
        });
      }

      return this.createNode("FunctionCall", {
        function: left,
        arguments: args,
        pos: left.pos,
        original: left.original + operator.original,
      });
    }

    this.advance();

    let rightPrec = symbolInfo.precedence;
    if (symbolInfo.associativity === "left") {
      rightPrec += 1;
    }

    let right;
    if (operator.value === "[" && symbolInfo.type === "postfix") {
      // Array/property access
      right = this.parseExpression(0);
      if (this.current.value !== "]") {
        this.error("Expected closing bracket");
      }
      this.advance();
      return this.createNode("PropertyAccess", {
        object: left,
        property: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === ":->") {
      // Standard function definition
      right = this.parseExpression(rightPrec);

      // Extract parameters if left side is a function call syntax
      let funcName = left;
      let parameters = { positional: [], keyword: [], metadata: {} };

      if (left.type === "FunctionCall") {
        funcName = left.function;
        // Convert function call arguments to parameter definitions
        parameters = this.convertArgsToParams(left.arguments);
      } else if (left.type === "ImplicitMultiplication") {
        // lowercase f(x) :-> expr — treat as function definition
        // left.left is the function name identifier, left.right is the Grouping/Tuple with params
        funcName = left.left;
        parameters = { positional: [], keyword: [], conditionals: [], metadata: {} };
        const paramExpr = left.right;
        if (paramExpr.type === "Grouping" && paramExpr.expression) {
          if (paramExpr.expression.type === "ParameterList") {
            parameters = paramExpr.expression.parameters;
          } else if (paramExpr.expression.type === "UserIdentifier") {
            parameters.positional.push({ name: paramExpr.expression.name, defaultValue: null });
          } else if (paramExpr.expression.type === "BinaryOperation" && paramExpr.expression.operator === "?") {
            const paramName = paramExpr.expression.left.name || paramExpr.expression.left.value;
            parameters.positional.push({ name: paramName, defaultValue: null });
            parameters.conditionals = parameters.conditionals || [];
            parameters.conditionals.push(paramExpr.expression.right);
          }
        } else if (paramExpr.type === "Tuple") {
          for (const el of paramExpr.elements) {
            const result = this.parseParameterFromArg(el, false);
            parameters.positional.push(result.param);
            if (result.condition) {
              parameters.conditionals = parameters.conditionals || [];
              parameters.conditionals.push(result.condition);
            }
          }
        }
      }

      return this.createNode("FunctionDefinition", {
        name: funcName,
        parameters: parameters,
        body: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === ":=>") {
      // Pattern matching function definition
      right = this.parseExpression(rightPrec);

      let funcName = left;
      let parameters = {
        positional: [],
        keyword: [],
        conditionals: [],
        metadata: {},
      };
      let patterns = [];
      let globalMetadata = {};

      if (left.type === "FunctionCall") {
        funcName = left.function;
        parameters = this.convertArgsToParams(left.arguments);
      }

      // Handle different pattern syntax and parse each pattern as a function
      let rawPatterns = [];
      if (right.type === "Array") {
        // Array syntax: g :=> [ (x ? x < 0) -> -x, (x) -> x ]
        rawPatterns = right.elements;
      } else if (
        right.type === "WithMetadata" &&
        right.primary &&
        right.primary.type === "Array"
      ) {
        // Array with metadata: g :=> [ [(x ? x < 0) -> -x+n, (x) -> x-n] , n := 4]
        if (
          Array.isArray(right.primary.elements) &&
          right.primary.elements.length > 0 &&
          right.primary.elements[0].type === "Array"
        ) {
          rawPatterns = right.primary.elements[0].elements;
        } else {
          rawPatterns = right.primary.elements;
        }
        globalMetadata = right.metadata;
      } else {
        // Single pattern: g :=> (x ? x < 0) -> -x
        rawPatterns = [right];
      }

      // Parse each pattern as a function definition
      for (const pattern of rawPatterns) {
        if (pattern.type === "FunctionLambda") {
          // Handle FunctionLambda nodes (new parsing with higher -> precedence)
          const patternFunc = {
            parameters: pattern.parameters,
            body: pattern.body,
          };
          patterns.push(patternFunc);
        } else if (
          pattern.type === "BinaryOperation" &&
          pattern.operator === "->"
        ) {
          // Handle legacy BinaryOperation nodes (fallback)
          const patternFunc = {
            parameters: {
              positional: [],
              keyword: [],
              conditionals: [],
              metadata: {},
            },
            body: pattern.right,
          };

          // Parse the left side (parameters with potential conditions)
          if (pattern.left.type === "Grouping") {
            const paramExpr = pattern.left.expression;
            if (
              paramExpr.type === "BinaryOperation" &&
              paramExpr.operator === "?"
            ) {
              // (x ? condition) format
              const paramName = paramExpr.left.name || paramExpr.left.value;
              patternFunc.parameters.positional.push({
                name: paramName,
                defaultValue: null,
              });
              patternFunc.parameters.conditionals.push(paramExpr.right);
            } else if (paramExpr.type === "UserIdentifier") {
              // Simple (x) format
              patternFunc.parameters.positional.push({
                name: paramExpr.name || paramExpr.value,
                defaultValue: null,
              });
            }
            // TODO: Handle more complex parameter expressions
          }

          patterns.push(patternFunc);
        }
      }

      return this.createNode("PatternMatchingFunction", {
        name: funcName,
        parameters: parameters,
        patterns: patterns,
        metadata: globalMetadata,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "->") {
      // Function arrow - handle ParameterList nodes specially
      right = this.parseExpression(rightPrec);

      // Check if left side is a ParameterList (from grouping with semicolons)
      if (
        left.type === "Grouping" &&
        left.expression &&
        left.expression.type === "ParameterList"
      ) {
        return this.createNode("FunctionLambda", {
          parameters: left.expression.parameters,
          body: right,
          pos: left.pos,
          original: left.original + operator.original,
        });
      } else if (left.type === "Grouping" && left.expression) {
        // Handle simple parameter cases like (x) -> expr or (x ? condition) -> expr
        let parameters = {
          positional: [],
          keyword: [],
          conditionals: [],
          metadata: {},
        };

        if (left.expression.type === "UserIdentifier") {
          // Single parameter: (x) -> expr
          parameters.positional.push({
            name: left.expression.name,
            defaultValue: null,
          });
        } else if (
          left.expression.type === "BinaryOperation" &&
          left.expression.operator === "?"
        ) {
          // Conditional parameter: (x ? condition) -> expr
          const paramName =
            left.expression.left.name || left.expression.left.value;
          parameters.positional.push({ name: paramName, defaultValue: null });
          parameters.conditionals.push(left.expression.right);
        }

        return this.createNode("FunctionLambda", {
          parameters: parameters,
          body: right,
          pos: left.pos,
          original: left.original + operator.original,
        });
      } else if (left.type === "Tuple") {
        // Handle multiple parameters parsed directly as Tuple: (a, b) -> expr
        let parameters = {
          positional: [],
          keyword: [],
          conditionals: [],
          metadata: {},
        };

        for (const element of left.elements) {
          if (element.type === "UserIdentifier") {
            parameters.positional.push({
              name: element.name,
              defaultValue: null,
            });
          }
        }

        return this.createNode("FunctionLambda", {
          parameters: parameters,
          body: right,
          pos: left.pos,
          original: left.original + operator.original,
        });
      } else if (left.type === "UserIdentifier") {
        // Handle unparenthesized single parameter: x -> expr
        let parameters = {
          positional: [{ name: left.name, defaultValue: null }],
          keyword: [],
          conditionals: [],
          metadata: {},
        };
        return this.createNode("FunctionLambda", {
          parameters: parameters,
          body: right,
          pos: left.pos,
          original: left.original + operator.original,
        });
      } else {
        // Regular binary operation
        return this.createNode("BinaryOperation", {
          operator: operator.value,
          left: left,
          right: right,
          pos: left.pos,
          original: left.original + operator.original,
        });
      }
    } else if (operator.value === "|>") {
      // Simple pipe operator
      right = this.parseExpression(rightPrec);
      return this.createNode("Pipe", {
        left: left,
        right: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "|>/") {
      // STRICT slice operator
      right = this.parseExpression(rightPrec);
      return this.createNode("SliceStrict", {
        left: left,
        right: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "|>/|") {
      // SPLIT operator
      right = this.parseExpression(rightPrec);
      return this.createNode("Split", {
        left: left,
        right: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "|>#|") {
      // CHUNK operator
      right = this.parseExpression(rightPrec);
      return this.createNode("Chunk", {
        left: left,
        right: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "|>//") {
      // CLAMPED slice operator
      right = this.parseExpression(rightPrec);
      return this.createNode("SliceClamp", {
        left: left,
        right: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "||>") {
      // Explicit pipe operator with placeholders
      right = this.parseExpression(rightPrec);

      return this.createNode("ExplicitPipe", {
        left: left,
        right: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "|>>") {
      // Map operator
      right = this.parseExpression(rightPrec);
      return this.createNode("Map", {
        left: left,
        right: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "|>?") {
      // Filter operator
      right = this.parseExpression(rightPrec);
      return this.createNode("Filter", {
        left: left,
        right: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "|>&&") {
      // Every (all) operator
      right = this.parseExpression(rightPrec);
      return this.createNode("Every", {
        left: left,
        right: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "|>||") {
      // Some (any) operator
      right = this.parseExpression(rightPrec);
      return this.createNode("Some", {
        left: left,
        right: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "|:>") {
      // Reduce operator with explicit init: list |:> init >: fn
      const startValue = this.parseExpression(rightPrec);

      const nextOp = this.current;
      if (nextOp.type !== "Symbol" || nextOp.value !== ">:") {
        this.error("Expected '>:' after start value in '|:>' reduce expression, found " + nextOp.value);
      } else {
        this.advance(); // consume `>:`
      }

      const fnExpr = this.parseExpression(rightPrec);
      return this.createNode("Reduce", {
        left: left,
        init: startValue,
        right: fnExpr,
        pos: left.pos,
        original: left.original + operator.original + startValue.original + (nextOp.value === ">:" ? nextOp.original : "") + fnExpr.original,
      });
    } else if (operator.value === "|>:") {
      // Reduce operator: list |>: fn (first element as init)
      // For explicit init value, use REDUCE(list, fn, init) function call
      right = this.parseExpression(rightPrec);
      return this.createNode("Reduce", {
        left: left,
        right: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "|><") {
      // Reverse operator (no right operand needed)
      return this.createNode("Reverse", {
        target: left,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "|<>") {
      // Sort operator: list |<> fn (comparator function)
      right = this.parseExpression(rightPrec);
      return this.createNode("Sort", {
        left: left,
        right: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === ":+") {
      // Interval stepping (direction determined at eval time based on step sign)
      right = this.parseExpression(rightPrec);
      return this.createNode("IntervalStepping", {
        interval: left,
        step: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "::") {
      // Interval division into equally spaced points
      right = this.parseExpression(rightPrec);
      return this.createNode("IntervalDivision", {
        interval: left,
        count: right,
        type: "equally_spaced",
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === ":/:") {
      // Interval partition into sub-intervals
      right = this.parseExpression(rightPrec);
      return this.createNode("IntervalPartition", {
        interval: left,
        count: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === ":~") {
      // Interval mediants
      right = this.parseExpression(rightPrec);
      return this.createNode("IntervalMediants", {
        interval: left,
        levels: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === ":~/") {
      // Interval mediant partition
      right = this.parseExpression(rightPrec);
      return this.createNode("IntervalMediantPartition", {
        interval: left,
        levels: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === ":%") {
      // Random selection from interval
      right = this.parseExpression(rightPrec);
      return this.createNode("IntervalRandom", {
        interval: left,
        parameters: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === ":/%") {
      // Random partition of interval
      right = this.parseExpression(rightPrec);
      return this.createNode("IntervalRandomPartition", {
        interval: left,
        count: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "::+") {
      // Infinite sequence (direction determined at eval time based on step sign)
      right = this.parseExpression(rightPrec);

      return this.createNode("InfiniteSequence", {
        start: left,
        step: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "??") {
      // Ternary operator: condition ?? trueExpr ?: falseExpr
      // Parse true expression with higher precedence to prevent ?: consumption
      const trueExpr = this.parseExpression(PRECEDENCE.CONDITION + 5);

      if (this.current.value !== "?:") {
        this.error('Expected "?:" in ternary operator after true expression');
      }

      this.advance(); // consume '?:'

      // Parse false expression with right-associative precedence
      const falseExpr = this.parseExpression(rightPrec);

      return this.createNode("TernaryOperation", {
        condition: left,
        trueExpression: trueExpr,
        falseExpression: falseExpr,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === ".") {
      // Dot property access: P.type, P.Derivative, etc.
      // Right side must be an identifier (property name)
      if (this.current.type !== "Identifier") {
        this.error("Expected property name after '.'");
      }
      const propertyName = this.current.value;
      const propertyOriginal = this.current.original;
      this.advance();

      return this.createNode("DotAccess", {
        object: left,
        property: propertyName,
        pos: left.pos,
        original: left.original + operator.original + propertyOriginal,
      });
    } else if (operator.value === "..") {
      // Double-dot external property access: obj..b
      // If followed by identifier, access that external property
      // If followed by nothing (or non-identifier), return all external properties
      if (this.current.type === "Identifier") {
        const propertyName = this.current.value;
        const propertyOriginal = this.current.original;
        this.advance();
        return this.createNode("ExternalAccess", {
          object: left,
          property: propertyName,
          pos: left.pos,
          original: left.original + operator.original + propertyOriginal,
        });
      } else {
        // obj.. returns map of all external properties
        return this.createNode("ExternalAccess", {
          object: left,
          property: null,
          pos: left.pos,
          original: left.original + operator.original,
        });
      }
    } else if (operator.value === ".|") {
      // obj.| returns set of keys
      return this.createNode("KeySet", {
        object: left,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else if (operator.value === "|.") {
      // obj|. returns set of values
      return this.createNode("ValueSet", {
        object: left,
        pos: left.pos,
        original: left.original + operator.original,
      });
    } else {
      // Binary operator
      right = this.parseExpression(rightPrec);
      return this.createNode("BinaryOperation", {
        operator: operator.value,
        left: left,
        right: right,
        pos: left.pos,
        original: left.original + operator.original,
      });
    }
  }

  parseGrouping() {
    const startToken = this.current;
    this.advance(); // consume '('

    // Check for empty parentheses first
    if (this.current.value === ")") {
      this.advance(); // consume ')'
      return this.createNode("Tuple", {
        elements: [],
        pos: startToken.pos,
        original: startToken.original,
      });
    }

    // Scan ahead to determine what type of content we have
    let hasSemicolon = false;
    let hasComma = false;
    let tempPos = this.position;
    let parenDepth = 0;
    let braceDepth = 0;
    let bracketDepth = 0;

    while (tempPos < this.tokens.length) {
      const token = this.tokens[tempPos];

      if (token.value === "(") parenDepth++;
      else if (token.value === ")") {
        if (parenDepth === 0) break;
        parenDepth--;
      }
      else if (typeof token.value === 'string' && token.value.startsWith("{") && token.value !== "}}") braceDepth++;
      else if (token.value === "}" || token.value === "}}") braceDepth--;
      else if (token.value === "[") bracketDepth++;
      else if (token.value === "]") bracketDepth--;

      else if (parenDepth === 0 && braceDepth <= 0 && bracketDepth <= 0) {
        if (token.value === ";") {
          hasSemicolon = true;
          break;
        } else if (token.value === ",") {
          hasComma = true;
          // Don't break - continue scanning for semicolons
        }
      }
      tempPos++;
    }

    let result;
    if (hasSemicolon) {
      // Parse as function parameters
      const params = this.parseFunctionParameters();
      result = this.createNode("Grouping", {
        expression: this.createNode("ParameterList", {
          parameters: params,
          pos: startToken.pos,
          original: startToken.original,
        }),
        pos: startToken.pos,
        original: startToken.original,
      });
    } else if (hasComma) {
      // Parse as tuple
      const elements = this.parseTupleElements();
      result = this.createNode("Tuple", {
        elements: elements,
        pos: startToken.pos,
        original: startToken.original,
      });
    } else {
      // Parse as regular grouped expression
      const expr = this.parseExpression(0);
      result = this.createNode("Grouping", {
        expression: expr,
        pos: startToken.pos,
        original: startToken.original,
      });
    }

    if (this.current.value !== ")") {
      this.error("Expected closing parenthesis");
    }
    this.advance(); // consume ')'

    return result;
  }

  parseTupleElements() {
    const elements = [];

    // Parse first element
    let firstElement = this.parseTupleElement();
    elements.push(firstElement);

    // Look for trailing comma or more elements
    while (this.current.value === ",") {
      this.advance(); // consume ','

      // Check for consecutive commas (syntax error)
      if (this.current.value === "," || this.current.value === ")") {
        if (this.current.value === ",") {
          this.error("Consecutive commas not allowed in tuples");
        }
        // Trailing comma case - we're done
        break;
      }

      // Parse next element
      const element = this.parseTupleElement();
      elements.push(element);
    }

    return elements;
  }

  parseTupleElement() {
    // Parse regular expression (underscore is handled by parsePrefix)
    return this.parseExpression(0);
  }

  parseArray() {
    const startToken = this.current;
    this.advance(); // consume '['

    // Check if this might be a matrix/tensor by looking for semicolons
    const result = this.parseMatrixOrArray(startToken);

    if (this.current.value !== "]") {
      this.error("Expected closing bracket");
    }
    this.advance(); // consume ']'

    return result;
  }

  parseGeneratorChain() {
    // Parse initial expression or start with null if we begin with a generator operator
    let start = null;
    const operators = [];

    // If current token is not a generator operator, parse the start value
    if (!this.isGeneratorOperator(this.current.value)) {
      // Parse the start value but don't let it consume generator operators
      const savedPos = this.pos;
      try {
        start = this.parseExpressionUntilGenerator();
      } catch (e) {
        // If parsing fails, restore position and treat as no start value
        this.pos = savedPos;
        start = null;
      }
    }

    // Parse chain of generator operators
    while (this.isGeneratorOperator(this.current.value)) {
      const operator = this.current;
      this.advance();

      // Parse the operand with higher precedence to avoid consuming subsequent operators
      const operand = this.parseExpression(PRECEDENCE.PIPE + 1);

      const operatorNode = this.createGeneratorOperatorNode(
        operator.value,
        operand,
        operator,
      );
      operators.push(operatorNode);
    }

    if (operators.length === 0) {
      return start; // Not actually a generator chain
    }

    return this.createNode("GeneratorChain", {
      start: start,
      operators: operators,
      pos: start ? start.pos : operators[0].pos,
      original: start ? start.original : operators[0].original,
    });
  }

  parseExpressionUntilGenerator() {
    // Parse just the prefix expression and return it
    // Don't parse infix operations that might include generators
    return this.parsePrefix();
  }

  parseExpressionRec(left, minPrec, stopAtGenerators = false) {
    while (this.current.type !== "End") {
      // Check for statement terminators
      if (
        this.current.value === ";" ||
        this.current.value === "," ||
        this.current.value === ")" ||
        this.current.value === "]" ||
        this.current.value === "}" ||
        this.current.value === "}}" ||
        this.current.type === "SemicolonSequence"
      ) {
        break;
      }


      // Special case for function calls - now works on any expression
      if (this.current.value === "(") {
        left = this.parseCall(left);
        continue;
      }

      // Special case for postfix @ operator (AT metadata access)
      if (this.current.value === "@" && this.peek().value === "(") {
        left = this.parseAt(left);
        continue;
      }

      // Special case for postfix ? operator (ASK metadata access)
      // Must distinguish from infix ? (condition operator)
      if (this.current.value === "?" && this.peek().value === "(") {
        left = this.parseAsk(left);
        continue;
      }

      // Special case for postfix derivatives (single quotes after function/identifier)
      if (
        this.current.value === "'" &&
        (left.type === "UserIdentifier" ||
          left.type === "SystemIdentifier" ||
          left.type === "SystemFunctionRef" ||
          left.type === "FunctionCall" ||
          left.type === "PropertyAccess" ||
          left.type === "Derivative" ||
          left.type === "Integral")
      ) {
        left = this.parseDerivative(left);
        continue;
      }

      // Special case for unit operators ~[ and ~{
      if (this.current.value === "~[") {
        left = this.parseScientificUnit(left);
        continue;
      }
      if (this.current.value === "~{") {
        left = this.parseMathematicalUnit(left);
        continue;
      }

      // Special case for mutation syntax: obj{= ...} or obj{! ...}
      if (this.current.value === "{=" || this.current.value === "{!") {
        left = this.parseMutation(left);
        continue;
      }

      // Command-style call: HELP topic, LOAD pkg, UNLOAD pkg
      // SystemIdentifier followed by Identifier/String/Number (no parens) → implicit call
      if (
        left.type === "SystemIdentifier" &&
        (this.current.type === "Identifier" || this.current.type === "String" || this.current.type === "Number")
      ) {
        const args = [];
        // Consume all following arguments until statement terminator or End
        while (
          this.current.type !== "End" &&
          this.current.value !== ";" &&
          this.current.value !== "," &&
          this.current.value !== ")" &&
          this.current.value !== "]" &&
          this.current.value !== "}" &&
          this.current.value !== "}}"
        ) {
          const arg = this.parsePrefix();
          args.push(arg);
        }
        left = this.createNode("CommandCall", {
          command: left,
          arguments: args,
          pos: left.pos,
          original: left.original,
        });
        continue;
      }

      let symbolInfo = this.getSymbolInfo(this.current);

      // Disambiguate `->` operator precedence:
      // Function definitions like `F(x) -> ...` need loose precedence (assignment).
      // Lambdas like `x -> ...` need tight precedence (arrow) to bind inside pipes.
      if (symbolInfo && this.current.value === "->") {
        if (left.type === "FunctionCall" || left.type === "ImplicitMultiplication") {
          symbolInfo = { ...symbolInfo, precedence: PRECEDENCE.ASSIGNMENT };
        }
      }

      if (!symbolInfo || symbolInfo.precedence < minPrec) {
        break;
      }

      if (symbolInfo.type === "statement" || symbolInfo.type === "separator") {
        break;
      }

      // Stop at generator operators if flag is set
      if (stopAtGenerators && this.isGeneratorOperator(this.current.value)) {
        break;
      }

      left = this.parseInfix(left, symbolInfo);
    }

    return left;
  }

  isGeneratorOperator(value) {
    return ["|+", "|*", "|:", "|?", "|^", "|^:", "|;", "|>"].includes(value);
  }

  createGeneratorOperatorNode(operator, operand, token) {
    const typeMap = {
      "|+": "GeneratorAdd",
      "|*": "GeneratorMultiply",
      "|:": "GeneratorFunction",
      "|?": "GeneratorFilter",
      "|^": "GeneratorLimit",
      "|^:": "GeneratorLazyLimit",
      "|;": "GeneratorEagerLimit",
      "|>": "GeneratorPipe",
    };

    return this.createNode(typeMap[operator], {
      operator: operator,
      operand: operand,
      pos: token.pos,
      original: token.original,
    });
  }

  convertBinaryChainToGeneratorChain(binaryOp) {
    // Convert a binary operation chain with generator operators to GeneratorChain
    const operators = [];
    let current = binaryOp;
    let start = null;

    // Traverse the binary operation tree to extract generator operators
    while (
      current &&
      current.type === "BinaryOperation" &&
      this.isGeneratorOperator(current.operator)
    ) {
      // Add this operator to the front of the list (since we're traversing backwards)
      const operatorNode = this.createGeneratorOperatorNode(
        current.operator,
        current.right,
        current,
      );
      operators.unshift(operatorNode);

      current = current.left;
    }

    // The remaining left side is the start value (unless it's also a generator operation)
    if (
      current &&
      current.type === "BinaryOperation" &&
      this.isGeneratorOperator(current.operator)
    ) {
      // Recursively convert nested generator chains
      const nestedChain = this.convertBinaryChainToGeneratorChain(current);
      start = nestedChain.start;
      operators.unshift(...nestedChain.operators);
    } else {
      start = current;
    }

    return this.createNode("GeneratorChain", {
      start: start,
      operators: operators,
      pos: binaryOp.pos,
      original: binaryOp.original,
    });
  }

  parseMatrixOrArray(startToken) {
    const elements = [];
    let hasMetadata = false;
    let primaryElement = null;
    const metadataMap = {};
    let nonMetadataCount = 0;
    let hasSemicolons = false;
    let matrixStructure = [];
    let currentRow = [];

    if (this.current.value !== "]") {
      do {
        // Handle leading semicolons (empty rows at start)
        if (
          this.current.value === ";" ||
          this.current.type === "SemicolonSequence"
        ) {
          hasSemicolons = true;
          const semicolonCount = this.consumeSemicolonSequence();

          // Add empty row to matrix structure
          matrixStructure.push({
            row: [],
            separatorLevel: semicolonCount,
          });
          continue;
        }

        // Parse element - check for generator chains
        let element;
        if (this.isGeneratorOperator(this.current.value)) {
          // Start with generator operator (no initial value)
          element = this.parseGeneratorChain();
        } else {
          // Parse expression normally first
          element = this.parseExpression(0);

          // Check if this element is actually a generator chain (parsed as binary operations)
          if (
            element.type === "BinaryOperation" &&
            this.isGeneratorOperator(element.operator)
          ) {
            element = this.convertBinaryChainToGeneratorChain(element);
          }
        }

        // Check if this is a metadata assignment (key := value)
        if (element.type === "BinaryOperation" && element.operator === ":=") {
          if (hasSemicolons) {
            this.error(
              "Cannot mix matrix/tensor syntax with metadata - use nested array syntax",
            );
          }
          hasMetadata = true;
          // Extract the key from the left side
          let key;
          if (element.left.type === "UserIdentifier") {
            key = element.left.name;
          } else if (element.left.type === "SystemIdentifier") {
            key = element.left.name;
          } else if (element.left.type === "String") {
            key = element.left.value;
          } else {
            this.error("Metadata key must be an identifier or string");
          }
          metadataMap[key] = element.right;
        } else {
          // Regular element
          nonMetadataCount++;
          if (hasMetadata) {
            this.error(
              "Cannot mix array elements with metadata - use nested array syntax like [[1,2,3], key := value]",
            );
          }
          if (nonMetadataCount === 1) {
            primaryElement = element;
          }
          elements.push(element);
          currentRow.push(element);
        }

        // Check what comes next
        if (this.current.value === ",") {
          this.advance();
        } else if (
          this.current.value === ";" ||
          this.current.type === "SemicolonSequence"
        ) {
          if (hasMetadata) {
            this.error("Cannot mix matrix/tensor syntax with metadata");
          }
          hasSemicolons = true;
          const semicolonCount = this.consumeSemicolonSequence();

          // Add current row to matrix structure (even if empty)
          matrixStructure.push({
            row: [...currentRow],
            separatorLevel: semicolonCount,
          });
          currentRow = [];
        } else {
          break;
        }
      } while (this.current.value !== "]" && this.current.type !== "End");
    }

    // Add final row (always add if we have semicolons, even if empty)
    if (currentRow.length > 0 || hasSemicolons) {
      matrixStructure.push({
        row: currentRow,
        separatorLevel: 0,
      });
    }

    // Check if we have metadata and multiple non-metadata elements
    if (hasMetadata && nonMetadataCount > 1) {
      this.error(
        "Cannot mix array elements with metadata - use nested array syntax like [[1,2,3], key := value]",
      );
    }

    // If we found metadata annotations, create a WithMetadata node
    if (hasMetadata) {
      return this.createNode("WithMetadata", {
        primary:
          primaryElement ||
          this.createNode("Array", {
            elements: [],
            pos: startToken.pos,
            original: startToken.original,
          }),
        metadata: metadataMap,
        pos: startToken.pos,
        original: startToken.original,
      });
    }

    // If we found semicolons, create Matrix or Tensor node
    if (hasSemicolons) {
      return this.buildMatrixTensor(matrixStructure, startToken);
    }

    // Otherwise, return a regular Array node
    return this.createNode("Array", {
      elements: elements,
      pos: startToken.pos,
      original: startToken.original,
    });
  }

  buildMatrixTensor(matrixStructure, startToken) {
    // Determine maximum separator level to decide between Matrix and Tensor
    const maxSeparatorLevel = Math.max(
      ...matrixStructure.map((item) => item.separatorLevel),
    );

    if (maxSeparatorLevel === 1) {
      // This is a 2D Matrix - convert structure to simple rows
      const rows = [];

      for (const item of matrixStructure) {
        rows.push(item.row);
      }

      return this.createNode("Matrix", {
        rows: rows,
        pos: startToken.pos,
        original: startToken.original,
      });
    } else {
      // This is a multi-dimensional Tensor
      return this.createNode("Tensor", {
        structure: matrixStructure,
        maxDimension: maxSeparatorLevel + 1,
        pos: startToken.pos,
        original: startToken.original,
      });
    }
  }

  consumeSemicolonSequence() {
    if (this.current.type === "SemicolonSequence") {
      // Multiple consecutive semicolons
      const count = this.current.count;
      this.advance();
      return count;
    } else if (this.current.value === ";") {
      // Single semicolon
      this.advance();
      return 1;
    }
    return 0;
  }

  parseBraceContainer() {
    const startToken = this.current;
    this.advance(); // consume '{'

    const elements = [];
    let containerType = null;
    let hasAssignments = false;
    let hasPatternMatches = false;
    let hasEquations = false;
    let hasSemicolons = false;

    if (this.current.value !== "}") {
      do {
        const element = this.parseExpression(0);
        elements.push(element);

        // Check for type indicators
        if (element.type === "PatternMatchingFunction") {
          // Immediately throw error for pattern matching in braces
          this.error(
            "Pattern matching should use array syntax [ ] with sequential evaluation, not brace syntax { }. Use format: name :=> [ pattern1, pattern2, ... ]",
          );
        } else if (element.type === "BinaryOperation") {
          if (element.operator === ":=") {
            hasAssignments = true;
          } else if (
            element.operator === ":=:" ||
            element.operator === ":>:" ||
            element.operator === ":<:" ||
            element.operator === ":<=:" ||
            element.operator === ":>=:"
          ) {
            hasEquations = true;
          }
        }

        if (this.current.value === ",") {
          this.advance();
        } else if (this.current.value === ";") {
          hasSemicolons = true;
          this.advance();
        } else {
          break;
        }
      } while (this.current.value !== "}" && this.current.type !== "End");
    }

    if (this.current.value !== "}") {
      this.error("Expected closing brace");
    }
    this.advance(); // consume '}'

    // Determine container type based on contents
    if (hasEquations) {
      if (!hasSemicolons) {
        this.error(
          "System containers must contain only equations with equation operators separated by semicolons",
        );
      }
      if (hasAssignments || hasPatternMatches) {
        this.error("Cannot mix equations with other assignment types");
      }
      containerType = "System";
    } else if (hasAssignments) {
      containerType = "Map";
    } else {
      // All literals or expressions without special operators
      containerType = "Set";
    }

    // Validate type homogeneity
    if (containerType === "Map") {
      for (const element of elements) {
        if (element.type !== "BinaryOperation" || element.operator !== ":=") {
          this.error(
            "Map containers must contain only key-value pairs with :=",
          );
        }
      }
    } else if (containerType === "System") {
      for (const element of elements) {
        if (
          element.type !== "BinaryOperation" ||
          ![":=:", ":>:", ":<:", ":<=:", ":>=:"].includes(element.operator)
        ) {
          this.error(
            "System containers must contain only equations with equation operators",
          );
        }
      }
    }

    return this.createNode(containerType, {
      elements: elements,
      pos: startToken.pos,
      original: startToken.original,
    });
  }

  parseOperatorBrace(sigil) {
    const startToken = this.current;
    this.advance(); // consume '{+' or '{*'

    const elements = [];
    if (this.current.value !== "}") {
      do {
        if (this.current.value === ",") {
          this.advance();
          continue;
        }
        elements.push(this.parseExpression(0));

        if (this.current.value === ",") {
          this.advance();
        } else if (this.current.value !== "}") {
          this.error("Expected ',' or '}' in brace sequence");
        }
      } while (this.current.value !== "}" && this.current.type !== "End");
    }

    if (this.current.value !== "}") {
      this.error("Expected '}'");
    }
    this.advance();

    let sysName;
    if (sigil === "{+") sysName = "ADD";
    else if (sigil === "{*") sysName = "MUL";
    else if (sigil === "{&&") sysName = "AND";
    else if (sigil === "{||") sysName = "OR";

    return this.createNode("FunctionCall", {
      function: this.createNode("SystemIdentifier", {
        name: sysName,
        systemInfo: this.systemLookup(sysName),
        original: sigil,
      }),
      arguments: {
        positional: elements,
        keyword: {}
      },
      pos: startToken.pos,
      original: sigil,
    });
  }

  // Parse brace sigil containers: {= map, {? case, {; block, {| set, {: tuple, {@ loop
  parseBraceSigil(sigil) {
    const startToken = this.current;
    this.advance(); // consume the sigil token (e.g., '{=')

    const sigilTypeMap = {
      "{=": "MapContainer",
      "{?": "CaseContainer",
      "{;": "BlockContainer",
      "{|": "SetContainer",
      "{:": "TupleContainer",
      "{@": "LoopContainer",
    };

    const nodeType = sigilTypeMap[sigil];

    // Determine separator: temporal (;) vs spatial (,)
    const temporalSigils = new Set(["{?", "{;", "{@"]);
    const isTemporal = temporalSigils.has(sigil);
    const closerMap = {
      "{|": ["|}", "}"],
    };
    const closers = closerMap[sigil] || ["}"];
    const primaryCloser = closers[0];
    const isCloser = (val) => closers.includes(val);
    const separator = isTemporal ? ";" : ",";

    const elements = [];

    if (!isCloser(this.current.value)) {
      do {
        // Handle leading separators (empty slots)
        if (this.current.value === separator) {
          this.advance();
          continue;
        }

        const element = this.parseExpression(0);
        elements.push(element);

        // Check for separator
        if (this.current.value === separator) {
          this.advance();
          // Allow trailing separator before closer
          if (isCloser(this.current.value)) {
            break;
          }
        } else if (isCloser(this.current.value)) {
          break;
        } else if (this.current.type === "End") {
          this.error(`Expected closing ${primaryCloser} for ${nodeType}`);
        } else {
          // Also accept the other separator type for flexibility
          const altSep = isTemporal ? "," : ";";
          if (this.current.value === altSep) {
            this.advance();
            if (isCloser(this.current.value)) break;
          } else {
            break;
          }
        }
      } while (!isCloser(this.current.value) && this.current.type !== "End");
    }

    if (!isCloser(this.current.value)) {
      this.error(`Expected closing ${primaryCloser} for ${nodeType}`);
    }
    this.advance(); // consume closer
    return this.createNode(nodeType, {
      sigil: sigil,
      elements: elements,
      pos: startToken.pos,
      original: startToken.original,
    });
  }

  // Parse mutation syntax: obj{= +a=3, -.b, +c} or obj{! +a=3, -.b}
  parseMutation(target) {
    const sigil = this.current.value; // "{=" or "{!"
    const mutate = sigil === "{!"; // true = in-place, false = new copy
    const startToken = this.current;
    this.advance(); // consume '{=' or '{!'

    const operations = [];

    if (this.current.value !== "}") {
      do {
        // Each operation starts with + (add/merge) or - (remove)
        const op = { action: null, key: null, value: null };

        if (this.current.value === "+") {
          op.action = "add";
          this.advance(); // consume '+'
        } else if (this.current.value === "-") {
          op.action = "remove";
          this.advance(); // consume '-'
          // Remove expects .key syntax: -.b
          if (this.current.value === ".") {
            this.advance(); // consume '.'
          }
        } else {
          // Default to add
          op.action = "add";
        }

        // Parse key (identifier)
        if (this.current.type === "Identifier") {
          op.key = this.current.value;
          this.advance();
        } else {
          this.error("Expected property name in mutation");
        }

        // Check for = value
        if (op.action === "add" && (this.current.value === "=" || this.current.value === ":=")) {
          this.advance(); // consume '=' or ':='
          op.value = this.parseExpression(PRECEDENCE.CONDITION + 1);
        }

        operations.push(op);

        if (this.current.value === ",") {
          this.advance();
          if (this.current.value === "}") break;
        } else if (this.current.value === "}") {
          break;
        } else {
          break;
        }
      } while (this.current.value !== "}" && this.current.type !== "End");
    }

    if (this.current.value !== "}") {
      this.error("Expected closing } for mutation");
    }
    this.advance(); // consume '}'

    return this.createNode("Mutation", {
      target: target,
      mutate: mutate,
      operations: operations,
      pos: startToken.pos,
      original: startToken.original,
    });
  }

  parseCodeBlock() {
    const startToken = this.current;
    this.advance(); // consume '{{'

    const statements = [];

    if (this.current.value !== "}}") {
      do {
        const statement = this.parseExpression(0);
        statements.push(statement);

        // Check what token we're at after parsing the expression
        if (this.current.value === ";") {
          this.advance(); // consume semicolon and continue
          if (this.current.value === "}}") {
            break; // End after semicolon if we hit closing braces
          }
        } else if (this.current.value === "}}") {
          break; // End if we hit closing braces
        } else if (this.current.type === "End") {
          this.error("Expected closing }}");
        } else {
          // If we have more tokens but no semicolon, we might have multiple statements
          // For now, just break to handle single expressions
          break;
        }
      } while (this.current.value !== "}}" && this.current.type !== "End");
    }

    if (this.current.value !== "}}") {
      this.error("Expected closing }}");
    }
    this.advance(); // consume '}}'

    // Always return a CodeBlock regardless of statement count
    return this.createNode("CodeBlock", {
      statements: statements,
      pos: startToken.pos,
      original: startToken.original,
    });
  }

  parseUnaryOperator() {
    const operator = this.current;
    this.advance();
    const operand = this.parseExpression(PRECEDENCE.UNARY);

    return this.createNode("UnaryOperation", {
      operator: operator.value,
      operand: operand,
      pos: operator.pos,
      original: operator.original,
    });
  }

  // Parse derivatives (postfix quotes)
  parseDerivative(left) {
    const quotes = [];
    let originalText = "";

    // Collect consecutive quotes
    while (this.current.value === "'") {
      quotes.push(this.current);
      originalText += this.current.original;
      this.advance();
    }

    // Check for bracket notation for variables: f'[x,y]
    let variables = null;
    if (this.current.value === "[") {
      this.advance(); // consume '['
      variables = this.parseVariableList();
      if (this.current.value !== "]") {
        this.error("Expected closing bracket after variable list");
      }
      originalText += this.current.original;
      this.advance(); // consume ']'
    }

    // Check for evaluation/operation parentheses
    let evaluation = null;
    let operations = null;

    if (this.current.value === "(") {
      const parenResult = this.parseCalculusParentheses();
      if (parenResult.isEvaluation) {
        evaluation = parenResult.content;
      } else {
        operations = parenResult.content;
      }
      originalText += parenResult.original;
    }

    return this.createNode("Derivative", {
      function: left,
      order: quotes.length,
      variables: variables,
      evaluation: evaluation,
      operations: operations,
      pos: left.pos,
      original: left.original + originalText,
    });
  }

  // Parse integrals (leading quotes)
  parseIntegral() {
    const quotes = [];
    let originalText = "";

    // Collect consecutive leading quotes
    while (this.current.value === "'") {
      quotes.push(this.current);
      originalText += this.current.original;
      this.advance();
    }

    // Parse the base function/identifier only
    let func = null;
    if (this.current.type === "Identifier") {
      if (this.current.kind === "System") {
        const systemInfo = this.systemLookup(this.current.value);
        func = this.createNode("SystemIdentifier", {
          name: this.current.value,
          systemInfo: systemInfo,
          original: this.current.original,
        });
      } else {
        func = this.createNode("UserIdentifier", {
          name: this.current.value,
          original: this.current.original,
        });
      }
      this.advance();
    } else {
      this.error("Expected function name after integral operator");
    }

    // Check for bracket notation for variables: 'f[x,y]
    let variables = null;
    if (this.current.value === "[") {
      this.advance(); // consume '['
      variables = this.parseVariableList();
      if (this.current.value !== "]") {
        this.error("Expected closing bracket after variable list");
      }
      originalText += this.current.original;
      this.advance(); // consume ']'
    }

    // Check for evaluation/operation parentheses
    let evaluation = null;
    let operations = null;

    if (this.current.value === "(") {
      const parenResult = this.parseCalculusParentheses();
      if (parenResult.isEvaluation) {
        evaluation = parenResult.content;
      } else {
        operations = parenResult.content;
      }
      originalText += parenResult.original;
    }

    return this.createNode("Integral", {
      function: func,
      order: quotes.length,
      variables: variables,
      evaluation: evaluation,
      operations: operations,
      metadata: { integrationConstant: "c", defaultValue: 0 },
      pos: quotes[0].pos,
      original: originalText + func.original,
    });
  }

  // Parse variable lists in brackets: [x, y, z]
  parseVariableList() {
    const variables = [];

    if (this.current.value !== "]") {
      do {
        if (this.current.type === "Identifier") {
          variables.push({
            name: this.current.value,
            original: this.current.original,
          });
          this.advance();
        } else {
          this.error("Expected variable name in variable list");
        }

        if (this.current.value === ",") {
          this.advance();
        } else if (this.current.value === "]") {
          break;
        } else {
          this.error("Expected comma or closing bracket in variable list");
        }
      } while (true);
    }

    return variables;
  }

  // Parse parentheses in calculus context to distinguish evaluation vs operations
  parseCalculusParentheses() {
    const startToken = this.current;
    this.advance(); // consume '('

    let isEvaluation = true;
    const content = [];
    let originalText = startToken.original;

    while (this.current.value !== ")" && this.current.type !== "End") {
      const expr = this.parseExpression(0);
      content.push(expr);

      // Check if this contains operations (quotes) indicating it's an operation sequence
      if (this.containsCalculusOperations(expr)) {
        isEvaluation = false;
      }

      if (this.current.value === ",") {
        originalText += this.current.original;
        this.advance();
      } else {
        break;
      }
    }

    if (this.current.value !== ")") {
      this.error("Expected closing parenthesis");
    }

    originalText += this.current.original;
    this.advance(); // consume ')'

    return {
      isEvaluation: isEvaluation,
      content: content,
      original: originalText,
    };
  }

  // Helper to check if expression contains calculus operations
  containsCalculusOperations(expr) {
    if (!expr || typeof expr !== "object") return false;

    // Check for calculus node types directly
    if (expr.type === "Derivative" || expr.type === "Integral") {
      return true;
    }

    // Check for quote symbols in identifiers (like x' or 'x)
    if (expr.type === "UserIdentifier" && expr.name) {
      return expr.name.includes("'");
    }

    // Recursively check child nodes
    if (expr.left && this.containsCalculusOperations(expr.left)) return true;
    if (expr.right && this.containsCalculusOperations(expr.right)) return true;
    if (expr.function && this.containsCalculusOperations(expr.function))
      return true;
    if (expr.elements) {
      for (const element of expr.elements) {
        if (this.containsCalculusOperations(element)) return true;
      }
    }

    return false;
  }

  parseFunctionArgs() {
    const args = [];

    if (this.current.value !== ")") {
      do {
        args.push(this.parseExpression(0));
        if (this.current.value === ",") {
          this.advance();
        } else {
          break;
        }
      } while (this.current.value !== ")" && this.current.type !== "End");
    }

    if (this.current.value !== ")") {
      this.error("Expected closing parenthesis in function call");
    }
    this.advance(); // consume ')'

    return args;
  }

  parseFunctionParameters() {
    const params = {
      positional: [],
      keyword: [],
      conditionals: [],
      metadata: {},
    };

    if (this.current.value === ")") {
      return params;
    }

    let inKeywordSection = false;

    while (this.current.value !== ")" && this.current.type !== "End") {
      if (this.current.value === ";") {
        inKeywordSection = true;
        this.advance();
        continue;
      }

      const param = this.parseFunctionParameter(inKeywordSection);

      if (inKeywordSection) {
        params.keyword.push(param);
      } else {
        params.positional.push(param);
      }

      // Check for condition after parameter
      if (this.current.value === "?") {
        this.advance();
        const condition = this.parseExpression(PRECEDENCE.CONDITION + 1);
        params.conditionals.push(condition);
      }

      if (this.current.value === ",") {
        this.advance();
      } else if (this.current.value !== ")" && this.current.value !== ";") {
        break;
      }
    }

    return params;
  }

  parseFunctionParameter(isKeywordOnly = false) {
    const param = {
      name: null,
      defaultValue: null,
    };

    // Parse parameter name
    if (this.current.type === "Identifier" && this.current.kind === "User") {
      param.name = this.current.value;
      this.advance();
    } else {
      this.error("Expected parameter name");
    }

    // Check for default value
    if (this.current.value === ":=") {
      this.advance();
      param.defaultValue = this.parseExpression(PRECEDENCE.CONDITION + 1);
    }

    // Keyword-only parameters must have default values
    if (isKeywordOnly && param.defaultValue === null) {
      this.error("Keyword-only parameters must have default values");
    }

    return param;
  }

  parseFunctionCallArgs() {
    const args = {
      positional: [],
      keyword: {},
    };

    if (this.current.value === ")") {
      return args;
    }

    let inKeywordSection = false;

    while (this.current.value !== ")" && this.current.type !== "End") {
      if (this.current.value === ";") {
        inKeywordSection = true;
        this.advance();
        continue;
      }

      if (inKeywordSection) {
        // Parse keyword argument
        if (
          this.current.type === "Identifier" &&
          this.current.kind === "User"
        ) {
          const keyName = this.current.value;
          const keyPos = this.current.pos;
          const keyOriginal = this.current.original;
          this.advance();

          if (this.current.value === ":=") {
            this.advance();
            const value = this.parseExpression(PRECEDENCE.ASSIGNMENT + 1);
            args.keyword[keyName] = value;
          } else {
            // Shorthand: n := n (identifier is both key and value)
            args.keyword[keyName] = this.createNode("UserIdentifier", {
              name: keyName,
              pos: keyPos,
              original: keyOriginal,
            });
          }
        } else {
          this.error("Expected identifier for keyword argument");
        }
      } else {
        // Parse positional argument
        args.positional.push(this.parseExpression(0));
      }

      if (this.current.value === ",") {
        this.advance();
      } else if (this.current.value !== ")" && this.current.value !== ";") {
        break;
      }
    }

    return args;
  }

  convertArgsToParams(args) {
    const params = {
      positional: [],
      keyword: [],
      conditionals: [],
      metadata: {},
    };

    // Handle new function call argument structure
    if (args.positional && args.keyword) {
      // Convert positional arguments
      for (const arg of args.positional) {
        const result = this.parseParameterFromArg(arg, false);
        params.positional.push(result.param);
        if (result.condition) {
          params.conditionals.push(result.condition);
        }
      }

      // Convert keyword arguments to keyword parameters
      for (const [key, value] of Object.entries(args.keyword)) {
        const param = {
          name: key,
          defaultValue: null,
        };

        // Handle keyword argument values which can be expressions with conditions
        if (value.type === "BinaryOperation" && value.operator === "?") {
          // Direct condition: n -> (2 ? condition)
          param.defaultValue = value.left;
          params.conditionals.push(value.right);
        } else {
          // Simple value
          param.defaultValue = value;
        }

        params.keyword.push(param);
      }
    } else if (Array.isArray(args)) {
      // Handle legacy array format
      for (const arg of args) {
        const result = this.parseParameterFromArg(arg, false);
        params.positional.push(result.param);
        if (result.condition) {
          params.conditionals.push(result.condition);
        }
      }
    }

    return params;
  }

  parseEmbeddedLanguage(token) {
    const content = token.value;

    // If starts with colon or no colon found, treat as RiX-String
    if (content.startsWith(":") || content.indexOf(":") === -1) {
      const body = content.startsWith(":") ? content.slice(1) : content;
      return this.createNode("EmbeddedLanguage", {
        language: "RiX-String",
        context: null,
        body: body,
        original: token.original,
      });
    }

    // First, try to find a proper language header with parentheses
    const parenStart = content.indexOf("(");
    let colonIndex = -1;
    let header = "";
    let body = "";

    if (parenStart !== -1) {
      // Look for balanced parentheses and then find colon after them
      let parenCount = 0;
      let parenEnd = -1;

      for (let i = parenStart; i < content.length; i++) {
        if (content[i] === "(") {
          parenCount++;
        } else if (content[i] === ")") {
          parenCount--;
          if (parenCount === 0) {
            parenEnd = i;
            break;
          }
        }
      }

      // If we found balanced parentheses, look for colon after them
      if (parenEnd !== -1) {
        const afterParens = content.slice(parenEnd + 1);
        const colonAfterParens = afterParens.indexOf(":");
        if (colonAfterParens !== -1) {
          colonIndex = parenEnd + 1 + colonAfterParens;
        }
      }
    }

    // If no parentheses or no colon after parentheses, find first colon
    if (colonIndex === -1) {
      colonIndex = content.indexOf(":");
    }

    header = content.slice(0, colonIndex).trim();
    body = content.slice(colonIndex + 1);

    // Parse the header to extract language and optional context
    let language = header;
    let context = null;

    // Check if header has parentheses for context
    const headerParenStart = header.indexOf("(");
    const headerParenEnd = header.lastIndexOf(")");

    // Check for unmatched closing parenthesis
    if (headerParenEnd !== -1 && headerParenStart === -1) {
      this.error("Unmatched closing parenthesis in embedded language header");
    }

    if (headerParenStart !== -1) {
      let parenCount = 0;
      let parenEnd = -1;

      // Find the matching closing parenthesis
      for (let i = headerParenStart; i < header.length; i++) {
        if (header[i] === "(") {
          parenCount++;
        } else if (header[i] === ")") {
          parenCount--;
          if (parenCount === 0) {
            parenEnd = i;
            break;
          }
        }
      }

      // Validate parentheses structure
      if (parenEnd === -1) {
        this.error("Unmatched opening parenthesis in embedded language header");
      }

      if (parenEnd !== header.length - 1) {
        this.error(
          "Invalid embedded language header format. Expected: LANGUAGE(CONTEXT):BODY",
        );
      }

      // Check for multiple outer parenthetical groups
      const afterCloseParen = header.slice(parenEnd + 1);
      if (afterCloseParen.includes("(")) {
        this.error(
          "Multiple parenthetical groups not allowed in embedded language header",
        );
      }

      language = header.slice(0, headerParenStart).trim();
      context = header.slice(headerParenStart + 1, parenEnd).trim();
    }

    return this.createNode("EmbeddedLanguage", {
      language: language || null,
      context: context,
      body: body,
      original: token.original,
    });
  }

  parseParameterFromArg(arg, inKeywordSection) {
    const result = {
      param: {
        name: null,
        defaultValue: null,
      },
      condition: null,
    };

    if (arg.type === "BinaryOperation" && arg.operator === ":=") {
      // Parameter with default value: x := 5 or x := 5 ? condition
      result.param.name = arg.left.name || arg.left.value;

      // Check if the right side has a condition
      if (arg.right.type === "BinaryOperation" && arg.right.operator === "?") {
        result.param.defaultValue = arg.right.left;
        result.condition = arg.right.right;
      } else {
        result.param.defaultValue = arg.right;
      }
    } else if (arg.type === "BinaryOperation" && arg.operator === "?") {
      // Parameter with condition: x ? condition
      result.param.name = arg.left.name || arg.left.value;
      result.condition = arg.right;
    } else if (
      arg.type === "UserIdentifier" ||
      (arg.type === "Identifier" && arg.kind === "User")
    ) {
      // Simple parameter
      result.param.name = arg.name || arg.value;
    }

    return result;
  }

  parseStatement() {
    if (this.current.type === "End") {
      return null;
    }

    // Handle comments as standalone nodes
    if (this.current.type === "String" && this.current.kind === "comment") {
      const commentToken = this.current;
      this.advance();
      return this.createNode("Comment", {
        value: commentToken.value,
        kind: commentToken.kind,
        original: commentToken.original,
        pos: commentToken.pos,
      });
    }

    const expr = this.parseExpression(0);

    // Check for semicolon
    if (this.current.value === ";") {
      this.advance();
      return this.createNode("Statement", {
        expression: expr,
        pos: expr.pos,
        original: expr.original,
      });
    }

    return expr;
  }

  // Drain any buffered comments into the statements array
  drainComments(statements) {
    while (this.skippedComments.length > 0) {
      const commentToken = this.skippedComments.shift();
      statements.push(
        this.createNode("Comment", {
          value: commentToken.value,
          kind: commentToken.kind,
          original: commentToken.original,
          pos: commentToken.pos,
        }),
      );
    }
  }

  // Parse the entire program (array of statements)
  parse() {
    const statements = [];

    // Drain any comments collected during constructor's initial advance()
    this.drainComments(statements);

    while (this.current.type !== "End") {
      // Collect standalone comments (shouldn't normally be reached since advance skips them,
      // but kept for safety)
      if (this.current.type === "String" && this.current.kind === "comment") {
        const commentToken = this.current;
        this.advance();
        statements.push(
          this.createNode("Comment", {
            value: commentToken.value,
            kind: commentToken.kind,
            original: commentToken.original,
            pos: commentToken.pos,
          }),
        );
        this.drainComments(statements);
        continue;
      }

      const stmt = this.parseStatement();
      if (stmt) {
        statements.push(stmt);
      }
      // Drain any comments that were skipped during expression parsing
      this.drainComments(statements);
    }

    return statements;
  }

  // Parse function calls - now works on any expression, not just identifiers
  parseCall(target) {
    // Lowercase letter-based user identifiers followed by ( are implicit multiplication: f(x) = f * (x)
    // Operator-symbol identifiers (+, *, <, etc.) remain function calls
    if (target.type === "UserIdentifier" && /^[\p{L}]/u.test(target.name)) {
      const grouping = this.parseGrouping();
      return this.createNode("ImplicitMultiplication", {
        left: target,
        right: grouping,
        pos: target.pos,
        original: target.original + "(...)",
      });
    }

    this.advance(); // consume '('
    const args = this.parseFunctionCallArgs();
    if (this.current.value !== ")") {
      this.error("Expected closing parenthesis in function call");
    }
    this.advance(); // consume ')'

    // SystemFunctionRef calls produce SystemCall nodes
    if (target.type === "SystemFunctionRef") {
      return this.createNode("SystemCall", {
        name: target.name,
        arguments: args,
        pos: target.pos,
        original: target.original + "(...)",
      });
    }

    // SystemIdentifier and UserIdentifier (operator symbols) produce FunctionCall
    if (target.type === "SystemIdentifier" || target.type === "UserIdentifier") {
      return this.createNode("FunctionCall", {
        function: target,
        arguments: args,
        pos: target.pos,
        original: target.original + "(...)",
      });
    }

    // Everything else (expressions, etc.)
    return this.createNode("Call", {
      target: target,
      arguments: args,
      pos: target.pos,
      original: target.original + "(...)",
    });
  }

  // Parse @ postfix operator (AT metadata access)
  parseAt(target) {
    this.advance(); // consume '@'
    if (this.current.value !== "(") {
      this.error("Expected opening parenthesis after @ operator");
    }
    this.advance(); // consume '('

    const arg = this.parseExpression(0);

    if (this.current.value !== ")") {
      this.error("Expected closing parenthesis in @ operator");
    }
    this.advance(); // consume ')'

    return this.createNode("At", {
      target: target,
      arg: arg,
      pos: target.pos,
      original: target.original + "@(" + (arg.original || "") + ")",
    });
  }

  // Parse ? postfix operator (ASK metadata access)
  parseAsk(target) {
    this.advance(); // consume '?'
    if (this.current.value !== "(") {
      this.error("Expected opening parenthesis after ? operator");
    }
    this.advance(); // consume '('

    const arg = this.parseExpression(0);

    if (this.current.value !== ")") {
      this.error("Expected closing parenthesis in ? operator");
    }
    this.advance(); // consume ')'

    return this.createNode("Ask", {
      target: target,
      arg: arg,
      pos: target.pos,
      original: target.original + "?(" + (arg.original || "") + ")",
    });
  }

  // Parse ~[ postfix operator (scientific unit)
  parseScientificUnit(target) {
    const startToken = this.current;
    this.advance(); // consume '~['

    // Collect all tokens until we find the closing ]
    let unitContent = "";
    let unitOriginal = "";

    while (this.current.type !== "End") {
      if (this.current.value === "[") {
        this.error("Nested '[' not allowed inside scientific unit ~[...]");
      } else if (this.current.value === "]") {
        break;
      }

      // Preserve exact content including spaces
      unitContent += this.current.original;
      unitOriginal += this.current.original;
      this.advance();
    }

    if (this.current.value !== "]") {
      this.error("Expected closing bracket ] for scientific unit");
    }
    this.advance(); // consume ']'

    return this.createNode("ScientificUnit", {
      target: target,
      unit: unitContent.trim(),
      pos: target.pos,
      original: target.original + startToken.original + unitOriginal + "]",
    });
  }

  // Parse ~{ postfix operator (mathematical unit)
  parseMathematicalUnit(target) {
    const startToken = this.current;
    this.advance(); // consume '~{'

    // Collect all tokens until we find the closing }
    let unitContent = "";
    let unitOriginal = "";

    while (this.current.type !== "End") {
      if (this.current.value === "{") {
        this.error("Nested '{' not allowed inside mathematical unit ~{...}");
      } else if (this.current.value === "}") {
        break;
      }

      // Preserve exact content including spaces
      unitContent += this.current.original;
      unitOriginal += this.current.original;
      this.advance();
    }

    if (this.current.value !== "}") {
      this.error("Expected closing brace } for mathematical unit");
    }
    this.advance(); // consume '}'

    return this.createNode("MathematicalUnit", {
      target: target,
      unit: unitContent.trim(),
      pos: target.pos,
      original: target.original + startToken.original + unitOriginal + "}",
    });
  }
}

// Main parse function
export function parse(input, systemLookup) {
  let tokens;
  let source = "";
  if (typeof input === "string") {
    source = input;
    tokens = tokenize(input);
  } else {
    tokens = input;
  }
  const parser = new Parser(tokens, systemLookup, source);
  return parser.parse();
}

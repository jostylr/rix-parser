# RiX ↔ Calc Merger Analysis & Path Forward

This document analyzes all existing parsers, languages, and evaluation systems in the ratmath project, identifies conflicts, and proposes a concrete architecture for merging them into a single unified system where RiX is the language and the calc is the runtime.

---

## 1. Current State: Three Separate Systems

### 1A. RiX Parser (`rix/parser/src/`)

**What it is:** A well-engineered two-stage parser (tokenizer → Pratt parser) producing clean ASTs.

- **Tokenizer** (`tokenizer.js`, 565 lines): Maximal-munch tokenization for 11+ number formats, Unicode identifiers, 50+ symbols, N-delimiter strings/comments.
- **Parser** (`parser.js`, 2407 lines): Full Pratt parser with 13 precedence levels. Produces 20+ AST node types: `Number`, `UserIdentifier`, `SystemIdentifier`, `BinaryOperation`, `FunctionCall`, `FunctionLambda`, `FunctionDefinition`, `PatternMatchingFunction`, `Pipe`, `Map`, `Filter`, `Reduce`, `GeneratorChain`, `Array`, `Matrix`, `Tensor`, `TernaryOperation`, `DotAccess`, `WithMetadata`, `IntervalStepping`, etc.
- **System Loader** (`system-loader.js`, 780 lines): Three-tier keyword registry (core → tinkerer → user). Registers AND/OR/NOT as operators, SIN/COS/etc as functions, PI/E as constants.

**What it lacks:** Zero evaluation capability. `rix/eval/` is an empty stub.

**Strengths:**
- Proper AST output — the foundation for "all syntax → system functions"
- Rich operator set already aligned with the scratch-ideas design
- Unicode identifiers with System/User distinction by case
- Generator/pipe/pattern-matching syntax already parsed
- Position tracking for error reporting

### 1B. Calc Number Parser (`packages/parser/src/index.js`)

**What it is:** A ~3700-line specialized parser for number literals only. Handles:
- Decimal uncertainty notation: `1.23[56:67]`, `1.23[+5,-6]`, `1.3[+-1]`
- Base-prefixed numbers: `0b101`, `0xFF`, `0o7`
- Repeating decimals, rationals, mixed numbers, intervals
- Scientific notation with various bases
- Converts string representations into `Integer`, `Rational`, `RationalInterval` core types

**What it lacks:** Cannot parse general expressions — only number literals.

**Strengths:**
- Battle-tested number parsing with edge cases covered
- Already supports the `0x`/`0b`/`0o` prefix notation
- Produces proper ratmath core types directly

### 1C. VariableManager (`packages/algebra/src/var.js`)

**What it is:** A ~2960-line monolith that is simultaneously:
- A regex-based expression "parser" (no tokenizer, no AST)
- An evaluator via string substitution
- A scope manager (scope chains)
- A module/package loader
- A function registry (JS + user-defined)
- A formatting system

**How it works:** `processInput(string)` does cascading regex matches:
1. `FuncName(args) -> body` → function definition
2. `Name = (args) -> body` → assignment-style function def
3. `Name.property = expr` → property assignment
4. `Name = expr` → variable assignment
5. Special functions (SUM/PROD/SEQ)
6. Function display lookup
7. Fallback: `evaluateExpression(string, scopeChain)`

`evaluateExpression` then does further regex-based processing:
- Detects oracle arithmetic patterns
- Detects lambda expressions via regex
- Detects piecewise `{cond ? val, ...}` and object literals `{a=5, b=10}`
- Does function call substitution via regex (finds `Name(args)` patterns, evaluates, splices result back into string)
- Handles base commands (`HEX expr`, `BIN expr`)
- Substitutes variables via regex
- Finally calls `Parser.parse()` (the number parser) on the resulting string

**Critical flaw:** Everything is string-based. Function bodies are stored as strings. Evaluation means regex-matching function calls in strings, evaluating args, formatting results back to strings, splicing them in, and repeating. This is fundamentally:
- **Fragile**: Regex can't properly handle nested structures
- **Slow**: Re-parsing on every evaluation
- **Limited**: Can't represent complex AST transformations
- **Hard to extend**: Every new syntax needs new regex patterns

**Strengths (to preserve):**
- Module system (`loadModule`, `unloadModule`, package registry)
- Scope chain model (local → parent → global)
- Lazy vs eager function evaluation
- The `@@` all-arguments sequence trick
- Property/decoration system
- The `freezeExpression` concept (static scoping for function bodies)
- Help system integration
- The stdlib functions (ASSIGN, GLOBAL, IF, MULTI, GETVAR, etc.)

---

## 2. Syntax Conflicts & Resolutions

Per the user's directive, `syntax-scratch-ideas.txt` overrides all other documents.

### 2A. Assignment: `=` and `:=` both work

**Current conflict:** Calc uses `=` for assignment, RiX spec uses `:=` for assignment and reserves `=` for mathematical identity/assertion.

**Resolution:** Both `=` and `:=` are assignment. Boolean equality is `==`. This is simple and familiar.

| Syntax | Meaning | System Function |
|--------|---------|-----------------|
| `x = 3` | Assignment | `ASSIGN("x", 3)` |
| `x := 3` | Assignment (synonym) | `ASSIGN("x", 3)` |
| `x == 3` | Boolean equality test | `EQ(x, 3)` |
| `x :=: 3x+2` | Equation to solve | `SOLVE(x, 3*x+2)` |
| `x < 5` | Boolean comparison | `LT(x, 5)` |
| `x :< 5` | Assertion | `ASSERT_LT(x, 5)` |

**Impact:** The RiX parser already has `=`, `:=`, `==` in its symbol table. Need to add `=` as an assignment operator alongside `:=`. The parser's `=` is currently at `PRECEDENCE.EQUALITY` — it needs to be context-sensitive (assignment when LHS is an identifier/pattern, equality in boolean context) OR always assignment at statement level with `==` for equality. The simplest approach: **`=` is assignment at statement level (lowest precedence) and `:=` is assignment anywhere. `==` is always boolean equality.**

### 2B. Number Bases: Drop Environment Toggle

**Current conflict:** The calc has `this.inputBase` which globally changes how all numbers are interpreted. Commands like `HEX`, `BIN`, `OCT`, `DEC` toggle this state.

**Resolution (from scratch-ideas line 69):** Remove the base environment toggle entirely. Numbers are base-10 by default. Use `0` + letter prefix:

| Prefix | Base | Name |
|--------|------|------|
| `0b` | 2 | Binary |
| `0t` | 3 | Ternary |
| `0q` | 4 | Quaternary |
| `0f` | 5 | Base-5 |
| `0s` | 7 | Base-7 |
| `0d` | 10 | Decimal (never needed) |
| `0x` | 16 | Hexadecimal |
| `0c` | 12 | Clock (duodecimal) |
| `0m` | 60 | Mesopotamian |
| `0y` | 64 | (0-9A-Za-z@&) |
| `0u` | 36 | URL shorteners |
| `0j` | 20 | Vigesimal |
| `0z[N]` | N | Custom base |

Capital letters (`0A`–`0Z` except reserved) available for user-defined bases.

**Impact:** 
- Remove `this.inputBase`, `setInputBase()`, `preprocessExpression()` from VariableManager
- Remove `HEX`, `BIN`, `OCT`, `DEC` REPL commands from calc
- The RiX tokenizer already handles `0[a-zA-Z]` prefix patterns (lines 276–334)
- The packages/parser already handles `0b`, `0x`, `0o` in `parseBaseNotation`
- Need to extend the tokenizer/number-parser to handle all the new base letters

### 2C. Brace Container Sigils

**From scratch-ideas:**

| Syntax | Type | Separator | System Function |
|--------|------|-----------|-----------------|
| `{= a=3, b=6}` | Map | `,` (spatial) | `MAP("a", 3, "b", 6)` |
| `{? x<y ? 3*x; x>5 ? x*4; x+2}` | Case | `; ?` (temporal) | `CASE(@{x<y}, @{3*x}, @{x>5}, @{x*4}, @{x+2})` |
| `{; x=x+3; Do(x); 2*x}` | Block | `;` (temporal) | `BLOCK(@{x=x+3}, @{Do(x)}, @{2*x})` |
| `{| 3, 6, "cool"}` | Set | `,` (spatial) | `SET(3, 6, "cool")` |
| `{: 5, 6, 7, 8}` | Tuple/Array | `,` (spatial) | `TUPLE(5, 6, 7, 8)` |
| `{@ i=0; i<10; body; i+=1}` | Loop | `;` (temporal) | `LOOP(@{i=0}, @{i<10}, @{body}, @{i+=1})` |

The `@` prefix on a block (`@{; ...}`) makes it a raw/deferred block (not immediately executed). This is crucial for CASE and LOOP arguments.

**Impact:** The RiX parser's `parseBraceContainer()` already detects sigils like `:=` assignments and equations. Need to extend it to detect the leading sigil character (`=`, `?`, `;`, `|`, `:`, `@`) right after `{`.

### 2D. Identifier Case Rules

**Agreement:** Keep the calc convention:
- **Lowercase start** → Variable: `x`, `myVar` → stored/retrieved via `ASSIGN`/`RETRIEVE`
- **Uppercase start** → Function/System: `Sin`, `MAP`, `EXP` → callable

The RiX tokenizer already normalizes: uppercase start → all-upper value, lowercase start → all-lower value. This matches the calc's `normalizeName()`.

### 2E. Syntax `f(x)` When `f` is Lowercase

**From scratch-ideas line 61:** "Syntax f(x) should be interpreted as f*x and not as function evaluation. Capital letters are the functions."

This means `f(x)` → `MUL(RETRIEVE("f"), RETRIEVE("x"))` (implicit multiplication), while `F(x)` → `CALL("F", RETRIEVE("x"))`.

**Impact:** The parser needs to distinguish: if identifier before `(` is lowercase, it's implicit multiplication with a grouped expression. If uppercase, it's a function call. The RiX parser currently treats both as `FunctionCall` nodes; this needs a post-parse or parse-time check on identifier kind.

---

## 3. The "Everything is a System Function" Architecture

This is the core of the user's vision and the key architectural principle.

### 3A. The Pipeline

```
Source Text
    ↓
[Tokenizer] — produces token stream
    ↓
[Parser] — produces AST
    ↓
[Lowering Pass] — converts AST nodes to system function calls (IR)
    ↓
[Evaluator] — executes system function calls
    ↓
Result (Integer, Rational, RationalInterval, String, Sequence, etc.)
```

### 3B. The Lowering Pass (AST → System Function IR)

Every AST node lowers to a system function call. The IR is itself a tree of function call nodes:

```javascript
// IR Node format:
{ fn: "SYSTEM_FUNC_NAME", args: [...] }

// Where args can be:
// - Literal values (numbers, strings)
// - Other IR nodes (nested function calls)
// - Deferred blocks: { fn: "DEFER", body: <IR node> }
```

**Lowering rules:**

| AST Node | Lowered Form |
|----------|-------------|
| `Number("42")` | `{ fn: "LITERAL", args: ["42"] }` |
| `UserIdentifier("x")` | `{ fn: "RETRIEVE", args: ["x"] }` |
| `SystemIdentifier("PI")` | `{ fn: "RETRIEVE", args: ["PI"] }` |
| `x = 3` (Assignment) | `{ fn: "ASSIGN", args: ["x", {fn:"LITERAL", args:["3"]}] }` |
| `x := 3` (Assignment) | `{ fn: "ASSIGN", args: ["x", {fn:"LITERAL", args:["3"]}] }` |
| `x + y` (BinaryOp) | `{ fn: "ADD", args: [{fn:"RETRIEVE",args:["x"]}, {fn:"RETRIEVE",args:["y"]}] }` |
| `x * y` | `{ fn: "MUL", args: [...] }` |
| `x ^ 2` | `{ fn: "POW", args: [...] }` |
| `x == y` | `{ fn: "EQ", args: [...] }` |
| `F(x, y)` (FuncCall) | `{ fn: "CALL", args: ["F", {fn:"RETRIEVE",args:["x"]}, ...] }` |
| `f(x)` (lowercase call) | `{ fn: "MUL", args: [{fn:"RETRIEVE",args:["f"]}, {fn:"RETRIEVE",args:["x"]}] }` |
| `(x) -> x^2` (Lambda) | `{ fn: "LAMBDA", args: [["x"], {fn:"POW", args:[...]}] }` |
| `{= a=3, b=6}` (Map) | `{ fn: "MAP", args: ["a", ..., "b", ...] }` |
| `{? c1 ? v1; c2 ? v2; d}` | `{ fn: "CASE", args: [{fn:"DEFER",...}, ...] }` |
| `{; s1; s2; s3}` (Block) | `{ fn: "BLOCK", args: [{fn:"DEFER",...}, ...] }` |
| `{@ init; cond; body; upd}` | `{ fn: "LOOP", args: [{fn:"DEFER",...}, ...] }` |
| `[1, 2, 3]` (Array) | `{ fn: "ARRAY", args: [...] }` |
| `a:b` (Interval) | `{ fn: "INTERVAL", args: [...] }` |
| `x \|> F` (Pipe) | `{ fn: "PIPE", args: [...] }` |
| `x \|>> F` (Map pipe) | `{ fn: "PMAP", args: [...] }` |

### 3C. System Function Registry

System functions are stored in a registry that maps names to implementations. This registry is **configurable** — functions can be swapped out for debugging, profiling, or customization.

```javascript
class SystemFunctionRegistry {
    constructor() {
        this.functions = new Map();
        this.debugMode = false;
    }

    register(name, implementation, options = {}) {
        this.functions.set(name, {
            impl: implementation,
            lazy: options.lazy || false,  // args passed as deferred blocks
            pure: options.pure || false,  // no side effects
            doc: options.doc || "",
        });
    }

    call(name, args, context) {
        const func = this.functions.get(name);
        if (!func) throw new Error(`Unknown system function: ${name}`);

        if (this.debugMode) {
            console.log(`[SYS] ${name}(${args.map(a => JSON.stringify(a)).join(", ")})`);
        }

        return func.impl(args, context);
    }

    // Swap implementation for debugging
    override(name, newImpl) { ... }
    // Restore original
    restore(name) { ... }
}
```

### 3D. The Evaluator

The evaluator walks the IR tree and calls system functions:

```javascript
function evaluate(irNode, context) {
    if (irNode.fn === "LITERAL") {
        return parseNumber(irNode.args[0]); // Uses packages/parser
    }
    if (irNode.fn === "DEFER") {
        return irNode; // Return unevaluated
    }

    // Evaluate args (unless function is lazy)
    const funcDef = registry.get(irNode.fn);
    let evaluatedArgs;
    if (funcDef.lazy) {
        evaluatedArgs = irNode.args; // Pass raw IR nodes
    } else {
        evaluatedArgs = irNode.args.map(arg =>
            typeof arg === 'object' && arg.fn ? evaluate(arg, context) : arg
        );
    }

    return registry.call(irNode.fn, evaluatedArgs, context);
}
```

---

## 4. Type System Proposals

The scratch-ideas mention typing is optional with `Any` as default. Here's a concrete proposal:

### 4A. Core Types

| Type | Description | Literal Examples |
|------|-------------|-----------------|
| `Integer` | Arbitrary-precision integer | `42`, `0b1010` |
| `Rational` | Exact rational number | `3/4`, `1..3/4` |
| `Interval` | Closed rational interval | `2:5`, `1.23:4.56` |
| `Real` | Oracle-based real number | `PI`, `Sqrt(2)` |
| `String` | Text | `"hello"` |
| `Bool` | Boolean (0 or 1 as Integer) | result of `==`, `<` |
| `Sequence` | Ordered list of values | `[1, 2, 3]` |
| `Set` | Unordered unique collection | `{\| 1, 2, 3}` |
| `Map` | Key-value pairs | `{= a=1, b=2}` |
| `Tuple` | Fixed-length ordered | `{: 1, "a", 3}` |
| `Lambda` | First-class function | `(x) -> x^2` |
| `Unit` | Value with unit annotation | `3.2~[m]` |
| `Extension` | Algebraic extension element | `2~{sqrt2}` |
| `Null` | Absence of value | `_` |
| `Block` | Deferred computation | `@{; x+1; x*2}` |

### 4B. Type Annotations (Optional)

Syntax from scratch-ideas: `{...}$type1, type2$` constrains allowed value types.

```
F = $(Integer, Integer) -> Integer$ (a, b) -> a + b
mymap = {= a=3, b=5 }$String, Integer$
```

Annotations are metadata — they don't change evaluation but enable:
- Static checks before evaluation
- Better error messages
- Documentation
- IDE tooling

### 4C. Type Hierarchy

```
Any
├── Number
│   ├── Integer
│   ├── Rational (⊃ Integer)
│   ├── Interval (pair of Rationals)
│   └── Real (⊃ Rational, oracle-based)
├── String
├── Bool (Integer restricted to 0/1)
├── Collection
│   ├── Sequence (ordered, indexable)
│   ├── Set (unordered, unique)
│   ├── Tuple (ordered, fixed-length)
│   └── Map (key-value)
├── Lambda
├── Unit (Number + unit tag)
├── Extension (Number + algebraic extension)
├── Block (deferred IR)
└── Null
```

### 4D. Type Coercion Rules

- `Integer → Rational`: automatic (lossless)
- `Rational → Interval`: automatic (point interval)
- `Integer → Real`: automatic (trivial oracle)
- `Rational → Real`: automatic (trivial oracle)
- `Bool → Integer`: automatic (0 or 1)
- Everything else: explicit via `ToInt()`, `ToRat()`, `ToStr()`, etc.

---

## 5. What to Keep, Drop, and Merge

### 5A. Keep from Calc

| Feature | Location | Notes |
|---------|----------|-------|
| Module system | `var.js` loadModule/unloadModule | Adapt to new evaluator |
| Package registry | `package-registry.js` | Keep as-is |
| Help registry | `help-registry.js` | Keep as-is |
| stdlib functions | `packages/stdlib/src/` | Core, Logic, List, String, Object — become system functions |
| Scope chain model | `var.js` scopeChain | Preserve in new evaluator Context |
| Lazy evaluation | `var.js` `func.lazy` | Map to DEFER in IR |
| `@@` all-args sequence | `var.js` | Keep in new evaluator |
| Property decorations | `var.js` decorations Map | Keep for metadata system |
| Number parsing | `packages/parser/src/index.js` | Reuse for LITERAL evaluation |
| Core types | `packages/core/` | Integer, Rational, RationalInterval, BaseSystem |
| Oracle reals | `packages/oracles/` | Keep for Real type |

### 5B. Drop from Calc

| Feature | Reason |
|---------|--------|
| `inputBase` environment toggle | Replaced by `0x`/`0b` prefix notation |
| `HEX`/`BIN`/`OCT`/`DEC` commands | Same |
| `preprocessExpression()` | No longer needed without base toggle |
| Regex-based expression parsing | Replaced by RiX tokenizer + parser |
| String substitution evaluation | Replaced by AST-based evaluation |
| `freezeExpression()` | Replaced by proper lexical scoping in AST |
| `tryOracleArithmetic()` | Handled naturally by AST evaluation |
| ad-hoc piecewise parsing | Replaced by `{? ...}` syntax |
| ad-hoc object literal parsing | Replaced by `{= ...}` syntax |

### 5C. Keep from RiX

| Feature | Location | Notes |
|---------|----------|-------|
| Tokenizer | `rix/parser/src/tokenizer.js` | Primary tokenizer for everything |
| Pratt Parser | `rix/parser/src/parser.js` | Primary parser, needs updates per §2 |
| System Loader | `rix/parser/src/system-loader.js` | Merge with calc's package system |
| Operator precedence table | parser.js SYMBOL_TABLE | Authoritative operator set |
| All AST node types | parser.js | Foundation for lowering |
| Generator/pipe syntax | parser.js | Already parsed, need evaluator |
| Pattern matching | parser.js | Already parsed, need evaluator |
| Design specs | `rix/parser/design/` | Reference documentation |

### 5D. Drop/Modify from RiX

| Feature | Reason |
|---------|--------|
| `?=` for boolean equality | Replaced by `==` per user directive |
| `=` as mathematical assertion | `=` is now assignment (like calc) |
| `?<`, `?>` etc. for boolean | Use `<`, `>` for boolean comparisons directly; the `?` prefix versions can remain as aliases |

---

## 6. Concrete Implementation Plan

### Phase 1: Unify the Parser (Tokenizer + AST)

**Goal:** Single parser that handles all RiX + calc syntax, producing clean ASTs.

1. **Update RiX tokenizer:**
   - Add `=` as a symbol (it's already there, but confirm assignment semantics)
   - Add all base prefixes from scratch-ideas (0t, 0q, 0f, 0s, 0c, 0m, 0y, 0u, 0j, 0z[N])
   - Ensure `#` comments work (already does)

2. **Update RiX parser:**
   - Make `=` an assignment operator at `PRECEDENCE.ASSIGNMENT` (same as `:=`)
   - Add `==` as boolean equality at `PRECEDENCE.EQUALITY`
   - Implement brace sigil detection: `{=`, `{?`, `{;`, `{|`, `{:`, `{@` as distinct container types
   - Handle lowercase `f(x)` as implicit multiplication vs uppercase `F(x)` as function call
   - Parse `obj{= +a=3, -.b}` mutation syntax
   - Parse `obj..b` external property access (double-dot)

3. **Add REPL commands as AST nodes:**
   - `HELP topic`, `LOAD pkg`, `UNLOAD pkg` → parsed as system function calls

### Phase 2: Build the Lowering Pass

**Goal:** AST → IR (tree of system function calls)

1. **Create `rix/eval/src/lower.js`:**
   - Walk AST, produce IR nodes `{ fn, args }`
   - Handle DEFER for lazy arguments (`@{...}` blocks, CASE conditions, LOOP components)
   - Handle the lowercase-call → multiplication rule

2. **Define the complete system function set:**
   - Arithmetic: `ADD`, `SUB`, `MUL`, `DIV`, `INTDIV`, `MOD`, `POW`, `NEG`
   - Comparison: `EQ`, `NEQ`, `LT`, `GT`, `LTE`, `GTE`
   - Logic: `AND`, `OR`, `NOT`
   - Variables: `ASSIGN`, `RETRIEVE`, `GLOBAL`
   - Control: `IF`, `CASE`, `BLOCK`, `LOOP`
   - Collections: `ARRAY`, `SET`, `MAP`, `TUPLE`, `INTERVAL`
   - Functions: `CALL`, `LAMBDA`, `PIPE`, `PMAP`, `PFILTER`, `PREDUCE`
   - Numbers: `LITERAL` (delegates to packages/parser for parsing)
   - Meta: `HELP`, `LOAD`, `UNLOAD`, `INFO`, `TYPE`

### Phase 3: Build the Evaluator

**Goal:** Execute IR using a system function registry.

1. **Create `rix/eval/src/evaluator.js`:**
   - System function registry (configurable, overridable)
   - Context object: scope chain, module state, config
   - Recursive IR walker
   - DEFER handling for lazy evaluation

2. **Port stdlib functions:**
   - Move `packages/stdlib/src/core.js` functions (ASSIGN, GLOBAL, IF, MULTI) to registry
   - Move `packages/stdlib/src/logic.js` (EQ, NEQ, GT, AND, OR, NOT) to registry
   - Move `packages/stdlib/src/list.js` (LEN, GETEL, MAP, FILTER, REDUCE) to registry
   - Move `packages/stdlib/src/string.js` to registry
   - Move `packages/stdlib/src/object.js` to registry
   - These become the default system function implementations

3. **Integrate number parsing:**
   - `LITERAL` system function uses `packages/parser` to convert number strings to core types
   - Handle all formats: integers, rationals, mixed numbers, intervals, repeating decimals, base-prefixed

4. **Port scope/module system:**
   - Adapt VariableManager's scope chain into evaluator Context
   - Port module loading (lazy package imports)
   - Port package registry integration

### Phase 4: Replace the Calc

**Goal:** `apps/calc` uses the new unified pipeline.

1. **Create new Calculator class:**
   - Uses RiX tokenizer + parser for input
   - Uses lowering pass to get IR
   - Uses evaluator to execute
   - Output formatting (rational, decimal, scientific, continued fraction modes)

2. **Port remaining calc features:**
   - Output mode commands (DECI, RAT, BOTH, SCI, CF) → environment settings
   - LIMIT command → environment setting
   - MIX display toggle → environment setting
   - Custom base definition `[n] = range` → system function
   - Interrupt handling → evaluator supports cancellation

3. **Port webcalc:**
   - Same pipeline, browser-compatible
   - System loader's browser integration already exists

### Phase 5: Extended Features

1. **Type annotations** (optional, progressive)
2. **Pattern matching evaluation** (already parsed)
3. **Unit arithmetic** (connect to packages/units)
4. **Generator/sequence evaluation** (already parsed)
5. **Symbolic calculus** (derivative/integral notation already parsed)

---

## 7. File Structure After Merge

```
rix/
├── parser/
│   └── src/
│       ├── tokenizer.js          # THE tokenizer (updated)
│       ├── parser.js             # THE parser (updated)
│       └── system-loader.js      # Keyword/operator registry
├── eval/
│   └── src/
│       ├── lower.js              # AST → IR lowering pass
│       ├── evaluator.js          # IR execution engine
│       ├── registry.js           # System function registry
│       ├── context.js            # Scope chain, module state
│       └── builtins/
│           ├── arithmetic.js     # ADD, SUB, MUL, DIV, POW, etc.
│           ├── comparison.js     # EQ, LT, GT, etc.
│           ├── logic.js          # AND, OR, NOT
│           ├── variables.js      # ASSIGN, RETRIEVE, GLOBAL
│           ├── control.js        # IF, CASE, BLOCK, LOOP
│           ├── collections.js    # ARRAY, SET, MAP, TUPLE
│           ├── functions.js      # CALL, LAMBDA, PIPE
│           ├── strings.js        # String operations
│           ├── numbers.js        # LITERAL, INTERVAL, etc.
│           └── meta.js           # HELP, LOAD, TYPE, INFO
├── repl/                         # REPL interface
└── web/                          # Browser interface

packages/
├── core/         # Integer, Rational, RationalInterval, BaseSystem (unchanged)
├── parser/       # Number literal parser (reused by LITERAL builtin)
├── algebra/      # Simplified: just package-registry + help-registry
├── stdlib/       # Legacy compatibility layer (maps to builtins)
├── reals/        # Oracle-based reals (loaded via LOAD)
├── oracles/      # Oracle definitions
├── arith-funs/   # Polynomial, number theory, etc. (loaded via LOAD)
├── units/        # Unit system (loaded via LOAD)
└── ...

apps/
├── calc/         # Terminal REPL (uses rix/eval pipeline)
├── webcalc/      # Browser calculator (uses rix/eval pipeline)
└── ...
```

---

## 8. Migration Strategy

**Approach:** Build the new pipeline alongside the old one, then swap.

1. **Phase 1-2** can be built in `rix/eval/` without touching existing code
2. **Phase 3** ports functionality but doesn't remove old code
3. **Phase 4** creates a new calc entry point that uses the new pipeline
4. Old `VariableManager.evaluateExpression()` can be kept temporarily for comparison/testing
5. Once the new pipeline passes all existing calc tests, remove old evaluation code

**Testing strategy:**
- Run existing `packages/parser/tests/` — number parsing must still work
- Run existing `apps/calc/tests/` — capture expected outputs, verify new pipeline matches
- Add new tests for RiX-specific syntax (brace containers, pipes, generators, patterns)
- Add lowering tests: AST → expected IR
- Add evaluator tests: IR → expected results

---

## 9. Key Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Assignment operator | Both `=` and `:=` | User directive; familiar |
| Equality operator | `==` | User directive; unambiguous |
| Number base | Prefix only (`0x`, `0b`, etc.) | User directive; no global state |
| Case convention | Lower=var, Upper=func | Keep from calc; clear distinction |
| `f(x)` lowercase | Implicit multiplication | User directive from scratch-ideas |
| All syntax → functions | Lowering pass | User directive; debuggable, configurable |
| Type system | Optional annotations, `Any` default | Scratch-ideas; progressive typing |
| Evaluation model | AST → IR → execute | Clean separation of concerns |
| System functions | Configurable registry | User directive; swappable for debugging |
| Brace containers | Sigil after `{` determines type | Scratch-ideas; regular, extensible |
| Deferred blocks | `@{...}` or implicit in CASE/LOOP | Scratch-ideas; enables lazy evaluation |
| Commas vs semicolons | Spatial vs temporal | Scratch-ideas; meaningful distinction |

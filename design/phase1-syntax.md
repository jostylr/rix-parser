# RiX Phase 1 Syntax Reference

This document describes the syntax changes implemented in Phase 1 of the RiX/Calc merger.

---

## 1. Assignment: `=` and `:=`

Both `=` and `:=` are assignment operators. They have the same precedence (ASSIGNMENT = 20) and are right-associative.

```
x = 5           # assignment
x := 5          # assignment (same behavior)
x = y = 3       # chained: x = (y = 3)
```

`==` is boolean equality comparison (precedence EQUALITY = 60):

```
x == 5          # equality test, not assignment
a + b == c      # (a + b) == c
```

### Precedence summary

| Operator | Role           | Precedence | Assoc |
|----------|----------------|------------|-------|
| `=`      | Assignment     | 20         | Right |
| `:=`     | Assignment     | 20         | Right |
| `==`     | Equality       | 60         | Left  |
| `!=`     | Not-equal      | 60         | Left  |

---

## 2. Identifier Case Convention

### Uppercase = Function / System

Identifiers starting with an uppercase letter are **System identifiers**. When followed by `(...)`, they produce a **FunctionCall** AST node.

```
SIN(x)          # FunctionCall → SystemIdentifier "SIN"
F(x, y)         # FunctionCall → SystemIdentifier "F"
PI              # SystemIdentifier (constant)
```

### Lowercase = Variable / Implicit Multiplication

Identifiers starting with a lowercase letter are **User identifiers** (variables). When followed by `(...)`, they produce **ImplicitMultiplication** — meaning `f(x)` is interpreted as `f * (x)`.

```
f(x)            # ImplicitMultiplication: f * (x)
abc(2 + 3)      # ImplicitMultiplication: abc * (2 + 3)
f(x, y)         # ImplicitMultiplication: f * (x, y)  [f * Tuple]
x               # UserIdentifier
```

### Function definitions still work with lowercase

When `f(x)` appears on the left of `:->` or `:=>`, the parser recognizes it as a function definition regardless of case:

```
f(x) :-> x + 1          # FunctionDefinition, name=f, params=[x]
F(x) :-> x + 1          # FunctionDefinition, name=F, params=[x]
f(x, y; n := 2) :-> ... # FunctionDefinition with keyword params
```

### Operator-as-function syntax

Operator symbols (`+`, `*`, `<`, etc.) followed by `(...)` remain function calls:

```
+(3, 4, 7)      # FunctionCall: function="+", args=[3, 4, 7]
*(2, 3)         # FunctionCall: function="*", args=[2, 3]
<(x, y)         # FunctionCall: function="<", args=[x, y]
```

---

## 3. System Function Access: `@_`

The `@_` prefix provides direct access to system functions from user-land code. System functions are the internal operations that all syntax lowers to during evaluation.

### Syntax

```
@_NAME(args...)     # SystemCall — invoke system function NAME
@_NAME              # SystemFunctionRef — reference without calling
```

### Examples

```
@_ASSIGN("i", 0)        # Direct system function call → ASSIGN
@_ADD(a, b)              # Direct system function call → ADD
@_RETRIEVE("x")          # Direct system function call → RETRIEVE
@_CALL(f, x)             # Call user function via system
```

### Nesting

```
@_ASSIGN(i, @_ADD(i, 1))   # i = i + 1 via system functions
```

### Key properties

- `@_` prefix is **only needed in user-land code** to access system functions
- In the lowered/translated IR, all functions are system functions (no prefix needed)
- System functions are **read-only** — user code cannot modify them
- The name after `@_` is always normalized to UPPERCASE
- `@_NAME` without `(...)` produces a `SystemFunctionRef` node (first-class reference)

### AST nodes

| Syntax | AST Node | Fields |
|--------|----------|--------|
| `@_ADD(x, y)` | `SystemCall` | `name: "ADD"`, `arguments: {positional, keyword}` |
| `@_ADD` | `SystemFunctionRef` | `name: "ADD"` |

---

## 4. Brace Sigil Containers

Brace sigil containers use a character immediately after `{` to explicitly declare the container type. This replaces the old approach of inferring container type from contents.

### Sigil table

| Sigil | Container | Separator | Description |
|-------|-----------|-----------|-------------|
| `{=`  | MapContainer   | `,` (spatial)   | Key-value map |
| `{?`  | CaseContainer  | `;` (temporal)  | Pattern matching / case expressions |
| `{;`  | BlockContainer | `;` (temporal)  | Sequential statement block |
| `{\|` | SetContainer   | `,` (spatial)   | Unordered set |
| `{:`  | TupleContainer | `,` (spatial)   | Ordered tuple |
| `{@`  | LoopContainer  | `;` (temporal)  | Loop construct |

All sigil containers close with `}`.

### Temporal vs Spatial

- **Spatial** (`,`): Elements are independent, order may not matter (sets, maps, tuples)
- **Temporal** (`;`): Elements are sequential, order matters (blocks, cases, loops)

### Examples

```
{= "a", 1, "b", 2 }        # MapContainer (key-value pairs)
{? x > 0; x < 10 }          # CaseContainer (conditions)
{; a := 1; b := 2; a + b }  # BlockContainer (statements)
{| 1, 2, 3 }                # SetContainer
{: a, b, c }                # TupleContainer
{@ i := 0; i + 1 }          # LoopContainer
```

### Empty and trailing separators

```
{| }            # Empty SetContainer
{| 1, 2, 3, }  # Trailing comma allowed
{; a; b; }      # Trailing semicolon allowed
```

### Relation to existing containers

The plain `{` brace still works for the old inference-based containers (`Set`, `Map`, `System`). The `{{` `}}` code block syntax is also unchanged.

---

## 5. External Property Access: `..`

The double-dot operator accesses **external properties** (metadata/decorations) on objects, distinct from regular map keys accessed via `.`.

### Syntax

```
obj..b              # Access external property "b"
obj..               # Access all external properties (returns map)
obj..b = 9          # Assign to external property "b"
```

### Related operators

| Operator | Returns | Description |
|----------|---------|-------------|
| `obj..b` | value | External property access |
| `obj..` | map | All external properties |
| `obj.\|` | set | Set of keys |
| `obj\|.` | set | Set of values |

### AST nodes

| Syntax | AST Node | Fields |
|--------|----------|--------|
| `obj..b` | `ExternalAccess` | `object`, `property: "b"` |
| `obj..` | `ExternalAccess` | `object`, `property: null` |
| `obj.\|` | `KeySet` | `object` |
| `obj\|.` | `ValueSet` | `object` |

---

## 6. Deferred Blocks: `@{...}`

The `@` prefix before a brace container creates a **deferred block** — a computation that is not evaluated immediately but stored for later execution.

```
@{; x + 1; x * 2 }       # Deferred BlockContainer
@{? x > 0; x < 10 }      # Deferred CaseContainer
@{ a, b }                 # Deferred plain brace container
@{{ a; b }}               # Deferred CodeBlock
```

### Use in control structures

Deferred blocks are essential for CASE, LOOP, and other lazy-evaluation contexts:

```
CASE(@{; x > 0}, @{; 3*x}, @{; x+2})
LOOP(@{; i = 0}, @{; i < 10}, @{; x = x + i}, @{; i = i + 1})
```

### AST node

| Syntax | AST Node | Fields |
|--------|----------|--------|
| `@{; ...}` | `DeferredBlock` | `body` (the inner container node) |

---

## 7. Object Mutation: `obj{= ...}` and `obj{! ...}`

Mutation syntax modifies objects using operations prefixed with `+` (add/change) or `-` (remove).

### Copy mutation (`{=`)

Creates a **new object** with the specified changes:

```
obj{= +a=3, -.b, +c }
```

- `+a=3` — add or change key `a` to value `3`
- `-.b` — remove key `b`
- `+c` — merge in properties from `c`

### In-place mutation (`{!`)

Modifies the **existing object** directly:

```
obj{! +a=3, -.b }
```

### AST node

| Syntax | AST Node | Fields |
|--------|----------|--------|
| `obj{= +a=3}` | `Mutation` | `target`, `mutate: false`, `operations: [{action, key, value}]` |
| `obj{! +a=3}` | `Mutation` | `target`, `mutate: true`, `operations: [...]` |

---

## 8. Extended Number Base Prefixes

Numbers are base-10 by default. Other bases use `0` + letter prefix:

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

Capital letters (`0A`–`0Z` except reserved) are available for user-defined bases.

### Custom base syntax

```
0z[23]13FASD3       # Base 23 number
0z[7]123            # Base 7 number (same as 0s123)
```

---

## 9. REPL Command-Style Calls

Uppercase system identifiers followed by bare arguments (no parentheses) produce **CommandCall** nodes. This handles REPL commands naturally.

```
HELP algebra        # CommandCall: command=HELP, args=[algebra]
LOAD mypackage      # CommandCall: command=LOAD, args=[mypackage]
UNLOAD mypackage    # CommandCall: command=UNLOAD, args=[mypackage]
HELP "syntax"       # CommandCall with string argument
```

Bare system identifiers (no arguments) remain plain `SystemIdentifier` nodes:

```
HELP                # SystemIdentifier (no args → not a command call)
```

Function call syntax with parentheses takes priority over command calls:

```
SIN(x)              # FunctionCall (parentheses → not command call)
```

### AST node

| Syntax | AST Node | Fields |
|--------|----------|--------|
| `HELP algebra` | `CommandCall` | `command`, `arguments: [...]` |

---

## 10. AST Node Summary

### All new nodes introduced in Phase 1

| Node | Source syntax | Fields |
|------|-------------|--------|
| `ImplicitMultiplication` | `f(x)` | `left`, `right` |
| `SystemCall` | `@_NAME(...)` | `name`, `arguments` |
| `SystemFunctionRef` | `@_NAME` | `name` |
| `MapContainer` | `{= ... }` | `sigil`, `elements` |
| `CaseContainer` | `{? ... }` | `sigil`, `elements` |
| `BlockContainer` | `{; ... }` | `sigil`, `elements` |
| `SetContainer` | `{\| ... }` | `sigil`, `elements` |
| `TupleContainer` | `{: ... }` | `sigil`, `elements` |
| `LoopContainer` | `{@ ... }` | `sigil`, `elements` |
| `ExternalAccess` | `obj..b` | `object`, `property` |
| `KeySet` | `obj.\|` | `object` |
| `ValueSet` | `obj\|.` | `object` |
| `DeferredBlock` | `@{...}` | `body` |
| `Mutation` | `obj{= ...}` / `obj{! ...}` | `target`, `mutate`, `operations` |
| `CommandCall` | `HELP topic` | `command`, `arguments` |

### Modified behavior

| Node | Change |
|------|--------|
| `BinaryOperation` with `=` | Now assignment (precedence 20), not equality |
| `FunctionCall` | Only produced for uppercase identifiers and operator symbols |

---

## 11. System Function Mapping (Preview)

In Phase 2 (lowering pass), all syntax will lower to system function calls. Here is a preview of the mapping:

| Source syntax | Lowered form |
|---------------|-------------|
| `x = 5` | `ASSIGN("x", 5)` |
| `x` (in expression) | `RETRIEVE("x")` |
| `a + b` | `ADD(a, b)` |
| `a * b` | `MUL(a, b)` |
| `F(x)` | `CALL("F", x)` |
| `f(x)` | `MUL(RETRIEVE("f"), x)` |
| `@_ADD(a, b)` | `ADD(a, b)` (direct, no translation needed) |
| `obj..b` | `EXTGET(obj, "b")` |
| `obj..b = 9` | `EXTSET(obj, "b", 9)` |
| `@{; x+1}` | `DEFER({fn:"ADD", ...})` |
| `HELP topic` | `HELP("topic")` |

The `@_` prefix in user code maps 1:1 to system functions in the IR, making it possible to bypass the lowering pass for direct system access.

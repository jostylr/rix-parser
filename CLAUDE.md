# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **RiX Language Parser & Tokenizer** - a comprehensive parsing library for the RiX (Rational Interval Expression Language) mathematical expression language. The project implements a complete tokenizer and Pratt parser that converts RiX source code into Abstract Syntax Trees (ASTs).

**Key Architecture:**
- **Two-stage parsing:** Tokenizer (`src/tokenizer.js`) → Parser (`src/parser.js`)
- **Pratt parser:** Operator precedence parsing with extensive operator support (50+ operators)
- **Rich AST generation:** Supports complex mathematical expressions, intervals, functions, matrices, and symbolic calculus
- **Unicode support:** Full Unicode identifier support with system vs user distinction

## Development Commands

### Testing
```bash
bun test                    # Run all tests (314 total tests)
bun test tests/tokenizer.test.js    # Run tokenizer tests (129 tests)
bun test tests/parser.test.js       # Run parser tests (185 tests)
bun test tests/array-generators*.test.js  # Run generator-specific tests
```

### Building
```bash
bun run build:demo         # Build browser demo from docs/src/demo.js
bun run dev:demo           # Build demo with watch mode
bun run build:docs         # Generate documentation from markdown
bun run build:all          # Build both demo and docs
```

## Core Architecture

### Tokenizer (`src/tokenizer.js`)
- **Maximal munch tokenization:** Always matches longest possible token
- **Complex number formats:** Supports 11+ number formats (intervals, mixed numbers, rationals, scientific notation)
- **N-delimiter quote system:** Flexible string embedding (`""hello""`, ```code```)
- **Position tracking:** Maintains source positions for error reporting
- **Symbol precedence:** 50+ mathematical and functional operators

### Parser (`src/parser.js`)
- **Pratt parser implementation:** Precedence-driven parsing with associativity rules
- **Rich AST nodes:** 20+ node types including Assignment, FunctionDefinition, Matrix, GeneratorChain
- **Operator precedence table:** 13 precedence levels from STATEMENT (0) to PROPERTY (130)
- **Postfix operators:** Support for `@` (precision), `?` (queries), `()` (universal calls), `~[...]` (units)
- **Function definitions:** Multiple styles (`:=`, `:->`, `:=>`) with pattern matching support

### System Loader (`src/system-loader.js`)
- **Three-tier architecture:** Language Maintainers → System Tinkerers → Users
- **Configurable keywords:** Runtime keyword configuration for different environments
- **System registry:** Built-in mathematical functions (SIN, COS, TAN, LOG, etc.)
- **Browser-friendly:** No file system dependencies, all configuration in-memory

## Language Features

The parser handles these key RiX language constructs:
- **Numbers:** Intervals (`2:5`), mixed numbers (`1..3/4`), rationals (`3/4`), scientific notation
- **Units:** Scientific units (`3.2~[m]`) and mathematical units (`2~{i}`)
- **Functions:** Multiple definition styles with optional parameters and pattern matching
- **Collections:** Arrays, matrices, tensors with metadata support
- **Operators:** Mathematical, functional, pipe operators (`|>`, `|>>`), array generators (`|+`, `|*`)
- **Postfix operations:** Precision control, queries, universal calls, unit annotations
- **Symbolic calculus:** Derivatives (`f'(x)`), integrals (`'f(x)`)

## Code Conventions

- **ES modules:** Use `import`/`export` syntax
- **Function exports:** Main functions exported from `index.js`
- **Error handling:** Comprehensive error reporting with position information
- **Test coverage:** Extensive test suite covering edge cases and language specification
- **Documentation:** Rich inline documentation and separate design specifications in `design/`

## Key Files

- `src/tokenizer.js` - Complete tokenization implementation
- `src/parser.js` - Pratt parser with full language support  
- `src/system-loader.js` - System identifier resolution and configuration
- `index.js` - Main export point for `parse` and `tokenize` functions
- `design/spec.md` - Complete RiX language specification
- `docs/architecture.md` - Detailed architecture documentation
- `examples/` - 36+ example files demonstrating language features

## Testing Notes

- Uses **Bun** as the test runner and runtime
- Test files follow pattern `*.test.js` in `tests/` directory
- Tests cover both tokenizer and parser functionality comprehensively
- Each test includes position tracking validation and AST structure verification
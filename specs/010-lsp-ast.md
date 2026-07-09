# LSP and AST Enhancement Spec

Status: Partial implementation. Read-only TypeScript symbol navigation is implemented; symbol-aware edit execution and dedicated eval fixtures remain roadmap items.

## Objective

LSP/AST support improves EasyCode beyond text search by giving the agent code-structure facts and safer edit boundaries.

## Advantages Over Current Text Tools

- Definition/reference lookup can distinguish same-name symbols across files and scopes.
- Rename and signature-level changes can be constrained to semantic references instead of raw string matches.
- Plans can cite affected symbols and call paths rather than only matching files.
- Diff review can flag edits that cross symbol boundaries, public APIs, or generated-code regions.
- Tests can target changed symbols and nearby references instead of relying only on broad command suggestions.

## Scope

- Start with TypeScript/JavaScript because the project is TypeScript and can use existing compiler APIs.
- Build a symbol index for files, exported declarations, references, imports, and call-like relationships.
- Expose read-only symbol lookup before enabling symbol-aware edits.
- Keep text tools available as fallback when a language server or parser is unavailable.

## Acceptance

- Symbol lookup returns definitions and references for local TypeScript symbols.
- Same-name symbols in different scopes are not conflated.
- Symbol-aware edit proposals include affected files and references before writing.
- Unified run prompts require symbol-aware edit planning for symbol-affecting changes: target symbols, owning definitions, affected references/callers, excluded same-name matches, and edit boundaries.
- Eval fixtures compare LSP/AST lookup against `grep` for same-name collision cases.

## Current Slice

- TypeScript AST parsing collects function/method parameter and local variable bindings.
- Reference and call edges skip names shadowed by local bindings, preventing false cross-file references.
- Indented local declarations are no longer promoted to top-level TypeScript symbols.
- The index cache generator version is bumped so stale regex-only indexes are rebuilt.
- Agent prompts now treat symbol-aware edit planning as the default path for symbol-affecting work in the unified run flow instead of relying on ad hoc text-match exploration.
- `find_definition` and `find_references` accept name, qualified name, or symbol id selectors so same-name collisions can be narrowed semantically instead of falling back to raw text matches.
- TypeScript method symbols now carry owner-aware ids and qualified names such as `src/auth.AuthService.login`, which lets read-only navigation distinguish same-name methods on different receiver types in the same file.
- Call-edge resolution now uses high-confidence receiver type hints from TypeScript parameters, local declarations, `new T()` initializers, and `this.method()` so `call_graph` and `find_references` can target the owning class or interface method before falling back to raw name matching.

## Remaining Roadmap

- Keep symbol lookup read-only until edit-boundary behavior is proven with focused tests.
- Add eval fixtures that compare symbol lookup against text search on same-name collisions.
- Promote symbol-aware edits only after affected references, excluded same-name matches, and rollback boundaries are visible in the proposed plan.

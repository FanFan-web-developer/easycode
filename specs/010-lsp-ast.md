# LSP and AST Enhancement Spec

Status: Partial implementation. Read-only TypeScript symbol navigation, symbol-aware edit planning, bounded fake-provider rename execution, and rollback eval coverage are implemented; real-provider promotion remains a roadmap item.

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
- Plan-mode and read-only review toolsets expose `find_definition`, `find_references`, and `call_graph`, so real planning turns can follow the symbol-aware edit contract instead of seeing only text search plus `repo_map`.
- `find_definition` and `find_references` accept name, qualified name, or symbol id selectors so same-name collisions can be narrowed semantically instead of falling back to raw text matches.
- TypeScript method symbols now carry owner-aware ids and qualified names such as `src/auth.AuthService.login`, which lets read-only navigation distinguish same-name methods on different receiver types in the same file.
- Call-edge resolution now uses high-confidence receiver type hints from TypeScript parameters, local declarations, `new T()` initializers, and `this.method()` so `call_graph` and `find_references` can target the owning class or interface method before falling back to raw name matching.
- `EC-015` adds a deterministic fake eval fixture for same-name method collisions, requiring qualified `find_definition` and `find_references` lookups to resolve `InvoiceService.format` while excluding `ReportService.format`.
- `EC-016` exercises the symbol-aware edit proposal boundary in plan mode: it requires definition/reference lookup before `plan_exit`, keeps the fixture read-only, and verifies the final proposed plan names target symbols, owning definitions, affected references, excluded same-name matches, edit boundaries, and rollback checks.
- `EC-017` exercises a deterministic symbol-aware rename execution path: the run resolves `InvoiceService.format`, edits only the owning definition plus verified reference, leaves `ReportService.format` untouched, and performs post-edit semantic checks for old/new symbol references.
- `EC-018` exercises rollback behavior for a failed symbol-aware edit: the eval initializes a git-backed fixture, performs a partial method rename, detects failed semantic verification, restores the changed file with `git_restore_guarded`, and confirms `InvoiceService.format` is back at its original definition.
- `EC-REAL-002` extends real-provider smoke coverage beyond no-tool replies by requiring configured providers to use semantic navigation and produce a read-only symbol-aware rename plan for the same-name collision fixture.

## Remaining Roadmap

- Keep generic symbol-aware edits behind focused eval coverage until real-provider behavior is proven.
- Expand real-provider coverage from read-only semantic planning to bounded execution behavior before promoting generic symbol-aware edits.
- Promote generic symbol-aware edit execution only after rollback behavior and post-edit verification are covered outside the deterministic fake-provider path.

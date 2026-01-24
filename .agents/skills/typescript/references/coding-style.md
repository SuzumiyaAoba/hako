## Coding Style

- Prioritize type safety.
  - DO NOT use `any`. Use `unknown` instead.
  - Add explicit type annotations to function parameters and return types.
  - Avoid type assertions (`as`) whenever possible.
  - Prefer discriminated unions for modeling state and results.
  - Use branded types to prevent accidental mixing of identifiers and primitive values.
  - DO NOT rely on type assertions for parsing. Validate and parse external input with Zod.
- Prefer `const`; use `let` only when necessary.
- Write TSDoc comments for exported APIs.

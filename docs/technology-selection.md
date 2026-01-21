# Technology Selection

## Goal
Build a system that reads Markdown documents and renders Obsidian-style links (wiki links like `[[Note]]`) with graph-aware navigation.

## Assumptions
- Initial scope is a web UI for local Markdown documents (single-user, local workspace).
- Files are stored on disk; the system indexes and renders them.
- Wiki links need resolution, backlinks, and a graph view.
- The document dependency graph should be persisted and only updated when an explicit update process runs.

## Requirements
- Markdown parsing with extensibility for wiki link syntax.
- Fast indexing of note graph (links, backlinks, tags).
- Rendering to HTML with custom link components.
- Graph visualization for note connections.
- Search over titles and content.

## Candidates and Notes

### Markdown parsing
- `markdown-it` + plugins
  - Pros: fast, simple plugin API, good for custom syntax like `[[...]]`.
  - Cons: less rich AST tooling compared with unified.
- `remark`/`unified` (remark-parse + rehype)
  - Pros: rich AST, strong ecosystem (transformers, MDX, linting).
  - Cons: heavier setup, more complexity.

### Wiki link handling
- `markdown-it` plugin or custom tokenizer
  - Pros: straightforward, can emit custom tokens.
  - Cons: token-level, less semantic structure.
- `remark` plugin (mdast transform)
  - Pros: semantic AST nodes, easier to attach metadata.
  - Cons: learning curve.

### Rendering
- Server-side rendering (Next.js)
  - Pros: routing and data loading conventions.
  - Cons: heavier if local-only.

### Graph visualization
- `D3.js` force layout
  - Pros: flexible, custom visuals.
  - Cons: more manual layout/interaction work.

### Indexing and search
- In-memory index + `flexsearch`
  - Pros: fast, small, client-side.
  - Cons: memory use grows with corpus.
- `lunr`
  - Pros: simple, mature.
  - Cons: slower for large datasets.

### Persistence for dependency graph
- SQLite (local file)
  - Pros: simple, durable, easy to query and update on demand.
  - Cons: needs a small data access layer.
- JSON cache file
  - Pros: minimal setup, easy to inspect.
  - Cons: larger reload costs, harder to query incrementally.

## Selected Stack (Initial)
- Frontend: `Next.js + React + TypeScript` for routing and data loading conventions.
- Markdown pipeline: `unified` (`remark-parse` -> custom wiki-link plugin -> `remark-rehype` -> `rehype-react`).
- Wiki link resolution: custom remark plugin that maps `[[Title]]` to node IDs and emits structured metadata.
- Graph view: `D3.js` force layout for flexible, custom visualization.
- Search: `flexsearch` with an in-memory index generated from the parsed AST.
- Storage: persisted dependency graph in SQLite, updated only by an explicit update process.

## Rationale
- Unified provides the richest AST for link resolution, backlinks, and metadata extraction.
- Next.js provides routing and data loading conventions for a local web UI.
- D3.js enables precise, custom graph visuals suitable for Obsidian-like UX.
- Flexsearch offers fast client-side search with low setup.
- SQLite keeps the dependency graph durable until an explicit update is run.

## Risks and Mitigations
- AST pipeline complexity: start with minimal plugin surface and add transforms gradually.
- Graph performance with large vaults: add clustering or progressive rendering later.
- File system access in browser: start with local server or desktop shell (e.g., Tauri/Electron) if needed.
- Persistence model: ensure update process is explicit and versioned to avoid stale graphs.

## Next Steps
- Define the wiki-link node schema in the AST.
- Prototype parsing and rendering with a small sample vault.
- Build a minimal indexer for backlinks and graph edges.

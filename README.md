# pi-codegraph

[CodeGraph](https://github.com/colbymchenry/codegraph) tools for the
[pi coding agent](https://github.com/earendil-works/pi-coding-agent) —
surgical code intelligence instead of file-by-file crawling.

CodeGraph builds a local knowledge graph (Rust kernel, SQLite, no
external services) of every symbol, call edge and dependency in a
repo. This extension exposes it as first-class pi tools, so the agent
asks one question and gets the relevant code — instead of spending a
dozen grep/read round-trips rediscovering structure.

## Tools

| Tool | Purpose |
|---|---|
| `codegraph_status` | Index stats/freshness for the project |
| `codegraph_init` | Build the index (whole repo, seconds) |
| `codegraph_sync` | Incremental refresh after changes |
| `codegraph_query` | Find symbols by name — faster than grep |
| `codegraph_context` | Relevant symbols + code for a task description |
| `codegraph_explore` | Call paths around an area |
| `codegraph_node` | One symbol's source + caller/callee trail |
| `codegraph_files` | Project file structure from the index |

## Install

```bash
# 1) the CodeGraph CLI itself (self-contained, no node needed)
npm i -g @colbymchenry/codegraph

# 2) this extension
pi install git:github.com/mohammadraufzahed/pi-codegraph
```

Then in any project: `codegraph_init` once — afterwards the agent
prefers `codegraph_context`/`explore`/`node` over crawling.

## Compatibility

This package is tested with pi coding agent `>=0.87.0 <0.88.0` and
`typebox` `^1.3.0`. npm will warn when it is installed with pi or
TypeBox versions outside those peer dependency ranges.

## Development

```bash
npm ci
npm run check
```

`npm run check` runs TypeScript typechecking and a smoke verification
that imports the extension and confirms all CodeGraph tools register
against a stub pi extension API.

## Example

```
> Where does order sync talk to Rahkaran?

agent → codegraph_context "order sync with Rahkaran"
      → relevant symbols, call paths and code blocks in one call
```

## License

MIT

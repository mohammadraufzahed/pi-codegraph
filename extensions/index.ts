/**
 * pi-codegraph — CodeGraph tools for the pi coding agent.
 *
 * Gives the agent surgical code intelligence instead of file-by-file
 * crawling — a pre-built knowledge graph of every symbol, call edge,
 * and dependency (Rust kernel, 100% local, SQLite):
 *
 *   codegraph_status   — is this project indexed? stats/freshness
 *   codegraph_init     — index the project (first run ~seconds)
 *   codegraph_sync     — refresh the index after changes
 *   codegraph_query    — find symbols by name, fast
 *   codegraph_context  — relevant symbols + code for a task description
 *   codegraph_explore  — call paths around an area of the codebase
 *   codegraph_node     — one symbol's source + caller/callee trail
 *   codegraph_files    — project file structure from the index
 *
 * Requires the codegraph CLI on PATH (npm i -g @colbymchenry/codegraph).
 *
 * Load: pi --extension /path/to/pi-codegraph/extensions/index.ts
 * or drop in .pi/extensions/ (project) or ~/.pi/agent/extensions/.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";

const MAX_OUT = 12000;

interface RunResult {
	code: number;
	out: string;
	err: string;
	timedOut: boolean;
}

function run(
	args: string[],
	cwd: string,
	timeout = 120_000,
): Promise<RunResult> {
	return new Promise((resolve) => {
		execFile(
			"codegraph",
			args,
			{ cwd, timeout, maxBuffer: 32 * 1024 * 1024 },
			(err, stdout, stderr) => {
				resolve({
					code:
						err && typeof (err as { code?: number }).code === "number"
							? ((err as { code?: number }).code ?? 1)
							: err
								? 1
								: 0,
					out: String(stdout ?? ""),
					err: String(stderr ?? ""),
					timedOut: Boolean((err as { killed?: boolean } | null)?.killed),
				});
			},
		);
	});
}

function text(r: RunResult): string {
	const body = (r.out + (r.err ? "\n--- stderr ---\n" + r.err : "")).trim();
	const trunc =
		body.length > MAX_OUT
			? body.slice(0, MAX_OUT) + `\n\n[truncated — ${body.length} chars total]`
			: body;
	return `exit ${r.code}${r.timedOut ? " (timeout)" : ""}\n${trunc || "(no output)"}`;
}

export default function piCodegraph(pi: ExtensionAPI) {
	const noIndex = {
		content: [
			{
				type: "text" as const,
				text: "No CodeGraph index in this project (.codegraph/ missing). Run codegraph_init first.",
			},
		],
		details: { indexed: false },
	};
	const noCli = {
		content: [
			{
				type: "text" as const,
				text: "codegraph CLI not on PATH — install: npm i -g @colbymchenry/codegraph",
			},
		],
		details: { error: "no-cli" },
	};
	const hasIndex = (cwd: string) => existsSync(join(cwd, ".codegraph"));
	const ok = async (cwd: string) =>
		run(["version"], cwd, 10_000).then((r) => r.code === 0);

	pi.registerTool({
		name: "codegraph_status",
		label: "CodeGraph Status",
		description:
			"Show CodeGraph index status for the project: file/node/edge counts, freshness, db size.",
		promptSnippet: "Check CodeGraph index status",
		parameters: Type.Object({}),
		async execute(_id, _params, _signal, _onUpdate, ctx) {
			if (!(await ok(ctx.cwd))) return noCli;
			if (!hasIndex(ctx.cwd)) return noIndex;
			const r = await run(["status"], ctx.cwd);
			return { content: [{ type: "text", text: text(r) }] };
		},
	});

	pi.registerTool({
		name: "codegraph_init",
		label: "CodeGraph Init",
		description:
			"Build the CodeGraph index for the current project (first run parses the whole repo — seconds to minutes).",
		promptSnippet: "Index this project with CodeGraph",
		parameters: Type.Object({}),
		async execute(_id, _params, _signal, _onUpdate, ctx) {
			if (!(await ok(ctx.cwd))) return noCli;
			const r = await run(["init"], ctx.cwd, 600_000);
			return { content: [{ type: "text", text: text(r) }] };
		},
	});

	pi.registerTool({
		name: "codegraph_sync",
		label: "CodeGraph Sync",
		description:
			"Incrementally refresh the CodeGraph index after file changes.",
		parameters: Type.Object({}),
		async execute(_id, _params, _signal, _onUpdate, ctx) {
			if (!(await ok(ctx.cwd))) return noCli;
			if (!hasIndex(ctx.cwd)) return noIndex;
			const r = await run(["sync"], ctx.cwd);
			return { content: [{ type: "text", text: text(r) }] };
		},
	});

	pi.registerTool({
		name: "codegraph_query",
		label: "CodeGraph Query",
		description:
			"Search for symbols (functions, classes, methods) by name across the whole codebase. Fast — prefer over grep for 'where is X defined'.",
		promptSnippet: "Find a symbol by name in the codebase",
		promptGuidelines: [
			"Prefer codegraph_query over grep when looking for where a symbol is defined or used.",
		],
		parameters: Type.Object({
			search: Type.String({ description: "Symbol name to search" }),
		}),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			if (!(await ok(ctx.cwd))) return noCli;
			if (!hasIndex(ctx.cwd)) return noIndex;
			const r = await run(["query", params.search], ctx.cwd);
			return { content: [{ type: "text", text: text(r) }] };
		},
	});

	pi.registerTool({
		name: "codegraph_context",
		label: "CodeGraph Context",
		description:
			"Build context for a task in ONE call: relevant symbols, relationships, and code blocks. The single most efficient way to understand an area before editing.",
		promptSnippet: "Get relevant code context for a task",
		promptGuidelines: [
			"Call codegraph_context with a description of the task BEFORE exploring files — it returns the relevant code in one shot.",
		],
		parameters: Type.Object({
			task: Type.String({ description: "What you're trying to do/find" }),
			maxNodes: Type.Optional(Type.Number()),
			noCode: Type.Optional(Type.Boolean()),
		}),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			if (!(await ok(ctx.cwd))) return noCli;
			if (!hasIndex(ctx.cwd)) return noIndex;
			const args = ["context", params.task];
			if (params.maxNodes) args.push("--max-nodes", String(params.maxNodes));
			if (params.noCode) args.push("--no-code");
			const r = await run(args, ctx.cwd);
			return { content: [{ type: "text", text: text(r) }] };
		},
	});

	pi.registerTool({
		name: "codegraph_explore",
		label: "CodeGraph Explore",
		description:
			"Explore an area: relevant symbols' source + call paths in one shot.",
		parameters: Type.Object({
			query: Type.String({ description: "Area/topic/symbol to explore" }),
		}),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			if (!(await ok(ctx.cwd))) return noCli;
			if (!hasIndex(ctx.cwd)) return noIndex;
			const r = await run(["explore", params.query], ctx.cwd);
			return { content: [{ type: "text", text: text(r) }] };
		},
	});

	pi.registerTool({
		name: "codegraph_node",
		label: "CodeGraph Node",
		description:
			"One symbol's full source + caller/callee trail — or read a file with dependents. Use for 'who calls this' / 'what does X do' before changing it.",
		parameters: Type.Object({
			name: Type.String({ description: "Symbol name or file path" }),
		}),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			if (!(await ok(ctx.cwd))) return noCli;
			if (!hasIndex(ctx.cwd)) return noIndex;
			const r = await run(["node", params.name], ctx.cwd);
			return { content: [{ type: "text", text: text(r) }] };
		},
	});

	pi.registerTool({
		name: "codegraph_files",
		label: "CodeGraph Files",
		description: "Show the project's file structure from the index.",
		parameters: Type.Object({}),
		async execute(_id, _params, _signal, _onUpdate, ctx) {
			if (!(await ok(ctx.cwd))) return noCli;
			if (!hasIndex(ctx.cwd)) return noIndex;
			const r = await run(["files"], ctx.cwd);
			return { content: [{ type: "text", text: text(r) }] };
		},
	});
}

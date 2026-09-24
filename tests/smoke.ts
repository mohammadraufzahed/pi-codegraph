import piCodegraph from "../extensions/index.ts";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";

const tools: ToolDefinition[] = [];

const api = {
	registerTool(tool: ToolDefinition) {
		tools.push(tool);
	},
} as ExtensionAPI;

piCodegraph(api);

const expectedTools = [
	"codegraph_status",
	"codegraph_init",
	"codegraph_sync",
	"codegraph_query",
	"codegraph_context",
	"codegraph_explore",
	"codegraph_node",
	"codegraph_files",
];

const registeredNames = tools.map((tool) => tool.name);

if (registeredNames.length !== expectedTools.length) {
	throw new Error(`Expected ${expectedTools.length} tools, got ${registeredNames.length}`);
}

for (const expectedTool of expectedTools) {
	if (!registeredNames.includes(expectedTool)) {
		throw new Error(`Missing registered tool: ${expectedTool}`);
	}
}

for (const tool of tools) {
	if (!tool.description || !tool.parameters || typeof tool.execute !== "function") {
		throw new Error(`Tool ${tool.name} is missing required metadata`);
	}
}

console.log(`Registered ${tools.length} CodeGraph tools.`);

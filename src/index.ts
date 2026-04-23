import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const TARGET_FILE_NAME = "claude.local.md";
const MAX_CONTEXT_BYTES = 50 * 1024;
const EMPTY_FILE_MESSAGE = "claude.local.md empty; skipping";
const LARGE_FILE_MESSAGE = `claude.local.md exceeds ${MAX_CONTEXT_BYTES} bytes; skipping`;
const LOADED_FILE_MESSAGE = "Loaded claude.local.md";

type LoadedLocalContext = {
	fileName: string;
	absolutePath: string;
	content: string;
};

type LoadResult =
	| { kind: "missing" }
	| { kind: "empty" }
	| { kind: "too_large" }
	| { kind: "loaded"; context: LoadedLocalContext };

export default function localClaudeLoader(pi: ExtensionAPI) {
	let loadedContext: LoadedLocalContext | undefined;

	pi.on("session_start", async (_event, ctx) => {
		const result = await loadLocalClaudeContext(ctx.cwd);

		if (result.kind === "loaded") {
			loadedContext = result.context;
			console.log(LOADED_FILE_MESSAGE);
			return;
		}

		loadedContext = undefined;

		if (result.kind === "empty") {
			console.log(EMPTY_FILE_MESSAGE);
		}

		if (result.kind === "too_large") {
			console.log(LARGE_FILE_MESSAGE);
		}
	});

	pi.on("before_agent_start", async (event) => {
		if (!loadedContext) {
			return;
		}

		return {
			systemPrompt: appendLocalContextToSystemPrompt(event.systemPrompt, loadedContext),
		};
	});
}

export async function loadLocalClaudeContext(cwd: string): Promise<LoadResult> {
	const matchedFileName = await findCaseInsensitiveClaudeLocalFile(cwd);
	if (!matchedFileName) {
		return { kind: "missing" };
	}

	const absolutePath = path.join(cwd, matchedFileName);
	const fileStats = await stat(absolutePath);
	if (fileStats.size > MAX_CONTEXT_BYTES) {
		return { kind: "too_large" };
	}

	const content = await readFile(absolutePath, "utf8");
	if (content.trim().length === 0) {
		return { kind: "empty" };
	}

	return {
		kind: "loaded",
		context: {
			fileName: matchedFileName,
			absolutePath,
			content,
		},
	};
}

export async function findCaseInsensitiveClaudeLocalFile(cwd: string): Promise<string | undefined> {
	const entries = await readdir(cwd, { withFileTypes: true });
	return entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === TARGET_FILE_NAME)?.name;
}

export function appendLocalContextToSystemPrompt(systemPrompt: string, localContext: LoadedLocalContext): string {
	return `${systemPrompt}\n\n## Additional Local Context\n\nThe following content comes from \`${localContext.fileName}\` in the current working directory. Treat it as highest-priority local context. It supplements existing AGENTS.md / CLAUDE.md context and must not replace it.\n\nPath: ${localContext.absolutePath}\n\n\`\`\`md\n${localContext.content}\n\`\`\``;
}

export const testExports = {
	TARGET_FILE_NAME,
	MAX_CONTEXT_BYTES,
	EMPTY_FILE_MESSAGE,
	LARGE_FILE_MESSAGE,
	LOADED_FILE_MESSAGE,
};

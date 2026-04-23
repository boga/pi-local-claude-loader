import { readdir, readFile, stat } from "node:fs/promises";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { DEFAULT_CONFIG, loadConfig, type LocalClaudeLoaderConfig } from "#src/config.ts";
import { LOADED_FILE_MESSAGE } from "#src/config_constants.ts";

type LoadedLocalContext = {
	fileName: string;
	absolutePath: string;
	content: string;
};

type MatchedLocalContextFile = {
	configuredName: string;
	matchedFileName: string;
	absolutePath: string;
};

type LoadResult =
	| { kind: "missing" }
	| { kind: "empty"; fileName: string }
	| { kind: "too_large"; fileName: string }
	| { kind: "loaded"; context: LoadedLocalContext };

export default function localClaudeLoader(pi: ExtensionAPI) {
	let loadedContext: LoadedLocalContext | undefined;

	pi.on("session_start", async (_event, ctx) => {
		const config = loadConfig(ctx.cwd);
		const result = await loadLocalClaudeContext(ctx.cwd, config);

		if (result.kind === "loaded") {
			loadedContext = result.context;
			console.log(`${LOADED_FILE_MESSAGE}: ${result.context.fileName}`);
			return;
		}

		loadedContext = undefined;

		if (result.kind === "empty") {
			console.log(`${result.fileName} empty; skipping`);
		}

		if (result.kind === "too_large") {
			console.log(`${result.fileName} exceeds ${config.maxBytes} bytes; skipping`);
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

export async function loadLocalClaudeContext(
	cwd: string,
	config: LocalClaudeLoaderConfig = DEFAULT_CONFIG,
): Promise<LoadResult> {
	const matchedFile = await findCaseInsensitiveLocalContextFile(cwd, config.fileNames);
	if (!matchedFile) {
		return { kind: "missing" };
	}

	const fileStats = await stat(matchedFile.absolutePath);
	if (fileStats.size > config.maxBytes) {
		return { kind: "too_large", fileName: matchedFile.matchedFileName };
	}

	const content = await readFile(matchedFile.absolutePath, "utf8");
	if (content.trim().length === 0) {
		return { kind: "empty", fileName: matchedFile.matchedFileName };
	}

	return {
		kind: "loaded",
		context: {
			fileName: matchedFile.matchedFileName,
			absolutePath: matchedFile.absolutePath,
			content,
		},
	};
}

export async function findCaseInsensitiveLocalContextFile(
	cwd: string,
	fileNames: string[] = DEFAULT_CONFIG.fileNames,
): Promise<MatchedLocalContextFile | undefined> {
	const entries = await readdir(cwd, { withFileTypes: true });

	for (const configuredName of fileNames) {
		const matchedEntry = entries.find(
			(entry) => entry.isFile() && entry.name.toLowerCase() === configuredName.toLowerCase(),
		);
		if (matchedEntry) {
			return {
				configuredName,
				matchedFileName: matchedEntry.name,
				absolutePath: path.join(cwd, matchedEntry.name),
			};
		}
	}
}

export function appendLocalContextToSystemPrompt(systemPrompt: string, localContext: LoadedLocalContext): string {
	return `${systemPrompt}\n\n## Additional Local Context\n\nThe following content comes from \`${localContext.fileName}\` in the current working directory. Treat it as highest-priority local context. It supplements existing AGENTS.md / CLAUDE.md context and must not replace it.\n\nPath: ${localContext.absolutePath}\n\n\`\`\`md\n${localContext.content}\n\`\`\``;
}


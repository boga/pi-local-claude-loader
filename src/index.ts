import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import * as path from "node:path";
import { getAgentDir, type ExtensionAPI } from "@mariozechner/pi-coding-agent";

const DEFAULT_FILE_NAMES = ["claude.local.md", "agents.local.md"];
const DEFAULT_MAX_CONTEXT_BYTES = 50 * 1024;
const EMPTY_FILE_MESSAGE = "Local context file empty; skipping";
const LOADED_FILE_MESSAGE = "Loaded local context file";

export type LocalClaudeLoaderConfig = {
	fileNames: string[];
	maxBytes: number;
};

const DEFAULT_CONFIG: LocalClaudeLoaderConfig = {
	fileNames: DEFAULT_FILE_NAMES,
	maxBytes: DEFAULT_MAX_CONTEXT_BYTES,
};

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

export function loadConfig(cwd: string): LocalClaudeLoaderConfig {
	const globalConfigPath = path.join(getAgentDir(), "extensions", "claude-local.json");
	const projectConfigPath = path.join(cwd, ".pi", "extensions", "claude-local.json");

	return {
		...DEFAULT_CONFIG,
		...readConfigFile(globalConfigPath),
		...readConfigFile(projectConfigPath),
	};
}

function readConfigFile(configPath: string): Partial<LocalClaudeLoaderConfig> {
	if (!existsSync(configPath)) {
		return {};
	}

	try {
		const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Partial<LocalClaudeLoaderConfig>;
		return normalizeConfig(parsed);
	} catch (error) {
		console.error(`Warning: Could not parse ${configPath}: ${error}`);
		return {};
	}
}

function normalizeConfig(config: Partial<LocalClaudeLoaderConfig>): Partial<LocalClaudeLoaderConfig> {
	const normalized: Partial<LocalClaudeLoaderConfig> = {};

	if (Array.isArray(config.fileNames)) {
		normalized.fileNames = config.fileNames.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
	}

	if (typeof config.maxBytes === "number" && Number.isFinite(config.maxBytes) && config.maxBytes >= 0) {
		normalized.maxBytes = config.maxBytes;
	}

	return normalized;
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

export const testExports = {
	DEFAULT_FILE_NAMES,
	DEFAULT_MAX_CONTEXT_BYTES,
	DEFAULT_CONFIG,
	EMPTY_FILE_MESSAGE,
	LOADED_FILE_MESSAGE,
};

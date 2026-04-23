import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import {
	DEFAULT_FILE_NAMES,
	DEFAULT_LOG_LEVEL,
	DEFAULT_MAX_CONTEXT_BYTES,
} from "#src/config_constants.ts";

export type LocalClaudeLoaderLogLevel = "error" | "info";

export type LocalClaudeLoaderConfig = {
	fileNames: string[];
	maxBytes: number;
	logLevel: LocalClaudeLoaderLogLevel;
};

export const DEFAULT_CONFIG: LocalClaudeLoaderConfig = {
	fileNames: DEFAULT_FILE_NAMES,
	maxBytes: DEFAULT_MAX_CONTEXT_BYTES,
	logLevel: DEFAULT_LOG_LEVEL,
};

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
		normalized.fileNames = config.fileNames.filter(
			(value): value is string => typeof value === "string" && value.trim().length > 0,
		);
	}

	if (typeof config.maxBytes === "number" && Number.isFinite(config.maxBytes) && config.maxBytes >= 0) {
		normalized.maxBytes = config.maxBytes;
	}

	if (config.logLevel === "error" || config.logLevel === "info") {
		normalized.logLevel = config.logLevel;
	}

	return normalized;
}


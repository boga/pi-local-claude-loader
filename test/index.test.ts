import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import {
	appendLocalContextToSystemPrompt,
	findCaseInsensitiveLocalContextFile,
	loadLocalClaudeContext,
} from "../src/index.ts";
import { DEFAULT_FILE_NAMES, DEFAULT_MAX_CONTEXT_BYTES } from "../src/config_constants.ts";

test("loads case-insensitive claude.local.md from cwd", async () => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-local-claude-loader-"));
	await writeFile(path.join(cwd, "ClaUdE.LoCaL.mD"), "follow the local rules");

	const result = await loadLocalClaudeContext(cwd);

	assert.equal(result.kind, "loaded");
	if (result.kind !== "loaded") return;
	assert.equal(result.context.fileName, "ClaUdE.LoCaL.mD");
	assert.match(result.context.content, /local rules/);
});

test("returns missing when no configured local context file exists", async () => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-local-claude-loader-"));

	const result = await loadLocalClaudeContext(cwd);

	assert.deepEqual(result, { kind: "missing" });
});

test("checks only the current working directory", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "pi-local-claude-loader-"));
	const cwd = path.join(root, "cwd");
	const nested = path.join(cwd, "nested");
	await mkdir(nested, { recursive: true });
	await writeFile(path.join(nested, DEFAULT_FILE_NAMES[0]), "nested only");

	const match = await findCaseInsensitiveLocalContextFile(cwd);

	assert.equal(match, undefined);
});

test("prefers the first configured file name when multiple matches exist", async () => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-local-claude-loader-"));
	await writeFile(path.join(cwd, "agents.local.md"), "agents rules");
	await writeFile(path.join(cwd, "claude.local.md"), "claude rules");

	const match = await findCaseInsensitiveLocalContextFile(cwd, ["claude.local.md", "agents.local.md"]);

	assert.deepEqual(match && { configuredName: match.configuredName, matchedFileName: match.matchedFileName }, {
		configuredName: "claude.local.md",
		matchedFileName: "claude.local.md",
	});
});

test("loads agents.local.md when claude.local.md is absent", async () => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-local-claude-loader-"));
	await writeFile(path.join(cwd, "AgEnTs.LoCaL.mD"), "agent-local rules");

	const result = await loadLocalClaudeContext(cwd);

	assert.equal(result.kind, "loaded");
	if (result.kind !== "loaded") return;
	assert.equal(result.context.fileName, "AgEnTs.LoCaL.mD");
	assert.match(result.context.content, /agent-local rules/);
});

test("returns empty for blank files", async () => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-local-claude-loader-"));
	await writeFile(path.join(cwd, DEFAULT_FILE_NAMES[0]), "   \n\t");

	const result = await loadLocalClaudeContext(cwd);

	assert.deepEqual(result, { kind: "empty", fileName: DEFAULT_FILE_NAMES[0] });
});

test("returns too_large for oversized files", async () => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-local-claude-loader-"));
	await writeFile(path.join(cwd, DEFAULT_FILE_NAMES[0]), "x".repeat(DEFAULT_MAX_CONTEXT_BYTES + 1));

	const result = await loadLocalClaudeContext(cwd);

	assert.deepEqual(result, { kind: "too_large", fileName: DEFAULT_FILE_NAMES[0] });
});

test("respects configurable maxBytes", async () => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-local-claude-loader-"));
	await writeFile(path.join(cwd, "agents.local.md"), "12345");

	const result = await loadLocalClaudeContext(cwd, {
		fileNames: ["agents.local.md"],
		maxBytes: 4,
	});

	assert.deepEqual(result, { kind: "too_large", fileName: "agents.local.md" });
});

test("appends local context without replacing existing prompt content", () => {
	const systemPrompt = "Existing AGENTS.md and CLAUDE.md instructions";
	const rendered = appendLocalContextToSystemPrompt(systemPrompt, {
		fileName: "claude.local.md",
		absolutePath: "/tmp/project/claude.local.md",
		content: "Local override guidance",
	});

	assert.match(rendered, /Existing AGENTS\.md and CLAUDE\.md instructions/);
	assert.match(rendered, /Treat it as highest-priority local context/);
	assert.match(rendered, /Local override guidance/);
});

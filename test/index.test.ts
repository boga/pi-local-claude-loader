import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
	appendLocalContextToSystemPrompt,
	findCaseInsensitiveClaudeLocalFile,
	loadLocalClaudeContext,
	testExports,
} from "../src/index.ts";

test("loads case-insensitive claude.local.md from cwd", async () => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-local-claude-loader-"));
	await writeFile(path.join(cwd, "ClaUdE.LoCaL.mD"), "follow the local rules");

	const result = await loadLocalClaudeContext(cwd);

	assert.equal(result.kind, "loaded");
	if (result.kind !== "loaded") return;
	assert.equal(result.context.fileName, "ClaUdE.LoCaL.mD");
	assert.match(result.context.content, /local rules/);
});

test("returns missing when claude.local.md does not exist", async () => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-local-claude-loader-"));

	const result = await loadLocalClaudeContext(cwd);

	assert.deepEqual(result, { kind: "missing" });
});

test("checks only the current working directory", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "pi-local-claude-loader-"));
	const cwd = path.join(root, "cwd");
	const nested = path.join(cwd, "nested");
	await mkdir(nested, { recursive: true });
	await writeFile(path.join(nested, testExports.TARGET_FILE_NAME), "nested only");

	const fileName = await findCaseInsensitiveClaudeLocalFile(cwd);

	assert.equal(fileName, undefined);
});

test("returns empty for blank files", async () => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-local-claude-loader-"));
	await writeFile(path.join(cwd, testExports.TARGET_FILE_NAME), "   \n\t");

	const result = await loadLocalClaudeContext(cwd);

	assert.deepEqual(result, { kind: "empty" });
});

test("returns too_large for oversized files", async () => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "pi-local-claude-loader-"));
	await writeFile(path.join(cwd, testExports.TARGET_FILE_NAME), "x".repeat(testExports.MAX_CONTEXT_BYTES + 1));

	const result = await loadLocalClaudeContext(cwd);

	assert.deepEqual(result, { kind: "too_large" });
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

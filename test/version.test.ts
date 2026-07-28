import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { freshness, listVersions, validateVersion } from "../cli/lib/version.js";

const lab = path.resolve(".");
const ncom = "ncom";
const oldId = "ncom-0eddf72";
const currentId = "ncom-a350b57";
const diffId = `${oldId}--${currentId}`;
const impactId = `impact-${diffId}`;

test("version schemas exist", async () => { for (const file of ["framework-version.schema.json", "framework-version-diff.schema.json", "evidence-impact.schema.json", "claim-impact.schema.json", "knowledge-impact.schema.json", "knowledge-freshness.schema.json", "refresh-plan.schema.json", "refresh-topic.schema.json", "refresh-bundle.schema.json", "knowledge-revision.schema.json"]) await access(path.join(lab, "schemas", file)); });
test("historical version validates", async () => assert.equal((await validateVersion(lab, ncom, oldId)).sourceCommit, "0eddf72d37579c3670770c0f73d22ffc769d3a12"));
test("current version validates", async () => assert.equal((await validateVersion(lab, ncom, currentId)).sourceCommit, "a350b576bbeae6c6254273037a17d2a8730fb80f"));
test("versions retain snapshot binding", async () => assert.match((await validateVersion(lab, ncom, currentId)).catalogRootHash, /^sha256:/));
test("version listing is deterministic", async () => assert.deepEqual((await listVersions(lab, ncom)).map((row) => row.versionId), (await listVersions(lab, ncom)).map((row) => row.versionId)));
test("version diff exists", async () => await access(path.join(lab, "frameworks", ncom, "versions", "diffs", diffId, "version-diff.json")));
test("version diff reuses catalog result", async () => assert.ok((await readFile(path.join(lab, "frameworks", ncom, "versions", "diffs", diffId, "catalog-diff.json"), "utf8")).includes("schemaVersion")));
test("version diff reuses symbol result", async () => assert.ok((await readFile(path.join(lab, "frameworks", ncom, "versions", "diffs", diffId, "symbol-diff.json"), "utf8")).includes("schemaVersion")));
test("impact has six published units", async () => assert.equal(JSON.parse(await readFile(path.join(lab, "frameworks", ncom, "learning", "impacts", impactId, "units.json"), "utf8")).units.length, 6));
test("real impact reports zero forced stale units", async () => assert.equal(JSON.parse(await readFile(path.join(lab, "frameworks", ncom, "learning", "impacts", impactId, "impact.json"), "utf8")).summary.affected, 0));
test("freshness target binding", async () => assert.equal((await freshness(lab, ncom, currentId)).targetVersionId, currentId));
test("freshness rows current", async () => assert.ok((await freshness(lab, ncom, currentId)).rows.every((row) => row.freshnessStatus === "current")));
test("refresh plan is bounded to impacts", async () => assert.equal(JSON.parse(await readFile(path.join(lab, "frameworks", ncom, "learning", "refresh", `refresh-${impactId}`, "plan.json"), "utf8")).topics.length, 0));

import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Exercise the real command/report contract without credentials or external calls.
test('blocked guardian exits unsuccessfully while preserving report and Actions outputs', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'guardian-failure-'));
  try {
    await cp(new URL('../scripts/', import.meta.url), join(fixture, 'scripts'), { recursive: true });
    await cp(new URL('../.content-guardian.json', import.meta.url), join(fixture, '.content-guardian.json'));
    await mkdir(join(fixture, 'content'));
    for (const name of ['sources.json', 'state.json']) {
      await cp(new URL(`../content/${name}`, import.meta.url), join(fixture, 'content', name));
    }
    const output = join(fixture, 'outputs');
    const env = { ...process.env, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_OUTPUT: output };
    delete env.MODEL_API_KEY;
    delete env.MODEL_BASE_URL;
    const result = spawnSync(process.execPath, [join(fixture, 'scripts/run-content-guardian.mjs')], { env, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /::error::Content guardian BLOCKED_CONFIG: MODEL_CREDENTIAL_MISSING/);
    const report = JSON.parse(await readFile(join(fixture, '.automation/report.json'), 'utf8'));
    assert.equal(report.status, 'BLOCKED_CONFIG');
    assert.equal(report.newItems, 0);
    assert.equal(report.blockerCode, 'MODEL_CREDENTIAL_MISSING');
    assert.match(await readFile(output, 'utf8'), /status=BLOCKED_CONFIG/);
    assert.match(await readFile(output, 'utf8'), /blocker_code=MODEL_CREDENTIAL_MISSING/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

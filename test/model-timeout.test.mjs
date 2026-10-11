import test from 'node:test';
import assert from 'node:assert/strict';
import { modelTimeout } from '../scripts/model-timeout.mjs';

function timers() {
  let time = 0, scheduled = null;
  return {
    now: () => time,
    schedule: (fn, delay) => { scheduled = { fn, at: time + delay }; return scheduled; },
    cancel: token => { if (token === scheduled) scheduled = null; },
    advance: ms => { time += ms; if (scheduled && time >= scheduled.at) { const fn = scheduled.fn; scheduled = null; fn(); } },
  };
}

test('idle streams abort and active streams can extend only as far as the shared deadline', () => {
  const clock = timers();
  const timeout = modelTimeout({ ...clock, deadline: 180_000, idleMs: 100_000 });
  clock.advance(90_000);
  timeout.refresh();
  clock.advance(80_000);
  assert.equal(timeout.signal.aborted, false);
  timeout.refresh();
  clock.advance(10_000);
  assert.equal(timeout.signal.aborted, true);
  assert.equal(timeout.signal.reason.name, 'TimeoutError');
});

test('no response data aborts at the idle deadline and disposal cancels it', () => {
  for (const dispose of [false, true]) {
    const clock = timers();
    const timeout = modelTimeout({ ...clock, deadline: 600_000, idleMs: 100_000 });
    if (dispose) timeout.dispose();
    clock.advance(100_000);
    assert.equal(timeout.signal.aborted, !dispose);
  }
});

// Stream activity refreshes the idle timeout, never the shared absolute deadline.
export function modelTimeout({ deadline, idleMs, now = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
  const controller = new AbortController();
  let timer;
  function refresh() {
    cancel(timer);
    timer = schedule(() => controller.abort(new DOMException('Model response deadline reached', 'TimeoutError')), Math.max(1, Math.min(idleMs, deadline - now())));
  }
  refresh();
  return { signal: controller.signal, refresh, dispose: () => cancel(timer) };
}

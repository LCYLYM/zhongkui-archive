import { useEffect, useRef } from 'react';

export default function useDialog(onClose) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const content = document.querySelector('main');
    const sidebar = document.querySelector('.sidebar');
    content?.setAttribute('inert', '');
    sidebar?.setAttribute('inert', '');
    document.body.classList.add('overlay-open');
    const focusable = () => [...(ref.current?.querySelectorAll('button:not(:disabled), a[href], input, select, [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length);
    focusable()[0]?.focus();
    const handler = event => {
      if (event.key === 'Escape') close.current();
      if (event.key === 'Tab') {
        const list = focusable();
        const first = list[0], last = list.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      content?.removeAttribute('inert'); sidebar?.removeAttribute('inert');
      document.body.classList.remove('overlay-open');
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return ref;
}

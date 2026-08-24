export function ArrowIcon({ direction = 'right' }) {
  return (
    <svg className={`icon icon--${direction}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M14 7l5 5-5 5" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg className="icon icon--play" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8.5 6.5 9 5.5-9 5.5z" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="5.8" /><path d="m15.2 15.2 4.3 4.3" />
    </svg>
  );
}

export function BookmarkIcon({ filled = false }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path className={filled ? 'icon-fill' : ''} d="M7 4.5h10v15l-5-3.4-5 3.4z" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

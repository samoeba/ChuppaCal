const artwork = {
  edit: <><path d="m4 16-1 5 5-1L20 8l-4-4Z" fill="var(--color-sun-soft)" /><path d="m13 7 4 4" /></>,
  trash: <><path d="M5 7h14l-1 13H6Z" fill="var(--color-coral-soft)" /><path d="M3 7h18M9 7V4h6v3m-5 4v5m4-5v5" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" fill="var(--color-sky-soft)" /><path d="M16 5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1" /></>,
  location: <><path d="M19 10c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 14 0Z" fill="var(--color-coral-soft)" /><circle cx="12" cy="10" r="2" /></>,
  lock: <><path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="var(--color-sun)" /><rect x="5" y="10" width="14" height="11" rx="2" fill="var(--color-sun)" stroke="var(--color-sun)" /><path d="M12 14v3" stroke="var(--color-cc-ink)" /></>,
};

export default function UiIcon({ name }: { name: keyof typeof artwork }) {
  return (
    <svg
      aria-hidden="true"
      className="inline-block size-[1.25em] shrink-0 align-[-0.22em]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {artwork[name]}
    </svg>
  );
}

import { sinceText } from '../lib/format';

/** Linha discreta "No Lanterninha desde novembro de 2026", com um calendário pequeno. */
export function Since({ iso }: { iso?: string }) {
  const text = sinceText(iso);
  if (!text) return null;
  return (
    <p className="v2since">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
      {text}
    </p>
  );
}

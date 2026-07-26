export function VMark({
  className = "",
  strokeWidth = 1,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <circle cx="60" cy="60" r="58" stroke="currentColor" strokeOpacity="0.25" strokeWidth={strokeWidth} />
      <circle cx="60" cy="60" r="44" stroke="currentColor" strokeOpacity="0.14" strokeWidth={strokeWidth} />
      <path
        d="M32 40 L60 90 L88 40"
        stroke="currentColor"
        strokeWidth={strokeWidth * 1.5}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M60 90 L60 108"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeOpacity="0.5"
      />
    </svg>
  );
}
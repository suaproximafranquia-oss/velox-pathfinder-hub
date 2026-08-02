/**
 * DEF 3.0.1 §3 — Arte oficial do painel central do CRM.
 *
 * A composição pertence EXCLUSIVAMENTE ao painel central: malha de
 * conexões + marca Atlas centralizada + moldura da arte acompanhando o
 * painel. O SVG usa `preserveAspectRatio="xMidYMid meet"`, portanto a
 * composição nunca deforma, nunca corta e nunca desloca o centro —
 * em notebook, Full HD, 2K ou UltraWide.
 */

const W = 1600;
const H = 900;

/** Malha de pontos com densidade decrescente nas bordas. */
const DOTS: { x: number; y: number; r: number; o: number }[] = (() => {
  const out: { x: number; y: number; r: number; o: number }[] = [];
  const stepX = 26;
  const stepY = 26;
  for (let y = stepY; y < H; y += stepY) {
    for (let x = stepX; x < W; x += stepX) {
      const nx = (x - W / 2) / (W / 2);
      const ny = (y - H / 2) / (H / 2);
      const d = Math.sqrt(nx * nx + ny * ny);
      if (d > 1.02) continue;
      // Recorte orgânico — sensação de continentes, sem imagem externa.
      const wave =
        Math.sin(nx * 5.1 + ny * 2.3) * 0.42 + Math.cos(ny * 4.4 - nx * 1.7) * 0.38;
      if (wave < -0.12) continue;
      out.push({
        x,
        y,
        r: d < 0.45 ? 2 : 1.6,
        o: Math.max(0.08, 0.5 - d * 0.42),
      });
    }
  }
  return out;
})();

export function CrmCanvas() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        <defs>
          <radialGradient id="crm-core" cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              stopColor="var(--crm-accent)"
              stopOpacity="0.20"
            />
            <stop offset="100%" stopColor="var(--crm-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={W / 2} cy={H / 2} r={430} fill="url(#crm-core)" />

        <g fill="var(--crm-accent)">
          {DOTS.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} opacity={d.o * 0.55} />
          ))}
        </g>

        {/* Marca Atlas — sempre no centro exato da composição. */}
        <g
          transform={`translate(${W / 2} ${H / 2 + 30})`}
          fill="none"
          stroke="var(--crm-accent)"
          strokeLinejoin="round"
        >
          <path
            d="M0 -150 L128 108 L0 46 L-128 108 Z"
            strokeWidth="3"
            opacity="0.55"
          />
          <path d="M0 -86 L74 62 L0 26 L-74 62 Z" strokeWidth="2.4" opacity="0.4" />
          <path
            d="M0 -150 L128 108 L0 46 L-128 108 Z"
            fill="var(--crm-accent)"
            opacity="0.05"
            stroke="none"
          />
        </g>
      </svg>

      {/* Moldura da arte — acompanha exatamente o painel central. */}
      <span className="absolute inset-3 rounded-2xl border border-[color:var(--crm-accent)] opacity-[0.18]" />
    </div>
  );
}
export function Marquee({
  items,
  className = '',
  invert = false,
}: {
  items: string[];
  className?: string;
  invert?: boolean;
}) {
  const bg = invert ? 'bg-ink text-cream' : 'bg-terra text-cream';
  const star = invert ? 'text-terra' : 'text-gold';
  const loop = [...items, ...items];

  return (
    <div className={`overflow-hidden ${bg} ${className}`}>
      <div className="marquee-track animate-marquee py-5 will-change-transform">
        {loop.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-8 px-8 font-display text-xl md:text-2xl font-bold uppercase tracking-[0.18em] shrink-0"
          >
            {item}
            <span className={`text-2xl ${star}`}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

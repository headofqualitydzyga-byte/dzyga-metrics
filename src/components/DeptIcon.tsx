const PATHS: Record<string, React.ReactNode> = {
  megaphone: (
    <>
      <path d="M3 10v4a1 1 0 0 0 1 1h2l8 4V5L6 9H4a1 1 0 0 0-1 1Z" />
      <path d="M18 8.5a3.5 3.5 0 0 1 0 7" />
    </>
  ),
  cart: (
    <>
      <circle cx={9} cy={20} r={1.5} />
      <circle cx={17} cy={20} r={1.5} />
      <path d="M2 3h2l2.4 12.2a2 2 0 0 0 2 1.8h7.2a2 2 0 0 0 2-1.6L20 8H6" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7Z" />,
  users: (
    <>
      <circle cx={9} cy={8} r={3} />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx={17} cy={9} r={2.5} />
      <path d="M15.5 14.3c2.6.4 4.5 2.6 4.5 5.7" />
    </>
  ),
  cog: (
    <>
      <circle cx={12} cy={12} r={3} />
      <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6" />
    </>
  ),
  truck: (
    <>
      <rect x={2} y={7} width={12} height={9} rx={1} />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx={7} cy={18} r={1.6} />
      <circle cx={17} cy={18} r={1.6} />
    </>
  ),
  clipboard: (
    <>
      <rect x={5} y={4} width={14} height={17} rx={1.5} />
      <rect x={9} y={2.5} width={6} height={3} rx={0.8} />
      <path d="M8.5 11h7M8.5 15h7" />
    </>
  ),
  document: (
    <>
      <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4M8 12h8M8 16h8" />
    </>
  ),
  currency: (
    <>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 6.5v11M15 9.2c0-1.2-1.3-2.2-3-2.2s-3 .9-3 2.2c0 1.3 1.3 1.8 3 2.3 1.7.5 3 1 3 2.3 0 1.2-1.3 2.2-3 2.2s-3-1-3-2.2" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M2 20h20" />
    </>
  ),
  shield: <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6Z" />,
  home: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
};

export default function DeptIcon({
  icon,
  className,
  style,
}: {
  icon: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {PATHS[icon] ?? PATHS.chart}
    </svg>
  );
}

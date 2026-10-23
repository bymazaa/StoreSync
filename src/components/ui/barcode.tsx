import { code128Bars } from "@/lib/barcode";

export function BarcodeSvg({ value, className }: { value: string; className?: string }) {
  const symbol = code128Bars(value);
  if (!symbol) return null;
  return (
    <svg
      className={className}
      role="img"
      aria-label={`Barcode for ${value}`}
      viewBox={`0 0 ${symbol.width} 100`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      width="100%"
      height="100%"
    >
      {symbol.bars.map(([x, width]) => <rect key={x} x={x} y={0} width={width} height={100} fill="#000" />)}
    </svg>
  );
}

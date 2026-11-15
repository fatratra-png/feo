import QRCode from 'qrcode';

/**
 * FEO-styled QR code: rounded modules and "eyes", and the
 * wordmark dot in the middle. High error correction keeps it scannable with
 * the centre covered. Always dark on white: scanners need the contrast.
 */
export function QrCode({ value, size = 220, className }: { value: string; size?: number; className?: string }) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: 'H' });
  const n = modules.size;
  const on = (x: number, y: number) => modules.get(y, x) === 1;
  const inEye = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const mid = n / 2;
  const hole = Math.ceil(n * 0.1);
  const inLogo = (x: number, y: number) => Math.abs(x + 0.5 - mid) < hole && Math.abs(y + 0.5 - mid) < hole;
  const dots: string[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    // Rounded squares rather than circles: some decoders fail on round modules.
    if (on(x, y) && !inEye(x, y) && !inLogo(x, y)) dots.push(`M${x + 0.3} ${y + 0.04}h.4a.26 .26 0 0 1 .26 .26v.4a.26 .26 0 0 1 -.26 .26h-.4a.26 .26 0 0 1 -.26 -.26v-.4a.26 .26 0 0 1 .26 -.26z`);
  }
  const eyes = [[0, 0], [n - 7, 0], [0, n - 7]];
  const pad = 3;
  return (
    <svg viewBox={`${-pad} ${-pad} ${n + pad * 2} ${n + pad * 2}`} width={size} height={size} className={className} role="img" aria-label={`QR code vers ${value}`}>
      <rect x={-pad} y={-pad} width={n + pad * 2} height={n + pad * 2} rx={3} fill="#fff" />
      <path d={dots.join('')} fill="#121212" />
      {eyes.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          {/* Finder patterns stay solid and only slightly rounded: decoders measure their 1:1:3:1:1 rhythm. */}
          <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.1} fill="none" stroke="#121212" strokeWidth={1} />
          <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.6} fill="#121212" />
        </g>
      ))}
      <circle cx={mid} cy={mid} r={hole - 0.6} fill="#121212" />
      <circle cx={mid} cy={mid} r={hole * 0.42} fill="#f8d02e" />
    </svg>
  );
}

/**
 * Compass rose showing which way a roof should face.
 *
 * Each arm is coloured by the same scale as the panels in the map, so the
 * legend, the compass and the roof polygons all read as one system: red to
 * the south (highest potential), blue to the north (lowest).
 */

import { rateSegment } from "@/lib/solar";

const DIRECTIONS = [
  { label: "N", azimuth: 0 },
  { label: "NØ", azimuth: 45 },
  { label: "Ø", azimuth: 90 },
  { label: "SØ", azimuth: 135 },
  { label: "S", azimuth: 180 },
  { label: "SV", azimuth: 225 },
  { label: "V", azimuth: 270 },
  { label: "NV", azimuth: 315 },
];

const CENTER = 70;
const TIP = 52;
const SHOULDER = 17;
const LABEL = 64;

/** Screen coordinates for a compass bearing (0 = north, clockwise). */
function point(bearing, radius) {
  const rad = ((bearing - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)];
}

export default function SolarCompass({ size = 132 }) {
  return (
    <svg
      viewBox="0 0 140 140"
      width={size}
      height={size}
      role="img"
      aria-label="Kompass: sørvendte tak har høyest solpotensial, nordvendte lavest"
    >
      {DIRECTIONS.map(({ label, azimuth }) => {
        const arm = [
          point(azimuth, TIP),
          point(azimuth + 22.5, SHOULDER),
          [CENTER, CENTER],
          point(azimuth - 22.5, SHOULDER),
        ];
        const [lx, ly] = point(azimuth, LABEL);
        return (
          <g key={label}>
            <polygon
              points={arm.map(([x, y]) => `${x},${y}`).join(" ")}
              fill={rateSegment(30, azimuth).color}
              stroke="#ffffff"
              strokeWidth="1"
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="11"
              fontWeight="600"
              fill="var(--ink)"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

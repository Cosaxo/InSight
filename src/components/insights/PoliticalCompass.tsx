import { C } from "../../theme";
import type { Political } from "../../types";

interface PoliticalCompassProps {
  group: Political;
  me: Political;
  groupColor: string;
  label?: string;
}

export function PoliticalCompass({
  group,
  me,
  groupColor,
  label = "Group",
}: PoliticalCompassProps) {
  const gX = 50 + (group.econ / 50) * 50;
  const gY = 50 - (group.social / 50) * 50;
  const mX = 50 + (me.econ / 50) * 50;
  const mY = 50 - (me.social / 50) * 50;

  return (
    <svg viewBox="0 0 100 100" style={{ width: "100%", display: "block" }}>
      <rect x="0" y="0" width="50" height="50" fill="#fee2e2" rx="2" />
      <rect x="50" y="0" width="50" height="50" fill="#fef9c3" rx="2" />
      <rect x="0" y="50" width="50" height="50" fill="#dcfce7" rx="2" />
      <rect x="50" y="50" width="50" height="50" fill="#ede9fe" rx="2" />
      <line x1="0" y1="25" x2="100" y2="25" stroke={C.divider} strokeWidth="0.5" strokeDasharray="2,2" />
      <line x1="0" y1="75" x2="100" y2="75" stroke={C.divider} strokeWidth="0.5" strokeDasharray="2,2" />
      <line x1="25" y1="0" x2="25" y2="100" stroke={C.divider} strokeWidth="0.5" strokeDasharray="2,2" />
      <line x1="75" y1="0" x2="75" y2="100" stroke={C.divider} strokeWidth="0.5" strokeDasharray="2,2" />
      <line x1="50" y1="3" x2="50" y2="97" stroke="#cbd5e1" strokeWidth="0.8" />
      <line x1="3" y1="50" x2="97" y2="50" stroke="#cbd5e1" strokeWidth="0.8" />
      <text x="25" y="8" textAnchor="middle" fill={C.red} fontSize="4" fontFamily="sans-serif" fontWeight="600">
        Auth-left
      </text>
      <text x="75" y="8" textAnchor="middle" fill={C.amber} fontSize="4" fontFamily="sans-serif" fontWeight="600">
        Auth-right
      </text>
      <text x="25" y="97" textAnchor="middle" fill={C.green} fontSize="4" fontFamily="sans-serif" fontWeight="600">
        Lib-left
      </text>
      <text x="75" y="97" textAnchor="middle" fill={C.purple} fontSize="4" fontFamily="sans-serif" fontWeight="600">
        Lib-right
      </text>
      <text x="5" y="52" fill={C.muted} fontSize="3.5" fontFamily="sans-serif">Left</text>
      <text x="72" y="52" fill={C.muted} fontSize="3.5" fontFamily="sans-serif">Right</text>
      <line
        x1={gX}
        y1={gY}
        x2={mX}
        y2={mY}
        stroke={C.muted}
        strokeWidth="0.5"
        strokeDasharray="2,1.5"
        opacity="0.5"
      />
      <circle cx={gX} cy={gY} r="9" fill={groupColor} opacity="0.18" />
      <circle cx={gX} cy={gY} r="5.5" fill={groupColor} />
      <text
        x={gX}
        y={gY + 9}
        textAnchor="middle"
        fill={groupColor}
        fontSize="3.5"
        fontFamily="sans-serif"
        fontWeight="600"
      >
        {label}
      </text>
      <circle cx={mX} cy={mY} r="7" fill={C.teal} opacity="0.18" />
      <circle cx={mX} cy={mY} r="4" fill={C.teal} />
      <text
        x={mX}
        y={mY - 5}
        textAnchor="middle"
        fill={C.teal}
        fontSize="3.5"
        fontFamily="sans-serif"
      >
        You
      </text>
    </svg>
  );
}

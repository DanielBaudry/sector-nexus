import React, { useMemo } from 'react';
import { Swords, Skull, Tent, Package, Crown, Rocket } from 'lucide-react';

const NODE_STYLE = {
  START:  { icon: Rocket,  color: '#22d3ee', label: 'Landing Zone' },
  COMBAT: { icon: Swords,  color: '#f87171', label: 'Combat' },
  ELITE:  { icon: Skull,   color: '#f59e0b', label: 'Elite' },
  REST:   { icon: Tent,    color: '#34d399', label: 'Field Camp' },
  CACHE:  { icon: Package, color: '#a78bfa', label: 'Supply Cache' },
  BOSS:   { icon: Crown,   color: '#ef4444', label: 'Apex Threat' },
};

const COL_X = [18, 50, 82];   // % across
const PAD_Y = 8;              // % top/bottom padding

/** Branching planet map. Start at the bottom, boss at the top. */
export default function RunNodeMap({ nodes, currentNodeId, reachableIds, onChoose, busy }) {
  const maxRow = useMemo(() => Math.max(...nodes.map((n) => n.row)), [nodes]);
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const reachable = new Set(reachableIds);

  const pos = (n) => ({
    x: COL_X[n.col] ?? 50,
    y: 100 - PAD_Y - (n.row / Math.max(1, maxRow)) * (100 - PAD_Y * 2),
  });

  return (
    <div className="relative w-full h-full min-h-[420px]">
      {/* Edges */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {nodes.flatMap((n) =>
          n.next_ids.map((nid) => {
            const to = byId[nid];
            if (!to) return null;
            const a = pos(n);
            const b = pos(to);
            const isLive = n.id === currentNodeId && reachable.has(nid);
            const travelled = n.visited && to.visited;
            return (
              <line
                key={`${n.id}-${nid}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isLive ? '#22d3ee' : travelled ? '#64748b' : '#1e293b'}
                strokeWidth={isLive ? 0.7 : 0.4}
                strokeDasharray={isLive ? '1.5 1' : travelled ? '0' : '1 1.2'}
                vectorEffect="non-scaling-stroke"
                style={{ strokeWidth: isLive ? 2.5 : 1.5 }}
              />
            );
          }),
        )}
      </svg>

      {/* Nodes */}
      {nodes.map((n) => {
        const style = NODE_STYLE[n.type] || NODE_STYLE.COMBAT;
        const Icon = style.icon;
        const p = pos(n);
        const isCurrent = n.id === currentNodeId;
        const canGo = reachable.has(n.id) && !busy;
        const big = n.type === 'BOSS';
        return (
          <button
            key={n.id}
            disabled={!canGo}
            onClick={() => canGo && onChoose(n.id)}
            title={`${style.label} — ${n.objective_hint}`}
            className="group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <span
              className={`relative flex items-center justify-center rounded-full border-2 transition-all ${
                big ? 'w-16 h-16' : 'w-11 h-11'
              } ${canGo ? 'cursor-pointer scale-110 animate-pulse hover:animate-none hover:scale-125' : ''} ${
                n.visited && !isCurrent ? 'opacity-40' : ''
              } ${!canGo && !n.visited && !isCurrent ? 'opacity-60' : ''}`}
              style={{
                borderColor: style.color,
                backgroundColor: n.visited ? `${style.color}33` : '#060a12',
                boxShadow: canGo || isCurrent ? `0 0 18px ${style.color}88` : 'none',
              }}
            >
              <Icon className={big ? 'w-7 h-7' : 'w-5 h-5'} style={{ color: style.color }} />
              {isCurrent && <span className="absolute -inset-1.5 rounded-full border-2 border-cyan-300 animate-ping opacity-60" />}
            </span>
            <span
              className={`mt-1 font-mono text-[9px] uppercase tracking-wider whitespace-nowrap px-1 rounded ${
                canGo ? 'text-slate-100 bg-black/70' : 'text-slate-500'
              }`}
            >
              {style.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { NODE_STYLE };

import React from 'react';
import { Target, ShieldAlert, Hourglass, Crown, CheckCircle2, XCircle } from 'lucide-react';

const ICONS = {
  CLEAR_LANES: Target,
  DEFEND_LANE: ShieldAlert,
  SURVIVE_TURNS: Hourglass,
  ELIMINATE_BOSS: Crown,
};

function progressText(o) {
  if (o.type === 'CLEAR_LANES') return `${o.params.progress ?? 0}/${o.params.count}`;
  if (o.type === 'SURVIVE_TURNS') return `${o.params.progress ?? 0}/${o.params.turns}`;
  return null;
}

export default function ObjectiveTracker({ objectives = [], compact = false }) {
  return (
    <div className={`flex ${compact ? 'flex-wrap gap-1.5' : 'flex-col gap-1.5'}`}>
      {objectives.map((o, i) => {
        const Icon = ICONS[o.type] || Target;
        const done = o.status === 'COMPLETE';
        const failed = o.status === 'FAILED';
        const progress = progressText(o);
        return (
          <div
            key={i}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] ${
              failed
                ? 'border-red-500/60 bg-red-950/50 text-red-300'
                : done
                ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300'
                : o.is_primary
                ? 'border-cyan-500/40 bg-cyan-950/30 text-cyan-200'
                : 'border-amber-500/40 bg-amber-950/30 text-amber-200'
            }`}
          >
            {done ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : failed ? <XCircle className="w-3.5 h-3.5 shrink-0" /> : <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span className="uppercase text-[8px] opacity-70">{o.is_primary ? 'Primary' : 'Must hold'}</span>
            <span className="truncate">{o.description}</span>
            {progress && <span className="ml-auto font-bold pl-1">{progress}</span>}
          </div>
        );
      })}
    </div>
  );
}

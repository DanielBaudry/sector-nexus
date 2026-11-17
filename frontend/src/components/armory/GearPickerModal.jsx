import React, { useEffect, useMemo, useState } from 'react';
import { X, ArrowRight, Check, Unlink } from 'lucide-react';
import Stars from '../Stars';
import ArtifactCard from '../ArtifactCard';
import { formatStat, rarityStyle, statLabel } from '../../utils/progression';
import { SLOT_ICONS, SORTS, compareArtifacts } from './gear';

function ItemTile({ artifact, selected, equippedHere, ownerName, onClick }) {
  const r = rarityStyle(artifact.rarity);
  const Icon = SLOT_ICONS[artifact.slot];
  return (
    <button
      onClick={onClick}
      className={`relative aspect-square rounded-lg border-2 ${r.border} ${r.bg} flex flex-col items-center justify-center gap-0.5 p-1 transition ${
        selected ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-black scale-[1.03]' : 'hover:brightness-125'
      }`}
      title={artifact.name}
    >
      <Icon className={`w-7 h-7 ${r.text}`} />
      <Stars value={artifact.rank} size="w-2.5 h-2.5" />
      <span className="font-mono text-[11px] font-bold text-cyan-200 leading-none">
        {statLabel(artifact.main_stat_name)} {formatStat(artifact.main_stat_name, artifact.main_stat_value)}
      </span>
      <span className="absolute top-0.5 right-1 font-orbitron font-black text-xs text-slate-100">+{artifact.level}</span>
      {equippedHere && (
        <span className="absolute top-0.5 left-1 text-emerald-300"><Check className="w-3 h-3" /></span>
      )}
      {!equippedHere && ownerName && (
        <span className="absolute bottom-0 inset-x-0 bg-black/70 font-mono text-[8px] text-amber-300 truncate px-1">
          {ownerName}
        </span>
      )}
    </button>
  );
}

/**
 * Inventory for one gear slot: grid of owned artifacts on the left, selected item
 * details + stat comparison against the equipped one on the right.
 */
export default function GearPickerModal({
  slot, champion, artifacts, equipped, championName, busy, onEquip, onUnequip, onUpgrade, onClose,
}) {
  const [sort, setSort] = useState('rank');
  const [hideTaken, setHideTaken] = useState(false);
  const [selectedId, setSelectedId] = useState(equipped?.id || null);

  const items = useMemo(
    () => (artifacts || [])
      .filter((a) => a.slot === slot)
      .filter((a) => !hideTaken || !a.equipped_to || a.equipped_to === champion.id)
      .sort(SORTS[sort]),
    [artifacts, slot, sort, hideTaken, champion.id],
  );

  useEffect(() => {
    if (!selectedId && items.length) setSelectedId(items[0].id);
  }, [items, selectedId]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selected = (artifacts || []).find((a) => a.id === selectedId) || null;
  const isEquippedHere = selected && selected.equipped_to === champion.id;
  const diffs = selected && !isEquippedHere ? compareArtifacts(selected, equipped) : [];
  const Icon = SLOT_ICONS[slot];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-5xl h-[82vh] hud-panel rounded-2xl border border-cyan-500/40 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center">
              <Icon className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="font-mono text-[10px] tracking-widest text-cyan-400">{champion.name.toUpperCase()} · INVENTORY</div>
              <h3 className="font-orbitron font-black text-lg text-slate-100">{slot.toUpperCase()}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="text-slate-500">SORT</span>
            {Object.keys(SORTS).map((k) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`px-2 py-1 rounded uppercase ${sort === k ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-400 hover:text-slate-200'}`}
              >
                {k}
              </button>
            ))}
            <label className="flex items-center gap-1 ml-2 text-slate-400 cursor-pointer select-none">
              <input type="checkbox" checked={hideTaken} onChange={(e) => setHideTaken(e.target.checked)} className="accent-cyan-500" />
              Hide worn by others
            </label>
            <button onClick={onClose} className="ml-2 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_340px]">
          {/* Inventory grid */}
          <div className="min-h-0 overflow-y-auto p-4">
            {items.length === 0 ? (
              <div className="h-full flex items-center justify-center font-mono text-xs text-slate-500 text-center">
                No {slot} in your vault. Run expeditions to find more.
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2">
                {items.map((a) => (
                  <ItemTile
                    key={a.id}
                    artifact={a}
                    selected={a.id === selectedId}
                    equippedHere={a.equipped_to === champion.id}
                    ownerName={a.equipped_to && a.equipped_to !== champion.id ? championName(a.equipped_to) : null}
                    onClick={() => setSelectedId(a.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Details / comparison */}
          <div className="min-h-0 overflow-y-auto border-t md:border-t-0 md:border-l border-slate-800 bg-black/30 p-4 flex flex-col gap-3">
            {selected ? (
              <>
                <div className="font-mono text-[10px] tracking-widest text-slate-500">
                  {isEquippedHere ? 'EQUIPPED' : 'SELECTED'}
                </div>
                <ArtifactCard
                  artifact={selected}
                  busy={busy}
                  equippedName={selected.equipped_to && !isEquippedHere ? championName(selected.equipped_to) : null}
                  onUpgrade={(a) => onUpgrade(a.id)}
                />

                {!isEquippedHere && (
                  <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-2.5">
                    <div className="font-mono text-[11px] tracking-widest text-slate-500 mb-1.5 flex items-center gap-1">
                      {equipped ? <>VS EQUIPPED <ArrowRight className="w-3 h-3" /> {equipped.name}</> : 'SLOT IS EMPTY'}
                    </div>
                    {diffs.length === 0 ? (
                      <div className="font-mono text-[10px] text-slate-500">Identical stats.</div>
                    ) : (
                      <div className="space-y-0.5">
                        {diffs.map((d) => (
                          <div key={d.stat} className="flex items-center justify-between font-mono text-sm">
                            <span className="text-slate-400">{statLabel(d.stat)}</span>
                            <span className={d.diff > 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {d.diff > 0 ? formatStat(d.stat, d.diff) : formatStat(d.stat, d.diff).replace('+-', '−')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-auto flex gap-2">
                  {isEquippedHere ? (
                    <button
                      disabled={busy}
                      onClick={() => onUnequip(slot)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-red-950 border border-slate-700 hover:border-red-500/50 text-slate-300 hover:text-red-300 font-orbitron font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <Unlink className="w-4 h-4" /> UNEQUIP
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => onEquip(selected.id)}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-orbitron font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <Check className="w-4 h-4" />
                      {selected.equipped_to ? `TAKE FROM ${championName(selected.equipped_to)?.split(' ').pop()?.toUpperCase()}` : 'EQUIP'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center font-mono text-xs text-slate-500">Select an artifact.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { User } from 'lucide-react';
import { getPortrait } from '../../utils/battleVisuals';

/** Same profile picture as the expedition battle board, with a silhouette fallback. */
export default function HeroPortrait({ name = '', className = '' }) {
  const src = getPortrait(name);
  return (
    <div className={`relative overflow-hidden bg-slate-900 flex items-center justify-center ${className}`}>
      {src
        ? <img src={src} alt={name} draggable={false} className="w-full h-full object-cover object-top" />
        : <User className="w-1/2 h-1/2 text-slate-600" />}
    </div>
  );
}

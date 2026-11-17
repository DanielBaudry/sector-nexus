import React from 'react';
import { Star } from 'lucide-react';

/** Rank shown as filled stars out of `max`. */
export default function Stars({ value = 0, max = 6, size = 'w-3 h-3', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-px ${className}`} title={`Rank ${value}`}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`${size} ${i < value ? 'text-amber-300 fill-amber-300' : 'text-slate-700'}`}
        />
      ))}
    </span>
  );
}

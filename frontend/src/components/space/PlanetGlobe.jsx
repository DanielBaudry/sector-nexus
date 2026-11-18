import React, { useEffect, useRef } from 'react';

const DAY_MS = 26000;   // one full trip of the sun around the planet
const DAY_SHARE = 0.74; // share of the cycle the sun spends in front (left → right sweep)
const DUSK_DIM = 0.42;  // how dark the twilight gets while the sun is behind (1 = black)
const WOBBLE = 4;       // deg of slow idle tilt
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Sun angle for cycle progress p ∈ [0,1): θ = -90° (sunrise, left) → 0° (noon, facing) →
 * +90° (sunset, right) during the day share, then the far side (+90° → 270°) during twilight.
 */
function sunAngle(p) {
  if (p < DAY_SHARE) return -Math.PI / 2 + (p / DAY_SHARE) * Math.PI;
  return Math.PI / 2 + ((p - DAY_SHARE) / (1 - DAY_SHARE)) * Math.PI;
}

/**
 * A planet that feels like a sphere: a sun that orbits it on a loop — light rises on the left,
 * sweeps across, sets on the right, a short dim twilight (never full night) with a glowing rim,
 * then dawn again — plus an atmosphere glow, a slow float / wobble and an orbit ring.
 */
export default function PlanetGlobe({ planet, className = '' }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf = 0;
    // Random start so neighbouring globes (travel transition) aren't in lockstep.
    const t0 = performance.now() - Math.random() * DAY_MS * DAY_SHARE;

    const tick = (now) => {
      const t = now - t0;
      const theta = sunAngle((t % DAY_MS) / DAY_MS);
      const lit = clamp01((Math.cos(theta) + 0.35) / 0.7); // 1 = day, 0 = twilight (sun behind)
      body.style.setProperty('--lx', `${(50 + Math.sin(theta) * 58).toFixed(1)}%`);
      body.style.setProperty('--ly', '40%');
      body.style.setProperty('--dusk', (1 - lit).toFixed(3));
      // Gentle idle wobble, leaning slightly toward the sun.
      body.style.setProperty('--rx', `${(Math.sin(t / 5200) * WOBBLE * 0.6).toFixed(2)}deg`);
      body.style.setProperty('--ry', `${(Math.sin(theta) * WOBBLE * lit + Math.sin(t / 7300) * WOBBLE * 0.5).toFixed(2)}deg`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hue = planet.image_hue ? `hue-rotate(${planet.image_hue}deg)` : '';
  const color = planet.color || '#f97316';

  return (
    <div className={`relative aspect-square ${className}`} style={{ perspective: '1100px' }}>
      <div className="planet-float absolute inset-0">
        <div
          ref={bodyRef}
          className="absolute inset-0"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))',
            '--lx': '38%',
            '--ly': '40%',
            '--dusk': 0,
          }}
        >
          {/* Atmosphere glow */}
          <div className="absolute inset-[-14%] rounded-full blur-3xl opacity-60" style={{ background: `radial-gradient(circle, ${color}66 0%, ${color}22 45%, transparent 70%)` }} />

          {/* Orbit ring — back half (behind the globe) */}
          <OrbitRing color={color} half="back" />

          {/* Globe */}
          <img
            src={planet.image}
            alt={planet.name}
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain select-none"
            style={{ filter: `${hue} drop-shadow(0 0 40px ${color}55)` }}
          />
          {/* Lighting: terminator shadow + specular, on the sphere (inset to skip the halo) */}
          <div
            className="absolute inset-[5%] rounded-full pointer-events-none mix-blend-multiply"
            style={{
              background: 'radial-gradient(circle at var(--lx) var(--ly), #ffffff 0%, #ffffff 30%, #6b6b6b 62%, #141414 92%)',
              opacity: 'calc(1 - var(--dusk))',
            }}
          />
          <div
            className="absolute inset-[5%] rounded-full pointer-events-none mix-blend-screen"
            style={{
              background: 'radial-gradient(circle at var(--lx) var(--ly), #ffe2b8aa 0%, transparent 30%)',
              opacity: 'calc(0.4 * (1 - var(--dusk)))',
            }}
          />
          {/* Twilight (sun behind): the directional shading fades into an even, soft dim */}
          <div
            className="absolute inset-[5%] rounded-full pointer-events-none bg-black"
            style={{ opacity: `calc(${DUSK_DIM} * var(--dusk))` }}
          />
          {/* Rim light (brighter in twilight: atmosphere lit from behind) */}
          <div className="absolute inset-[5%] rounded-full pointer-events-none" style={{ boxShadow: `inset 0 0 40px 6px ${color}55, 0 0 60px 4px ${color}33` }} />
          <div
            className="absolute inset-[5%] rounded-full pointer-events-none"
            style={{ boxShadow: `inset 0 0 26px 4px ${color}aa, 0 0 50px 8px ${color}55`, opacity: 'var(--dusk)' }}
          />

          {/* Orbit ring — front half */}
          <OrbitRing color={color} half="front" />
        </div>
      </div>
    </div>
  );
}

/**
 * A tilted orbit with a satellite. Rendered twice: the back half under the globe, the front
 * half over it, so the satellite visibly passes behind the planet.
 */
function OrbitRing({ color, half }) {
  return (
    <div
      className="absolute inset-[-12%] pointer-events-none"
      style={{ clipPath: half === 'front' ? 'inset(50% 0 0 0)' : 'inset(0 0 50% 0)' }}
    >
      <div className="absolute inset-0" style={{ transform: 'rotateZ(-14deg) scaleY(0.24)' }}>
        <div className="orbit-spin absolute inset-0 rounded-full border" style={{ borderColor: `${color}55` }}>
          <span
            className="absolute left-1/2 -top-[5px] w-2.5 h-2.5 -ml-[5px] rounded-full"
            style={{ background: '#fff', boxShadow: `0 0 10px 3px ${color}, 0 0 4px #fff`, transform: 'scaleY(4.2)' }}
          />
        </div>
      </div>
    </div>
  );
}

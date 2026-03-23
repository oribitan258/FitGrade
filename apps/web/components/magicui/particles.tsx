'use client';

import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';

interface MousePosition {
  x: number;
  y: number;
}

function useMousePosition(): MousePosition {
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    function handleMouseMove(event: MouseEvent): void {
      setMousePosition({ x: event.clientX, y: event.clientY });
    }
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return mousePosition;
}

interface ParticleData {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

function generateParticles(count: number): ParticleData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.5 + 0.1,
    duration: Math.random() * 10 + 8,
    delay: Math.random() * 6,
  }));
}

interface ParticlesProps {
  className?: string;
  quantity?: number;
  staticity?: number;
  ease?: number;
  size?: number;
  refresh?: boolean;
  color?: string;
  vx?: number;
  vy?: number;
}

/**
 * Magic UI — Particles
 * Lightweight CSS-animated floating particles with brand violet color.
 * No heavy tsparticles runtime — pure CSS keyframes for performance.
 */
export function Particles({
  className,
  quantity = 50,
  color = '#8B5CF6',
}: ParticlesProps): React.JSX.Element {
  const id = useId();
  const [particles] = useState<ParticleData[]>(() => generateParticles(quantity));

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      <style>{`
        @keyframes particle-float-${id.replace(/:/g, '')} {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: var(--p-opacity); }
          25% { transform: translateY(-12px) translateX(4px); }
          50% { transform: translateY(-6px) translateX(-4px); opacity: calc(var(--p-opacity) * 1.5); }
          75% { transform: translateY(-18px) translateX(2px); }
        }
      `}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: color,
              '--p-opacity': p.opacity,
              opacity: p.opacity,
              animation: `particle-float-${id.replace(/:/g, '')} ${p.duration}s ${p.delay}s ease-in-out infinite`,
              boxShadow: `0 0 ${p.size * 2}px ${color}`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

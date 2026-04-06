'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

interface AnatomyVideoPlayerProps {
  /** Path to a PNG with a solid green-screen background */
  imageUrl?: string;
  /** Legacy alias — treated the same as imageUrl */
  videoUrl?: string;
  fallbackTitle: string;
}

export function AnatomyVideoPlayer({
  imageUrl,
  videoUrl,
  fallbackTitle,
}: AnatomyVideoPlayerProps): React.JSX.Element {
  const src = imageUrl ?? videoUrl ?? '';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [hasError, setHasError] = useState(!src);

  useEffect(() => {
    if (!src) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);

      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = frame.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        // Kill any pixel where green dominates both red AND blue
        if (g > r + 15 && g > b + 15) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(frame, 0, 0);
      setReady(true);
    };

    img.onerror = () => setHasError(true);
    img.src = src;
  }, [src]);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-transparent">

      {/* Violet ambient glow */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full blur-[100px]"
        style={{
          width: '65%',
          height: '65%',
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.32) 0%, rgba(79,70,229,0.14) 55%, transparent 100%)',
        }}
        animate={{ opacity: [0.5, 1, 0.5], scale: [0.88, 1.10, 0.88] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Cyan accent glow */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full blur-[60px]"
        style={{
          width: '35%',
          height: '35%',
          insetInlineStart: '10%',
          top: '12%',
          background: 'rgba(34,211,238,0.15)',
        }}
        animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.2, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }}
      />

      {hasError ? (
        <FallbackOrbs title={fallbackTitle} />
      ) : (
        <>
          {/* Hidden canvas — pixels are keyed here */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Visible display — motion wrapper for holographic feel */}
          <motion.div
            className="relative z-10 mx-auto"
            style={{ maxWidth: 400, width: '100%', opacity: ready ? 1 : 0 }}
            animate={ready ? {
              y: [0, -15, 0],
              scale: [1, 1.03, 1],
            } : {}}
            transition={{
              y:     { duration: 6,   repeat: Infinity, ease: 'easeInOut' },
              scale: { duration: 8,   repeat: Infinity, ease: 'easeInOut' },
            }}
          >
            {/* Ground glow beneath the figure */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 inset-x-0 mx-auto blur-2xl"
              style={{
                height: 60,
                width: '60%',
                background: 'radial-gradient(ellipse, rgba(139,92,246,0.45) 0%, transparent 70%)',
              }}
            />

            {ready && (
              <img
                src={canvasRef.current?.toDataURL() ?? ''}
                alt=""
                className="relative w-full object-contain"
                style={{ maxHeight: 420, filter: 'drop-shadow(0 0 28px rgba(139,92,246,0.55)) drop-shadow(0 0 10px rgba(34,211,238,0.25))' }}
              />
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}

function FallbackOrbs({ title }: { title: string }): React.JSX.Element {
  return (
    <div className="relative flex h-full min-h-[300px] w-full items-center justify-center overflow-hidden">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 280, height: 280, background: 'rgba(139,92,246,0.36)' }}
        animate={{ x: [0, 34, -24, 0], y: [0, -30, 20, 0], scale: [1, 1.13, 0.87, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 210, height: 210, background: 'rgba(34,211,238,0.23)' }}
        animate={{ x: [0, -40, 30, 0], y: [0, 34, -24, 0], scale: [1, 0.85, 1.22, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full blur-2xl"
        style={{ width: 140, height: 140, background: 'rgba(99,102,241,0.46)' }}
        animate={{ x: [20, -26, 34, 20], y: [-20, 30, -14, -20], scale: [1, 1.24, 0.80, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
      />
      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/30"
          style={{ background: 'rgba(139,92,246,0.18)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Activity className="h-8 w-8 text-violet-300" aria-hidden="true" />
        </motion.div>
        <p className="max-w-[160px] text-sm font-medium leading-snug text-slate-400">{title}</p>
      </div>
    </div>
  );
}

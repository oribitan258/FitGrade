'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TracingBeamProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Aceternity UI — Tracing Beam
 * A glowing vertical beam that traces the user's scroll position
 * down the left/right side of the content. Uses framer-motion scroll tracking.
 * RTL: beam is on the end side (start in visual LTR).
 */
export function TracingBeam({ children, className }: TracingBeamProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  const contentRef = useRef<HTMLDivElement>(null);
  const [svgHeight, setSvgHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setSvgHeight(contentRef.current.offsetHeight);
    }
  }, []);

  const y1 = useSpring(useTransform(scrollYProgress, [0, 0.8], [50, svgHeight]), {
    stiffness: 500,
    damping: 90,
  });
  const y2 = useSpring(useTransform(scrollYProgress, [0, 1], [50, svgHeight - 200]), {
    stiffness: 500,
    damping: 90,
  });

  return (
    <motion.div ref={ref} className={cn('relative mx-auto h-full w-full', className)}>
      {/* Beam track — absolute on the start side */}
      <div className="absolute start-4 top-3 hidden md:block" aria-hidden="true">
        <motion.div
          transition={{ duration: 0.2, delay: 0.5 }}
          animate={{ boxShadow: scrollYProgress.get() > 0 ? 'none' : 'rgba(139,92,246,0.4) 0 4px 14px 0' }}
          className="border-netural-200 relative ml-[27px] flex h-4 w-4 items-center justify-center rounded-full border shadow-sm"
          style={{ background: 'rgba(139,92,246,0.20)' }}
        >
          <div className="h-2 w-2 rounded-full border border-violet-400 bg-violet-500" />
        </motion.div>
        <svg
          viewBox={`0 0 20 ${svgHeight}`}
          width="20"
          height={svgHeight}
          className="ml-4 block"
          aria-hidden="true"
        >
          <motion.path
            d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`}
            fill="none"
            stroke="#9091A0"
            strokeOpacity="0.16"
            strokeWidth="1.25"
            transition={{ duration: 10 }}
          />
          <motion.path
            d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`}
            fill="none"
            stroke="url(#beam-path-gradient)"
            strokeWidth="1.25"
            className="motion-reduce:hidden"
            transition={{ duration: 10 }}
            style={{ pathLength: scrollYProgress, pathOffset: useTransform(scrollYProgress, [0, 1], [0, 0.1]) }}
          />
          <defs>
            <motion.linearGradient
              id="beam-path-gradient"
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              y1={y1}
              y2={y2}
            >
              <stop stopColor="#7B2FFF" stopOpacity="0" />
              <stop stopColor="#7B2FFF" />
              <stop offset="0.325" stopColor="#00D4FF" />
              <stop offset="1" stopColor="#00D4FF" stopOpacity="0" />
            </motion.linearGradient>
          </defs>
        </svg>
      </div>
      <div ref={contentRef}>{children}</div>
    </motion.div>
  );
}

import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glowOnHover?: boolean;
}

export default function GlassCard({ children, className, glowOnHover, ...rest }: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "GlassCard relative overflow-hidden",
        className
      )}
      {...(glowOnHover
        ? { whileHover: { y: -4, boxShadow: '0 0 48px rgba(195,245,255,0.15)' } }
        : {})}
      {...(rest as Record<string, unknown>)}
    >
      {/* Inner border highlight */}
      <div className="absolute inset-0 border border-[#4F7C82]/30 rounded-2xl pointer-events-none" />
      {children}
    </motion.div>
  );
}

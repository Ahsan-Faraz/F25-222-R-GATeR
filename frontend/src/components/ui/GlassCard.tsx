import React, { ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
  glowOnHover?: boolean;
}

export default function GlassCard({ children, className, glowOnHover, ...props }: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "GlassCard relative overflow-hidden",
        className
      )}
      whileHover={glowOnHover ? { y: -4, boxShadow: '0 0 48px rgba(79,124,130,0.4)' } : undefined}
      {...props}
    >
      {/* Inner border highlight */}
      <div className="absolute inset-0 border border-[#4F7C82]/30 rounded-2xl pointer-events-none" />
      {children}
    </motion.div>
  );
}

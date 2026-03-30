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
      whileHover={glowOnHover ? { y: -4, boxShadow: '0 0 48px rgba(184,227,233,0.3)' } : undefined}
      {...props}
    >
      {/* Optional subtle inner border highlight via pseudo-element or absolute div */}
      <div className="absolute inset-0 border border-[rgba(184,227,233,0.1)] rounded-2xl pointer-events-none" />
      {children}
    </motion.div>
  );
}

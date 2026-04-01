import React from 'react';

export type ActivityLevel = 'INFO' | 'SYSTEM' | 'WARN' | 'ERROR';

export interface ActivityLogLine {
  time: string;
  level: ActivityLevel;
  message: string;
}

const levelClass: Record<ActivityLevel, string> = {
  INFO: 'text-primary',
  SYSTEM: 'text-secondary',
  WARN: 'text-error',
  ERROR: 'text-error',
};

const borderClass: Record<ActivityLevel, string> = {
  INFO: 'border-primary/20',
  SYSTEM: 'border-secondary/20',
  WARN: 'border-error/20',
  ERROR: 'border-error/20',
};

export interface ActivityCardProps {
  logs: ActivityLogLine[];
}

/**
 * Stitch f8392340720a469cb944211c9fac7ea3 — Recent Activity Logs (col-span-8 bottom).
 */
export default function ActivityCard({ logs }: ActivityCardProps) {
  return (
    <div className="col-span-12 md:col-span-8 bg-surface-container-lowest border border-outline-variant/10 rounded-lg p-6">
      <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-[0.2em] mb-4">
        Recent Activity Logs
      </p>
      <div className="space-y-3 font-mono text-[12px]">
        {logs.length === 0 ? (
          <p className="text-on-surface-variant/70">No recent activity.</p>
        ) : (
          logs.map((log, i) => (
            <div
              key={`${log.time}-${i}`}
              className={`flex gap-4 border-l-2 ${borderClass[log.level]} pl-4 py-1 flex-wrap`}
            >
              <span className="text-on-surface-variant/40 shrink-0">{log.time}</span>
              <span className={`shrink-0 ${levelClass[log.level]}`}>{log.level}</span>
              <span className="text-on-surface min-w-0 break-words">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

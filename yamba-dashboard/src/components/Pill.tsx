import type { ReactNode } from 'react';
import './Pill.css';

export type TonPill = 'ok' | 'warn' | 'info' | 'muted';

export function Pill({ ton, children }: { ton: TonPill; children: ReactNode }) {
  return <span className={`pill pill--${ton}`}>{children}</span>;
}

import type { ReactNode } from 'react';
import './PageHeader.css';

export function PageHeader({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <h1 className="page-header-titre">{titre}</h1>
      {children && <div className="page-header-filtres">{children}</div>}
    </header>
  );
}

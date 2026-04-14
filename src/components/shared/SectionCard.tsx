import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  accent?: string;
  span?: 'normal' | '2' | 'full';
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export default function SectionCard({ title, subtitle, accent, span, icon, action, children }: SectionCardProps) {
  const spanClass = span === '2' ? 'span-2' : span === 'full' ? 'span-full' : '';

  return (
    <div className={`section-card ${spanClass}`} data-accent={accent}>
      <div className="card-header">
        <div>
          <div className="card-title">
            {icon}
            {title}
          </div>
          {subtitle && <div className="card-subtitle">{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

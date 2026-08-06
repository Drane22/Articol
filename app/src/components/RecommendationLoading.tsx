'use client';

import { useEffect, useState } from 'react';

const STAGES = [
  'Finding related music',
  'Comparing artwork',
  'Curating the strongest matches',
];

export function RecommendationLoading() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const first = window.setTimeout(() => setStage(1), 900);
    const second = window.setTimeout(() => setStage(2), 2200);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, []);

  return (
    <div className="recommendation-loading" role="status" aria-live="polite" aria-label={STAGES[stage]}>
      <div className="recommendation-loading__status">
        <div className="recommendation-loading__record" aria-hidden="true">
          <span className="recommendation-loading__groove" />
          <span className="recommendation-loading__label" />
        </div>
        <div>
          <p className="text-sm font-serif text-[var(--text-primary)]">{STAGES[stage]}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">One analysis prepares every recommendation tier.</p>
        </div>
      </div>

      <div className="recommendation-grid" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <div key={index} className="loading-card" style={{ animationDelay: `${(index % 6) * 70}ms` }}>
            <div className="loading-card__cover" />
            <div className="loading-card__copy">
              <span className="loading-card__line loading-card__line--title" />
              <span className="loading-card__line loading-card__line--artist" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

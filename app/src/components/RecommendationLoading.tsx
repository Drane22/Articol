'use client';

import { useEffect, useState } from 'react';

const LOADING_PROMPTS = [
  'Pretending this is a very serious music investigation.',
  'Making guesses with suspicious confidence.',
  'Comparing covers like this is a peer-reviewed discipline.',
  'Asking the algorithm to explain its taste.',
  'Sorting vibes into categories that definitely exist.',
  'Checking whether these covers have chemistry or just good lighting.',
  'Doing the math. The vibes remain unverified.',
  'Looking for a match with plausible deniability.',
  'Curating a shortlist. Please act surprised when it gets weird.',
];

const LOADING_PROMPT_INTERVAL = 3000;

export function RecommendationLoading() {
  const [promptIndex, setPromptIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPromptIndex((current) => (current + 1) % LOADING_PROMPTS.length);
    }, LOADING_PROMPT_INTERVAL);

    return () => window.clearInterval(interval);
  }, []);

  const prompt = LOADING_PROMPTS[promptIndex];

  return (
    <div className="recommendation-loading" role="status" aria-live="polite" aria-atomic="true" aria-label={prompt}>
      <div className="recommendation-loading__status">
        <div className="recommendation-loading__record" aria-hidden="true">
          <span className="recommendation-loading__groove" />
          <span className="recommendation-loading__label" />
        </div>
        <div>
          <p key={prompt} className="recommendation-loading__message text-sm font-serif text-[var(--text-primary)]">{prompt}</p>
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

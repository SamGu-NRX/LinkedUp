import React from 'react';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  // Component logic and JSX here
  return (
    <div>
      <p>{message}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  );
}

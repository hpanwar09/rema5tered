import { useState } from 'react';
import GuessGame from './GuessGame';

const isDev = import.meta.env.DEV;

export default function GuessTabs() {
  const [resetKey, setResetKey] = useState(0);

  const handleReset = () => {
    localStorage.removeItem('guess-game');
    setResetKey((k) => k + 1);
  };

  return (
    <div>
      <GuessGame key={resetKey} />

      {isDev && (
        <div className="fixed bottom-4 right-4">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 bg-ember/80 hover:bg-ember rounded text-xs font-display text-white"
          >
            reset game
          </button>
        </div>
      )}
    </div>
  );
}

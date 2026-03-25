import { useState, useEffect, useRef, useCallback } from 'react';

interface Movie {
  id: number;
  title: string;
  year: string;
  posterUrl: string | null;
}

type LevelResult = 'pending' | 'won' | 'lost';

interface GameState {
  date: string;
  levels: {
    guesses: string[];
    result: LevelResult;
  }[];
  currentLevel: number;
}

const LEVELS = ['easy', 'medium', 'hard'] as const;
const GUESSES_PER_LEVEL = 4;
const PIXEL_LEVELS = [48, 32, 20, 12];
const POSTER_W = 300;
const POSTER_H = 450;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function emptyLevels() {
  return LEVELS.map(() => ({ guesses: [] as string[], result: 'pending' as LevelResult }));
}

function loadState(): GameState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('guess-game');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.date || !Array.isArray(parsed.levels) || parsed.levels.length !== 3) {
      localStorage.removeItem('guess-game');
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem('guess-game');
    return null;
  }
}

function saveState(state: GameState) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('guess-game', JSON.stringify(state));
}

function pixelate(canvas: HTMLCanvasElement, img: HTMLImageElement, blockSize: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = POSTER_W;
  canvas.height = POSTER_H;

  if (blockSize <= 1) {
    ctx.drawImage(img, 0, 0, POSTER_W, POSTER_H);
    return;
  }

  const sw = Math.ceil(POSTER_W / blockSize);
  const sh = Math.ceil(POSTER_H / blockSize);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, sw, sh);
  ctx.drawImage(canvas, 0, 0, sw, sh, 0, 0, POSTER_W, POSTER_H);
}

export default function GuessGame() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = loadState();
    if (saved && saved.date === todayUTC()) return saved;
    return { date: todayUTC(), levels: emptyLevels(), currentLevel: 0 };
  });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Movie[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const level = gameState.currentLevel;
  const levelData = gameState.levels[level];
  const movie = movies[level] ?? null;
  const isGameOver = level >= 3;
  const isLevelDone = levelData?.result !== 'pending';
  const isPlaying = !loading && !isGameOver && !isLevelDone;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/daily-movie');
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`${res.status}: ${body || 'Failed to load'}`);
        }
        const data: Movie[] = await res.json();
        if (cancelled) return;

        setMovies(data);
        setLoading(false);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'could not load today\u2019s movies');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const drawPoster = useCallback(() => {
    if (!movie?.posterUrl || !canvasRef.current) return;

    const draw = (img: HTMLImageElement) => {
      const isRevealed = isLevelDone || isGameOver;
      const guessCount = levelData?.guesses.length ?? 0;
      const blockSize = isRevealed ? 1 : (PIXEL_LEVELS[guessCount] ?? 8);
      pixelate(canvasRef.current!, img, blockSize);
    };

    if (imgRef.current?.src !== movie.posterUrl) {
      imgRef.current = null;
    }

    if (imgRef.current) {
      draw(imgRef.current);
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imgRef.current = img;
        draw(img);
      };
      img.src = movie.posterUrl;
    }
  }, [movie, levelData?.guesses.length, isLevelDone, isGameOver]);

  useEffect(() => {
    drawPoster();
  }, [drawPoster]);

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-movies?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data: Movie[] = await res.json();
          setSuggestions(data);
          setShowSuggestions(true);
          setHighlightIdx(-1);
        }
      } catch {
        /* swallow */
      }
    }, 250);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  const submitGuess = (title: string) => {
    if (!isPlaying || !movie) return;

    const newGuesses = [...levelData.guesses, title];
    const isCorrect = normalise(title) === normalise(movie.title);
    const isExhausted = newGuesses.length >= GUESSES_PER_LEVEL;
    const result: LevelResult = isCorrect ? 'won' : isExhausted ? 'lost' : 'pending';

    const newLevels = [...gameState.levels];
    newLevels[level] = { guesses: newGuesses, result };

    const newState: GameState = {
      ...gameState,
      levels: newLevels,
      currentLevel: gameState.currentLevel,
    };

    setGameState(newState);
    saveState(newState);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (!isLevelDone || isGameOver) return;

    const timer = setTimeout(() => {
      const nextLevel = level + 1;
      if (nextLevel < 3) {
        const newState = { ...gameState, currentLevel: nextLevel };
        setGameState(newState);
        saveState(newState);
        imgRef.current = null;
      } else {
        const newState = { ...gameState, currentLevel: 3 };
        setGameState(newState);
        saveState(newState);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isLevelDone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.parentElement?.parentElement?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (error) {
    return <div className="text-ember text-sm">{error}</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[450px]">
        <div className="text-surface-500 font-display text-sm animate-pulse">loading today&apos;s movies…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {!isGameOver && (
        <div className="relative">
          <div className="absolute right-full mr-3 top-0 flex flex-col items-end gap-2">
            {LEVELS.map((name, i) => {
              const lvl = gameState.levels[i];
              let colorClass = 'text-surface-600';
              if (i === level && !isGameOver) colorClass = 'text-white';
              if (lvl.result === 'won') colorClass = 'text-green-400';
              if (lvl.result === 'lost') colorClass = 'text-accent';

              return (
                <span
                  key={name}
                  className={`font-display font-medium ${i === level && !isGameOver ? 'text-sm opacity-100' : 'text-xs opacity-30'} ${colorClass}`}
                >
                  {name}
                  {lvl.result === 'won' ? ' ✓' : lvl.result === 'lost' ? ' ✗' : ''}
                </span>
              );
            })}
          </div>

          <canvas
            ref={canvasRef}
            width={POSTER_W}
            height={POSTER_H}
            className="rounded-lg shadow-lg shadow-surface-950/60"
            style={{
              width: POSTER_W,
              height: POSTER_H,
              imageRendering: isLevelDone || isGameOver ? 'auto' : 'pixelated',
            }}
          />
        </div>
      )}

      {isPlaying && (
        <p className="text-accent text-sm font-display">
          guesses left: <span className="text-surface-50">{GUESSES_PER_LEVEL - (levelData?.guesses.length ?? 0)}</span>
        </p>
      )}

      {isLevelDone && !isGameOver && (
        <p className="font-display font-bold text-fluid-lg text-surface-50 text-center animate-fade-in">
          {movie!.title} ({movie!.year})
        </p>
      )}

      {isGameOver && (
        <div className="animate-fade-in">
          <div className="flex gap-4 justify-center">
            {movies.map((m, i) => {
              const lvl = gameState.levels[i];
              return (
                <div key={m.id} className="flex flex-col items-center gap-2">
                  {m.posterUrl && (
                    <img
                      src={m.posterUrl}
                      alt={m.title}
                      className="rounded-lg shadow-lg shadow-surface-950/60"
                      style={{ width: POSTER_W, height: POSTER_H, objectFit: 'cover' }}
                    />
                  )}
                  <span
                    className={`text-xs font-display font-medium ${
                      lvl.result === 'won' ? 'text-green-400' : 'text-accent'
                    }`}
                  >
                    {LEVELS[i]} {lvl.result === 'won' ? '✓' : '✗'}
                  </span>
                  <span className="font-display text-xs text-surface-50 text-center">
                    {m.title} ({m.year})
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-surface-500 text-sm font-display mt-8 text-center italic">
            tomorrow is another day.
            <span className="block text-surface-600 text-xs mt-1 not-italic">— gone with the wind, 1939</span>
          </p>
        </div>
      )}

      {isPlaying && (
        <div style={{ width: POSTER_W }}>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && showSuggestions && suggestions.length > 0) {
                  e.preventDefault();
                  setHighlightIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
                } else if (e.key === 'ArrowUp' && showSuggestions) {
                  e.preventDefault();
                  setHighlightIdx((prev) => Math.max(prev - 1, 0));
                } else if (e.key === 'Enter') {
                  if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
                    submitGuess(suggestions[highlightIdx].title);
                    setSuggestions([]);
                    setShowSuggestions(false);
                    setHighlightIdx(-1);
                  } else if (query.trim()) {
                    submitGuess(query.trim());
                  }
                } else if (e.key === 'Escape') {
                  setShowSuggestions(false);
                  setHighlightIdx(-1);
                }
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="guess here"
              className="w-full bg-transparent border-b border-surface-700 px-1 py-2 text-surface-200 font-display text-sm placeholder:text-surface-600 focus:outline-none focus:border-surface-400 transition-colors"
            />

            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-20 top-full mt-1 w-full bg-surface-900 border border-surface-700 rounded-lg overflow-hidden shadow-xl max-h-60 overflow-y-auto">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(s.title);
                        setSuggestions([]);
                        setShowSuggestions(false);
                        inputRef.current?.focus();
                      }}
                      className={`w-full text-left px-4 py-2.5 transition-colors ${
                        suggestions.indexOf(s) === highlightIdx ? 'bg-surface-800' : 'hover:bg-surface-800'
                      }`}
                    >
                      <span className="font-display text-sm text-surface-200">
                        {s.title} <span className="text-surface-500">({s.year})</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {levelData && levelData.guesses.length > 0 && !isGameOver && (
        <div className="w-full max-w-sm space-y-2">
          {[...levelData.guesses].reverse().map((g, i) => {
            const isCorrect = movie ? normalise(g) === normalise(movie.title) : false;
            const guessNum = levelData.guesses.length - i;

            return (
              <div
                key={`${level}-${guessNum}`}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-display ${
                  isCorrect
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                    : 'bg-accent/10 border border-accent/30 text-accent'
                }`}
              >
                <span className="text-xs w-5 text-center opacity-50">{guessNum}</span>
                <span>{g}</span>
                {isCorrect && <span className="ml-auto">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

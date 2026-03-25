const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export interface TMDBMovie {
  id: number;
  title: string;
  year: string;
  posterUrl: string | null;
}

interface TMDBMovieResult {
  id: number;
  title: string;
  release_date?: string;
  poster_path: string | null;
  popularity: number;
}

function getToken(): string {
  const token = import.meta.env.TMDB_API_TOKEN;
  if (!token) throw new Error('TMDB_API_TOKEN not set');
  return token;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  };
}

function toMovie(m: TMDBMovieResult): TMDBMovie {
  return {
    id: m.id,
    title: m.title,
    year: m.release_date?.slice(0, 4) ?? '',
    posterUrl: m.poster_path ? `${TMDB_IMAGE_BASE}/w500${m.poster_path}` : null,
  };
}

async function fetchWithRetry(url: string, opts: RequestInit, retries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.ok) return res;

      if (res.status >= 400 && res.status < 500) return res;
    } catch (err) {
      if (attempt === retries) throw err;
    }

    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }

  throw new Error('fetch failed after retries');
}

let dailyCache: { date: string; movies: TMDBMovie[] } | null = null;

function hashDate(dateStr: string): number {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const DIFFICULTY_POOLS = [
  { min: 1, max: 5 },
  { min: 5, max: 25 },
  { min: 25, max: 100 },
] as const;

async function pickMovie(dateStr: string, salt: string, minPage: number, maxPage: number): Promise<TMDBMovie> {
  const hash = hashDate(`${salt}-${dateStr}`);
  const pageRange = maxPage - minPage;
  const page = (hash % pageRange) + minPage;
  const index = (hash >> 8) % 20;

  const url = `${TMDB_BASE}/discover/movie?sort_by=popularity.desc&include_adult=false&include_video=false&language=en-US&page=${page}&vote_count.gte=200`;

  const res = await fetchWithRetry(url, { headers: headers() });
  if (!res.ok) throw new Error(`TMDB discover failed: ${res.status}`);

  const data = await res.json();
  const results: TMDBMovieResult[] = data.results ?? [];

  if (results.length === 0) throw new Error('No movies returned from TMDB');

  let movie = results[index % results.length];

  if (!movie.poster_path) {
    const fallback = results.find((m) => m.poster_path);
    if (fallback) movie = fallback;
  }

  return toMovie(movie);
}

export async function getDailyMovies(): Promise<TMDBMovie[]> {
  const today = new Date().toISOString().slice(0, 10);

  if (dailyCache && dailyCache.date === today) {
    return dailyCache.movies;
  }

  const movies = await Promise.all(
    DIFFICULTY_POOLS.map((pool, i) => pickMovie(today, `level-${i}`, pool.min, pool.max)),
  );

  dailyCache = { date: today, movies };
  return movies;
}

export async function searchMovies(query: string): Promise<TMDBMovie[]> {
  if (!query.trim()) return [];

  const url = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;

  const res = await fetchWithRetry(url, { headers: headers() });
  if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);

  const data = await res.json();
  const results: TMDBMovieResult[] = data.results ?? [];

  return results
    .filter((m) => m.poster_path)
    .slice(0, 10)
    .map(toMovie);
}

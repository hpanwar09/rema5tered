import type { APIRoute } from 'astro';
import { getDailyMovies } from '../../lib/tmdb';

function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCDate(midnight.getUTCDate() + 1);
  midnight.setUTCHours(0, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

export const GET: APIRoute = async () => {
  try {
    const movies = await getDailyMovies();
    const ttl = secondsUntilMidnightUTC();

    return new Response(JSON.stringify(movies), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=60`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch daily movie';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

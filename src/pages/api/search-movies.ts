import type { APIRoute } from 'astro';
import { searchMovies } from '../../lib/tmdb';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q') ?? '';

  if (query.length < 2) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const results = await searchMovies(query);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Search failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

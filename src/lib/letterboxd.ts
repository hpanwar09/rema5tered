export interface LetterboxdFilm {
  title: string;
  year: string;
  rating: number | null;
  liked: boolean;
  watchedDate: string;
  rewatch: boolean;
  tmdbId: string | null;
  posterUrl: string | null;
  review: string | null;
  letterboxdUrl: string;
  filmPageUrl: string;
}

/**
 * Fetch and parse a Letterboxd user's RSS feed.
 * Returns ~50 most recent watches.
 * Runs server-side only — never in browser.
 */
export async function fetchLetterboxdFeed(
  username: string
): Promise<LetterboxdFilm[]> {
  const url = `https://letterboxd.com/${username}/rss/`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'rema5tered/1.0' },
  });

  if (!res.ok) {
    throw new Error(`Letterboxd RSS fetch failed: ${res.status}`);
  }

  const xml = await res.text();
  return parseRSS(xml);
}

function parseRSS(xml: string): LetterboxdFilm[] {
  const items: LetterboxdFilm[] = [];
  const itemBlocks = xml.split('<item>').slice(1); // skip channel header

  for (const block of itemBlocks) {
    const film = parseItem(block);
    if (film) items.push(film);
  }

  return items;
}

function parseItem(block: string): LetterboxdFilm | null {
  const title = extractTag(block, 'letterboxd:filmTitle');
  if (!title) return null;

  const year = extractTag(block, 'letterboxd:filmYear') ?? '';
  const ratingStr = extractTag(block, 'letterboxd:memberRating');
  const liked = extractTag(block, 'letterboxd:memberLike') === 'Yes';
  const watchedDate = extractTag(block, 'letterboxd:watchedDate') ?? '';
  const rewatch = extractTag(block, 'letterboxd:rewatch') === 'Yes';
  const tmdbId = extractTag(block, 'tmdb:movieId');
  const letterboxdUrl = extractTag(block, 'link') ?? '';
  // Transform user log URL to film page URL
  // https://letterboxd.com/rema5tered/film/the-iron-giant/ → https://letterboxd.com/film/the-iron-giant/
  const filmSlug = letterboxdUrl.match(/\/film\/(.+)/)?.[1] ?? '';
  const filmPageUrl = filmSlug ? `https://letterboxd.com/film/${filmSlug}` : letterboxdUrl;

  // Extract poster URL and review from CDATA description
  const description = extractCDATA(block);
  const posterUrl = extractPosterFromDescription(description);
  const review = extractReviewFromDescription(description);

  return {
    title,
    year,
    rating: ratingStr ? parseFloat(ratingStr) : null,
    liked,
    watchedDate,
    rewatch,
    tmdbId,
    posterUrl,
    review,
    letterboxdUrl,
    filmPageUrl,
  };
}

function extractTag(block: string, tag: string): string | null {
  // Handle self-closing tags
  const selfClose = new RegExp(`<${tag}\\s*/>`);
  if (selfClose.test(block)) return null;

  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const match = block.match(regex);
  return match ? decodeXMLEntities(match[1].trim()) : null;
}

function extractCDATA(block: string): string {
  const match = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
  return match ? match[1].trim() : '';
}

function extractPosterFromDescription(description: string): string | null {
  const match = description.match(/<img\s+src="([^"]+)"/);
  return match ? match[1] : null;
}

function extractReviewFromDescription(description: string): string | null {
  // Remove the img tag, then extract remaining <p> text
  const withoutImg = description.replace(/<p><img[^>]*\/><\/p>/, '').trim();

  // Extract text from remaining <p> tags
  const paragraphs: string[] = [];
  const pRegex = /<p>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = pRegex.exec(withoutImg)) !== null) {
    const text = match[1]
      .replace(/<[^>]+>/g, '') // strip HTML tags
      .trim();
    // Skip "Watched on..." auto-generated text
    if (text && !text.startsWith('Watched on')) {
      paragraphs.push(text);
    }
  }

  return paragraphs.length > 0 ? paragraphs.join('\n') : null;
}

function decodeXMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Format a star rating as emoji stars.
 * 4.5 → "★★★★½"
 */
export function formatRating(rating: number): string {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return '★'.repeat(full) + (half ? '½' : '');
}

/**
 * Format watched date relative to now.
 * "2026-03-20" → "Mar 20" or "Mar 20, 2025" if different year
 */
export function formatWatchedDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

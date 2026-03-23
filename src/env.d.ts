/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly TMDB_API_TOKEN: string;
  readonly TMDB_API_KEY: string;
  readonly LETTERBOXD_USERNAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

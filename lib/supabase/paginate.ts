// ─── Pagination helper for tables above the project's row cap ────────────────
//
// Supabase/PostgREST on this project clamps every response to 1,000 rows
// server-side — confirmed empirically, not assumed: a request for 500 rows
// correctly returns 500, but a request for 9,999 (via .range(0, 9999)) still
// only returns 1,000. A client-side .range() can request FEWER rows than the
// server's max, never more, so a single .range() call can never fetch a
// table above 1,000 rows here. The only reliable fix is to page through it.
//
// No Supabase client import here — pure pagination logic, safe to use from
// both server files (next/headers-based clients) and client components.

const PAGE_SIZE = 1000

export async function fetchAllPages<T>(
  // PromiseLike, not Promise — Supabase's query builder is a thenable it
  // builds up via chained calls (.select().order().range()...), not an
  // actual Promise instance, so it only structurally satisfies PromiseLike.
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<{ data: T[] | null; error: unknown }> {
  const all: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return { data: all, error: null }
}

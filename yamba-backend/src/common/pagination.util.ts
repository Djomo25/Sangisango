export interface OptionsPagination {
  limit: number;
  offset: number;
}

const LIMITE_PAR_DEFAUT = 20;
const LIMITE_MAX = 100;

/** Parse les query params limit/offset (chaînes ou undefined) en pagination sûre. */
export function parserPagination(limitRaw?: string, offsetRaw?: string): OptionsPagination {
  const limitParsed = parseInt(limitRaw ?? '', 10);
  const offsetParsed = parseInt(offsetRaw ?? '', 10);

  const limit = Math.min(
    Math.max(Number.isFinite(limitParsed) ? limitParsed : LIMITE_PAR_DEFAUT, 1),
    LIMITE_MAX,
  );
  const offset = Math.max(Number.isFinite(offsetParsed) ? offsetParsed : 0, 0);

  return { limit, offset };
}

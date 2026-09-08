import { useEffect, useState } from 'react';
import { parseSlugParam } from '../utils/slug';
import { peekEntityId, resolveEntityId } from '../services/entityLinks';

/**
 * Turns a `title-code` URL segment into the record's real id. Navigating from
 * a list answers synchronously off the primed cache; a cold load or a shared
 * link falls back to a lookup request.
 */
export default function useEntityId(kind, param) {
  const code = param ? parseSlugParam(param) : null;
  const known = peekEntityId(kind, code);
  const [resolved, setResolved] = useState({
    code: null,
    id: null,
    failed: false,
  });

  useEffect(() => {
    if (!code || known) return undefined;

    let cancelled = false;
    resolveEntityId(kind, code)
      .then((id) => {
        if (!cancelled) setResolved({ code, id, failed: !id });
      })
      .catch(() => {
        if (!cancelled) setResolved({ code, id: null, failed: true });
      });

    return () => {
      cancelled = true;
    };
  }, [kind, code, known]);

  // A result from a previous segment must not leak into the current one.
  const current = resolved.code === code ? resolved : null;
  const id = known || current?.id || null;
  const notFound = Boolean(current?.failed);

  return {
    id,
    code,
    notFound,
    resolving: Boolean(code) && !id && !notFound,
  };
}

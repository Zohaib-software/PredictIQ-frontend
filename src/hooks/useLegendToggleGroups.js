import { useState, useCallback, useMemo } from 'react';

/**
 * Legend click toggles visibility by dataKey. Each value in `legendGroups` is a list of keys
 * that hide/show together (use a single-element array for independent series).
 * Pass a stable `legendGroups` object (e.g. module-level const) so the hook deps stay stable.
 * For charts where hiding the actual series should also hide its projection line, use
 * `projectedLineHidden` / `legendEntryDimmed` from `utils/chartLegendVisibility` on projected Lines and the Legend formatter.
 *
 * @param {Record<string, string[]>} legendGroups - group id -> dataKeys toggled together on legend click
 */
export function useLegendToggleGroups(legendGroups) {
  const [hidden, setHidden] = useState(() => new Set());

  const keyToGroup = useMemo(() => {
    const m = new Map();
    for (const keys of Object.values(legendGroups)) {
      keys.forEach((k) => m.set(String(k), keys.map(String)));
    }
    return m;
  }, [legendGroups]);

  const onLegendClick = useCallback(
    (e) => {
      const dk =
        e?.dataKey != null
          ? String(e.dataKey)
          : e?.payload?.dataKey != null
            ? String(e.payload.dataKey)
            : null;
      if (!dk) return;
      const group = keyToGroup.get(dk) || [dk];
      setHidden((prev) => {
        const next = new Set(prev);
        const allHidden = group.every((k) => next.has(k));
        if (allHidden) group.forEach((k) => next.delete(k));
        else group.forEach((k) => next.add(k));
        return next;
      });
    },
    [keyToGroup]
  );

  return { hidden, onLegendClick };
}

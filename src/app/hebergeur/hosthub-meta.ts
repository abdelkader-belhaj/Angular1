/** Données étendues stockées en fin de description (compatible API existante). */
export const HOSTHUB_META_MARKER = '__HOSTHUB_META__';

export interface HostHubMeta {
  nbChambres?: number;
  surfaceM2?: number;
  equipements?: string[];
  maintenance?: boolean;
}

export function stripHostHubMeta(description: string | undefined): string {
  if (!description) return '';
  const cut = description.indexOf(HOSTHUB_META_MARKER);
  if (cut === -1) return description.trim();
  return description.slice(0, cut).trim();
}

export function parseHostHubMeta(description: string | undefined): HostHubMeta {
  if (!description || !description.includes(HOSTHUB_META_MARKER)) {
    return {};
  }
  const start = description.indexOf(HOSTHUB_META_MARKER) + HOSTHUB_META_MARKER.length;
  const jsonPart = description.slice(start).trim();
  try {
    return JSON.parse(jsonPart) as HostHubMeta;
  } catch {
    return {};
  }
}

export function mergeDescriptionWithMeta(visibleText: string, meta: HostHubMeta): string {
  const base = (visibleText || '').trim();
  const filled: HostHubMeta = {
    ...meta,
    equipements: meta.equipements?.length ? meta.equipements : undefined
  };
  const json = JSON.stringify(filled);
  return `${base}\n\n${HOSTHUB_META_MARKER}${json}`;
}

export type HostLogementStatus = 'disponible' | 'occupe' | 'maintenance';

export function getHostLogementStatus(disponible: boolean, description?: string): HostLogementStatus {
  const meta = parseHostHubMeta(description);
  if (meta.maintenance) return 'maintenance';
  if (disponible) return 'disponible';
  return 'occupe';
}

export type ReclamationPriorite = 'urgent' | 'normale' | 'tres_urgent';
export type ReclamationStatut = 'ouverte' | 'repondue';

export interface ReclamationCreateRequest {
  reservationId?: number | null;
  priorite: ReclamationPriorite;
  sujet: string;
}

export interface ReclamationResponse {
  id: number;
  reservationId?: number | null;
  reservationReference?: string | null;
  touristeEmail?: string | null;
  priorite: ReclamationPriorite | string;
  statut: ReclamationStatut | string;
  sujet: string;
  reponse?: string | null;
  dateCreation: string;
  dateReponse?: string | null;
  clientLu?: boolean;
}

export interface UnreadCountResponse {
  unread: number;
}
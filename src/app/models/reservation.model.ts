import { Vol } from './vol.model';

export type TypeBillet = 'aller_simple' | 'aller_retour';
export type StatutPaiement = 'en_attente' | 'paye' | 'echec' | 'annule' | 'rembourse';
export type StatutReservation = 'active' | 'annulee';

export interface ReservationRequest {
  volAllerId: number;
  volRetourId?: number | null;
  typeBillet: TypeBillet;
  nbPassagers: number;
}

export interface PaiementRequest {
  reservationId: number;
  methode: string;
}

export interface ReservationResponse {
  id: number;
  reference: string;
  touristeEmail: string;
  volAller: Vol;
  volRetour?: Vol | null;
  typeBillet: TypeBillet;
  nbPassagers: number;
  prixTotal: number;
  dateReservation: string;
  statutPaiement: StatutPaiement;
  statutReservation: StatutReservation;
}
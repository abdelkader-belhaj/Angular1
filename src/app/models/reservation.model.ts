import { Vol } from './vol.model';

export type TypeBillet = 'aller_simple' | 'aller_retour';
export type StatutPaiement = 'en_attente' | 'paye' | 'echec' | 'annule' | 'rembourse';
export type StatutReservation = 'active' | 'annulee' | 'archivee';

export interface ReservationRequest {
  volAllerId: number;
  volRetourId?: number | null;
  typeBillet: TypeBillet;
  nbPassagers: number;
  offreCode?: string;
}

export interface PaiementRequest {
  reservationId: number;
  methode: string;
  paymentMethodId: string;
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
  prixInitial: number; // ← NOUVEAU
  dateReservation: string;
  statutPaiement: StatutPaiement;
  statutReservation: StatutReservation;
  bonusApplique?: boolean;
  remiseBonus?: number;
  offre?: any;
}

export interface QrCodeVolResponse {
  id: number;
  reservationId: number;
  reference: string;
  contenu: string;
  imageBase64: string;
  dateGeneration: string;
}
// src/app/features/transport/core/models/paiement.model.ts
import { Course } from './course.model';
import { PaiementMethode, PaiementStatut, PaiementType } from './enums';
import { ReservationLocation } from './reservation-location.model';

export interface PaiementTransport {
  idPaiement: number;
  course?: Course;
  reservationLocation?: ReservationLocation;
  montantTotal: number;
  montantCommission: number;
  montantNet: number;
  methode: PaiementMethode;
  statut: PaiementStatut;
  typePaiement: PaiementType;
  datePaiement?: string;
  dateCreation?: string;
  dateModification?: string;
}

export interface PaiementChauffeur {
  idPaiement: number;
  montantNet: number;
  methode: PaiementMethode;
  datePaiement: string;
  typePaiement: PaiementType;
  description?: string;
}

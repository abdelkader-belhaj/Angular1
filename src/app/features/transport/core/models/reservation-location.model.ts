// src/app/features/transport/core/models/reservation-location.model.ts
import { User } from './user.model';
import { VehiculeAgence } from './VehiculeAgence.model';
import { AgenceLocation } from './AgenceLocation.model';
import {
  ReservationStatus,
  DepositStatus,
  LicenseStatus,
  TypeVehicule,
} from './enums';
import { PaiementTransport } from './paiement.model';

export interface ReservationLocation {
  idReservation: number;
  client: User;
  prenom?: string;
  nom?: string;
  dateNaiss?: string;
  clientId?: number;
  vehiculeAgence: VehiculeAgence;
  vehiculeAgenceId?: number;
  agenceLocation?: AgenceLocation;
  dateDebut: string;
  dateFin: string;
  typeVehiculeDemande?: TypeVehicule;
  note?: string;
  prixTotal: number;
  advanceAmount?: number;
  depositAmount?: number;
  montantCommission?: number;
  depositStatus?: DepositStatus;
  statut: ReservationStatus;
  paymentPhase?:
    | 'DRAFT'
    | 'ADVANCE_PENDING'
    | 'ADVANCE_PAID'
    | 'VERIFICATION_PENDING'
    | 'CONFIRMED_PENDING_FINAL_PAYMENT'
    | 'FINAL_PAID'
    | 'ACTIVE'
    | 'COMPLETED'
    | 'CANCELLED';
  advanceStatus?: 'PENDING' | 'HELD' | 'PAID' | 'FAILED';
  paymentIntentId?: string;
  numeroPermis?: string;
  licenseExpiryDate?: string;
  licenseImageUrl?: string;
  licenseStatus?: LicenseStatus;
  licenseRejectionReason?: string;
  rejectionReason?: string;
  licenseAiValid?: boolean;
  licenseAiNumeroMatch?: boolean;
  licenseAiDateMatch?: boolean;
  licenseAiExtractedNumero?: string;
  licenseAiExtractedDate?: string;
  licenseAiMessage?: string;
  licenseAiCheckedAt?: string;
  dateCreation?: string;
  dateModification?: string;
  paiementTransport?: PaiementTransport;
}

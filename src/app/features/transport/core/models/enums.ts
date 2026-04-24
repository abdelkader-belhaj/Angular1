// src/app/features/transport/core/models/enums.ts

export enum Role {
  ADMIN = 'ADMIN',
  CLIENT_TOURISTE = 'CLIENT_TOURISTE',
  HEBERGEUR = 'HEBERGEUR',
  TRANSPORTEUR = 'TRANSPORTEUR',
  AIRLINE_PARTNER = 'AIRLINE_PARTNER',
  ORGANISATEUR_ACTIV = 'ORGANISATEUR_ACTIV',
  ORGANISATEUR_EVNT = 'ORGANISATEUR_EVNT',
  VENDEUR_ARTI = 'VENDEUR_ARTI',
  SOCIETE = 'SOCIETE',
}

// Chauffeur Enums
export enum ChauffeurStatut {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum DisponibiliteStatut {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  ON_RIDE = 'ON_RIDE',
}

// Course Enums
export enum CourseStatus {
  ACCEPTED = 'ACCEPTED',
  STARTED = 'STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum DemandeStatus {
  PENDING = 'PENDING',
  MATCHING = 'MATCHING',
  ACCEPTED = 'ACCEPTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum ConfirmationClientStatut {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export enum TypeVehicule {
  ECONOMY = 'ECONOMY',
  PREMIUM = 'PREMIUM',
  VAN = 'VAN',
}

export enum VehiculeStatut {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

// Matching Enums
export enum MatchingStatut {
  PROPOSED = 'PROPOSED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

// Paiement Enums
export enum PaiementMethode {
  CASH = 'CASH',
  CARD = 'CARD',
  WALLET = 'WALLET',
}

export enum PaiementStatut {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export enum PaiementType {
  COURSE = 'COURSE',
  RESERVATION_LOCATION = 'RESERVATION_LOCATION',
}

export enum TransactionType {
  CREDIT_COURSE = 'CREDIT_COURSE',
  CREDIT_RESERVATION = 'CREDIT_RESERVATION',
  CREDIT_COMMISSION = 'CREDIT_COMMISSION',
  DEBIT_PAYOUT = 'DEBIT_PAYOUT',
}

// Evaluation Enums
export enum EvaluationType {
  CLIENT_TO_DRIVER = 'CLIENT_TO_DRIVER',
  DRIVER_TO_CLIENT = 'DRIVER_TO_CLIENT',
}

// Annulation Enums
export enum AnnulePar {
  CLIENT = 'CLIENT',
  CHAUFFEUR = 'CHAUFFEUR',
  SYSTEM = 'SYSTEM',
}

// Location Enums
export enum ReservationStatus {
  PENDING = 'PENDING',
  DRAFT = 'DRAFT',
  KYC_PENDING = 'KYC_PENDING',
  DEPOSIT_HELD = 'DEPOSIT_HELD',
  CONTRACT_SIGNED = 'CONTRACT_SIGNED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  CHECKOUT_PENDING = 'CHECKOUT_PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  CANCELLED_BY_AGENCY = 'CANCELLED_BY_AGENCY',
}

export enum DepositStatus {
  PENDING = 'PENDING',
  HELD = 'HELD',
  RELEASED = 'RELEASED',
  FORFEITED = 'FORFEITED',
}

export enum LicenseStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

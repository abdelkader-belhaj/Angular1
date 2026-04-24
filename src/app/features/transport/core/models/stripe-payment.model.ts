/**
 * Modèles TypeScript pour l'intégration Stripe - Course Transport
 * À ajouter aux modèles existants du projet
 */

export interface PaymentIntentResponse {
  clientSecret: string; // Secret Stripe pour confirmer le paiement
  paymentIntentId: string; // ID unique Stripe
  montant: number; // Montant total payé par client (TND)
  montantCommission: number; // Commission plateforme (TND)
  montantNet: number; // Montant pour chauffeur (TND)
  paiementId: number; // ID du paiement en DB
  courseId: number; // ID de la course
}

export interface ConfirmPaymentRequest {
  courseId: number; // ID de la course
  paymentIntentId: string; // ID du PaymentIntent Stripe
}

export interface PaymentResult {
  success: boolean; // Succès ou erreur
  message: string; // Message utilisateur
  paiement?: any; // Objet paiement (si succès)
  error?: string; // Description erreur
  paymentIntentId?: string; // ID Stripe (si succès)
  paymentIntent?: any; // Objet PaymentIntent Stripe (debug)
}

export interface PaiementTransport {
  idPaiement: number; // ID du paiement
  montantTotal: number; // Total payé
  montantCommission: number; // Commission plateforme
  montantNet: number; // Montant chauffeur
  statut: PaiementStatut; // PENDING, COMPLETED, REFUNDED, FAILED
  methode: PaiementMethode; // CASH, CARD, WALLET
  datePaiement: string; // DateTime ISO 8601
  dateCreation: string; // DateTime ISO 8601
  dateModification: string; // DateTime ISO 8601
}

export enum PaiementStatut {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export enum PaiementMethode {
  CASH = 'CASH',
  CARD = 'CARD',
  WALLET = 'WALLET',
}

export interface StripePaymentEvent {
  type:
    | 'init'
    | 'form_loaded'
    | 'processing'
    | 'success'
    | 'error'
    | 'cancelled';
  timestamp: Date;
  courseId: number;
  data?: any;
  error?: string;
}

/**
 * Extension du modèle Course pour inclure paiement
 */
export interface CourseWithPayment {
  // Propriétés Course existantes
  idCourse: number;
  prixFinal: number;
  statut: CourseStatus;
  // Propriétés paiement ajoutées
  paiementTransport?: PaiementTransport;
  prixEstime?: number;
  montantCommission?: number;
}

export enum CourseStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  STARTED = 'STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

// src/app/features/transport/core/models/wallet-transaction.model.ts
import { TransactionType } from './enums';

export interface WalletTransaction {
  id?: number;
  chauffeur?: { idChauffeur?: number; id?: number };
  agence?: { idAgence?: number; id?: number; nomAgence?: string };
  paiementTransport?: { idPaiement?: number; id?: number };
  chauffeurId?: number;
  agenceId?: number;
  montant: number;
  type: TransactionType;
  description?: string;
  paiementId?: number;
  dateTransaction?: string;
}

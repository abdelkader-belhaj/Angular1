import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../../../services/auth.service';
import {
  AgenceLocation,
  TransactionType,
  WalletTransaction,
} from '../../../core/models';
import { LocationService } from '../../../core/services/location.service';
import { WalletService } from '../../../core/services/wallet.service';

@Component({
  selector: 'app-portefeuille-agence',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portefeuille-agence.component.html',
  styleUrl: './portefeuille-agence.component.css',
})
export class PortefeuilleAgenceComponent implements OnInit {
  agency: AgenceLocation | null = null;
  transactions: WalletTransaction[] = [];
  isLoading = false;
  error = '';

  constructor(
    private readonly locationService: LocationService,
    private readonly walletService: WalletService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    const userId = this.authService.getCurrentUser()?.id;

    if (!userId) {
      this.error = 'Aucune session détectée.';
      return;
    }

    this.isLoading = true;
    this.locationService
      .resolveAgencyByUserId(userId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (agency) => {
          this.agency = agency;

          if (!this.agency) {
            this.error = 'Agence introuvable.';
            return;
          }

          this.walletService
            .getAgenceTransactions(this.agency.idAgence)
            .subscribe({
              next: (transactions) => {
                const list = transactions ?? [];
                this.transactions = [...list].sort((a, b) => {
                  const ta = new Date(a.dateTransaction ?? 0).getTime();
                  const tb = new Date(b.dateTransaction ?? 0).getTime();
                  return tb - ta;
                });
              },
              error: (error) => {
                this.error =
                  error?.message ||
                  'Impossible de charger le portefeuille. Les transactions sont temporairement indisponibles.';
                this.transactions = [];
              },
            });
        },
        error: (error) => {
          this.error = error?.message || 'Impossible de charger votre agence.';
        },
      });
  }

  get confirmedRevenue(): number {
    return this.transactions
      .filter((tx) => this.isCreditType(tx.type))
      .reduce((total, tx) => total + this.parseMontant(tx.montant), 0);
  }

  get pendingRevenue(): number {
    return this.transactions
      .filter((tx) => this.isDebitType(tx.type))
      .reduce((total, tx) => total + this.parseMontant(tx.montant), 0);
  }

  get completedCount(): number {
    return this.transactions.length;
  }

  getTypeLabel(type: TransactionType): string {
    const value = String(type || '').toUpperCase();
    switch (value) {
      case 'CREDIT_COURSE':
        return 'Crédit course';
      case 'CREDIT_RESERVATION':
        return 'Crédit réservation';
      case 'CREDIT_COMMISSION':
        return 'Crédit commission';
      case 'DEBIT_PAYOUT':
        return 'Débit payout';
      default:
        return value || 'Inconnu';
    }
  }

  isCredit(type: TransactionType): boolean {
    return this.isCreditType(type);
  }

  private isCreditType(type: TransactionType): boolean {
    return String(type || '')
      .toUpperCase()
      .startsWith('CREDIT');
  }

  private isDebitType(type: TransactionType): boolean {
    return String(type || '')
      .toUpperCase()
      .startsWith('DEBIT');
  }

  /** Montants API parfois en chaîne ; aligné sur `montant_net` côté wallet. */
  parseMontant(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
}

import { Injectable } from '@angular/core';
import { AuthService } from '../auth.service';

export interface PaymentReceipt {
  reservationId: number;
  logementId: number;
  logementName: string;
  amountInCents: number;
  currency: string;
  displayCurrency: 'DT';
  paidAtIso: string;
  paymentIntentId: string;
  customerFullName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  country: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentRecordsService {
  constructor(private readonly authService: AuthService) {}

  getAllReceiptsAllUsers(): PaymentReceipt[] {
    const all: PaymentReceipt[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('payment_receipts_')) continue;

        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw) as PaymentReceipt[];
        if (Array.isArray(parsed)) {
          all.push(...parsed);
        }
      }
    } catch {
      return [];
    }

    // Keep only the latest payment record per reservation.
    const byReservation = new Map<number, PaymentReceipt>();
    all.forEach((receipt) => {
      const existing = byReservation.get(receipt.reservationId);
      if (!existing) {
        byReservation.set(receipt.reservationId, receipt);
        return;
      }

      const existingTs = Date.parse(existing.paidAtIso || '');
      const currentTs = Date.parse(receipt.paidAtIso || '');
      if (!Number.isFinite(existingTs) || currentTs > existingTs) {
        byReservation.set(receipt.reservationId, receipt);
      }
    });

    return Array.from(byReservation.values());
  }

  getPaidReservationIds(): Set<number> {
    const receipts = this.getReceipts();
    return new Set(receipts.map((item) => item.reservationId));
  }

  isReservationPaid(reservationId: number): boolean {
    return this.getPaidReservationIds().has(reservationId);
  }

  getReceiptByReservationId(reservationId: number): PaymentReceipt | null {
    return this.getReceipts().find((item) => item.reservationId === reservationId) || null;
  }

  saveReceipt(receipt: PaymentReceipt): void {
    const existing = this.getReceipts();
    const next = existing.filter((item) => item.reservationId !== receipt.reservationId);
    next.push(receipt);
    localStorage.setItem(this.getStorageKey(), JSON.stringify(next));
  }

  private getReceipts(): PaymentReceipt[] {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw) as PaymentReceipt[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private getStorageKey(): string {
    const user = this.authService.getCurrentUser();
    const userId = user?.id ?? 'guest';
    return `payment_receipts_${userId}`;
  }
}

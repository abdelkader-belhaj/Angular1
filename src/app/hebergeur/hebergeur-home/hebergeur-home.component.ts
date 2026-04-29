import { Component, OnInit, inject } from '@angular/core';
import { LogementService, Logement } from '../../services/accommodation/logement.service';
import { AuthService } from '../../services/auth.service';
import { ReservationResponse, ReservationService } from '../../services/accommodation/reservation.service';
import { PaymentRecordsService } from '../../services/payment/payment-records.service';
import { forkJoin } from 'rxjs';
import {
  getHostLogementStatus,
  parseHostHubMeta,
  stripHostHubMeta
} from '../hosthub-meta';

@Component({
  selector: 'app-hebergeur-home',
  templateUrl: './hebergeur-home.component.html',
  styleUrl: './hebergeur-home.component.css'
})
export class HebergeurHomeComponent implements OnInit {
  private readonly logementService = inject(LogementService);
  private readonly authService = inject(AuthService);
  private readonly reservationService = inject(ReservationService);
  private readonly paymentRecordsService = inject(PaymentRecordsService);

  loading = true;
  error = '';

  logements: Logement[] = [];
  filteredByHost: Logement[] = [];
  reservationsHost: ReservationResponse[] = [];

  revenueMonthEst = 0;
  occupancyPct = 0;
  reviewScore = 4.6;
  disponibleCount = 0;
  occupeCount = 0;
  maintenanceCount = 0;

  revenueTrend: { label: string; pct: number }[] = [];
  typeDistribution: { label: string; count: number; pct: number }[] = [];
  recentActivity: { title: string; sub: string; when: string }[] = [];

  // Advanced analytics: payments, cancellations and revenue risk
  totalReservations = 0;
  confirmedReservations = 0;
  cancelledReservations = 0;
  pendingReservations = 0;
  paidReservations = 0;
  unpaidConfirmedReservations = 0;
  cancellationRatePct = 0;
  paymentCoveragePct = 0;
  revenuePaidDT = 0;
  cancelledLossDT = 0;
  netSecuredDT = 0;
  paymentVelocityScore = 0;
  paymentInsights: { title: string; value: string; hint: string; tone: 'good' | 'warn' | 'neutral' }[] = [];

  ngOnInit(): void {
    this.load();
  }

  get userName(): string {
    return this.authService.getCurrentUser()?.username || 'Hôte';
  }

  load(): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      logements: this.logementService.getLogements(),
      reservations: this.reservationService.getAllReservations()
    }).subscribe({
      next: ({ logements, reservations }) => {
        this.logements = logements;
        const hostId = this.authService.getCurrentUser()?.id;
        this.filteredByHost = hostId
          ? logements.filter((l) => l.idHebergeur === hostId)
          : logements;

        const hostLogementIds = new Set(this.filteredByHost.map((l) => l.idLogement));
        this.reservationsHost = (reservations || []).filter((r) => hostLogementIds.has(r.idLogement));

        this.computeKpis();
        this.buildCharts();
        this.buildActivity();
        this.computeAdvancedAnalytics();
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Impossible de charger les données.';
        this.loading = false;
      }
    });
  }

  private computeAdvancedAnalytics(): void {
    const reservations = this.reservationsHost;
    this.totalReservations = reservations.length;
    this.confirmedReservations = reservations.filter((r) => (r.statut || '').toLowerCase() === 'confirmee').length;
    this.cancelledReservations = reservations.filter((r) => (r.statut || '').toLowerCase() === 'annulee').length;
    this.pendingReservations = reservations.filter((r) => (r.statut || '').toLowerCase() === 'en_attente').length;

    this.cancellationRatePct = this.totalReservations
      ? Math.round((this.cancelledReservations / this.totalReservations) * 100)
      : 0;

    const receipts = this.paymentRecordsService.getAllReceiptsAllUsers();
    const hostReservationIds = new Set(reservations.map((r) => r.idReservation));
    const hostReceipts = receipts.filter((receipt) => hostReservationIds.has(receipt.reservationId));
    const paidReservationIds = new Set(hostReceipts.map((receipt) => receipt.reservationId));

    this.paidReservations = paidReservationIds.size;
    this.unpaidConfirmedReservations = reservations.filter((r) => (r.statut || '').toLowerCase() === 'confirmee' && !paidReservationIds.has(r.idReservation)).length;
    this.paymentCoveragePct = this.confirmedReservations
      ? Math.round((this.paidReservations / this.confirmedReservations) * 100)
      : 0;

    this.revenuePaidDT = hostReceipts.reduce((sum, receipt) => sum + (receipt.amountInCents || 0) / 100, 0);
    this.cancelledLossDT = reservations
      .filter((r) => (r.statut || '').toLowerCase() === 'annulee')
      .reduce((sum, r) => sum + this.parseAmountToDT(r.prixTotal), 0);

    this.netSecuredDT = Math.max(0, this.revenuePaidDT - this.cancelledLossDT);

    const velocityRaw = (this.paymentCoveragePct * 0.65) + ((100 - this.cancellationRatePct) * 0.35);
    this.paymentVelocityScore = Math.round(Math.min(100, Math.max(0, velocityRaw)));

    this.paymentInsights = [
      {
        title: 'Encaissement sécurisé',
        value: this.formatMoney(this.revenuePaidDT),
        hint: `${this.paidReservations} reservation(s) reglee(s)`,
        tone: this.paidReservations > 0 ? 'good' : 'neutral'
      },
      {
        title: 'Exposition annulation',
        value: this.formatMoney(this.cancelledLossDT),
        hint: `${this.cancelledReservations} annulation(s)`,
        tone: this.cancelledReservations > 0 ? 'warn' : 'good'
      },
      {
        title: 'Couverture paiement',
        value: `${this.paymentCoveragePct}%`,
        hint: `${this.unpaidConfirmedReservations} reservation(s) confirmee(s) non reglee(s)`,
        tone: this.paymentCoveragePct >= 70 ? 'good' : 'warn'
      },
      {
        title: 'Score performance flux',
        value: `${this.paymentVelocityScore}/100`,
        hint: 'Mix paiements et stabilite annulations',
        tone: this.paymentVelocityScore >= 70 ? 'good' : 'neutral'
      }
    ];
  }

  private parseAmountToDT(rawAmount: string | number): number {
    if (typeof rawAmount === 'number') return rawAmount;

    const normalized = String(rawAmount || '')
      .replace(/\s/g, '')
      .replace(/,/g, '.')
      .replace(/[^0-9.]/g, '');

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  getToneClasses(tone: 'good' | 'warn' | 'neutral'): string {
    if (tone === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    if (tone === 'warn') return 'border-amber-200 bg-amber-50 text-amber-900';
    return 'border-slate-200 bg-slate-50 text-slate-900';
  }

  private computeKpis(): void {
    const list = this.filteredByHost;
    const n = list.length;
    let disp = 0;
    let occ = 0;
    let maint = 0;
    let sumNight = 0;

    list.forEach((l) => {
      sumNight += l.prixNuit ?? 0;
      const s = getHostLogementStatus(l.disponible, l.description);
      if (s === 'disponible') disp++;
      else if (s === 'occupe') occ++;
      else maint++;
    });

    this.disponibleCount = disp;
    this.occupeCount = occ;
    this.maintenanceCount = maint;

    const avg = n ? sumNight / n : 0;
    const bookedUnits = occ;
    this.occupancyPct = n ? Math.round((bookedUnits / n) * 100) : 0;
    // Estimation revenus mois : unités occupées × prix moyen × 22 nuits (indicatif)
    this.revenueMonthEst = bookedUnits * avg * 22;
  }

  private buildCharts(): void {
    const list = this.filteredByHost;
    const seed = list.length || 1;
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'];
    this.revenueTrend = months.map((label, i) => {
      const wave = Math.sin((i + seed) * 0.7) * 15 + 70;
      const pct = Math.min(100, Math.max(18, wave));
      return { label, pct };
    });

    const byType = new Map<string, number>();
    list.forEach((l) => {
      const k = l.nomCategorie || 'Autre';
      byType.set(k, (byType.get(k) || 0) + 1);
    });
    const total = list.length || 1;
    this.typeDistribution = Array.from(byType.entries()).map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100)
    }));
    if (this.typeDistribution.length === 0) {
      this.typeDistribution = [{ label: 'Aucun logement', count: 0, pct: 0 }];
    }
  }

  private buildActivity(): void {
    const sorted = [...this.filteredByHost].sort((a, b) => {
      const da = new Date(a.dateCreation || 0).getTime();
      const db = new Date(b.dateCreation || 0).getTime();
      return db - da;
    });
    this.recentActivity = sorted.slice(0, 5).map((l) => {
      const meta = parseHostHubMeta(l.description);
      const extras: string[] = [];
      if (meta.surfaceM2) extras.push(`${meta.surfaceM2} m²`);
      if (meta.nbChambres) extras.push(`${meta.nbChambres} ch.`);
      return {
        title: l.nom,
        sub: [l.ville, l.nomCategorie, extras.join(' · ')].filter(Boolean).join(' · '),
        when: l.dateCreation
          ? new Date(l.dateCreation).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
          : '—'
      };
    });
  }

  formatMoney(v: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      maximumFractionDigits: 0
    }).format(v || 0);
  }

  excerpt(desc?: string): string {
    const t = stripHostHubMeta(desc);
    return t.length > 80 ? `${t.slice(0, 80)}…` : t;
  }
}

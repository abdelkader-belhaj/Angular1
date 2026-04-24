import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VolReservationService, VolResponse, ReservationResponse } from '../societe/vol-reservation.service';

interface StatsGlobales {
  totalVols: number;
  totalReservations: number;
  reservationsActives: number;
  reservationsAnnulees: number;
  revenuTotal: number;
  totalPlaces: number;
  totalPassagers: number;
  totalRemiseOffres: number;
  totalRemiseBonus: number;
  revenuNet: number;
}

interface VolDetail {
  id: number;
  numero: string;
  depart: string;
  arrivee: string;
  dateDepart: string;
  prix: number;
  places: number;
  nbReservations: number;
  revenu: number;
  tauxRemplissage: number;
}

interface TopVol {
  numero: string;
  depart: string;
  arrivee: string;
  count: number;
}

interface RevenuVol {
  numero: string;
  depart: string;
  arrivee: string;
  revenu: number;
}

@Component({
  selector: 'app-statistiques-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistiques-page.component.html',
  styleUrl: './statistiques-page.component.css'
})
export class StatistiquesPageComponent implements OnInit {

  loading = true;

  mesVols: VolResponse[] = [];
  toutesReservations: ReservationResponse[] = [];

  stats: StatsGlobales = {
    totalVols: 0,
    totalReservations: 0,
    reservationsActives: 0,
    reservationsAnnulees: 0,
    revenuTotal: 0,
    totalPlaces: 0,
    totalPassagers: 0,
    totalRemiseOffres: 0,
    totalRemiseBonus: 0,
    revenuNet: 0
  };

  detailVols: VolDetail[] = [];
  topVols: TopVol[] = [];
  revenusParVol: RevenuVol[] = [];

  // Circumference du cercle SVG (r=70)
  private readonly CIRC = 2 * Math.PI * 70; // ≈ 439.82

  constructor(
    private service: VolReservationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.chargerDonnees();
  }

  retour(): void {
    this.router.navigate(['/societe']);
  }

  // ══════════════════════════════════════════════════════════════
  //  CHARGEMENT DES DONNÉES
  // ══════════════════════════════════════════════════════════════
  chargerDonnees(): void {
    this.loading = true;

    this.service.getMesVols().subscribe({
      next: vols => {
        this.mesVols = vols;
        this.service.getToutesReservations().subscribe({
          next: reservations => {
            const mesVolIds = new Set(vols.map(v => v.id));
            this.toutesReservations = reservations.filter(r =>
              mesVolIds.has(r.volAller.id) ||
              (r.volRetour && mesVolIds.has(r.volRetour.id))
            );
            this.calculerStats();
            this.loading = false;
          },
          error: () => { this.loading = false; }
        });
      },
      error: () => { this.loading = false; }
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  CALCUL DES STATISTIQUES
  // ══════════════════════════════════════════════════════════════
  calculerStats(): void {
    const res = this.toutesReservations;
    const vols = this.mesVols;

    // KPI globaux
    this.stats.totalVols = vols.length;
    this.stats.totalReservations = res.length;
    this.stats.reservationsActives = res.filter(r => r.statutReservation === 'active').length;
    this.stats.reservationsAnnulees = res.filter(r => r.statutReservation === 'annulee').length;
    this.stats.revenuTotal = res
      .filter(r => r.statutPaiement === 'paye')
      .reduce((sum, r) => sum + r.prixTotal, 0);
    this.stats.totalPlaces = vols.reduce((sum, v) => sum + v.places, 0);
    this.stats.totalPassagers = res
      .filter(r => r.statutPaiement === 'paye')
      .reduce((sum, r) => sum + r.nbPassagers, 0);

    // ✅ NOUVEAU : Calcul des remises et budget net
    const payees = res.filter(r => r.statutPaiement === 'paye');
    
    this.stats.totalRemiseBonus = payees.reduce((sum, r) => {
      const b = typeof r.remiseBonus === 'number' ? r.remiseBonus : parseFloat(r.remiseBonus as any) || 0;
      return sum + b;
    }, 0);

    this.stats.totalRemiseOffres = payees.reduce((sum, r) => {
      if (this.aOffreAppliquee(r)) {
        const pInit = typeof r.prixInitial === 'number' ? r.prixInitial : parseFloat(r.prixInitial as any) || 0;
        const pTot = typeof r.prixTotal === 'number' ? r.prixTotal : parseFloat(r.prixTotal as any) || 0;
        const pBon = typeof r.remiseBonus === 'number' ? r.remiseBonus : parseFloat(r.remiseBonus as any) || 0;
        return sum + (pInit - pTot - pBon);
      }
      return sum;
    }, 0);

    this.stats.revenuNet = this.stats.revenuTotal * 0.8; // 80% Budget Net

    // Détail par vol
    this.detailVols = vols.map(v => {
      const volRes = res.filter(r => r.volAller.id === v.id);
      const revenu = volRes
        .filter(r => r.statutPaiement === 'paye')
        .reduce((sum, r) => sum + r.prixTotal, 0);
      // Estimation places occupées = passagers payés
      const passagersPayes = volRes
        .filter(r => r.statutPaiement === 'paye')
        .reduce((sum, r) => sum + r.nbPassagers, 0);
      const capaciteEstimee = v.places + passagersPayes;
      const taux = capaciteEstimee > 0 ? (passagersPayes / capaciteEstimee) * 100 : 0;

      return {
        id: v.id,
        numero: v.numero,
        depart: v.depart,
        arrivee: v.arrivee,
        dateDepart: v.dateDepart,
        prix: v.prix,
        places: v.places,
        nbReservations: volRes.length,
        revenu,
        tauxRemplissage: Math.min(taux, 100)
      };
    }).sort((a, b) => b.nbReservations - a.nbReservations);

    // Top vols par réservations
    this.topVols = this.detailVols
      .map(v => ({ numero: v.numero, depart: v.depart, arrivee: v.arrivee, count: v.nbReservations }))
      .filter(v => v.count > 0)
      .slice(0, 5);

    // Revenus par vol
    this.revenusParVol = this.detailVols
      .map(v => ({ numero: v.numero, depart: v.depart, arrivee: v.arrivee, revenu: v.revenu }))
      .filter(v => v.revenu > 0)
      .sort((a, b) => b.revenu - a.revenu)
      .slice(0, 5);
  }

  // ══════════════════════════════════════════════════════════════
  //  HELPERS DONUT — PAIEMENTS
  // ══════════════════════════════════════════════════════════════
  countPaiement(statut: string): number {
    return this.toutesReservations.filter(r => r.statutPaiement === statut).length;
  }

  private paiementOrder = ['paye', 'en_attente', 'echec', 'rembourse'];

  paiementDash(statut: string): string {
    const total = this.stats.totalReservations || 1;
    const count = this.countPaiement(statut);
    const filled = (count / total) * this.CIRC;
    return `${filled} ${this.CIRC}`;
  }

  paiementOffset(statut: string): string {
    const total = this.stats.totalReservations || 1;
    const idx = this.paiementOrder.indexOf(statut);
    let offset = 0;
    for (let i = 0; i < idx; i++) {
      offset += (this.countPaiement(this.paiementOrder[i]) / total) * this.CIRC;
    }
    return `${-offset}`;
  }

  // ══════════════════════════════════════════════════════════════
  //  HELPERS DONUT — RÉSERVATIONS
  // ══════════════════════════════════════════════════════════════
  get tauxAnnulation(): number {
    if (!this.stats.totalReservations) return 0;
    return (this.stats.reservationsAnnulees / this.stats.totalReservations) * 100;
  }

  reservationDash(statut: string): string {
    const total = this.stats.totalReservations || 1;
    const count = statut === 'active' ? this.stats.reservationsActives : this.stats.reservationsAnnulees;
    return `${(count / total) * this.CIRC} ${this.CIRC}`;
  }

  reservationOffset(): string {
    const total = this.stats.totalReservations || 1;
    return `${-((this.stats.reservationsActives / total) * this.CIRC)}`;
  }

  // ══════════════════════════════════════════════════════════════
  //  HELPERS DONUT — TYPE BILLET
  // ══════════════════════════════════════════════════════════════
  countBillet(type: string): number {
    return this.toutesReservations.filter(r => r.typeBillet === type).length;
  }

  billetDash(type: string): string {
    const total = this.stats.totalReservations || 1;
    return `${(this.countBillet(type) / total) * this.CIRC} ${this.CIRC}`;
  }

  billetOffset(): string {
    const total = this.stats.totalReservations || 1;
    return `${-((this.countBillet('aller_simple') / total) * this.CIRC)}`;
  }

  // ══════════════════════════════════════════════════════════════
  //  HELPERS BAR CHARTS
  // ══════════════════════════════════════════════════════════════
  barPct(count: number): number {
    const max = Math.max(...this.topVols.map(v => v.count), 1);
    return (count / max) * 100;
  }

  revenuPct(revenu: number): number {
    const max = Math.max(...this.revenusParVol.map(v => v.revenu), 1);
    return (revenu / max) * 100;
  }

  aOffreAppliquee(res: ReservationResponse): boolean {
    const pInit = typeof res.prixInitial === 'number' ? res.prixInitial : parseFloat(res.prixInitial as any) || 0;
    const pTot = typeof res.prixTotal === 'number' ? res.prixTotal : parseFloat(res.prixTotal as any) || 0;
    const pBon = typeof res.remiseBonus === 'number' ? res.remiseBonus : parseFloat(res.remiseBonus as any) || 0;
    return (pInit - pTot - pBon) > 0.01;
  }
}
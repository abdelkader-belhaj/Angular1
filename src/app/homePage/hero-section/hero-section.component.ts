import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VolService } from '../../services/vol.service';
import { PanierService } from '../../services/panier.service';
import { ReservationService } from '../../services/reservation.service';
import { AuthService } from '../../services/auth.service';
import { ReclamationService } from '../../services/reclamation.service';
import { Vol } from '../../models/vol.model';

@Component({
  selector: 'app-hero-section',
  templateUrl: './hero-section.component.html',
  styleUrl: './hero-section.component.css'
})
export class HeroSectionComponent implements OnInit {

  // ── Filtres ──────────────────────────────────────
  depart = '';
  arrivee = '';
  date = '';

  // ── Vols ─────────────────────────────────────────
  tous: Vol[] = [];        // tous les vols chargés
  vols: Vol[] = [];        // vols affichés dans le scroller
  volsRetour: Vol[] = [];  // vols filtrés pour retour
  loading = true;
  showRecommendations = false;

  // ── Panier ───────────────────────────────────────
  panierIds: Set<number> = new Set();
  unreadReclamations = 0;

  // ── Modal réservation ────────────────────────────
  showModal = false;
  // etape : 'confirm' | 'retour'
  etape: 'confirm' | 'retour' = 'confirm';
  typeBillet: 'aller_simple' | 'aller_retour' = 'aller_simple';
  nbPassagers = 1;
  volAller: Vol | null = null;
  volRetour: Vol | null = null;
  reservationLoading = false;
  reservationSuccess = '';
  reservationError = '';

  constructor(
    private volService: VolService,
    public panierService: PanierService,
    private reservationService: ReservationService,
    public authService: AuthService,
    public router: Router,
    private readonly reclamationService: ReclamationService
  ) {}

  ngOnInit(): void {
    // Sync panier
    this.panierService.panierItems$.subscribe(items => {
      this.panierIds = new Set(items.map(i => i.volAller.id));
    });

    // Charger tous les vols
    this.volService.getAll().subscribe({
      next: v => {
        this.tous = v;
        this.vols = v;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });

    this.refreshUnreadReclamations();
  }

  // ── FILTRES ──────────────────────────────────────
  filtrer(): void {
    if (!this.depart && !this.arrivee && !this.date) {
      this.vols = this.tous;
      return;
    }
    this.vols = this.tous.filter(v => {
      const okDepart  = this.depart  ? v.depart.toLowerCase().includes(this.depart.toLowerCase())   : true;
      const okArrivee = this.arrivee ? v.arrivee.toLowerCase().includes(this.arrivee.toLowerCase()) : true;
      const okDate    = this.date    ? v.dateDepart === this.date : true;
      return okDepart && okArrivee && okDate;
    });
  }

  rechercherPage(): void {
    // Naviguer vers la page vols avec filtres
    this.router.navigate(['/vols'], {
      queryParams: {
        depart: this.depart || undefined,
        arrivee: this.arrivee || undefined,
        date: this.date || undefined
      }
    });
  }

  voirTous(): void {
    this.router.navigate(['/vols']);
  }

  // ── RECOMMENDATIONS ───────────────────────────────
  getRecommendations(): void {
    if (!this.authService.isAuthenticated()) {
      alert('Connectez-vous pour voir les recommandations');
      return;
    }
    
    this.loading = true;
    this.showRecommendations = true;
    
    this.volService.getRecommendations().subscribe({
      next: (recommendedVols) => {
        if (recommendedVols.length === 0) {
          // Si pas de recommandations, afficher tous les vols
          this.vols = this.tous;
          this.loading = false;
        } else {
          this.vols = recommendedVols;
          this.loading = false;
        }
      },
      error: () => {
        // En cas d'erreur, afficher tous les vols
        this.vols = this.tous;
        this.loading = false;
      }
    });
  }

  resetToNormal(): void {
    this.showRecommendations = false;
    this.vols = this.tous;
  }

  // ── PANIER toggle ─────────────────────────────────
  togglePanier(vol: Vol, event: Event): void {
    event.stopPropagation();
    if (!this.authService.isAuthenticated()) {
      alert('Connectez-vous pour utiliser le panier'); return;
    }
    if (this.estDansPanier(vol.id)) {
      const item = this.panierService.items.find(i => i.volAller.id === vol.id);
      if (item) this.panierService.supprimer(item.id);
    } else {
      this.panierService.ajouter(vol, {
        volAllerId: vol.id,
        typeBillet: 'aller_simple',
        nbPassagers: 1
      });
    }
  }

  estDansPanier(id: number): boolean {
    return this.panierIds.has(id);
  }

  get panierCount(): number {
    return this.panierService.items.length;
  }

  refreshUnreadReclamations(): void {
    if (!this.authService.isAuthenticated()) {
      this.unreadReclamations = 0;
      return;
    }
    this.reclamationService.unreadCount().subscribe({
      next: (res) => (this.unreadReclamations = Number(res?.unread ?? 0)),
      error: () => (this.unreadReclamations = 0)
    });
  }

  // ── MODAL RÉSERVATION ─────────────────────────────
  ouvrirReservation(vol: Vol, event: Event): void {
    event.stopPropagation();
    if (!this.authService.isAuthenticated()) {
      alert('Connectez-vous pour réserver'); return;
    }
    this.volAller = vol;
    this.volRetour = null;
    this.typeBillet = 'aller_simple';
    this.nbPassagers = 1;
    this.etape = 'confirm';
    this.reservationSuccess = '';
    this.reservationError = '';
    this.showModal = true;
  }

  choisirAllerRetour(): void {
    this.typeBillet = 'aller_retour';
    if (!this.volAller) return;
    const aller = this.volAller;

    this.volService.getAll().subscribe({
      next: (vols) => {
        this.tous = vols;
        this.volsRetour = this.tous.filter(v => {
          if (v.id === aller.id) return false;
          const vDep = (v.depart || '').toLowerCase().trim();
          const aArr = (aller.arrivee || '').toLowerCase().trim();

          const matchLocation = vDep.includes(aArr) || aArr.includes(vDep);
          const dateRetourValide = new Date(v.dateDepart) > new Date(aller.dateDepart);

          return matchLocation && dateRetourValide;
        });
        this.etape = 'retour';
      },
      error: () => { this.etape = 'retour'; }
    });
  }

  selectionnerRetour(vol: Vol): void {
    this.volRetour = vol;
    this.etape = 'confirm';
  }

  annulerRetour(): void {
    this.typeBillet = 'aller_simple';
    this.volRetour = null;
    this.etape = 'confirm';
  }

  fermerModal(): void {
    this.showModal = false;
    this.volAller = null;
    this.volRetour = null;
    this.etape = 'confirm';
    this.reservationSuccess = '';
    this.reservationError = '';
  }

  confirmerReservation(): void {
    if (!this.volAller) return;
    this.reservationLoading = true;
    this.reservationError = '';
    this.reservationService.creer({
      volAllerId: this.volAller.id,
      volRetourId: this.volRetour?.id ?? null,
      typeBillet: this.typeBillet,
      nbPassagers: this.nbPassagers
    }).subscribe({
      next: res => {
        this.reservationLoading = false;
        this.reservationSuccess = `✅ Réservation ${res.reference} créée !`;
      },
      error: err => {
        this.reservationLoading = false;
        this.reservationError = err?.error?.message ?? 'Erreur de réservation';
      }
    });
  }

  get prixTotal(): number {
    let t = 0;
    if (this.volAller) {
      const p = this.volAller.offre ? this.volAller.prix * (1 - this.volAller.offre!.pourcentage/100) : this.volAller.prix;
      t += p * this.nbPassagers;
    }
    if (this.volRetour) {
      const p = this.volRetour.offre ? this.volRetour.prix * (1 - this.volRetour.offre!.pourcentage/100) : this.volRetour.prix;
      t += p * this.nbPassagers;
    }
    return t;
  }

  formatRetard(minutes: number | undefined): string {
    if (!minutes || minutes <= 0) return '';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
}
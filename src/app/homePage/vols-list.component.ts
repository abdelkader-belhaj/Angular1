import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VolService } from '../services/vol.service';
import { PanierService } from '../services/panier.service';
import { ReservationService } from '../services/reservation.service';
import { AuthService } from '../services/auth.service';
import { Vol } from '../models/vol.model';

@Component({
  selector: 'app-vols-list',
  templateUrl: './vols-list.component.html',
  styleUrls: ['./vols-list.component.css']
})
export class VolsListComponent implements OnInit {

  tous: Vol[] = [];   // tous les vols
  vols: Vol[] = [];   // vols affichés (filtrés)
  volsRetour: Vol[] = []; // vols retour filtrés

  loading = true;
  error = '';
  depart = '';
  arrivee = '';
  date = '';
  searched = false;

  // Panier
  panierIds: Set<number> = new Set();

  // Modal
  showModal = false;
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
    private authService: AuthService,
    private route: ActivatedRoute,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.panierService.panierItems$.subscribe(items => {
      this.panierIds = new Set(items.map(i => i.volAller.id));
    });

    this.route.queryParams.subscribe(params => {
      this.depart  = params['depart']  ?? '';
      this.arrivee = params['arrivee'] ?? '';
      this.date    = params['date']    ?? '';
      this.chargerTous();
    });
  }

  chargerTous(): void {
    this.loading = true;
    this.volService.getAll().subscribe({
      next: v => {
        this.tous = v;
        this.filtrer();
        this.loading = false;
      },
      error: () => { this.error = 'Erreur de chargement'; this.loading = false; }
    });
  }

  filtrer(): void {
    if (!this.depart && !this.arrivee && !this.date) {
      this.vols = this.tous;
      this.searched = false;
      return;
    }
    this.searched = true;
    this.vols = this.tous.filter(v => {
      const okD = this.depart  ? v.depart.toLowerCase().includes(this.depart.toLowerCase())   : true;
      const okA = this.arrivee ? v.arrivee.toLowerCase().includes(this.arrivee.toLowerCase()) : true;
      const okDate = this.date ? v.dateDepart === this.date : true;
      return okD && okA && okDate;
    });
  }

  rechercher(): void {
    this.filtrer();
  }

  resetRecherche(): void {
    this.depart = ''; this.arrivee = ''; this.date = '';
    this.filtrer();
  }

  // ── PANIER toggle ─────────────────────────────────────────
  togglePanier(vol: Vol): void {
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

  // ── MODAL : ouvrir directement sur confirm ────────────────
  ouvrirModal(vol: Vol): void {
    if (!this.authService.isAuthenticated()) {
      alert('Connectez-vous pour réserver'); return;
    }
    this.volAller = vol;
    this.volRetour = null;
    this.typeBillet = 'aller_simple';
    this.nbPassagers = 1;
    this.etape = 'confirm';       // ← directement confirm, pas type
    this.reservationSuccess = '';
    this.reservationError = '';
    this.showModal = true;
  }

  // ── Ajouter vol retour ────────────────────────────────────
  choisirAllerRetour(): void {
    this.typeBillet = 'aller_retour';
    // Filtrer : arrivee = depart aller ET date >= date aller ET id différent
    this.volsRetour = this.tous.filter(v =>
      v.arrivee === this.volAller?.depart &&
      v.id !== this.volAller?.id &&
      v.dateDepart >= (this.volAller?.dateDepart ?? '')
    );
    this.etape = 'retour';
  }

  selectionnerRetour(vol: Vol): void {
    this.volRetour = vol;
    this.etape = 'confirm';  // ← retour direct vers confirm, PAS vers type
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
    if (!this.volAller) return 0;
    let t = this.volAller.prix * this.nbPassagers;
    if (this.volRetour) t += this.volRetour.prix * this.nbPassagers;
    return t;
  }
}
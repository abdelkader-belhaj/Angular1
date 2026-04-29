import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  VolReservationService,
  VolRequest,
  VolResponse,
  ReservationResponse
} from './vol-reservation.service';

@Component({
  selector: 'app-societe-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './societe-page.component.html',
  styleUrl: './societe-page.component.css'
})
export class SocietePageComponent implements OnInit {

  // ── ONGLET ACTIF ─────────────────────────────────────────────
  activeTab: 'vols' | 'reservations' | 'offres' = 'vols';

  // ── ALERTES ──────────────────────────────────────────────────
  successMsg = '';
  errorMsg = '';

  // ── VOLS ─────────────────────────────────────────────────────
  mesVols: VolResponse[] = [];
  loading = false;
  showVolForm = false;
  editingVol: VolResponse | null = null;
  volForm: VolRequest = this.emptyVolForm();

  // ── DATE MINIMUM (aujourd'hui) ────────────────────────────────
  todayStr: string = new Date().toISOString().split('T')[0];

  // ── ERREURS FORMULAIRE ────────────────────────────────────────
  formErrors: { [key: string]: string } = {};

  // ── RÉSERVATIONS ─────────────────────────────────────────────
  toutesReservations: ReservationResponse[] = [];
  reservationsFiltrees: ReservationResponse[] = [];
  loadingRes = false;
  filtreStatutPaiement = '';
  filtreStatutReservation = '';
  activeTabRes: 'all' | 'archive' = 'all';

  // ── OFFRES ──────────────────────────────────────────────────
  mesOffres: any[] = [];
  showOffreForm = false;
  editingOffre: any | null = null;
  offreForm = this.emptyOffreForm();

  // ── MODAL CONFIRMATION ────────────────────────────────────────
  showConfirm = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmAction: (() => void) | null = null;

  // ── RETARD ──────────────────────────────────────────────────
  showRetardModal = false;
  volPourRetard: VolResponse | null = null;
  nouveauRetard = 0;

  constructor(
    private service: VolReservationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.chargerVols();
    this.chargerOffres();
  }

  // ══════════════════════════════════════════════════════════════
  //  NAVIGATION STATISTIQUES
  // ══════════════════════════════════════════════════════════════
  allerStatistiques(): void {
    this.router.navigate(['/societe/statistiques']);
  }

  allerReclamations(): void {
    this.router.navigate(['/societe/reclamations']);
  }

  // ══════════════════════════════════════════════════════════════
  //  STATS
  // ══════════════════════════════════════════════════════════════
  get totalRevenu(): number {
    return this.reservationsFiltrees
      .filter(r => r.statutPaiement === 'paye')
      .reduce((sum, r) => sum + r.prixTotal, 0);
  }

  // ══════════════════════════════════════════════════════════════
  //  VOLS — CRUD
  // ══════════════════════════════════════════════════════════════
  chargerVols(): void {
    this.loading = true;
    this.service.getMesVols().subscribe({
      next: vols => { this.mesVols = vols; this.loading = false; },
      error: err => { this.showError(err); this.loading = false; }
    });
  }

  openVolForm(): void {
    this.editingVol = null;
    this.volForm = this.emptyVolForm();
    this.formErrors = {};
    this.showVolForm = true;
  }

  editVol(v: VolResponse): void {
    this.editingVol = v;
    this.volForm = {
      numero: v.numero,
      depart: v.depart,
      arrivee: v.arrivee,
      dateDepart: v.dateDepart,
      heureDepart: v.heureDepart,
      prix: v.prix,
      places: v.places,
      escales: v.escales ? [...v.escales] : [],
      offreId: v.offre ? v.offre.id : null
    };
    this.formErrors = {};
    this.showVolForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  saveVol(): void {
    if (!this.validateVolForm()) return;

    this.loading = true;
    const obs = this.editingVol
      ? this.service.updateVol(this.editingVol.id, this.volForm)
      : this.service.createVol(this.volForm);

    obs.subscribe({
      next: () => {
        this.showSuccess(this.editingVol ? 'Vol modifié avec succès !' : 'Vol créé avec succès !');
        this.cancelVolForm();
        this.chargerVols();
        this.loading = false;
      },
      error: err => { this.showError(err); this.loading = false; }
    });
  }

  confirmDeleteVol(vol: VolResponse): void {
    this.confirmTitle = 'Supprimer le vol';
    this.confirmMessage = `Voulez-vous vraiment supprimer le vol ${vol.numero} ?`;
    this.showConfirm = true;
    this.confirmAction = () => {
      this.service.deleteVol(vol.id).subscribe({
        next: () => {
          this.showSuccess('Vol supprimé');
          this.chargerVols();
          this.showConfirm = false;
        },
        error: err => { this.showError(err); this.showConfirm = false; }
      });
    };
  }

  // ── RETARD MODAL ─────────────────────────────────────────────
  ouvrirRetardModal(vol: VolResponse): void {
    this.volPourRetard = vol;
    this.nouveauRetard = vol.retard || 0;
    this.showRetardModal = true;
  }

  fermerRetardModal(): void {
    this.showRetardModal = false;
    this.volPourRetard = null;
  }

  validerRetard(): void {
    if (!this.volPourRetard) return;
    
    this.loading = true;
    this.service.updateRetard(this.volPourRetard.id, this.nouveauRetard).subscribe({
      next: () => {
        this.showSuccess('Retard mis à jour et clients notifiés par email');
        this.chargerVols();
        this.fermerRetardModal();
        this.loading = false;
      },
      error: err => {
        this.showError(err);
        this.loading = false;
      }
    });
  }

  cancelVolForm(): void {
    this.showVolForm = false;
    this.editingVol = null;
    this.volForm = this.emptyVolForm();
    this.formErrors = {};
  }

  // ══════════════════════════════════════════════════════════════
  //  VALIDATION FORMULAIRE VOL
  // ══════════════════════════════════════════════════════════════
validateVolForm(): boolean {
  this.formErrors = {};
  const f = this.volForm;

  // Numéro de vol
  if (!f.numero || f.numero.trim() === '') {
    this.formErrors['numero'] = 'Le numéro de vol est obligatoire.';
  } else if (!/^[A-Z0-9]{2,10}$/i.test(f.numero.trim())) {
    this.formErrors['numero'] = 'Format invalide (ex: TU123, 2-10 caractères alphanumériques).';
  }

  // Départ (MODIFIÉ ✅)
  if (!f.depart || f.depart.trim() === '') {
    this.formErrors['depart'] = 'La ville de départ est obligatoire.';
  } else if (!/^[A-Za-z]{1,8}$/.test(f.depart.trim())) {
    this.formErrors['depart'] = 'Le nom doit contenir entre 1 et 8 lettres.';
  }

  // Arrivée (MODIFIÉ ✅)
  if (!f.arrivee || f.arrivee.trim() === '') {
    this.formErrors['arrivee'] = 'La ville d\'arrivée est obligatoire.';
  } else if (!/^[A-Za-z]{1,8}$/.test(f.arrivee.trim())) {
    this.formErrors['arrivee'] = 'Le nom doit contenir entre 1 et 8 lettres.';
  } else if (f.arrivee.trim().toLowerCase() === f.depart.trim().toLowerCase()) {
    this.formErrors['arrivee'] = 'L\'arrivée doit être différente du départ.';
  }

  // Date départ
  if (!f.dateDepart) {
    this.formErrors['dateDepart'] = 'La date de départ est obligatoire.';
  } else if (f.dateDepart < this.todayStr) {
    this.formErrors['dateDepart'] = 'La date de départ doit être aujourd\'hui ou dans le futur.';
  }

  // Heure départ
  if (!f.heureDepart) {
    this.formErrors['heureDepart'] = 'L\'heure de départ est obligatoire.';
  }

  // Prix
  if (!f.prix || f.prix <= 0) {
    this.formErrors['prix'] = 'Le prix doit être supérieur à 0.';
  } else if (f.prix > 99999) {
    this.formErrors['prix'] = 'Le prix ne peut pas dépasser 99 999 TND.';
  }

  // Places
  if (!f.places || f.places <= 0) {
    this.formErrors['places'] = 'Le nombre de places doit être supérieur à 0.';
  } else if (f.places > 850) {
    this.formErrors['places'] = 'Le nombre de places ne peut pas dépasser 850.';
  }

  return Object.keys(this.formErrors).length === 0;
}

  // ══════════════════════════════════════════════════════════════
  //  RÉSERVATIONS
  // ══════════════════════════════════════════════════════════════
  switchToReservations(): void {
    this.activeTab = 'reservations';
    if (this.toutesReservations.length === 0) {
      this.chargerReservations();
    }
  }

  chargerReservations(): void {
    this.loadingRes = true;
    
    // On s'assure d'abord d'avoir les vols de la société pour filtrer
    const obsVols = this.mesVols.length > 0 
      ? Promise.resolve(this.mesVols) 
      : this.service.getMesVols().toPromise();

    obsVols.then(vols => {
      if (vols) this.mesVols = vols;
      const mesVolIds = new Set(this.mesVols.map(v => v.id));

      this.service.getToutesReservations().subscribe({
        next: reservations => {
          this.toutesReservations = reservations.filter(r =>
            mesVolIds.has(r.volAller.id) ||
            (r.volRetour && mesVolIds.has(r.volRetour.id))
          );
          this.filtrerReservations();
          this.loadingRes = false;
        },
        error: err => { this.showError(err); this.loadingRes = false; }
      });
    }).catch(err => {
      this.showError(err);
      this.loadingRes = false;
    });
  }

  filtrerReservations(): void {
    this.reservationsFiltrees = this.toutesReservations.filter(r => {
      const matchPaiement = !this.filtreStatutPaiement || r.statutPaiement === this.filtreStatutPaiement;
      const matchReservation = !this.filtreStatutReservation || r.statutReservation === this.filtreStatutReservation;
      
      const resStatut = r.statutReservation || 'active'; // Fallback pour les anciennes lignes
      const isArchived = resStatut === 'archivee';
      const matchArchive = this.activeTabRes === 'archive' ? isArchived : !isArchived;
      
      return matchPaiement && matchReservation && matchArchive;
    });
  }

  changerStatut(r: ReservationResponse, statut: string): void {
    if (statut === r.statutPaiement) return;
    this.service.modifierStatutReservation(r.id, statut).subscribe({
      next: updated => {
        const idx = this.toutesReservations.findIndex(x => x.id === r.id);
        if (idx !== -1) this.toutesReservations[idx] = updated;
        this.filtrerReservations();
        this.showSuccess('Statut mis à jour.');
      },
      error: err => this.showError(err)
    });
  }

  confirmerRemboursement(r: ReservationResponse): void {
    this.service.confirmerRemboursement(r.id).subscribe({
      next: updated => {
        const idx = this.toutesReservations.findIndex(x => x.id === r.id);
        if (idx !== -1) this.toutesReservations[idx] = updated;
        this.filtrerReservations();
        this.showSuccess('Remboursement confirmé.');
      },
      error: err => this.showError(err)
    });
  }

  confirmDeleteReservation(r: ReservationResponse): void {
    this.openConfirm(
      'Archiver cette réservation ?',
      `Voulez-vous archiver la réservation ${r.reference} ? Elle ne sera plus visible dans la liste active mais restera consultable dans l'archive.`,
      () => {
        this.service.supprimerReservation(r.id).subscribe({
          next: (updated) => {
            const idx = this.toutesReservations.findIndex(x => x.id === r.id);
            if (idx !== -1) this.toutesReservations[idx] = updated;
            this.filtrerReservations();
            this.showSuccess('Réservation archivée.');
          },
          error: err => this.showError(err)
        });
      }
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════════
  labelPaiement(statut: string): string {
    const map: Record<string, string> = {
      en_attente: 'En attente',
      paye: '✅ Payé',
      echec: '❌ Échoué',
      rembourse: '💜 Remboursé',
      annule: 'Annulé'
    };
    return map[statut] || statut;
  }

  aOffreAppliquee(res: ReservationResponse): boolean {
    const pInit = typeof res.prixInitial === 'number' ? res.prixInitial : parseFloat(res.prixInitial as any) || 0;
    const pTot = typeof res.prixTotal === 'number' ? res.prixTotal : parseFloat(res.prixTotal as any) || 0;
    const pBon = typeof res.remiseBonus === 'number' ? res.remiseBonus : parseFloat(res.remiseBonus as any) || 0;
    
    // Si la différence (PrixInitial - PrixTotal - Bonus) est supérieure à zéro, c'est qu'il y a eu une offre
    return (pInit - pTot - pBon) > 0.01;
  }

  openConfirm(title: string, message: string, action: () => void): void {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmAction = action;
    this.showConfirm = true;
  }

  executeConfirm(): void {
    if (this.confirmAction) this.confirmAction();
    this.cancelConfirm();
  }

  cancelConfirm(): void {
    this.showConfirm = false;
    this.confirmAction = null;
  }

  // ══════════════════════════════════════════════════════════════
  //  OFFRES — CRUD
  // ══════════════════════════════════════════════════════════════
  switchToOffres(): void {
    this.activeTab = 'offres';
    this.chargerOffres();
  }

  chargerOffres(): void {
    this.service.getOffres().subscribe({
      next: res => this.mesOffres = res,
      error: err => this.showError(err)
    });
  }

  openOffreForm(): void {
    this.editingOffre = null;
    this.offreForm = this.emptyOffreForm();
    this.showOffreForm = true;
  }

  editOffre(o: any): void {
    this.editingOffre = o;
    this.offreForm = { ...o };
    this.showOffreForm = true;
  }

  saveOffre(): void {
    const obs = this.editingOffre
      ? this.service.updateOffre(this.editingOffre.id, this.offreForm)
      : this.service.createOffre(this.offreForm);

    obs.subscribe({
      next: () => {
        this.showSuccess('Offre enregistrée !');
        this.showOffreForm = false;
        this.chargerOffres();
      },
      error: err => this.showError(err)
    });
  }

  deleteOffre(o: any): void {
    this.openConfirm('Supprimer cette offre ?', `Voulez-vous supprimer l'offre ${o.code} ?`, () => {
      this.service.deleteOffre(o.id).subscribe({
        next: () => { this.showSuccess('Offre supprimée.'); this.chargerOffres(); },
        error: err => this.showError(err)
      });
    });
  }

  emptyOffreForm() {
    return { code: '', pourcentage: 0, dateDebut: '', dateFin: '', actif: true };
  }

  showSuccess(msg: string): void {
    this.successMsg = msg;
    this.errorMsg = '';
    setTimeout(() => this.successMsg = '', 5000);
  }

  showError(err: any): void {
    this.errorMsg = err?.error?.message || 'Une erreur est survenue.';
    this.successMsg = '';
    setTimeout(() => this.errorMsg = '', 5000);
  }

  formatRetard(minutes: number | undefined): string {
    if (!minutes || minutes <= 0) return '';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  emptyVolForm(): VolRequest {
    return { numero: '', depart: '', arrivee: '', dateDepart: '', heureDepart: '', prix: 0, places: 0, escales: [], offreId: null };
  }

  ajouterEscale(): void {
    this.volForm.escales.push({ ville: '', duree: '' });
  }

  supprimerEscale(idx: number): void {
    this.volForm.escales.splice(idx, 1);
  }
}
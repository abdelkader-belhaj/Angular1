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
  activeTab: 'vols' | 'reservations' = 'vols';

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

  // ── MODAL CONFIRMATION ────────────────────────────────────────
  showConfirm = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmAction: (() => void) | null = null;

  constructor(
    private service: VolReservationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.chargerVols();
  }

  // ══════════════════════════════════════════════════════════════
  //  NAVIGATION STATISTIQUES
  // ══════════════════════════════════════════════════════════════
  allerStatistiques(): void {
    this.router.navigate(['/societe/statistiques']);
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
      places: v.places
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

  confirmDeleteVol(v: VolResponse): void {
    this.openConfirm(
      'Supprimer ce vol ?',
      `Supprimer le vol ${v.numero} (${v.depart} → ${v.arrivee}) ? Cette action est irréversible.`,
      () => {
        this.service.deleteVol(v.id).subscribe({
          next: () => { this.showSuccess('Vol supprimé.'); this.chargerVols(); },
          error: err => this.showError(err)
        });
      }
    );
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

    // Départ
    if (!f.depart || f.depart.trim() === '') {
      this.formErrors['depart'] = 'La ville de départ est obligatoire.';
    } else if (!/^[A-Z]{3}$/i.test(f.depart.trim())) {
      this.formErrors['depart'] = 'Code IATA invalide (3 lettres, ex: TUN).';
    }

    // Arrivée
    if (!f.arrivee || f.arrivee.trim() === '') {
      this.formErrors['arrivee'] = 'La ville d\'arrivée est obligatoire.';
    } else if (!/^[A-Z]{3}$/i.test(f.arrivee.trim())) {
      this.formErrors['arrivee'] = 'Code IATA invalide (3 lettres, ex: PAR).';
    } else if (f.arrivee.trim().toUpperCase() === f.depart.trim().toUpperCase()) {
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
    this.service.getToutesReservations().subscribe({
      next: reservations => {
        const mesVolIds = new Set(this.mesVols.map(v => v.id));
        this.toutesReservations = reservations.filter(r =>
          mesVolIds.has(r.volAller.id) ||
          (r.volRetour && mesVolIds.has(r.volRetour.id))
        );
        this.filtrerReservations();
        this.loadingRes = false;
      },
      error: err => { this.showError(err); this.loadingRes = false; }
    });
  }

  filtrerReservations(): void {
    this.reservationsFiltrees = this.toutesReservations.filter(r => {
      const matchPaiement = !this.filtreStatutPaiement || r.statutPaiement === this.filtreStatutPaiement;
      const matchReservation = !this.filtreStatutReservation || r.statutReservation === this.filtreStatutReservation;
      return matchPaiement && matchReservation;
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
      'Supprimer cette réservation ?',
      `Supprimer la réservation ${r.reference} (${r.touristeEmail}) ? Les places seront restituées si le paiement était effectué.`,
      () => {
        this.service.supprimerReservation(r.id).subscribe({
          next: () => {
            this.toutesReservations = this.toutesReservations.filter(x => x.id !== r.id);
            this.filtrerReservations();
            this.showSuccess('Réservation supprimée.');
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

  showSuccess(msg: string): void {
    this.successMsg = msg;
    this.errorMsg = '';
    setTimeout(() => this.successMsg = '', 4000);
  }

  showError(err: any): void {
    this.errorMsg = err?.error?.message || err?.message || 'Une erreur est survenue.';
    this.successMsg = '';
    setTimeout(() => this.errorMsg = '', 5000);
  }

  emptyVolForm(): VolRequest {
    return { numero: '', depart: '', arrivee: '', dateDepart: '', heureDepart: '', prix: 0, places: 0 };
  }
}
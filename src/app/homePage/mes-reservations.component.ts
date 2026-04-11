import { Component, OnInit } from '@angular/core';
import { ReservationService } from '../services/reservation.service';
import { ReservationResponse } from '../models/reservation.model';

@Component({
  selector: 'app-mes-reservations',
  templateUrl: './mes-reservations.component.html',
  styleUrls: ['./mes-reservations.component.css']
})
export class MesReservationsComponent implements OnInit {
  reservations: ReservationResponse[] = [];
  loading = true;
  error = '';
  message = '';
  messageType: 'success' | 'error' = 'success';
  paiementEnCours: number | null = null;
  annulationEnCours: number | null = null;

  reservationASupprimer: ReservationResponse | null = null;
  typeAction: 'supprimer' | 'annuler' = 'supprimer';

  constructor(private reservationService: ReservationService) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading = true;
    this.reservationService.mesReservations().subscribe({
      next: (r) => {
        this.reservations = r;
        console.log('Réservations reçues:', JSON.stringify(r, null, 2)); // ← Pour debug
        this.loading = false;
      },
      error: () => {
        this.error = 'Erreur de chargement des réservations';
        this.loading = false;
      }
    });
  }

  payer(res: ReservationResponse): void {
    this.paiementEnCours = res.id;
    this.reservationService.payer({ reservationId: res.id, methode: 'carte' }).subscribe({
      next: () => {
        this.paiementEnCours = null;
        this.afficherMessage('✅ Paiement effectué avec succès !', 'success');
        this.charger();
      },
      error: (err) => {
        this.paiementEnCours = null;
        this.afficherMessage(err?.error?.message || 'Erreur lors du paiement', 'error');
      }
    });
  }

  ouvrirDialog(res: ReservationResponse): void {
    this.reservationASupprimer = res;
    this.typeAction = this.peutSupprimer(res) ? 'supprimer' : 'annuler';
  }

  confirmerAction(): void {
    if (!this.reservationASupprimer) return;
    const res = this.reservationASupprimer;
    this.reservationASupprimer = null;
    this.annulationEnCours = res.id;

    if (this.typeAction === 'supprimer') {
      this.reservationService.supprimerAvantPaiement(res.id).subscribe({
        next: () => {
          this.annulationEnCours = null;
          this.afficherMessage('✅ Réservation supprimée avec succès', 'success');
          this.charger();
        },
        error: (err) => {
          this.annulationEnCours = null;
          this.afficherMessage(err?.error?.message || 'Impossible de supprimer', 'error');
        }
      });
    } else {
      this.reservationService.annuler(res.id).subscribe({
        next: () => {
          this.annulationEnCours = null;
          this.afficherMessage('✅ Réservation annulée - Remboursement initié', 'success');
          this.charger();
        },
        error: (err) => {
          this.annulationEnCours = null;
          this.afficherMessage(err?.error?.message || 'Impossible d’annuler', 'error');
        }
      });
    }
  }

  fermerDialog(): void {
    this.reservationASupprimer = null;
  }

  private afficherMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg;
    this.messageType = type;
    setTimeout(() => (this.message = ''), 5000);
  }

  // CONDITIONS CORRIGÉES (en attendant de fixer le backend)
  peutPayer(res: ReservationResponse): boolean {
    const statutP = String(res.statutPaiement || '').toLowerCase().trim();
    const statutR = String(res.statutReservation || 'active').toLowerCase().trim(); // null → active par défaut
    return statutR === 'active' && 
           (statutP === 'en_attente' || statutP.includes('attente'));
  }

  peutSupprimer(res: ReservationResponse): boolean {
    const statutP = String(res.statutPaiement || '').toLowerCase().trim();
    const statutR = String(res.statutReservation || 'active').toLowerCase().trim();
    return statutR === 'active' && 
           (statutP === 'en_attente' || statutP.includes('attente'));
  }

  peutAnnuler(res: ReservationResponse): boolean {
    const statutP = String(res.statutPaiement || '').toLowerCase().trim();
    const statutR = String(res.statutReservation || 'active').toLowerCase().trim();
    return statutR === 'active' && statutP === 'paye';
  }

  getStatutClass(res: ReservationResponse): string {
    const statutR = String(res.statutReservation || '').toLowerCase().trim();
    if (statutR === 'annulee') return 'statut-annule';

    const statutP = String(res.statutPaiement || '').toLowerCase().trim();
    if (statutP === 'paye') return 'statut-paye';
    if (statutP === 'rembourse') return 'statut-rembourse';
    if (statutP === 'echec') return 'statut-echec';
    return 'statut-attente';
  }

  getStatutLabel(res: ReservationResponse): string {
    const statutR = String(res.statutReservation || '').toLowerCase().trim();
    if (statutR === 'annulee') return '🔴 Annulée';

    const statutP = String(res.statutPaiement || '').toLowerCase().trim();
    if (statutP === 'paye') return '✅ Payée';
    if (statutP === 'rembourse') return '💸 Remboursée';
    if (statutP === 'echec') return '❌ Échoué';
    return '⏳ En attente de paiement';
  }
}
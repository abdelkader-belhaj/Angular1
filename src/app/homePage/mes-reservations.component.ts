import { Component, OnInit } from '@angular/core';
import { ReservationService } from '../services/reservation.service';
import { ReservationResponse, QrCodeVolResponse } from '../models/reservation.model';
import { loadStripe, Stripe, StripeCardElement } from '@stripe/stripe-js';
import { Router } from '@angular/router';

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

  stripe: Stripe | null = null;
  cardElement: StripeCardElement | null = null;
  reservationAPayer: ReservationResponse | null = null;
  stripeLoading = false;
  stripeError = '';

  qrCodeData: QrCodeVolResponse | null = null;
  qrCodeLoading = false;
  qrCodeError = '';

  hotels: any[] = [];
  hotelsLoading = false;
  hotelError = '';
  destinationCity = '';
  private map: any;

  constructor(
    private reservationService: ReservationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.charger();
    this.initStripe();
  }

  // ============================================================
  //  INIT STRIPE
  // ============================================================
  async initStripe(): Promise<void> {
    this.stripe = await loadStripe('pk_test_51TLg6BPQTKpnVqkBr9U7VSVVz2obdbqP9ila6ApFFos2TV75Y9WcFRmCj11XcjfQUqMsUxKxQ4wlH0J8YrC5YQYw00yCHUGbwE');
  }

  // ============================================================
  //  QR CODE : OUVRIR MODAL
  // ============================================================
  ouvrirQrCode(res: ReservationResponse): void {
    this.qrCodeData = null;
    this.qrCodeError = '';
    this.qrCodeLoading = true;

    this.reservationService.getQrCode(res.id).subscribe({
      next: (data) => {
        this.qrCodeData = data;
        this.qrCodeLoading = false;
      },
      error: () => {
        this.qrCodeError = 'Impossible de charger le billet électronique.';
        this.qrCodeLoading = false;
      }
    });
  }

  fermerQrCode(): void {
    this.qrCodeData = null;
    this.qrCodeError = '';
    this.qrCodeLoading = false;
  }

  // ============================================================
  //  QR CODE : TÉLÉCHARGER L'IMAGE
  // ============================================================
  telechargerQrCode(): void {
    if (!this.qrCodeData) return;
    const link = document.createElement('a');
    link.href = 'data:image/png;base64,' + this.qrCodeData.imageBase64;
    link.download = 'billet-' + this.qrCodeData.reference + '.png';
    link.click();
  }

  // ============================================================
  //  OUVRIR LE DIALOG DE PAIEMENT STRIPE
  // ============================================================
  ouvrirPaiement(res: ReservationResponse): void {
    this.reservationAPayer = res;
    this.stripeError = '';
    setTimeout(() => this.monterCardElement(), 100);
  }

  // ============================================================
  //  MONTER LE CARD ELEMENT STRIPE DANS LE DOM
  // ============================================================
  monterCardElement(): void {
    if (!this.stripe) return;

    const elements = this.stripe.elements();
    this.cardElement = elements.create('card', {
      hidePostalCode: true,
      style: {
        base: {
          fontSize: '16px',
          color: '#0f172a',
          fontFamily: 'sans-serif',
          '::placeholder': { color: '#94a3b8' }
        },
        invalid: { color: '#dc2626' }
      }
    });
    this.cardElement.mount('#stripe-card-element');
  }

  // ============================================================
  //  FERMER LE DIALOG PAIEMENT
  // ============================================================
  fermerPaiement(): void {
    this.reservationAPayer = null;
    this.stripeError = '';
    if (this.cardElement) {
      this.cardElement.unmount();
      this.cardElement = null;
    }
  }

  // ============================================================
  //  CONFIRMER PAIEMENT STRIPE
  // ============================================================
  async confirmerPaiement(): Promise<void> {
    if (!this.stripe || !this.cardElement || !this.reservationAPayer) return;

    this.stripeLoading = true;
    this.stripeError = '';

    const { paymentMethod, error } = await this.stripe.createPaymentMethod({
      type: 'card',
      card: this.cardElement
    });

    if (error) {
      this.stripeError = error.message || 'Erreur Stripe';
      this.stripeLoading = false;
      return;
    }

    const req = {
      reservationId: this.reservationAPayer.id,
      methode: 'carte',
      paymentMethodId: paymentMethod!.id
    };

    this.paiementEnCours = this.reservationAPayer.id;
    this.fermerPaiement();

    this.reservationService.payer(req).subscribe({
      next: () => {
        this.paiementEnCours = null;
        this.afficherMessage('✅ Paiement effectué avec succès !', 'success');
        this.charger();
      },
      error: (err) => {
        this.paiementEnCours = null;
        this.afficherMessage(
          err?.error?.message || 'Erreur lors du paiement', 'error'
        );
      }
    });

    this.stripeLoading = false;
  }

  // ============================================================
  //  CHARGER LES RÉSERVATIONS
  // ============================================================
  charger(): void {
    this.loading = true;
    this.reservationService.mesReservations().subscribe({
      next: (r) => {
        this.reservations = r.filter(res => res.statutReservation !== 'archivee');
        this.loading = false;
      },
      error: () => {
        this.error = 'Erreur de chargement des réservations';
        this.loading = false;
      }
    });
  }

  // ============================================================
  //  DIALOG SUPPRESSION / ANNULATION
  // ============================================================
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
          this.afficherMessage(
            err?.error?.message || 'Impossible de supprimer', 'error'
          );
        }
      });
    } else {
      this.reservationService.annuler(res.id).subscribe({
        next: () => {
          this.annulationEnCours = null;
          this.afficherMessage(
            '✅ Réservation annulée - Remboursement initié', 'success'
          );
          this.charger();
        },
        error: (err) => {
          this.annulationEnCours = null;
          this.afficherMessage(
            err?.error?.message || "Impossible d'annuler", 'error'
          );
        }
      });
    }
  }

  fermerDialog(): void {
    this.reservationASupprimer = null;
  }

  // ============================================================
  //  HOTELS : VOIR SUR LA CARTE
  // ============================================================
  voirHotels(res: ReservationResponse): void {
    this.destinationCity = res.volAller.arrivee;
    this.hotelsLoading = true;
    this.hotelError = '';
    this.hotels = [];

    this.reservationService.getHotelRecommendations(this.destinationCity).subscribe({
      next: (data) => {
        this.hotels = data;
        this.hotelsLoading = false;
        setTimeout(() => this.initMap(), 200);
      },
      error: () => {
        this.hotelError = 'Erreur lors de la récupération des hôtels.';
        this.hotelsLoading = false;
      }
    });
  }

  private initMap(): void {
    // @ts-ignore
    const L = window['L'];
    if (!L) {
      console.error('Leaflet (L) is not defined on window.');
      return;
    }
    if (this.hotels.length === 0) return;

    // Utilisation de setTimeout pour s'assurer que le DOM est prêt
    setTimeout(() => {
      const mapEl = document.getElementById('hotel-map');
      if (!mapEl) {
        console.warn('DOM element #hotel-map not found yet, retrying...');
        return;
      }

      if (this.map) {
        this.map.remove();
        this.map = null;
      }

      const firstHotel = this.hotels[0];
      try {
        this.map = L.map('hotel-map').setView([firstHotel.latitude, firstHotel.longitude], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);

        const markers: any[] = [];
        this.hotels.forEach((h, index) => {
          if (h.latitude !== 0 || h.longitude !== 0) {
            const m = L.marker([h.latitude, h.longitude])
              .addTo(this.map)
              .bindPopup(`<b>${h.nom}</b><br>${h.prixApprox}<br><a href="${h.osmLink}" target="_blank">OpenStreetMap</a>`);
            
            markers.push([h.latitude, h.longitude]);
            
            // Ouvrir la bulle pour le premier hôtel
            if (index === 0) {
              m.openPopup();
            }
          }
        });

        if (markers.length > 0) {
          this.map.fitBounds(markers, { padding: [50, 50] });
        }
        
        // Correction pour s'assurer que la carte se dessine bien
        setTimeout(() => {
           if (this.map) this.map.invalidateSize();
        }, 200);

      } catch (e) {
        console.error('Erreur lors de l\'initialisation de la carte Leaflet:', e);
      }
    }, 400); // Augmentation du délai pour la modal
  }

  fermerHotels(): void {
    this.destinationCity = '';
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  // ============================================================
  //  RÉCLAMATION
  // ============================================================
  faireReclamation(res: ReservationResponse): void {
    void this.router.navigate(['/reclamations/nouvelle'], {
      queryParams: {
        reservationId: res.id,
        reference: res.reference
      }
    });
  }

  private afficherMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg;
    this.messageType = type;
    setTimeout(() => (this.message = ''), 5000);
  }

  // ============================================================
  //  CONDITIONS
  // ============================================================
  peutPayer(res: ReservationResponse): boolean {
    const statutP = String(res.statutPaiement || '').toLowerCase().trim();
    const statutR = String(res.statutReservation || 'active').toLowerCase().trim();
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

  peutVoirBillet(res: ReservationResponse): boolean {
    const statutP = String(res.statutPaiement || '').toLowerCase().trim();
    return statutP === 'paye';
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

  aOffreAppliquee(res: ReservationResponse): boolean {
    const pInit = typeof res.prixInitial === 'number' ? res.prixInitial : parseFloat(res.prixInitial as any) || 0;
    const pTot = typeof res.prixTotal === 'number' ? res.prixTotal : parseFloat(res.prixTotal as any) || 0;
    const pBon = typeof res.remiseBonus === 'number' ? res.remiseBonus : parseFloat(res.remiseBonus as any) || 0;
    
    // Si la différence (PrixInitial - PrixTotal - Bonus) est supérieure à zéro, c'est qu'il y a eu une offre
    return (pInit - pTot - pBon) > 0.01;
  }

  formatRetard(minutes: number | undefined): string {
    if (!minutes || minutes <= 0) return '';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
}
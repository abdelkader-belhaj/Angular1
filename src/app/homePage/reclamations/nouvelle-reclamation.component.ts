import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ReclamationService } from '../../services/reclamation.service';
import { ReclamationPriorite } from '../../models/reclamation.model';

@Component({
  selector: 'app-nouvelle-reclamation',
  templateUrl: './nouvelle-reclamation.component.html',
  styleUrls: ['./nouvelle-reclamation.component.css']
})
export class NouvelleReclamationComponent implements OnInit {
  loading = false;
  message = '';
  messageType: 'success' | 'error' = 'success';

  reservationId: number | null = null;
  reservationRef: string | null = null;

  readonly priorites: { value: ReclamationPriorite; label: string }[] = [
    { value: 'normale', label: 'Normale' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'tres_urgent', label: 'Très urgent' }
  ];

  form: ReturnType<FormBuilder['group']>;

  constructor(
    private readonly fb: FormBuilder,
    private readonly reclamationService: ReclamationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    // Initialisation ici pour éviter l’accès à fb avant injection
    this.form = this.fb.group({
      priorite: ['normale' as ReclamationPriorite, [Validators.required]],
      sujet: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnInit(): void {
    const reservationIdStr = this.route.snapshot.queryParamMap.get('reservationId');
    const reservationRef = this.route.snapshot.queryParamMap.get('reference');
    this.reservationId = reservationIdStr ? Number(reservationIdStr) : null;
    this.reservationRef = reservationRef ? String(reservationRef) : null;

    if (!this.reservationId || Number.isNaN(this.reservationId)) {
      this.afficherMessage('Veuillez choisir une réservation pour faire une réclamation.', 'error');
      setTimeout(() => void this.router.navigate(['/mes-reservations']), 800);
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.afficherMessage('Veuillez compléter le formulaire.', 'error');
      return;
    }

    this.loading = true;
    this.message = '';

    const payload = {
      reservationId: this.reservationId!,
      priorite: this.form.value.priorite!,
      sujet: (this.form.value.sujet ?? '').trim()
    };

    this.reclamationService.creer(payload).subscribe({
      next: () => {
        this.loading = false;
        this.afficherMessage('✅ Réclamation envoyée. Vous serez notifié dès qu’une réponse est disponible.', 'success');
        setTimeout(() => void this.router.navigate(['/reclamations/mes']), 900);
      },
      error: (err) => {
        this.loading = false;
        this.afficherMessage(err?.error?.message || 'Erreur lors de l’envoi de la réclamation.', 'error');
      }
    });
  }

  retour(): void {
    void this.router.navigate(['/mes-reservations']);
  }

  private afficherMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg;
    this.messageType = type;
    setTimeout(() => (this.message = ''), 6000);
  }
}
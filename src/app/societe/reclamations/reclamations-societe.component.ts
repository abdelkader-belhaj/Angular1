import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ReclamationResponse } from '../../models/reclamation.model';
import { ReclamationService } from '../../services/reclamation.service';

@Component({
  selector: 'app-reclamations-societe',
  templateUrl: './reclamations-societe.component.html',
  styleUrls: ['./reclamations-societe.component.css']
})
export class ReclamationsSocieteComponent implements OnInit {
  reclamations: ReclamationResponse[] = [];
  loading = true;
  error = '';

  selected: ReclamationResponse | null = null;
  saving = false;
  message = '';

  form: ReturnType<FormBuilder['group']>;

  constructor(
    private readonly reclamationService: ReclamationService,
    private readonly fb: FormBuilder,
    private readonly router: Router
  ) {
    this.form = this.fb.group({
      reponse: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading = true;
    this.error = '';
    this.reclamationService.toutes().subscribe({
      next: (data) => {
        this.reclamations = data ?? [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Erreur de chargement des réclamations.';
        this.loading = false;
      }
    });
  }

  ouvrir(r: ReclamationResponse): void {
    this.selected = r;
    this.message = '';
    this.form.reset({
      reponse: r.reponse ?? ''
    });
  }

  fermer(): void {
    this.selected = null;
    this.message = '';
  }

  submit(): void {
    if (!this.selected) return;
    if (this.form.invalid) {
      this.message = 'Veuillez saisir une réponse.';
      return;
    }
    this.saving = true;
    this.message = '';
    const text = (this.form.value.reponse ?? '').trim();
    this.reclamationService.repondre(this.selected.id, text).subscribe({
      next: (updated) => {
        this.saving = false;
        this.message = '✅ Réponse envoyée (notif site + email).';
        // update list item in place
        const idx = this.reclamations.findIndex((x) => x.id === updated.id);
        if (idx >= 0) this.reclamations[idx] = updated;
        this.selected = updated;
        // Fermer le popup automatiquement après succès
        setTimeout(() => this.fermer(), 600);
      },
      error: (err) => {
        this.saving = false;
        this.message = err?.error?.message || 'Erreur lors de l’envoi.';
      }
    });
  }

  prioriteLabel(p: any): string {
    const v = String(p || '').toLowerCase();
    if (v === 'tres_urgent') return 'Très urgent';
    if (v === 'urgent') return 'Urgent';
    return 'Normale';
  }

  lc(v: any): string {
    return String(v ?? '').toLowerCase().trim();
  }

  retourDashboard(): void {
    this.router.navigate(['/societe']);
  }
}


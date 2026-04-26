import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ReclamationResponse } from '../../models/reclamation.model';
import { ReclamationService } from '../../services/reclamation.service';

@Component({
  selector: 'app-mes-reclamations',
  templateUrl: './mes-reclamations.component.html',
  styleUrls: ['./mes-reclamations.component.css']
})
export class MesReclamationsComponent implements OnInit {
  reclamations: ReclamationResponse[] = [];
  loading = true;
  error = '';

  selected: ReclamationResponse | null = null;
  markingRead = false;
  editMode = false;
  editPriorite: string = 'normale';
  editSujet: string = '';
  savingEdit = false;
  editMessage = '';

  constructor(
    private readonly reclamationService: ReclamationService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading = true;
    this.error = '';
    console.log('DEBUG: Chargement des réclamations...');
    this.reclamationService.mesReclamations().subscribe({
      next: (data) => {
        console.log('DEBUG: Réclamations reçues:', data);
        this.reclamations = data ?? [];
        this.loading = false;
      },
      error: (err) => {
        console.log('DEBUG: Erreur complète:', err);
        console.log('DEBUG: Status:', err.status);
        console.log('DEBUG: Message:', err.message);
        console.log('DEBUG: Error:', err.error);
        this.error = `Erreur de chargement des réclamations. Status: ${err.status} - ${err.message || err.error?.message || 'Erreur inconnue'}`;
        this.loading = false;
      }
    });
  }

  nouvelle(): void {
    // La réclamation doit être rattachée à une réservation
    void this.router.navigate(['/mes-reservations']);
  }

  
  ouvrir(r: ReclamationResponse): void {
    this.selected = r;
    this.editMode = false;
    this.editMessage = '';
    this.editPriorite = String(r.priorite || 'normale');
    this.editSujet = String(r.sujet || '');

    const statut = String(r.statut || '').toLowerCase().trim();
    const nonLu = r.clientLu === false;
    if (statut === 'repondue' && nonLu) {
      this.markingRead = true;
      this.reclamationService.marquerLu(r.id).subscribe({
        next: () => {
          this.markingRead = false;
          r.clientLu = true;
        },
        error: () => {
          this.markingRead = false;
        }
      });
    }
  }

  fermer(): void {
    this.selected = null;
    this.editMode = false;
    this.editMessage = '';
  }

  badgePriorite(p: any): string {
    const v = String(p || '').toLowerCase();
    if (v === 'tres_urgent') return 'Très urgent';
    if (v === 'urgent') return 'Urgent';
    return 'Normale';
  }

  prioriteClass(p: any): string {
    const v = String(p || '').toLowerCase();
    if (v === 'tres_urgent') return 'p-tres';
    if (v === 'urgent') return 'p-urgent';
    return 'p-normale';
  }

  statutLabel(s: any): string {
    const v = String(s || '').toLowerCase();
    return v === 'repondue' ? 'Répondue' : 'Ouverte';
  }

  lc(v: any): string {
    return String(v ?? '').toLowerCase().trim();
  }

  peutModifierSelected(): boolean {
    return !!this.selected && this.lc(this.selected.statut) === 'ouverte';
  }

  activerEdition(): void {
    if (!this.selected) return;
    if (!this.peutModifierSelected()) return;
    this.editMode = true;
    this.editMessage = '';
    this.editPriorite = String(this.selected.priorite || 'normale');
    this.editSujet = String(this.selected.sujet || '');
  }

  annulerEdition(): void {
    this.editMode = false;
    this.editMessage = '';
  }

  enregistrerEdition(): void {
    if (!this.selected) return;
    if (!this.peutModifierSelected()) return;

    const sujet = (this.editSujet || '').trim();
    if (sujet.length < 10) {
      this.editMessage = 'Sujet trop court (min 10 caractères).';
      return;
    }

    this.savingEdit = true;
    this.editMessage = '';
    this.reclamationService.modifier(this.selected.id, {
      priorite: this.editPriorite,
      sujet
    }).subscribe({
      next: (updated) => {
        this.savingEdit = false;
        const idx = this.reclamations.findIndex((x) => x.id === updated.id);
        if (idx >= 0) this.reclamations[idx] = updated;
        this.selected = updated;
        this.editMode = false;
      },
      error: (err) => {
        this.savingEdit = false;
        this.editMessage = err?.error?.message || 'Erreur lors de la modification.';
      }
    });
  }
}
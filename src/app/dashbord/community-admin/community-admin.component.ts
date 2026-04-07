import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { CommunityService, JoinRequest } from '../../services/community.service';
import { Community } from '../../models/community.model';
import { interval } from 'rxjs';
@Component({
  selector: 'app-community-admin',
  templateUrl: './community-admin.component.html',
  styleUrls: ['./community-admin.component.css']
})
export class CommunityAdminComponent implements OnInit {

  communities: Community[] = [];
  pendingRequests: Array<JoinRequest & { communityName: string }> = [];
  isFormOpen = false;
  isEditing = false;
  loading = false;
  successMsg = '';
  errorMsg = '';

  form: Community = this.emptyForm();

  categories = ['Tourisme', 'Culture', 'Sport', 'Gastronomie', 'Tech', 'Art', 'Music', 'Travel'];

  constructor(private communityService: CommunityService) {}

  get totalMembers(): number {
    return this.communities.reduce((sum, community) => sum + (community.totalMembers || 0), 0);
  }

  get uniqueCategories(): number {
    return new Set(this.communities.map((community) => community.category)).size;
  }

  ngOnInit(): void {
    this.loadAll();
     interval(5000).subscribe(() => {
    this.loadAll();
  });
  }

  loadAll(): void {
    this.loading = true;
    this.communityService.getAll().subscribe({
      next: (data) => {
        this.communities = data;
        this.pendingRequests = data.flatMap((community) =>
          (community.joinRequests ?? [])
            .filter((request) => request.status === 'pending')
            .map((request) => ({ ...request, communityName: community.name }))
        );
        this.loading = false;
      },
      error: () => { this.errorMsg = 'Erreur de chargement.'; this.loading = false; }
    });
  }

  approveJoinRequest(request: JoinRequest): void {
    this.communityService.approveJoin(request.communityId, request.user.id).subscribe((ok) => {
      if (ok) {
        this.successMsg = `La demande de ${request.user.username} a été approuvée.`;
        this.loadAll();
      } else {
        this.errorMsg = 'Impossible d’approuver cette demande.';
      }
    });
  }

  openCreate(): void {
    this.form = this.emptyForm();
    this.isEditing = false;
    this.isFormOpen = true;
    this.successMsg = '';
    this.errorMsg = '';
  }

  openEdit(c: Community): void {
    this.form = { ...c };
    this.isEditing = true;
    this.isFormOpen = true;
    this.successMsg = '';
    this.errorMsg = '';
  }

  closeForm(): void {
    this.isFormOpen = false;
  }

  submit(form: NgForm): void {
    this.successMsg = '';
    this.errorMsg = '';

    if (form.invalid || !this.isFormDataValid()) {
      this.errorMsg = 'Veuillez corriger les erreurs du formulaire avant de continuer.';
      return;
    }

    if (this.isEditing) {
      this.communityService.update(this.form.id!, this.form).subscribe({
        next: () => {
          this.successMsg = 'Communauté mise à jour !';
          this.loadAll();
          this.closeForm();
        },
        error: (err: any) => {
          console.error('UPDATE ERROR:', err);
          this.errorMsg = 'Erreur lors de la mise à jour.';
        }
      });
    } else {
      this.communityService.create(this.form).subscribe({
        next: () => {
          this.successMsg = 'Communauté créée !';
          this.loadAll();
          this.closeForm();
        },
        error: (err: any) => {
          console.error('CREATE ERROR:', err);
          this.errorMsg = 'Erreur lors de la création.';
        }
      });
    }
  }

  isFormDataValid(): boolean {
    const name = this.form.name?.trim() ?? '';
    const description = this.form.description?.trim() ?? '';
    const category = this.form.category?.trim() ?? '';

    const startsWithUppercase = /^[A-ZÀ-Ý]/.test(name);
    const validCategory = category !== '' && this.categories.includes(category);

    return (
      name !== '' &&
      startsWithUppercase &&
      description.length >= 24 &&
      validCategory
    );
  }

  delete(id?: number): void {
    if (id == null) {
      this.errorMsg = 'Impossible de supprimer : identifiant invalide.';
      return;
    }

    if (!confirm('Supprimer cette communauté ?')) return;

    this.communityService.delete(id).subscribe({
      next: () => {
        this.successMsg = 'Communauté supprimée.';
        this.loadAll();
      },
      error: (err: any) => {
        console.error('DELETE ERROR:', err);

        if (err.status === 0) {
          this.errorMsg = 'Erreur suppression : le serveur est injoignable.';
        } else if (err.status === 401 || err.status === 403) {
          this.errorMsg = 'Erreur suppression : accès refusé. Vérifiez votre session ou vos permissions.';
        } else {
          this.errorMsg = err.error?.message || err.message || 'Erreur suppression.';
        }
      }
    });
  }

  emptyForm(): Community {
    return { name: '', description: '', category: '' };
  }
}
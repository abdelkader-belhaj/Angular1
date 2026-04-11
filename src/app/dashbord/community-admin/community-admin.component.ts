import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { CommunityService, JoinRequest } from '../../services/community.service';
import { Community } from '../../models/community.model';
import { interval } from 'rxjs';

export interface ForumNotification {
  id: number;
  username: string;
  forumTitle: string;
  communityName: string;
  createdAt: string;
  read: boolean;
}

@Component({
  selector: 'app-community-admin',
  templateUrl: './community-admin.component.html',
  styleUrls: ['./community-admin.component.css']
})
export class CommunityAdminComponent implements OnInit {

  communities: Community[] = [];
  pendingRequests: Array<JoinRequest & { communityName: string }> = [];
  forumNotifications: ForumNotification[] = [];
  isFormOpen = false;
  isEditing = false;
  loading = false;
  successMsg = '';
  errorMsg = '';

  form: Community = this.emptyForm();
  categories = ['Tourisme', 'Culture', 'Sport', 'Gastronomie', 'Tech', 'Art', 'Music', 'Travel'];

  constructor(private communityService: CommunityService) {}

  get totalMembers(): number {
    return this.communities.reduce((sum, c) => sum + (c.totalMembers || 0), 0);
  }

  get uniqueCategories(): number {
    return new Set(this.communities.map(c => c.category)).size;
  }

  get unreadNotifications(): number {
    return this.forumNotifications.filter(n => !n.read).length;
  }

  ngOnInit(): void {
    this.loadAll();
    this.loadNotifications();
    interval(5000).subscribe(() => {
      this.loadAll();
      this.loadNotifications();
    });
  }

  loadNotifications(): void {
    try {
      const data = localStorage.getItem('forumNotifications');
      if (!data) return;
      this.forumNotifications = JSON.parse(data) || [];
    } catch {
      this.forumNotifications = [];
    }
  }

  markAllAsRead(): void {
    this.forumNotifications = this.forumNotifications.map(n => ({ ...n, read: true }));
    localStorage.setItem('forumNotifications', JSON.stringify(this.forumNotifications));
  }

  markAsRead(id: number): void {
    this.forumNotifications = this.forumNotifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    localStorage.setItem('forumNotifications', JSON.stringify(this.forumNotifications));
  }

  deleteNotification(id: number): void {
    this.forumNotifications = this.forumNotifications.filter(n => n.id !== id);
    localStorage.setItem('forumNotifications', JSON.stringify(this.forumNotifications));
  }

  loadAll(): void {
    this.loading = true;
    this.communityService.getAll().subscribe({
      next: (data) => {
        this.communities = data;
        this.pendingRequests = data.flatMap(c =>
          (c.joinRequests ?? [])
            .filter(r => r.status === 'pending')
            .map(r => ({ ...r, communityName: c.name }))
        );
        this.loading = false;
      },
      error: () => { this.errorMsg = 'Erreur de chargement.'; this.loading = false; }
    });
  }

  approveJoinRequest(request: JoinRequest): void {
    this.communityService.approveJoin(request.communityId, request.user.id).subscribe(ok => {
      if (ok) {
        this.successMsg = `La demande de ${request.user.username} a ete approuvee.`;
        this.loadAll();
      } else {
        this.errorMsg = 'Impossible d approuver cette demande.';
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
      this.errorMsg = 'Veuillez corriger les erreurs du formulaire.';
      return;
    }
    if (this.isEditing) {
      this.communityService.update(this.form.id!, this.form).subscribe({
        next: () => {
          this.successMsg = 'Communaute mise a jour !';
          this.loadAll();
          this.closeForm();
        },
        error: (err: any) => {
          this.errorMsg = 'Erreur lors de la mise a jour.';
        }
      });
    } else {
      this.communityService.create(this.form).subscribe({
        next: () => {
          this.successMsg = 'Communaute creee !';
          this.loadAll();
          this.closeForm();
        },
        error: (err: any) => {
          this.errorMsg = 'Erreur lors de la creation.';
        }
      });
    }
  }

  isFormDataValid(): boolean {
    const name = this.form.name?.trim() ?? '';
    const description = this.form.description?.trim() ?? '';
    const category = this.form.category?.trim() ?? '';
    return (
      name !== '' &&
      /^[A-ZÀ-Ý]/.test(name) &&
      description.length >= 24 &&
      category !== '' &&
      this.categories.includes(category)
    );
  }

  delete(id?: number): void {
    if (id == null) { this.errorMsg = 'Identifiant invalide.'; return; }
    if (!confirm('Supprimer cette communaute ?')) return;
    this.communityService.delete(id).subscribe({
      next: () => { this.successMsg = 'Communaute supprimee.'; this.loadAll(); },
      error: (err: any) => {
        if (err.status === 0) {
          this.errorMsg = 'Serveur injoignable.';
        } else if (err.status === 401 || err.status === 403) {
          this.errorMsg = 'Acces refuse.';
        } else {
          this.errorMsg = err.error?.message || 'Erreur suppression.';
        }
      }
    });
  }

  emptyForm(): Community {
    return { name: '', description: '', category: '' };
  }
  getLastActivityDate(): string {
  return this.forumNotifications[0]?.createdAt ?? '';
}
}
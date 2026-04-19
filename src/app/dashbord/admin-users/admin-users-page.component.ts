import { Component, OnInit, inject } from '@angular/core';
import { finalize } from 'rxjs';
import { AdminUserResponse, AdminUsersService } from './admin-users.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-users-page',
  templateUrl: './admin-users-page.component.html',
  styleUrls: ['./admin-users-page.component.css']
})
export class AdminUsersPageComponent implements OnInit {
  private readonly adminUsersService = inject(AdminUsersService);
  private readonly authService = inject(AuthService);

  users: AdminUserResponse[] = [];
  selectedUser: AdminUserResponse | null = null;
  loading = false;
  errorMessage = '';
  searchTerm = '';
  roleFilter = 'ALL';

  readonly roleOptions = [
    'ALL',
    'ADMIN',
    'CLIENT_TOURISTE',
    'HEBERGEUR',
    'TRANSPORTEUR',
    'AIRLINE_PARTNER',
    'ORGANISATEUR',
    'VENDEUR_ARTI',
    'SOCIETE'
  ];

  ngOnInit(): void {
    this.loadUsers();
  }

  get currentUserName(): string {
    return this.authService.getCurrentUser()?.username ?? 'Administrateur';
  }

  get filteredUsers(): AdminUserResponse[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.users.filter((user) => {
      const matchesSearch = !term
        || user.username.toLowerCase().includes(term)
        || user.email.toLowerCase().includes(term)
        || user.role.toLowerCase().includes(term);
      const matchesRole = this.roleFilter === 'ALL' || user.role === this.roleFilter;

      return matchesSearch && matchesRole;
    });
  }

  get activeUsersCount(): number {
    return this.users.filter((user) => user.enabled).length;
  }

  get inactiveUsersCount(): number {
    return this.users.filter((user) => !user.enabled).length;
  }

  isPendingApproval(user: AdminUserResponse): boolean {
    return !user.enabled && user.role !== 'CLIENT_TOURISTE';
  }

  get roleCount(): number {
    return new Set(this.users.map((user) => user.role)).size;
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMessage = '';

    this.adminUsersService
      .getAllUsers()
      .pipe(finalize(() => {
        this.loading = false;
      }))
      .subscribe({
        next: (users) => {
          this.users = users;
        },
        error: () => {
          this.errorMessage = 'Impossible de charger les utilisateurs pour le moment.';
        }
      });
  }

  refresh(): void {
    this.loadUsers();
  }

  openUserDetails(user: AdminUserResponse): void {
    this.selectedUser = user;
  }

  closeUserDetails(): void {
    this.selectedUser = null;
  }

  toggleStatus(user: AdminUserResponse): void {
    this.adminUsersService.toggleUser(user.id).subscribe({
      next: (updatedUser) => {
        this.users = this.users.map((item) => (item.id === updatedUser.id ? updatedUser : item));
        if (this.selectedUser?.id === updatedUser.id) {
          this.selectedUser = updatedUser;
        }
      },
      error: () => {
        this.errorMessage = 'Le statut utilisateur n a pas pu etre modifie.';
      }
    });
  }

  updateRole(user: AdminUserResponse, role: string): void {
    if (!role || role === user.role) {
      return;
    }

    this.adminUsersService.changeUserRole(user.id, role).subscribe({
      next: (updatedUser) => {
        this.users = this.users.map((item) => (item.id === updatedUser.id ? updatedUser : item));
        if (this.selectedUser?.id === updatedUser.id) {
          this.selectedUser = updatedUser;
        }
      },
      error: () => {
        this.errorMessage = 'Le role utilisateur n a pas pu etre modifie.';
      }
    });
  }

  deleteUser(user: AdminUserResponse): void {
    const confirmed = window.confirm(`Supprimer ${user.username} ? Cette action est definitive.`);
    if (!confirmed) {
      return;
    }

    this.adminUsersService.deleteUser(user.id).subscribe({
      next: () => {
        this.users = this.users.filter((item) => item.id !== user.id);
      },
      error: () => {
        this.errorMessage = 'La suppression a echoue.';
      }
    });
  }

  trackByUserId(_: number, user: AdminUserResponse): number {
    return user.id;
  }

  formatRole(role: string): string {
    return role.replaceAll('_', ' ');
  }

  getStatusLabel(user: AdminUserResponse): string {
    if (this.isPendingApproval(user)) {
      return 'En attente';
    }

    return user.enabled ? 'Actif' : 'Suspendu';
  }

  getToggleActionLabel(user: AdminUserResponse): string {
    if (this.isPendingApproval(user)) {
      return 'Accepter';
    }

    return user.enabled ? 'Suspendre' : 'Reactiver';
  }

  getUserInitial(user: AdminUserResponse): string {
    const source = (user.username || user.email || '?').trim();
    return source ? source.charAt(0).toUpperCase() : '?';
  }

  getTwoFactorStatusLabel(user: AdminUserResponse): string {
    return user.twoFactorEnabled ? 'Active' : 'Non active';
  }

  getFaceIdStatusLabel(user: AdminUserResponse): string {
    return user.hasFaceId ? 'Enregistre' : 'Non enregistre';
  }

  formatDateTime(value?: string): string {
    if (!value) {
      return 'N/A';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }
}

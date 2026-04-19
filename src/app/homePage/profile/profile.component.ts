import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  isEditing = false;
  updateError = '';
  updateSuccess = '';
  isUpdating = false;
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly profileForm = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]]
  });

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/']);
      return;
    }

    this.profileForm.patchValue({
      username: user.username,
      email: user.email
    });
  }

  get currentUser() {
    return this.authService.getCurrentUser();
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    this.updateError = '';
    this.updateSuccess = '';

    if (!this.isEditing) {
      // Reset form to current user data
      const user = this.authService.getCurrentUser();
      if (user) {
        this.profileForm.patchValue({
          username: user.username,
          email: user.email
        });
      }
    }
  }

  async updateProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isUpdating = true;
    this.updateError = '';
    this.updateSuccess = '';

    try {
      // TODO: Implement profile update API call
      // For now, just show success message
      this.updateSuccess = 'Profil mis à jour avec succès.';
      this.isEditing = false;
    } catch (error: any) {
      this.updateError = error?.error?.message || 'Erreur lors de la mise à jour du profil.';
    } finally {
      this.isUpdating = false;
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  getRoleLabel(role?: string): string {
    switch (role) {
      case 'CLIENT_TOURISTE': return 'Client Touriste';
      case 'HEBERGEUR': return 'Hébergeur';
      case 'ADMIN': return 'Administrateur';
      case 'TRANSPORTEUR': return 'Transporteur';
      case 'AIRLINE_PARTNER': return 'Partenaire Aérien';
      case 'ORGANISATEUR': return 'Organisateur';
      case 'VENDEUR_ARTI': return 'Vendeur Artisan';
      case 'SOCIETE': return 'Société';
      default: return 'Utilisateur';
    }
  }
}
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-user-profile-banner',
  standalone: false,
  templateUrl: './user-profile-banner.component.html',
  styleUrl: './user-profile-banner.component.css'
})
export class UserProfileBannerComponent implements OnInit {
  private readonly authService = inject(AuthService);
  
  currentUser: any = null;

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
  }

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  getRoleLabel(role: string): string {
    const roleLabels: { [key: string]: string } = {
      'CLIENT_TOURISTE': 'Client Touriste',
      'HEBERGEUR': 'Hébergeur',
      'ADMIN': 'Administrateur',
      'TRANSPORT': 'Transport',
      'AIRLINE': 'Compagnie Aérienne',
      'ORGANIZER': 'Organisateur d\'Événements',
      'ARTISAN': 'Artisan',
      'COMPANY': 'Entreprise'
    };
    return roleLabels[role] || role;
  }
}

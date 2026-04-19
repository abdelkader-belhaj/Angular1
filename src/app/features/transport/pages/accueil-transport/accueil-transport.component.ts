import { Component } from '@angular/core';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-accueil-transport',
  templateUrl: './accueil-transport.component.html',
  styleUrl: './accueil-transport.component.css',
})
export class AccueilTransportComponent {
  constructor(private readonly authService: AuthService) {}

  get normalizedRole(): string {
    return (this.currentRole || '').toUpperCase().replace(/^ROLE_/, '');
  }

  get currentRole(): string {
    return this.authService.getCurrentUser()?.role ?? 'ANONYMOUS';
  }

  get canAccessAgenceLocation(): boolean {
    return this.normalizedRole === 'TRANSPORTEUR';
  }
}

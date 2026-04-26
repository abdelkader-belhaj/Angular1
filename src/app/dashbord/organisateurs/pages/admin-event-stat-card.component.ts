import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-admin-event-stat-card',
  templateUrl: './admin-event-stat-card.component.html',
  styleUrl: './admin-event-stat-card.component.css'
})
export class AdminEventStatCardComponent {
  @Input() status: string = '';
  @Input() count: number = 0;

  getStatusLabel(): string {
    const map: { [key: string]: string } = {
      'DRAFT':     'Brouillons',
      'PUBLISHED': 'Publiés',
      'REJECTED':  'Rejetés',
      'CANCELLED': 'Annulés'
    };
    return map[this.status] || this.status;
  }

  getStatusHint(): string {
    const map: { [key: string]: string } = {
      'DRAFT':     'En attente de révision',
      'PUBLISHED': 'En ligne actuellement',
      'REJECTED':  'Non conformes',
      'CANCELLED': 'Événements annulés'
    };
    return map[this.status] || '';
  }

  getAccentColor(): string {
    const map: { [key: string]: string } = {
      'DRAFT':     'bg-amber-400',
      'PUBLISHED': 'bg-green-500',
      'REJECTED':  'bg-red-500',
      'CANCELLED': 'bg-gray-400'
    };
    return map[this.status] || 'bg-primary';
  }

  getIconBg(): string {
    const map: { [key: string]: string } = {
      'DRAFT':     'bg-amber-100',
      'PUBLISHED': 'bg-green-100',
      'REJECTED':  'bg-red-100',
      'CANCELLED': 'bg-gray-100'
    };
    return map[this.status] || 'bg-primary-container';
  }

  getIconColor(): string {
    const map: { [key: string]: string } = {
      'DRAFT':     'text-amber-600',
      'PUBLISHED': 'text-green-700',
      'REJECTED':  'text-red-700',
      'CANCELLED': 'text-gray-500'
    };
    return map[this.status] || 'text-primary';
  }
}
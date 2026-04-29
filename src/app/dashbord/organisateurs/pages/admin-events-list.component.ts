import { Component, OnInit } from '@angular/core';
import { AdminEventsService, EventActivityResponse } from './admin-events.service';

@Component({
  selector: 'app-admin-events-list',
  templateUrl: './admin-events-list.component.html',
  styleUrl: './admin-events-list.component.css'
})
export class AdminEventsListComponent implements OnInit {
  events: EventActivityResponse[] = [];
  filteredEvents: EventActivityResponse[] = [];
  selectedEvent: EventActivityResponse | null = null;
  newEventPopupTarget: EventActivityResponse | null = null;
  rejectTargetEvent: EventActivityResponse | null = null;
  rejectReason = '';
  showRejectModal = false;
  cancelTargetEvent: EventActivityResponse | null = null;
  cancelReason = '';
  showCancelModal = false;
  loading = false;
  error = '';
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  searchQuery = '';
  selectedStatus = 'ALL';
  showActionMenu: number | null = null;
  actionInProgress: { [key: number]: string } = {};
  currentPage = 1;
  readonly pageSize = 8;

  statusOptions = [
    { value: 'ALL', label: 'Tous les statuts' },
    { value: 'DRAFT', label: 'Brouillons' },
    { value: 'PUBLISHED', label: 'Publiés' },
    { value: 'REJECTED', label: 'Rejetés' },
    { value: 'CANCELLED', label: 'Annulés' }
  ];

  constructor(private adminEventsService: AdminEventsService) {}

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.loading = true;
    this.error = '';

    this.adminEventsService.getAllEvents().subscribe({
      next: (data) => {
        this.events = data;
        this.filterEvents();
        this.showNewEventPopupIfNeeded();
        this.showToast('Liste des evenements chargee', 'success');
        this.loading = false;
      },
      error: (err) => {
        const status = err?.status ?? 'inconnu';
        this.error = `Erreur chargement evenements (HTTP ${status})`;
        this.showToast(this.error, 'error');
        console.error(err);
        this.loading = false;
      }
    });
  }

  filterEvents(): void {
    let filtered = this.events;

    // Filtrer par statut
    if (this.selectedStatus !== 'ALL') {
      filtered = filtered.filter(e => e.status === this.selectedStatus);
    }

    // Filtrer par recherche
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.organizerName.toLowerCase().includes(query) ||
        e.city.toLowerCase().includes(query)
      );
    }

    this.filteredEvents = filtered;
    this.currentPage = 1;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredEvents.length / this.pageSize));
  }

  get paginatedEvents(): EventActivityResponse[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredEvents.slice(start, start + this.pageSize);
  }

  get pageStartItem(): number {
    if (this.filteredEvents.length === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get pageEndItem(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredEvents.length);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onSearchChange(): void {
    this.filterEvents();
  }

  onStatusChange(): void {
    this.filterEvents();
  }

  getStatusBadge(status: string): string {
    const map: { [key: string]: string } = {
      'DRAFT': 'bg-orange-100 text-orange-800',
      'PUBLISHED': 'bg-green-100 text-green-800',
      'REJECTED': 'bg-red-100 text-red-800',
      'CANCELLED': 'bg-gray-100 text-gray-800'
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  }

  getStatusLabel(status: string): string {
    const map: { [key: string]: string } = {
      'DRAFT': 'Brouillon',
      'PUBLISHED': 'Publié',
      'REJECTED': 'Rejeté',
      'CANCELLED': 'Annulé'
    };
    return map[status] || status;
  }

  getTypeLabel(type: string): string {
    const map: { [key: string]: string } = {
      'EVENT': 'Événement',
      'ACTIVITY': 'Activité'
    };
    return map[type] || type;
  }

  toggleActionMenu(eventId: number): void {
    this.showActionMenu = this.showActionMenu === eventId ? null : eventId;
  }

  openEventDetails(event: EventActivityResponse): void {
    this.selectedEvent = event;
    this.showActionMenu = null;
  }

  closeNewEventPopup(): void {
    this.newEventPopupTarget = null;
  }

  openNewEventDetails(): void {
    if (!this.newEventPopupTarget) return;
    this.selectedEvent = this.newEventPopupTarget;
    this.newEventPopupTarget = null;
  }

  closeEventDetails(): void {
    this.selectedEvent = null;
  }

  publishEvent(event: EventActivityResponse): void {
    if (event.status !== 'DRAFT') {
      this.error = 'Seuls les brouillons peuvent être publiés';
      return;
    }

    this.actionInProgress[event.id] = 'publishing';

    this.adminEventsService.publishEvent(event.id).subscribe({
      next: (updated) => {
        const index = this.events.findIndex(e => e.id === event.id);
        if (index !== -1) {
          this.events[index] = updated;
        }
        this.filterEvents();
        this.showToast('Evenement publie avec succes', 'success');
        delete this.actionInProgress[event.id];
        this.showActionMenu = null;
      },
      error: (err) => {
        this.error = 'Erreur lors de la publication';
        this.showToast(this.error, 'error');
        console.error(err);
        delete this.actionInProgress[event.id];
      }
    });
  }

  openRejectModal(event: EventActivityResponse): void {
    this.rejectTargetEvent = event;
    this.rejectReason = '';
    this.showRejectModal = true;
    this.showActionMenu = null;
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.rejectTargetEvent = null;
    this.rejectReason = '';
  }

  submitReject(): void {
    if (!this.rejectTargetEvent) return;

    const reason = this.rejectReason.trim();
    if (reason.length > 500) {
      this.showToast('Motif trop long (max 500 caracteres)', 'error');
      return;
    }

    const event = this.rejectTargetEvent;
    this.actionInProgress[event.id] = 'rejecting';

    this.adminEventsService.rejectEvent(event.id, { reason: reason || undefined }).subscribe({
      next: (updated) => {
        const index = this.events.findIndex(e => e.id === event.id);
        if (index !== -1) {
          this.events[index] = updated;
        }
        this.filterEvents();
        this.showToast(reason ? 'Evenement rejete avec motif' : 'Evenement rejete', 'success');
        delete this.actionInProgress[event.id];
        this.closeRejectModal();
      },
      error: (err) => {
        this.error = 'Erreur lors du rejet';
        this.showToast(this.error, 'error');
        console.error(err);
        delete this.actionInProgress[event.id];
      }
    });
  }

  rejectEvent(event: EventActivityResponse): void {
    if (event.status !== 'DRAFT') {
      this.error = 'Seuls les brouillons peuvent être rejetés';
      return;
    }

    this.openRejectModal(event);
  }

  cancelEvent(event: EventActivityResponse): void {
    if (event.status !== 'PUBLISHED') {
      this.error = 'Seuls les événements publiés peuvent être annulés';
      return;
    }

    this.cancelTargetEvent = event;
    this.cancelReason = '';
    this.showCancelModal = true;
    this.showActionMenu = null;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.cancelTargetEvent = null;
    this.cancelReason = '';
  }

  submitCancel(): void {
    if (!this.cancelTargetEvent) return;
    const event = this.cancelTargetEvent;
    const reason = this.cancelReason.trim();

    if (reason.length < 10) {
      this.showToast('Motif obligatoire (minimum 10 caractères).', 'error');
      return;
    }

    this.actionInProgress[event.id] = 'cancelling';
    this.adminEventsService.cancelEvent(event.id, { reason }).subscribe({
      next: (updated) => {
        const index = this.events.findIndex(e => e.id === event.id);
        if (index !== -1) {
          this.events[index] = updated;
        }
        this.filterEvents();
        this.showToast('Evenement annule avec motif', 'success');
        delete this.actionInProgress[event.id];
        this.closeCancelModal();
      },
      error: (err) => {
        this.error = 'Erreur lors de l\'annulation';
        this.showToast(this.error, 'error');
        console.error(err);
        delete this.actionInProgress[event.id];
      }
    });
  }

  deleteEvent(event: EventActivityResponse): void {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'événement "${event.title}" ?`)) {
      return;
    }

    this.actionInProgress[event.id] = 'deleting';

    this.adminEventsService.deleteEvent(event.id).subscribe({
      next: () => {
        this.events = this.events.filter(e => e.id !== event.id);
        this.filterEvents();
        this.showToast('Evenement supprime', 'success');
        delete this.actionInProgress[event.id];
        this.showActionMenu = null;
      },
      error: (err) => {
        this.error = 'Erreur lors de la suppression';
        this.showToast(this.error, 'error');
        console.error(err);
        delete this.actionInProgress[event.id];
      }
    });
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
    }, 2800);
  }

  private showNewEventPopupIfNeeded(): void {
    const latest = [...this.events]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (!latest) return;

    const storageKey = 'admin.events.lastSeenCreatedAt';
    const lastSeen = localStorage.getItem(storageKey);
    if (!lastSeen || new Date(latest.createdAt).getTime() > new Date(lastSeen).getTime()) {
      this.newEventPopupTarget = latest;
      localStorage.setItem(storageKey, latest.createdAt);
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getAvailableActions(event: EventActivityResponse): string[] {
    const actions = ['view'];

    if (event.status === 'DRAFT') {
      actions.push('publish', 'reject');
    } else if (event.status === 'PUBLISHED') {
      actions.push('cancel');
    }

    if (event.status === 'REJECTED' || event.status === 'CANCELLED') {
      actions.push('delete');
    }

    return actions;
  }

  getActionLabel(action: string): string {
    const map: { [key: string]: string } = {
      'view': '👁️ Voir',
      'publish': '✅ Publier',
      'reject': '❌ Rejeter',
      'cancel': '⛔ Annuler',
      'delete': '🗑️ Supprimer'
    };
    return map[action] || action;
  }

  getActionColor(action: string): string {
    const map: { [key: string]: string } = {
      'view': 'text-blue-600',
      'publish': 'text-green-600',
      'reject': 'text-red-600',
      'cancel': 'text-orange-600',
      'delete': 'text-red-700'
    };
    return map[action] || 'text-gray-600';
  }

  performAction(action: string, event: EventActivityResponse): void {
    switch (action) {
      case 'publish':
        this.publishEvent(event);
        break;
      case 'reject':
        this.openRejectModal(event);
        break;
      case 'cancel':
        this.cancelEvent(event);
        break;
      case 'delete':
        this.deleteEvent(event);
        break;
      case 'view':
        this.openEventDetails(event);
        break;
    }
  }
}

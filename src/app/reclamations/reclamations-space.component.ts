import { Component, OnInit, inject } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ReservationService, ReservationResponse } from '../services/accommodation/reservation.service';
import { LogementService, Logement } from '../services/accommodation/logement.service';
import {
  ReclamationService,
  ReclamationItem,
  ReclamationImage,
  ReclamationStatus,
  ReclamationActorRole
} from '../services/accommodation/reclamation.service';

interface ReservationOption {
  reservationId: number;
  logementId: number;
  hebergeurId: number;
  label: string;
  logementNom: string;
}

@Component({
  selector: 'app-reclamations-space',
  templateUrl: './reclamations-space.component.html',
  styleUrl: './reclamations-space.component.css'
})
export class ReclamationsSpaceComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly reservationService = inject(ReservationService);
  private readonly logementService = inject(LogementService);
  private readonly reclamationService = inject(ReclamationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  loading = true;
  saving = false;
  replyingId: string | null = null;
  requestError = '';
  requestSuccess = '';
  clientReplyNotice = '';
  private errorTimeoutId: ReturnType<typeof setTimeout> | null = null;

  reclamations: ReclamationItem[] = [];
  reservationOptions: ReservationOption[] = [];
  currentReservationOption: ReservationOption | null = null;

  formData = {
    title: '',
    description: ''
  };

  imageFiles: ReclamationImage[] = [];
  replyDrafts: Record<string, string> = {};
  private readonly openedConversationIds = new Set<string>();
  private requestedReclamationId: string | null = null;
  readonly statusOptions: ReclamationStatus[] = ['ouverte', 'en_cours', 'resolue'];

  get currentUser() {
    return this.authService.getCurrentUser();
  }

  get role(): string {
    return this.currentUser?.role || '';
  }

  get isClient(): boolean {
    return this.role === 'CLIENT_TOURISTE';
  }

  get isHebergeur(): boolean {
    return this.role === 'HEBERGEUR';
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  get createBlockedReason(): string {
    if (!this.isClient) return '';

    if (!this.currentReservationOption) {
      return 'Vous pouvez déclarer une réclamation uniquement pour une réservation actuellement en cours.';
    }

    const clientId = this.currentUser?.id ?? 0;
    const blocking = this.reclamationService.getBlockingReclamationForClient(clientId);
    if (blocking) {
      return 'Vous ne pouvez pas envoyer une nouvelle réclamation tant que la précédente n\'a pas reçu une réponse de l\'Equipe TunisiaTour.';
    }

    return '';
  }

  get canCreateReclamation(): boolean {
    if (!this.isClient || !this.currentReservationOption) return false;
    return this.reclamationService.canClientCreateReclamation(this.currentUser?.id ?? 0);
  }

  get reclamationsEnCours(): number {
    return this.reclamations.filter(r => r.status === 'en_cours').length;
  }

  get reclamationsResolues(): number {
    return this.reclamations.filter(r => r.status === 'resolue').length;
  }

  private setError(msg: string): void {
    if (this.errorTimeoutId) {
      clearTimeout(this.errorTimeoutId);
    }
    this.requestError = msg;
    this.errorTimeoutId = setTimeout(() => {
      this.requestError = '';
      this.errorTimeoutId = null;
    }, 5000);
  }

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/']);
      return;
    }

    if (!(this.isClient || this.isHebergeur || this.isAdmin)) {
      this.router.navigate(['/']);
      return;
    }

    this.route.queryParamMap.subscribe((params) => {
      this.requestedReclamationId = params.get('reclamationId');
      this.tryFocusRequestedReclamation();
    });

    this.bootstrapData();
  }

  private bootstrapData(): void {
    this.loading = true;
    this.requestError = '';
    this.requestSuccess = '';

    if (this.isClient) {
      this.loadClientData();
      return;
    }

    this.refreshReclamations();
  }

  private loadClientData(): void {
    this.reservationService.getAllReservations().subscribe({
      next: (reservations) => {
        const confirmed = reservations.filter((r) => (r.statut || '').toLowerCase() === 'confirmee');
        if (!confirmed.length) {
          this.reservationOptions = [];
          this.refreshReclamations();
          return;
        }

        this.logementService.getLogements().subscribe({
          next: (logements) => {
            const byId = new Map<number, Logement>();
            logements.forEach((l) => byId.set(l.idLogement, l));

            this.reservationOptions = confirmed.map((r) => {
              const logement = byId.get(r.idLogement);
              const period = `${this.formatDate(r.dateDebut)} - ${this.formatDate(r.dateFin)}`;
              return {
                reservationId: r.idReservation,
                logementId: r.idLogement,
                hebergeurId: logement?.idHebergeur ?? 0,
                logementNom: r.nomLogement,
                label: `${r.nomLogement} • ${period}`
              };
            });
            this.currentReservationOption = this.resolveCurrentReservationOption(confirmed, this.reservationOptions);
            this.refreshReclamations();
          },
          error: () => {
            this.reservationOptions = confirmed.map((r) => ({
              reservationId: r.idReservation,
              logementId: r.idLogement,
              hebergeurId: 0,
              logementNom: r.nomLogement,
              label: r.nomLogement
            }));
            this.currentReservationOption = this.resolveCurrentReservationOption(confirmed, this.reservationOptions);
            this.refreshReclamations();
          }
        });
      },
      error: () => {
        this.requestError = 'Impossible de vérifier vos réservations pour les réclamations.';
        this.loading = false;
      }
    });
  }

  refreshReclamations(): void {
    const uid = this.currentUser?.id ?? 0;
    if (this.isClient) {
      const unreadReplies = this.reclamationService.getClientUnreadReplyCount(uid);
      this.clientReplyNotice = unreadReplies > 0
        ? `Vous avez ${unreadReplies} nouvelle(s) réponse(s) de l'Equipe TunisiaTour.`
        : '';
      if (unreadReplies > 0) {
        this.reclamationService.markClientRepliesAsSeen(uid);
      }
      this.reclamations = this.reclamationService.getByClient(uid);
    } else if (this.isHebergeur) {
      this.reclamations = this.reclamationService.getByHebergeur(uid);
    } else {
      this.reclamations = this.reclamationService.getAll();
    }
    this.loading = false;
    this.tryFocusRequestedReclamation();
  }

  private tryFocusRequestedReclamation(): void {
    if (!this.requestedReclamationId || this.loading) return;
    if (!this.reclamations.some((x) => x.id === this.requestedReclamationId)) return;

    this.openedConversationIds.add(this.requestedReclamationId);

    const targetId = this.requestedReclamationId;
    setTimeout(() => {
      const el = document.getElementById(`reclamation-card-${targetId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }

  isConversationOpen(itemId: string): boolean {
    return this.openedConversationIds.has(itemId);
  }

  toggleConversation(itemId: string): void {
    if (this.openedConversationIds.has(itemId)) {
      this.openedConversationIds.delete(itemId);
      return;
    }
    this.openedConversationIds.add(itemId);
  }

  onImagesSelected(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (!files || !files.length) return;

    const allowed = Array.from(files).slice(0, 4);
    const readers = allowed.map((file) => this.toCompressedDataUrl(file));

    Promise.all(readers).then((items) => {
      this.imageFiles = items;
    });
  }

  removeImage(index: number): void {
    this.imageFiles = this.imageFiles.filter((_, i) => i !== index);
  }

  createReclamation(): void {
    if (!this.canCreateReclamation) {
      this.requestSuccess = '';
      this.setError(this.createBlockedReason);
      return;
    }
    if (!this.formData.title.trim() || !this.formData.description.trim()) {
      this.requestSuccess = '';
      this.setError('Titre et description sont obligatoires.');
      return;
    }

    const selected = this.currentReservationOption;
    if (!selected) {
      this.requestSuccess = '';
      this.setError('Aucune réservation active trouvée pour déposer une réclamation.');
      return;
    }

    this.saving = true;
    this.requestError = '';

    try {
      this.reclamationService.createReclamation({
        clientId: this.currentUser?.id ?? 0,
        clientName: this.getPreferredUsername(),
        clientEmail: this.currentUser?.email,
        reservationId: selected.reservationId,
        logementId: selected.logementId,
        logementNom: selected.logementNom,
        hebergeurId: selected.hebergeurId,
        title: this.formData.title,
        description: this.formData.description,
        images: this.imageFiles
      });
    } catch (error) {
      this.requestSuccess = '';
      this.setError(error instanceof Error ? error.message : 'Impossible de créer la réclamation.');
      this.saving = false;
      return;
    }

    this.formData.title = '';
    this.formData.description = '';
    this.imageFiles = [];
    this.requestSuccess = 'Votre réclamation a bien été envoyée. L\'Equipe TunisiaTour vous répondra dans les plus brefs délais.';
    this.saving = false;
    this.refreshReclamations();
  }

  replyDisplayName(
    reply: { authorRole: ReclamationActorRole; authorName?: string; authorId?: number },
    fallbackClientName?: string,
    fallbackClientEmail?: string
  ): string {
    if (reply.authorRole === 'ADMIN') {
      return 'Equipe Tunisia Tour';
    }

    if (reply.authorRole === 'HEBERGEUR') {
      const hostName = (reply.authorName || '').trim();
      if (hostName && !hostName.includes('@')) return hostName;
      return 'Hebergeur';
    }

    // Client touristique: afficher le mail du client qui a ouvert la reclamation.
    const rawClientEmail = (fallbackClientEmail || '').trim();
    if (rawClientEmail && rawClientEmail.includes('@')) {
      return rawClientEmail;
    }

    const rawAuthorName = (reply.authorName || '').trim();
    if (rawAuthorName && rawAuthorName.includes('@')) {
      return rawAuthorName;
    }

    if (rawAuthorName && !rawAuthorName.includes('@') && rawAuthorName.toLowerCase() !== 'client') {
      return rawAuthorName;
    }

    const rawFallbackName = (fallbackClientName || '').trim();
    if (rawFallbackName && !rawFallbackName.includes('@')) {
      return rawFallbackName;
    }

    return 'Client';
  }

  replyRoleBadge(role: ReclamationActorRole): string {
    if (role === 'CLIENT_TOURISTE') return 'Client touristique';
    if (role === 'HEBERGEUR') return 'Hebergeur';
    return 'Equipe Tunisia Tour';
  }

  showReplyRoleBadge(role: ReclamationActorRole): boolean {
    return role !== 'ADMIN';
  }

  replyBubbleClass(reply: { authorRole: ReclamationActorRole }): string {
    if (reply.authorRole === 'CLIENT_TOURISTE') return 'from-client';
    if (reply.authorRole === 'HEBERGEUR') return 'from-hebergeur';
    return 'from-admin';
  }

  replyAvatarText(reply: { authorRole: ReclamationActorRole }): string {
    if (reply.authorRole === 'CLIENT_TOURISTE') return 'C';
    if (reply.authorRole === 'HEBERGEUR') return 'H';
    return 'T';
  }

  isClientAuthor(reply: { authorRole: ReclamationActorRole }): boolean {
    return reply.authorRole === 'CLIENT_TOURISTE';
  }

  getCurrentReservationLabel(): string {
    return this.currentReservationOption?.label || '';
  }

  private resolveCurrentReservationOption(
    reservations: ReservationResponse[],
    options: ReservationOption[]
  ): ReservationOption | null {
    const now = new Date();

    const currentReservation = reservations
      .filter((r) => this.isReservationActiveNow(r, now))
      .sort((a, b) => new Date(b.dateDebut).getTime() - new Date(a.dateDebut).getTime())[0];

    if (!currentReservation) return null;
    return options.find((x) => x.reservationId === currentReservation.idReservation) || null;
  }

  private isReservationActiveNow(reservation: ReservationResponse, now: Date): boolean {
    if (!reservation.dateDebut || !reservation.dateFin) return false;

    const start = new Date(reservation.dateDebut);
    start.setHours(0, 0, 0, 0);

    const end = new Date(reservation.dateFin);
    end.setHours(23, 59, 59, 999);

    return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
  }

  canReply(item: ReclamationItem): boolean {
    if (this.isClient) return item.clientId === (this.currentUser?.id ?? 0);
    if (this.isAdmin) return true;
    if (this.isHebergeur) return item.hebergeurId === (this.currentUser?.id ?? 0);
    return false;
  }

  canManageStatus(item: ReclamationItem): boolean {
    if (this.isAdmin) return true;
    if (this.isHebergeur) return item.hebergeurId === (this.currentUser?.id ?? 0);
    return false;
  }

  sendReply(item: ReclamationItem): void {
    const text = (this.replyDrafts[item.id] || '').trim();
    if (!text) return;

    const role = (this.currentUser?.role || 'ADMIN') as ReclamationActorRole;
    this.replyingId = item.id;

    const authorName = role === 'CLIENT_TOURISTE'
      ? (this.currentUser?.email || this.getPreferredUsername())
      : this.getPreferredUsername();

    this.reclamationService.addReply(
      item.id,
      this.currentUser?.id ?? 0,
      authorName,
      role,
      text
    );

    this.replyDrafts[item.id] = '';
    this.replyingId = null;
    this.refreshReclamations();
  }

  updateStatus(item: ReclamationItem, status: ReclamationStatus): void {
    if (!this.canReply(item)) return;
    this.reclamationService.updateStatus(item.id, status);
    this.refreshReclamations();
  }

  statusClass(status: ReclamationStatus): string {
    if (status === 'ouverte') return 'badge-open';
    if (status === 'en_cours') return 'badge-progress';
    return 'badge-resolved';
  }

  statusLabel(status: ReclamationStatus): string {
    if (status === 'ouverte') return 'Ouverte';
    if (status === 'en_cours') return 'En cours';
    return 'Résolue';
  }

  statusIcon(status: ReclamationStatus): string {
    if (status === 'resolue') return 'task_alt';
    if (status === 'en_cours') return 'hourglass_top';
    return 'radio_button_unchecked';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigate(['/mes-reservations']);
  }

  private toCompressedDataUrl(file: File): Promise<ReclamationImage> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result || '');

        const image = new Image();
        image.onload = () => {
          const maxWidth = 640;
          const ratio = image.width > maxWidth ? maxWidth / image.width : 1;
          const width = Math.max(1, Math.round(image.width * ratio));
          const height = Math.max(1, Math.round(image.height * ratio));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ name: file.name, dataUrl: base64 });
            return;
          }

          ctx.drawImage(image, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', 0.58);
          resolve({
            name: file.name,
            dataUrl: compressed || base64
          });
        };

        image.onerror = () => {
          resolve({ name: file.name, dataUrl: base64 });
        };

        image.src = base64;
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private getPreferredUsername(): string {
    const username = (this.currentUser?.username || '').trim();
    if (username) return username;
    return 'Client';
  }

  archiveReclamation(item: ReclamationItem): void {
    if (confirm('Êtes-vous sûr de vouloir archiver cette réclamation ?')) {
      try {
        this.reclamationService.archiveReclamation(item.id);
        this.requestSuccess = 'Réclamation archivée avec succès.';
        this.requestError = '';
        this.refreshReclamations();
      } catch (error) {
        this.requestSuccess = '';
        this.setError(error instanceof Error ? error.message : 'Impossible d\'archiver la réclamation.');
      }
    }
  }

  deleteReclamation(item: ReclamationItem): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette réclamation ? Cette action est irréversible.')) {
      try {
        this.reclamationService.deleteReclamation(item.id);
        this.requestSuccess = 'Réclamation supprimée avec succès.';
        this.requestError = '';
        this.refreshReclamations();
      } catch (error) {
        this.requestSuccess = '';
        this.setError(error instanceof Error ? error.message : 'Impossible de supprimer la réclamation.');
      }
    }
  }
}


import { ActivatedRoute, Router } from '@angular/router';
import { CommunityService } from '../../../services/community.service';
import { ForumService } from '../../../services/forum.service';
import { AuthService } from '../../../services/auth.service';
import { Community } from '../../../models/community.model';
import { Forum } from '../../../models/forum.model';
import { Reaction, ForumComment, Review } from '../../../models/forum-interactions.model';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ModerationService } from '../../../services/ModerationService';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as L from 'leaflet';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ForumConditionsService } from '../../../services/forum-conditions.service';
import { TranslationService } from '../../../services/translation.service';


@Component({
  selector: 'app-forum-detail',
  templateUrl: './forum-detail.component.html',
  styleUrls: ['./forum-detail.component.css']
})
export class ForumDetailComponent implements OnInit, OnDestroy {

  community?: Community;
  forums: Forum[] = [];
  forum?: Forum;
  currentUser?: { id: number; username: string } | null;
  showCreateForm = false;
  editingForum?: Forum;

  // Form data
  forumTitle = '';
  forumContent = '';

  // UI state
  infoMessage = '';
  errorMessage = '';
  loading = false;
  isLoginDialogOpen = false;

  // Interactions
  private reactionsMap: Map<number, Reaction[]> = new Map();
  private commentsMap: Map<number, ForumComment[]> = new Map();
  private reviewsMap: Map<number, Review[]> = new Map();

  // ✅ SORT & FILTER
  sortOrder: 'newest' | 'oldest' | 'popular' | 'positive' | 'negative' = 'newest';
  searchQuery = '';
  filteredForums: Forum[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private communityService: CommunityService,
    private forumService: ForumService,
    private authService: AuthService,
    private http: HttpClient,
    private moderationService: ModerationService,
    private sanitizer: DomSanitizer,
    private forumConditionsService: ForumConditionsService,
    private translationService: TranslationService

  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.infoMessage = 'Vous devez être connecté pour accéder au forum de cette communauté.';
      return;
    }
    this.loadData();
    this.startLocationPolling();
  }

  private loadData(): void {
    const communityId = Number(this.route.snapshot.params['id']);
    this.communityService.getById(communityId).subscribe({
      next: (community) => {
        if (!community) { this.errorMessage = 'Communauté introuvable.'; return; }
        this.community = community;
        if (!this.isMember()) { this.errorMessage = 'Accès refusé. Vous devez être membre de cette communauté.'; return; }
        if (!this.forumConditionsService.hasAccepted(communityId)) {
          this.pendingCommunityId = communityId;
          this.showConditionsModal = true;
          return;
        }
        this.loadForums(communityId);
      },
      error: () => { this.errorMessage = 'Erreur lors du chargement de la communauté.'; }
    });
  }

  private loadInteractionsForForum(forumId: number): void {
    this.forumService.getReactions(forumId).subscribe({ next: (r) => this.reactionsMap.set(forumId, r) });
    this.forumService.getComments(forumId).subscribe({ next: (c) => this.commentsMap.set(forumId, c) });
    this.forumService.getReviews(forumId).subscribe({ next: (r) => this.reviewsMap.set(forumId, r) });
  }

  private isMember(): boolean {
    if (!this.community || !this.currentUser) return false;
    return this.community.members?.some(m => m.id === this.currentUser?.id) ?? false;
  }

  // ─── SORT ────────────────────────────────────────────────────────────────────

  setSortOrder(order: 'newest' | 'oldest' | 'popular' | 'positive' | 'negative'): void {
    this.sortOrder = order;
    this.applyFilters();
  }

  // ─── SEARCH & FILTER ─────────────────────────────────────────────────────────

  onSearchChange(): void {
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }

  private applyFilters(): void {
    const q = this.searchQuery.trim().toLowerCase();

    // 1. Filtrage texte
    let result = q
      ? this.forums.filter(f =>
          f.title?.toLowerCase().includes(q) ||
          f.content?.toLowerCase().includes(q) ||
          f.user?.username?.toLowerCase().includes(q)
        )
      : [...this.forums];

    // 2. Filtrage sentiment
    if (this.sortOrder === 'positive') {
      result = result.filter(f => f.sentiment === 'POSITIVE');
    } else if (this.sortOrder === 'negative') {
      result = result.filter(f => f.sentiment === 'NEGATIVE');
    }

    // 3. Tri
    if (this.sortOrder === 'newest') {
      result.sort((a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );
    } else if (this.sortOrder === 'oldest') {
      result.sort((a, b) =>
        new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
      );
    } else if (this.sortOrder === 'popular') {
      result.sort((a, b) =>
        ((b.likesCount ?? 0) + (b.views ?? 0)) - ((a.likesCount ?? 0) + (a.views ?? 0))
      );
    }

    this.filteredForums = result;
  }

  // ─── FORUM CRUD ───────────────────────────────────────────────────────────────

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    if (!this.showCreateForm) this.resetForm();
    this.errorMessage = '';
    this.infoMessage = '';
  }

  startEdit(forum: Forum): void {
    if (!this.currentUser || forum.user?.id !== this.currentUser.id) {
      this.errorMessage = 'Vous ne pouvez modifier que vos propres sujets.';
      return;
    }
    this.editingForum = { ...forum };
    this.forumTitle = forum.title;
    this.forumContent = forum.content;
    this.showCreateForm = true;
    this.errorMessage = '';
    this.infoMessage = '';
  }

  cancelEdit(): void {
    this.editingForum = undefined;
    this.resetForm();
  }

  private resetForm(): void {
    this.forumTitle = '';
    this.forumContent = '';
    this.showCreateForm = false;
    this.editingForum = undefined;
  }

  capitalizeTitle(): void {
    if (this.forumTitle?.length > 0) {
      this.forumTitle = this.forumTitle.charAt(0).toUpperCase() + this.forumTitle.slice(1);
    }
  }

  submitForum(): void {
    this.errorMessage = '';
    this.infoMessage = '';

    if (!this.community || !this.currentUser) { this.errorMessage = 'Erreur: utilisateur non connecté.'; return; }
    if (!this.isMember()) { this.errorMessage = 'Accès refusé.'; return; }
    if (!this.forumTitle || this.forumTitle.trim().length === 0) { this.errorMessage = 'Le titre est obligatoire.'; return; }
    if (this.forumTitle.trim().length < 5) { this.errorMessage = 'Le titre doit contenir au moins 5 caractères.'; return; }
    if (!this.forumContent || this.forumContent.trim().length < 20) { this.errorMessage = 'Le contenu doit contenir au moins 20 caractères.'; return; }

    this.loading = true;

    const payload: Forum = {
      title: this.forumTitle.trim(),
      content: this.forumContent.trim(),
      user: { id: this.currentUser.id, username: this.currentUser.username }
    };

    if (this.editingForum?.id) {
      payload.id = this.editingForum.id;
      this.communityService.updateForum(this.community.id!, { ...this.editingForum, ...payload }).subscribe({
        next: (updated) => {
          this.infoMessage = 'Sujet mis à jour avec succès.';
          const index = this.forums.findIndex(f => f.id === updated.id);
          if (index !== -1) this.forums[index] = updated;
          this.applyFilters();
          this.cancelEdit();
          this.loading = false;
        },
        error: () => { this.errorMessage = 'Erreur lors de la mise à jour.'; this.loading = false; }
      });
    } else {
      this.communityService.createForum(this.community.id!, payload).subscribe({
        next: (createdForum) => {
          this.infoMessage = 'Sujet créé avec succès.';
          this.reactionsMap.set(createdForum.id!, []);
          this.commentsMap.set(createdForum.id!, []);
          this.reviewsMap.set(createdForum.id!, []);
          this.sendForumNotification(createdForum);
          this.generateAiSuggestions(createdForum);
          this.resetForm();
          setTimeout(() => {
            this.loadForums(this.community!.id!);
          }, 2000);
          this.loading = false;
        },
        error: () => { this.errorMessage = 'Erreur lors de la création.'; this.loading = false; }
      });
    }
  }

  deleteForum(forum: Forum): void {
    if (!this.currentUser || forum.user?.id !== this.currentUser.id) {
      this.errorMessage = 'Vous ne pouvez supprimer que vos propres sujets.';
      return;
    }
    if (!forum.id || !this.community?.id) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce sujet ?')) return;

    const forumId = forum.id;
    this.communityService.deleteForum(this.community.id, forumId).subscribe({
      next: () => {
        this.infoMessage = 'Sujet supprimé avec succès.';
        this.forums = this.forums.filter(f => f.id !== forumId);
        this.applyFilters();
        this.reactionsMap.delete(forumId);
        this.commentsMap.delete(forumId);
        this.reviewsMap.delete(forumId);
      },
      error: () => { this.errorMessage = 'Erreur lors de la suppression.'; }
    });
  }

  // ─── REACTIONS ────────────────────────────────────────────────────────────────

  getReactions(forumId: number): Reaction[] { return this.reactionsMap.get(forumId) ?? []; }
  getUserReaction(forumId: number): Reaction | undefined {
    if (!this.currentUser) return undefined;
    return this.getReactions(forumId).find(r => r.user?.id === this.currentUser?.id);
  }
  getLikeCount(forumId: number): number { return this.getReactions(forumId).filter(r => r.type === 'LIKE').length; }
  getDislikeCount(forumId: number): number { return this.getReactions(forumId).filter(r => r.type === 'DISLIKE').length; }

  addReaction(forumId: number, type: string): void {
    if (!this.currentUser) { this.errorMessage = 'Vous devez être connecté pour réagir.'; return; }
    const existing = this.getUserReaction(forumId);
    if (existing?.type === type) {
      this.forumService.removeReaction(forumId, this.currentUser.id).subscribe({
        next: () => this.reactionsMap.set(forumId, this.getReactions(forumId).filter(r => r.user?.id !== this.currentUser?.id))
      });
      return;
    }
    if (existing) {
      this.forumService.removeReaction(forumId, this.currentUser.id).subscribe({
        next: () => {
          const withoutOld = this.getReactions(forumId).filter(r => r.user?.id !== this.currentUser?.id);
          this.reactionsMap.set(forumId, withoutOld);
          this.forumService.addReaction(forumId, this.currentUser!, type).subscribe({
            next: (reaction) => this.reactionsMap.set(forumId, [...withoutOld, reaction])
          });
        }
      });
      return;
    }
    this.forumService.addReaction(forumId, this.currentUser, type).subscribe({
      next: (reaction) => {
        const reactions = this.getReactions(forumId).filter(r => r.user?.id !== this.currentUser?.id);
        this.reactionsMap.set(forumId, [...reactions, reaction]);
      }
    });
  }

  // ─── COMMENTS ─────────────────────────────────────────────────────────────────

  getComments(forumId: number): ForumComment[] { return this.commentsMap.get(forumId) ?? []; }

  addComment(forumId: number, content: string): void {
    if (!this.currentUser) { this.errorMessage = 'Vous devez être connecté pour commenter.'; return; }
    const trimmed = content.trim();
    if (trimmed.length < 5) { this.errorMessage = 'Le commentaire doit contenir au moins 5 caractères.'; return; }
    if (this.moderationService.containsForbiddenWords(trimmed)) { this.errorMessage = 'Votre commentaire contient des termes non autorisés.'; return; }
    this.moderationService.analyze(trimmed).subscribe({
      next: (result) => {
        if (!result.approved) { this.errorMessage = `Commentaire rejeté${result.reason ? ' : ' + result.reason : ''}.`; return; }
        this.forumService.addComment(forumId, this.currentUser!, trimmed).subscribe({
          next: (comment) => { this.commentsMap.set(forumId, [...this.getComments(forumId), comment]); this.errorMessage = ''; },
          error: () => { this.errorMessage = 'Erreur lors de l\'ajout du commentaire.'; }
        });
      },
      error: () => { this.errorMessage = 'Service de modération indisponible.'; }
    });
  }

  deleteComment(commentId: number): void {
  this.forumService.deleteComment(commentId).subscribe({
    next: () => {
      this.commentsMap.forEach((comments, forumId) =>
        this.commentsMap.set(forumId, comments.filter(c => c.id !== commentId)));
    },
    error: (err) => {
      if (err.status === 400 || err.status === 404) {
        this.commentsMap.forEach((comments, forumId) =>
          this.commentsMap.set(forumId, comments.filter(c => c.id !== commentId)));
      } else {
        this.errorMessage = 'Erreur lors de la suppression.';
      }
    }
  });
}

  // ─── REVIEWS ──────────────────────────────────────────────────────────────────

  getReviews(forumId: number): Review[] { return this.reviewsMap.get(forumId) ?? []; }
  getAverageRating(forumId: number): number {
    const reviews = this.getReviews(forumId);
    if (reviews.length === 0) return 0;
    return Math.round((reviews.reduce((acc, r) => acc + (r.rating ?? 0), 0) / reviews.length) * 10) / 10;
  }
  getUserReviewRating(forumId: number): number {
    if (!this.currentUser) return 0;
    return this.getReviews(forumId).find(r => r.user?.id === this.currentUser?.id)?.rating ?? 0;
  }
  isStarSelected(star: number, forumId: number): boolean { return star <= this.getUserReviewRating(forumId); }

  addReview(forumId: number, rating: number, comment?: string): void {
    if (!this.currentUser) { this.errorMessage = 'Vous devez être connecté pour donner un avis.'; return; }
    this.forumService.addReview(forumId, this.currentUser, rating, comment).subscribe({
      next: (review) => {
        const reviews = this.getReviews(forumId).filter(r => r.user?.id !== this.currentUser?.id);
        this.reviewsMap.set(forumId, [...reviews, review]);
        this.errorMessage = '';
      },
      error: () => { this.errorMessage = 'Erreur lors de l\'ajout de l\'avis.'; }
    });
  }

  deleteReview(reviewId: number): void {
    this.forumService.deleteReview(reviewId).subscribe({
      next: () => this.reviewsMap.forEach((reviews, forumId) =>
        this.reviewsMap.set(forumId, reviews.filter(r => r.id !== reviewId)))
    });
  }

  clearReviewInput(reviewInput: HTMLTextAreaElement, forumId: number): void {
    if (!this.currentUser) { this.errorMessage = 'Vous devez être connecté pour donner un avis.'; return; }
    this.addReview(forumId, this.getUserReviewRating(forumId) || 5, reviewInput.value.trim());
    reviewInput.value = '';
  }

  // ─── LOGIN DIALOG ─────────────────────────────────────────────────────────────

  openLoginDialog(): void { this.isLoginDialogOpen = true; }
  closeLoginDialog(): void {
    this.isLoginDialogOpen = false;
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser) { this.infoMessage = ''; this.loadData(); }
  }

  private sendForumNotification(forum: Forum): void {
    try {
      const notifications = JSON.parse(localStorage.getItem('forumNotifications') || '[]');
      notifications.unshift({ id: Date.now(), username: this.currentUser?.username || 'Inconnu', forumTitle: forum.title, communityName: this.community?.name || 'Communauté', createdAt: new Date().toISOString(), read: false });
      localStorage.setItem('forumNotifications', JSON.stringify(notifications));
    } catch {}
  }

  // ─── AI SUGGESTIONS ───────────────────────────────────────────────────────────

  aiSuggestionsMap: Map<number, string[]> = new Map();
  aiLoadingMap: Map<number, boolean> = new Map();
  aiSummaryMap: Map<number, string> = new Map();
  aiSourcesMap: Map<number, string[]> = new Map();

  private generateAiSuggestions(forum: Forum): void {
    if (!forum.id) return;
    this.aiLoadingMap.set(forum.id, true);
    const token = localStorage.getItem('auth_token') || '';
    this.http.post<{ summary: string; sources: string[]; suggestions: string[] }>(
      'http://localhost:8080/api/ai/suggestions',
      { title: forum.title, content: forum.content },
      { headers: new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }) }
    ).subscribe({
      next: (data) => {
        this.aiSummaryMap.set(forum.id!, data.summary || '');
        this.aiSourcesMap.set(forum.id!, data.sources || []);
        this.aiSuggestionsMap.set(forum.id!, data.suggestions || []);
        this.aiLoadingMap.set(forum.id!, false);
      },
      error: () => { this.aiLoadingMap.set(forum.id!, false); }
    });
  }

  getAiSummary(forumId: number): string { return this.aiSummaryMap.get(forumId) ?? ''; }
  getAiSources(forumId: number): string[] { return this.aiSourcesMap.get(forumId) ?? []; }
  getAiSuggestions(forumId: number): string[] { return this.aiSuggestionsMap.get(forumId) ?? []; }
  isAiLoading(forumId: number): boolean { return this.aiLoadingMap.get(forumId) ?? false; }

  onAiQuestionClick(question: string, forumId: number): void {
    const textarea = document.querySelector(`[data-forum-id="${forumId}"] textarea`) as HTMLTextAreaElement;
    if (textarea) { textarea.value = question; textarea.dispatchEvent(new Event('input')); textarea.focus(); }
  }

  // ─── AI CORRECTION ────────────────────────────────────────────────────────────

  aiCorrecting = false;
  aiCorrectionResult: { correctedTitle: string; correctedContent: string } | null = null;

  correctWithAi(): void {
    if (!this.forumTitle.trim() || !this.forumContent.trim()) return;
    this.aiCorrecting = true;
    this.aiCorrectionResult = null;
    this.errorMessage = '';
    const token = localStorage.getItem('auth_token') || '';
    this.http.post<{ correctedTitle: string; correctedContent: string }>(
      'http://localhost:8080/api/ai/correct',
      { title: this.forumTitle.trim(), content: this.forumContent.trim() },
      { headers: new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }) }
    ).subscribe({
      next: (result) => { this.aiCorrectionResult = result; this.aiCorrecting = false; },
      error: () => { this.errorMessage = 'Service de correction IA indisponible.'; this.aiCorrecting = false; }
    });
  }

  acceptAiCorrection(): void {
    if (!this.aiCorrectionResult) return;
    this.forumTitle = this.aiCorrectionResult.correctedTitle;
    this.forumContent = this.aiCorrectionResult.correctedContent;
    this.aiCorrectionResult = null;
  }

  dismissAiCorrection(): void { this.aiCorrectionResult = null; }

  // ─── LOCATION SHARE ───────────────────────────────────────────────────────────

  locationShareOpen      = false;
  locationAiLoading      = false;
  locationGpsLoading     = false;
  isLocationSharing      = false;
  selectedLocationMinutes = 60;
  locationRemainingTime  = '';
  locationAiData: { message: string; options: { label: string; minutes: number; description: string }[] } | null = null;
  private locationTimerInterval?: ReturnType<typeof setInterval>;
  locationEndTime: number = 0;

  openLocationShare(): void {
    this.locationShareOpen = true;
    this.locationAiLoading = true;
    this.locationAiData = null;
    const token = localStorage.getItem('auth_token') || '';
    this.http.post<any>('http://localhost:8080/api/ai/location-message',
      { username: this.currentUser?.username || 'Utilisateur', community: this.community?.name || 'la communauté' },
      { headers: new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }) }
    ).subscribe({
      next: (data) => { this.locationAiData = data; this.locationAiLoading = false; },
      error: () => {
        this.locationAiData = { message: `${this.currentUser?.username} partage sa position`, options: [{ label: '15 minutes', minutes: 15, description: 'Partage rapide' }, { label: '1 heure', minutes: 60, description: 'Recommandé' }, { label: '2 heures', minutes: 120, description: 'Partage prolongé' }] };
        this.locationAiLoading = false;
      }
    });
  }

  selectLocationDuration(minutes: number): void { this.selectedLocationMinutes = minutes; }

  startLocationShare(): void {
    this.locationGpsLoading = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locationGpsLoading = false;
        this.isLocationSharing = true;
        this.currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.locationEndTime = Date.now() + this.selectedLocationMinutes * 60 * 1000;
        this.updateLocationTimer();
        this.locationTimerInterval = setInterval(() => this.updateLocationTimer(), 1000);
        const token = localStorage.getItem('auth_token') || '';
        this.http.post('http://localhost:8080/api/ai/location-share',
          { userId: String(this.currentUser!.id), username: this.currentUser!.username, communityId: String(this.community!.id), lat: pos.coords.latitude, lng: pos.coords.longitude, minutes: this.selectedLocationMinutes },
          { headers: new HttpHeaders({ 'Authorization': `Bearer ${token}` }) }
        ).subscribe();
      },
      () => { this.locationGpsLoading = false; this.errorMessage = 'Impossible d\'accéder à votre position GPS.'; },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  stopLocationShare(): void {
    this.isLocationSharing = false;
    if (this.locationTimerInterval) clearInterval(this.locationTimerInterval);
    if (this.locationPollingInterval) clearInterval(this.locationPollingInterval);
    this.locationRemainingTime = '';
    const token = localStorage.getItem('auth_token') || '';
    this.http.delete(`http://localhost:8080/api/ai/location-share/${this.currentUser!.id}`,
      { params: { communityId: String(this.community!.id) }, headers: new HttpHeaders({ 'Authorization': `Bearer ${token}` }) }
    ).subscribe();
  }

  private updateLocationTimer(): void {
    if (!this.locationEndTime) return;
    const remaining = Math.max(0, Math.floor((this.locationEndTime - Date.now()) / 1000));
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    if (h > 0) this.locationRemainingTime = `${h}h${m.toString().padStart(2, '0')} restante`;
    else if (m > 0) this.locationRemainingTime = `${m}min ${s.toString().padStart(2, '0')}s restante`;
    else this.locationRemainingTime = `${s}s restante`;
    if (remaining === 0) this.stopLocationShare();
  }

  closeLocationShare(event?: MouseEvent): void {
  if (!event || (event.target as HTMLElement).style.position === 'fixed'
              || (event.target as HTMLElement) === event.currentTarget) {
    this.locationShareOpen = false;
  }
}

  shareAvatarColors = ['#E6F1FB', '#FAEEDA', '#E1F5EE', '#EEEDFE', '#FCEBEB'];
  shareTextColors   = ['#0C447C', '#633806', '#085041', '#3C3489', '#791F1F'];

  activeLocationShares: { userId: number; username: string; lat: number; lng: number; minutes: number; startedAt: number; }[] = [];
  locationMapOpen  = false;
  selectedShare: any = null;
  locationMapTimer = '';
  private mapTimerInterval?: ReturnType<typeof setInterval>;

  addLocationShare(share: any): void {
    this.activeLocationShares = this.activeLocationShares.filter(s => s.userId !== share.userId);
    this.activeLocationShares.push({ ...share, startedAt: Date.now() });
    setTimeout(() => { this.activeLocationShares = this.activeLocationShares.filter(s => s.userId !== share.userId); }, share.minutes * 60 * 1000);
  }

  getSharePercent(share: any): number {
    const total = share.minutes * 60 * 1000;
    return Math.round((Math.max(0, total - (Date.now() - share.startedAt)) / total) * 100);
  }

  getShareRemainingLabel(share: any): string {
    const secs = Math.max(0, Math.floor((share.startedAt + share.minutes * 60 * 1000 - Date.now()) / 1000));
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
    if (m > 0) return `${m}min`;
    return `${s}s`;
  }

  private leafletMap?: L.Map;

  openLocationMap(share: any): void {
    this.selectedShare = share;
    this.locationMapOpen = true;
    this.updateMapTimer();
    this.mapTimerInterval = setInterval(() => this.updateMapTimer(), 1000);
    if (this.leafletMap) { this.leafletMap.remove(); this.leafletMap = undefined; }
    setTimeout(() => {
      const container = document.getElementById(`map-${share.userId}`);
      if (!container) return;
      this.leafletMap = L.map(`map-${share.userId}`, { center: [share.lat, share.lng], zoom: 16 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(this.leafletMap);
      const icon = L.divIcon({ html: `<div style="position:relative;display:flex;align-items:center;justify-content:center"><div style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(24,95,165,0.2);animation:mapPulse 2s ease-out infinite"></div><div style="width:16px;height:16px;border-radius:50%;background:#185FA5;border:3px solid white;box-shadow:0 2px 8px rgba(24,95,165,0.5);position:relative;z-index:2"></div></div>`, iconSize: [40, 40], iconAnchor: [20, 20], className: '' });
      L.marker([share.lat, share.lng], { icon }).addTo(this.leafletMap).bindPopup(`<div style="font-family:sans-serif;padding:4px"><b style="color:#185FA5">${share.username}</b><br><span style="font-size:12px;color:#666">Position en direct</span></div>`).openPopup();
    }, 200);
  }

  private updateMapTimer(): void {
    if (!this.selectedShare) return;
    this.locationMapTimer = this.getShareRemainingLabel(this.selectedShare);
    if (this.getSharePercent(this.selectedShare) === 0) this.closeLocationMap();
  }

  closeLocationMap(event?: MouseEvent): void {
    if (event && (event.target as HTMLElement) !== event.currentTarget) return;
    if (this.leafletMap) { this.leafletMap.remove(); this.leafletMap = undefined; }
    this.locationMapOpen = false;
    this.selectedShare = null;
    if (this.mapTimerInterval) clearInterval(this.mapTimerInterval);
  }

  getMapUrl(lat: number, lng: number): SafeResourceUrl {
    const delta = 0.005;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta},${lat - delta},${lng + delta},${lat + delta}&layer=mapnik&marker=${lat},${lng}`
    );
  }

  private currentCoords?: { lat: number; lng: number };
  getGoogleMapsUrl(): string {
    if (!this.currentCoords) return '#';
    return `https://www.google.com/maps?q=${this.currentCoords.lat},${this.currentCoords.lng}`;
  }

  private locationPollingInterval?: ReturnType<typeof setInterval>;

  private startLocationPolling(): void {
    this.fetchActiveShares();
    this.locationPollingInterval = setInterval(() => this.fetchActiveShares(), 5000);
  }

  private fetchActiveShares(): void {
    if (!this.community?.id) return;
    const token = localStorage.getItem('auth_token') || '';
    this.http.get<any[]>(`http://localhost:8080/api/ai/location-share/community/${this.community.id}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${token}` }) }
    ).subscribe({
      next: (shares) => {
        this.activeLocationShares = shares.map(s => ({ userId: s.userId, username: s.username, lat: s.lat, lng: s.lng, minutes: s.minutes, startedAt: new Date(s.startedAt).getTime() }));
      },
      error: (e) => console.error('Erreur polling:', e)
    });
  }

  ngOnDestroy(): void {
    if (this.locationPollingInterval) clearInterval(this.locationPollingInterval);
    if (this.locationTimerInterval) clearInterval(this.locationTimerInterval);
    if (this.mapTimerInterval) clearInterval(this.mapTimerInterval);
  }

  // ─── CONDITIONS ───────────────────────────────────────────────────────────────

  showConditionsModal = false;
  pendingCommunityId: number = 0;

  onConditionsAccepted(): void {
    this.showConditionsModal = false;
    this.loadForums(this.pendingCommunityId);
  }

  onConditionsCancelled(): void {
    this.showConditionsModal = false;
    this.router.navigate(['/communities']);
  }

  private loadForums(communityId: number): void {
    const token = localStorage.getItem('auth_token');
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });
    this.http.get<Forum[]>(`http://localhost:8080/api/forums/community/${communityId}`, { headers }).subscribe({
      next: (forums) => {
        this.forums = forums;
        this.applyFilters(); // ✅ applique le tri au chargement
        this.forums.forEach(f => { if (f.id) this.loadInteractionsForForum(f.id); });
      },
      error: () => { this.errorMessage = 'Erreur lors du chargement des forums.'; }
    });
  }
  // ─── TRADUCTION ───────────────────────────────────────────────────────────────
translationMap:        Map<number, string>  = new Map();
translationTitleMap:   Map<number, string>  = new Map();
translationLoadingMap: Map<number, boolean> = new Map();
showLangPickerMap:     Map<number, boolean> = new Map();
activeLangMap:         Map<number, string>  = new Map();

commentTranslationMap:        Map<number, string>  = new Map();
commentTranslationLoadingMap: Map<number, boolean> = new Map();

get languages() { return this.translationService.languages; }

// ─── MÉTHODES TRADUCTION ──────────────────────────────────────────────────────

private detectLang(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  if (/[\u3040-\u30FF]/.test(text)) return 'ja';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  return 'fr';
}

toggleLangPicker(forumId: number): void {
  const current = this.showLangPickerMap.get(forumId) ?? false;
  this.showLangPickerMap.clear();
  this.showLangPickerMap.set(forumId, !current);
}

isLangPickerOpen(forumId: number): boolean {
  return this.showLangPickerMap.get(forumId) ?? false;
}

getActiveLang(forumId: number): string {
  return this.activeLangMap.get(forumId) ?? '';
}

isTranslating(forumId: number): boolean {
  return this.translationLoadingMap.get(forumId) ?? false;
}

isTranslated(forumId: number): boolean {
  return this.translationMap.has(forumId);
}

getTranslatedTitle(forum: any): string {
  return this.translationTitleMap.get(forum.id) ?? forum.title;
}

getTranslatedContent(forum: any): string {
  return this.translationMap.get(forum.id) ?? forum.content;
}

translateForum(forum: any, langCode: string): void {
  const forumId = forum.id;

  if (this.activeLangMap.get(forumId) === langCode) {
    this.translationMap.delete(forumId);
    this.translationTitleMap.delete(forumId);
    this.activeLangMap.delete(forumId);
    this.showLangPickerMap.set(forumId, false);
    return;
  }

  this.translationLoadingMap.set(forumId, true);
  this.showLangPickerMap.set(forumId, false);
  this.activeLangMap.set(forumId, langCode);

  this.translationService.translate(forum.title, this.detectLang(forum.title), langCode).subscribe({
    next: (translatedTitle) => {
      this.translationTitleMap.set(forumId, translatedTitle);
    }
  });

  this.translationService.translate(forum.content, this.detectLang(forum.content), langCode).subscribe({
    next: (translatedContent) => {
      if (translatedContent.includes('PLEASE SELECT') || translatedContent.includes('MYMEMORY WARNING')) {
      this.translationLoadingMap.set(forumId, false);
      return;
    }
      this.translationMap.set(forumId, translatedContent);
      this.translationLoadingMap.set(forumId, false);
    },
    error: () => {
      this.errorMessage = 'Erreur de traduction.';
      this.translationLoadingMap.set(forumId, false);
      this.activeLangMap.delete(forumId);
    }
  });
}

resetTranslation(forumId: number): void {
  this.translationMap.delete(forumId);
  this.translationTitleMap.delete(forumId);
  this.activeLangMap.delete(forumId);
}

getCommentText(comment: any): string {
  return this.commentTranslationMap.get(comment.id) ?? comment.content ?? '';
}

isCommentTranslating(commentId: number): boolean {
  return this.commentTranslationLoadingMap.get(commentId) ?? false;
}

translateComment(comment: any, langCode: string): void {
  // Si déjà en cours → ignore
  if (this.commentTranslationLoadingMap.get(comment.id)) return;

  // Si déjà traduit → reset
  if (this.commentTranslationMap.has(comment.id)) {
    this.commentTranslationMap.delete(comment.id);
    return;
  }

  const sourceLang = 'fr';
  if (sourceLang === langCode) return;

  this.commentTranslationLoadingMap.set(comment.id, true);

  this.translationService.translate(comment.content, sourceLang, langCode).subscribe({
    next: (translated) => {
      if (translated.includes('PLEASE SELECT') || translated.includes('MYMEMORY WARNING')) {
        this.commentTranslationLoadingMap.set(comment.id, false);
        return;
      }
      this.commentTranslationMap.set(comment.id, translated);
      this.commentTranslationLoadingMap.set(comment.id, false);
    },
    error: () => {
      this.commentTranslationLoadingMap.set(comment.id, false);
    }
  });
}
// ─── EMOJI PICKER ─────────────────────────────────────────────────────────────
showEmojiPickerForumId: number | null = null;
showEmojiPickerCreate = false;
selectedEmojiCategory = 0;

emojiCategories = [
  { label: '😊', emojis: ['😀','😂','😍','🥰','😎','🤔','😢','😡','😮','🤩','😴','🤗','😏','😅','🥹'] },
  { label: '👍', emojis: ['👍','👎','❤️','🙏','💪','👏','🤝','✌️','🤞','👌','🫶','💯','✅','⭐','🔥'] },
  { label: '✈️', emojis: ['✈️','🏖️','🏨','🗺️','📍','🧳','🌊','☀️','🌙','⛅','🏔️','🌴','🕌','🇹🇳','🌍'] },
  { label: '🍽️', emojis: ['🍽️','🥘','🫕','🧆','🥙','🍵','☕','🧃','🍰','🎂','🍊','🌶️','🫒','🧄','🍋'] },
  { label: '📝', emojis: ['📸','💬','📝','🔍','💡','⚠️','ℹ️','🎯','🚀','💎','🎉','🎊','🏆','📢','💌'] },
];

toggleEmojiPickerComment(forumId: number, event: Event): void {
  event.stopPropagation();
  this.showEmojiPickerForumId = this.showEmojiPickerForumId === forumId ? null : forumId;
  this.showEmojiPickerCreate = false;
}

toggleEmojiPickerCreate(event: Event): void {
  event.stopPropagation();
  this.showEmojiPickerCreate = !this.showEmojiPickerCreate;
  this.showEmojiPickerForumId = null;
}

insertEmojiComment(emoji: string, textarea: HTMLTextAreaElement, event: Event): void {
  event.stopPropagation();
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = textarea.value.slice(0, start) + emoji + textarea.value.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
}

insertEmojiCreate(emoji: string, event: Event): void {
  event.stopPropagation();
  this.forumContent += emoji;
}

closeAllEmojiPickers(): void {
  this.showEmojiPickerForumId = null;
  this.showEmojiPickerCreate = false;
}
}
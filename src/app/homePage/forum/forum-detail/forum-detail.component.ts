import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommunityService } from '../../../services/community.service';
import { ForumService } from '../../../services/forum.service';
import { AuthService } from '../../../services/auth.service';
import { Community } from '../../../models/community.model';
import { Forum } from '../../../models/forum.model';
import { Reaction, ForumComment, Review } from '../../../models/forum-interactions.model';
import { HttpClient } from '@angular/common/http';
@Component({
  selector: 'app-forum-detail',
  templateUrl: './forum-detail.component.html',
  styleUrls: ['./forum-detail.component.css']
})
export class ForumDetailComponent implements OnInit {

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

  // Interactions stockées localement après chargement HTTP
  private reactionsMap: Map<number, Reaction[]> = new Map();
  private commentsMap: Map<number, ForumComment[]> = new Map();
  private reviewsMap: Map<number, Review[]> = new Map();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private communityService: CommunityService,
    private forumService: ForumService,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    if (!this.currentUser) {
      this.infoMessage = 'Vous devez être connecté pour accéder au forum de cette communauté.';
      return;
    }

    this.loadData();
  }

  // ─── CHARGEMENT ──────────────────────────────────────────────────────────────

  private loadData(): void {
  const communityId = Number(this.route.snapshot.params['id']);

  this.communityService.getById(communityId).subscribe({
    next: (community) => {
      if (!community) {
        this.errorMessage = 'Communauté introuvable.';
        return;
      }

      this.community = community;

      if (!this.isMember()) {
        this.errorMessage = 'Accès refusé. Vous devez être membre de cette communauté.';
        return;
      }

      // ✅ Charger les vrais forums depuis la BDD
      const token = localStorage.getItem('auth_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      this.http.get<Forum[]>(
        `http://localhost:8080/api/forums/community/${communityId}`,
        { headers }
      ).subscribe({
        next: (forums) => {
          this.forums = forums;
          this.forums.forEach(f => this.loadInteractionsForForum(f.id!));
        },
        error: () => {
          this.errorMessage = 'Erreur lors du chargement des forums.';
        }
      });
    },
    error: () => {
      this.errorMessage = 'Erreur lors du chargement de la communauté.';
    }
  });
}

  private loadInteractionsForForum(forumId: number): void {
  this.forumService.getReactions(forumId).subscribe({
    next: (reactions) => this.reactionsMap.set(forumId, reactions),
    error: (err) => console.error('Erreur reactions:', err)
  });

  this.forumService.getComments(forumId).subscribe({
    next: (comments) => this.commentsMap.set(forumId, comments),
    error: (err) => console.error('Erreur comments:', err)
  });

  this.forumService.getReviews(forumId).subscribe({
    next: (reviews) => this.reviewsMap.set(forumId, reviews),
    error: (err) => console.error('Erreur reviews:', err)
  });
}

  private isMember(): boolean {
    if (!this.community || !this.currentUser) return false;
    return this.community.members?.some(m => m.id === this.currentUser?.id) ?? false;
  }

  // ─── FORUM CRUD ───────────────────────────────────────────────────────────────

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    if (!this.showCreateForm) this.resetForm();
    this.errorMessage = '';
    this.infoMessage = '';
  }

  startEdit(forum: Forum): void {
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

    if (!this.community || !this.currentUser) {
      this.errorMessage = 'Erreur: utilisateur non connecté.';
      return;
    }

    if (!this.isMember()) {
      this.errorMessage = 'Accès refusé. Vous devez être membre de cette communauté.';
      return;
    }

    if (!this.forumTitle || this.forumTitle.trim().length === 0) {
      this.errorMessage = 'Le titre du sujet est obligatoire.';
      return;
    }

    if (this.forumTitle.trim().length < 5) {
      this.errorMessage = 'Le titre doit contenir au moins 5 caractères.';
      return;
    }

    if (!this.forumContent || this.forumContent.trim().length < 20) {
      this.errorMessage = 'Le contenu doit contenir au moins 20 caractères.';
      return;
    }

    this.loading = true;

    const payload: Forum = {
      title: this.forumTitle.trim(),
      content: this.forumContent.trim(),
      user: { id: this.currentUser.id, username: this.currentUser.username }
    };

    // ✅ UPDATE
    if (this.editingForum?.id) {
      payload.id = this.editingForum.id;

      this.communityService.updateForum(this.community.id!, { ...this.editingForum, ...payload }).subscribe({
        next: (updated) => {
          this.infoMessage = 'Sujet mis à jour avec succès.';
          // Mettre à jour localement sans recharger
          const index = this.forums.findIndex(f => f.id === updated.id);
          if (index !== -1) this.forums[index] = updated;
          this.cancelEdit();
          this.loading = false;
        },
        error: (err) => {
          console.error('Erreur update forum:', err);
          this.errorMessage = 'Erreur lors de la mise à jour.';
          this.loading = false;
        }
      });

    // ✅ CREATE
    } else {
      this.communityService.createForum(this.community.id!, payload).subscribe({
        next: (createdForum) => {
          console.log('Forum créé avec ID:', createdForum.id);
          this.infoMessage = 'Sujet créé avec succès.';
          // Ajouter localement en tête de liste
          this.forums = [createdForum, ...this.forums];
          // Initialiser les interactions pour le nouveau forum
          this.reactionsMap.set(createdForum.id!, []);
          this.commentsMap.set(createdForum.id!, []);
          this.reviewsMap.set(createdForum.id!, []);
          this.resetForm();
          this.loading = false;
        },
        error: (err) => {
          console.error('Erreur create forum:', err);
          this.errorMessage = 'Erreur lors de la création.';
          this.loading = false;
        }
      });
    }
  }

  deleteForum(forum: Forum): void {
    if (!forum.id) return;
    if (!this.community?.id) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce sujet ?')) return;

    const forumId = forum.id;
    this.communityService.deleteForum(this.community.id, forumId).subscribe({
      next: () => {
        this.infoMessage = 'Sujet supprimé avec succès.';
        // Supprimer localement
        this.forums = this.forums.filter(f => f.id !== forumId);
        this.reactionsMap.delete(forumId);
        this.commentsMap.delete(forumId);
        this.reviewsMap.delete(forumId);
      },
      error: (err) => {
        console.error('Erreur delete forum:', err);
        this.errorMessage = 'Erreur lors de la suppression.';
      }
    });
  }

  // ─── REACTIONS ────────────────────────────────────────────────────────────────

  getReactions(forumId: number): Reaction[] {
    return this.reactionsMap.get(forumId) ?? [];
  }

  getUserReaction(forumId: number): Reaction | undefined {
    if (!this.currentUser) return undefined;
    return this.getReactions(forumId).find(r => r.user?.id === this.currentUser?.id);
  }

  getLikeCount(forumId: number): number {
    return this.getReactions(forumId).filter(r => r.type === 'LIKE').length;
  }

  getDislikeCount(forumId: number): number {
    return this.getReactions(forumId).filter(r => r.type === 'DISLIKE').length;
  }

  addReaction(forumId: number, type: string): void {
  if (!this.currentUser) {
    this.errorMessage = 'Vous devez être connecté pour réagir.';
    return;
  }

  const existing = this.getUserReaction(forumId);

  if (existing?.type === type) {
    this.forumService.removeReaction(forumId, this.currentUser.id).subscribe({
      next: () => {
        const reactions = this.getReactions(forumId).filter(
          r => r.user?.id !== this.currentUser?.id
        );
        this.reactionsMap.set(forumId, reactions);
      },
      error: (err) => console.error('Erreur remove reaction:', err)
    });
    return;
  }

  this.forumService.addReaction(forumId, this.currentUser, type).subscribe({
    next: (reaction) => {
      const reactions = this.getReactions(forumId).filter(
        r => r.user?.id !== this.currentUser?.id
      );
      this.reactionsMap.set(forumId, [...reactions, reaction]);
    },
    error: (err) => console.error('Erreur add reaction:', err)
  });
}

  // ─── COMMENTS ─────────────────────────────────────────────────────────────────

  getComments(forumId: number): ForumComment[] {
    return this.commentsMap.get(forumId) ?? [];
  }

  addComment(forumId: number, content: string): void {
  if (!this.currentUser) {
    this.errorMessage = 'Vous devez être connecté pour commenter.';
    return;
  }

  if (content.trim().length < 5) {
    this.errorMessage = 'Le commentaire doit contenir au moins 5 caractères.';
    return;
  }

  this.forumService.addComment(forumId, this.currentUser, content.trim()).subscribe({
    next: (comment) => {
      const comments = [...this.getComments(forumId), comment];
      this.commentsMap.set(forumId, comments);
      this.errorMessage = '';
    },
    error: (err) => {
      console.error('Erreur add comment:', err);
      this.errorMessage = 'Erreur lors de l\'ajout du commentaire.';
    }
  });
}
  deleteComment(commentId: number): void {
    this.forumService.deleteComment(commentId).subscribe({
      next: () => {
        this.commentsMap.forEach((comments, forumId) => {
          this.commentsMap.set(forumId, comments.filter(c => c.id !== commentId));
        });
      },
      error: (err) => console.error('Erreur delete comment:', err)
    });
  }

  // ─── REVIEWS ──────────────────────────────────────────────────────────────────

  getReviews(forumId: number): Review[] {
    return this.reviewsMap.get(forumId) ?? [];
  }

  getAverageRating(forumId: number): number {
    const reviews = this.getReviews(forumId);
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + (r.rating ?? 0), 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }

  getUserReviewRating(forumId: number): number {
    if (!this.currentUser) return 0;
    const review = this.getReviews(forumId).find(r => r.user?.id === this.currentUser?.id);
    return review?.rating ?? 0;
  }

  isStarSelected(star: number, forumId: number): boolean {
    return star <= this.getUserReviewRating(forumId);
  }

  addReview(forumId: number, rating: number, comment?: string): void {
  if (!this.currentUser) {
    this.errorMessage = 'Vous devez être connecté pour donner un avis.';
    return;
  }

  this.forumService.addReview(forumId, this.currentUser, rating, comment).subscribe({
    next: (review) => {
      const reviews = this.getReviews(forumId).filter(
        r => r.user?.id !== this.currentUser?.id
      );
      this.reviewsMap.set(forumId, [...reviews, review]);
      this.errorMessage = '';
    },
    error: (err) => {
      console.error('Erreur add review:', err);
      this.errorMessage = 'Erreur lors de l\'ajout de l\'avis.';
    }
  });
}
  deleteReview(reviewId: number): void {
    this.forumService.deleteReview(reviewId).subscribe({
      next: () => {
        this.reviewsMap.forEach((reviews, forumId) => {
          this.reviewsMap.set(forumId, reviews.filter(r => r.id !== reviewId));
        });
      },
      error: (err) => console.error('Erreur delete review:', err)
    });
  }

  clearReviewInput(reviewInput: HTMLTextAreaElement, forumId: number): void {
    if (!this.currentUser) {
      this.errorMessage = 'Vous devez être connecté pour donner un avis.';
      return;
    }

    const rating = this.getUserReviewRating(forumId) || 5;
    const comment = reviewInput.value.trim();
    this.addReview(forumId, rating, comment);
    reviewInput.value = '';
  }

  // ─── LOGIN DIALOG ─────────────────────────────────────────────────────────────

  openLoginDialog(): void {
    this.isLoginDialogOpen = true;
  }

  closeLoginDialog(): void {
    this.isLoginDialogOpen = false;
    // Recharger après connexion éventuelle
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser) {
      this.infoMessage = '';
      this.loadData();
    }
  }
}
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Reaction, ForumComment, Review } from '../models/forum-interactions.model';

@Injectable({ providedIn: 'root' })
export class ForumService {

  private apiUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {
    const token = localStorage.getItem('auth_token');
  }

  private getHeaders(): HttpHeaders {
  const token = localStorage.getItem('auth_token')
             || localStorage.getItem('token')
             || localStorage.getItem('jwt')
             || localStorage.getItem('access_token')
             || localStorage.getItem('authToken')
             || localStorage.getItem('user_token')
             || '';

  console.log('Clés localStorage:', Object.keys(localStorage));
  console.log('Token utilisé:', token ? token.substring(0, 30) + '...' : 'AUCUN TOKEN ❌');

  return new HttpHeaders({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });
}

  // ─── REACTIONS ──────────────────────────────────────────────────────────────

  addReaction(forumId: number, user: { id: number; username: string }, type: string): Observable<Reaction> {
    return this.http.post<Reaction>(
      `${this.apiUrl}/reactions/forum/${forumId}`,
      { type },
      { headers: this.getHeaders() }
    );
  }

  removeReaction(forumId: number, userId: number) {
  return this.http.delete(
    `${this.apiUrl}/reactions/forum/${forumId}/user/${userId}`,
    {
      headers: this.getHeaders(),   
      responseType: 'text'          
    }
  );
}

  getReactions(forumId: number): Observable<Reaction[]> {
    return this.http.get<Reaction[]>(
      `${this.apiUrl}/reactions/forum/${forumId}`,
      { headers: this.getHeaders() }
    );
  }

  // ─── COMMENTS ───────────────────────────────────────────────────────────────

  addComment(forumId: number, user: { id: number; username: string }, content: string): Observable<ForumComment> {
    return this.http.post<ForumComment>(
      `${this.apiUrl}/comments/forum/${forumId}`,
      { content },
      { headers: this.getHeaders() }
    );
  }

  getComments(forumId: number): Observable<ForumComment[]> {
    return this.http.get<ForumComment[]>(
      `${this.apiUrl}/comments/forum/${forumId}`,
      { headers: this.getHeaders() }
    );
  }

  deleteComment(commentId: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/comments/${commentId}`,
      { headers: this.getHeaders() }
    );
  }

  // ─── REVIEWS ────────────────────────────────────────────────────────────────

  addReview(forumId: number, user: { id: number; username: string }, rating: number, comment?: string): Observable<Review> {
    return this.http.post<Review>(
      `${this.apiUrl}/reviews/forum/${forumId}`,
      { rating, comment },
      { headers: this.getHeaders() }
    );
  }

  getReviews(forumId: number): Observable<Review[]> {
    return this.http.get<Review[]>(
      `${this.apiUrl}/reviews/forum/${forumId}`,
      { headers: this.getHeaders() }
    );
  }

  deleteReview(reviewId: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/reviews/${reviewId}`,
      { headers: this.getHeaders() }
    );
  }
}
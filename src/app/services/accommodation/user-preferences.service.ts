import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserPreferencesRequest {
  budgetMax: number | null;
  typeSejour: string | null;
  villePreferee: string | null;
  capaciteMin: number | null;
  equipementsSouhaites: string | null;
  ambiance: string | null;
}

export interface UserPreferencesResponse {
  id: number;
  userId: number;
  budgetMax: number | null;
  typeSejour: string | null;
  villePreferee: string | null;
  capaciteMin: number | null;
  equipementsSouhaites: string | null;
  ambiance: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private apiUrl = `${environment.apiBaseUrl}/api/preferences`;

  constructor(private readonly http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  save(prefs: UserPreferencesRequest): Observable<UserPreferencesResponse> {
    return this.http.post<UserPreferencesResponse>(this.apiUrl, prefs, { headers: this.getHeaders() });
  }

  get(): Observable<UserPreferencesResponse> {
    return this.http.get<UserPreferencesResponse>(this.apiUrl, { headers: this.getHeaders() });
  }
}

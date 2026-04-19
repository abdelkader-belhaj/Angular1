import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Logement {
  idLogement: number;
  idCategorie: number;
  nomCategorie: string;
  idHebergeur: number;
  nomHebergeur: string;
  nom: string;
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  adresse?: string;
  ville?: string;
  prixNuit?: number;
  capacite: number;
  availablePlaces?: number;
  saturated?: boolean;
  nextAvailableDate?: string;
  disponible: boolean;
  latitude?: number;
  longitude?: number;
  dateCreation?: string;
}

export interface RecommendationResponse {
  logement: Logement;
  aiScore: number;
}

export interface LogementRequest {
  idCategorie: number;
  nom: string;
  description: string;
  imageUrls: string[];
  /** Premier visuel envoyé au backend (alias de imageUrls[0]) */
  imageUrl?: string;
  videoUrl: string;
  adresse: string;
  ville: string;
  prixNuit: number;
  capacite: number;
  disponible: boolean;
  latitude?: number;
  longitude?: number;
}

@Injectable({
  providedIn: 'root'
})
export class LogementService {
  private apiUrl = 'http://localhost:8080/api/logements';

  constructor(private readonly http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  getLogements(): Observable<Logement[]> {
    return this.getLogementsPublic();
  }

  getRecommendations(userId: number): Observable<RecommendationResponse[]> {
    return this.http.get<RecommendationResponse[]>(`${this.apiUrl}/recommendations/${userId}`, { headers: this.getHeaders() });
  }

  getLogementsPublic(): Observable<Logement[]> {
    console.debug('LogementService: requesting public logements from', `${this.apiUrl}/public`);
    return this.http.get<Logement[]>(`${this.apiUrl}/public`, { headers: this.getHeaders() });
  }

  getLogementsByCategorie(idCategorie: number): Observable<Logement[]> {
    return this.http.get<Logement[]>(`${this.apiUrl}/categorie/${idCategorie}`, { headers: this.getHeaders() });
  }

  getLogementById(id: number): Observable<Logement> {
    return this.http.get<Logement>(`${this.apiUrl}/${id}`);
  }

  createLogement(payload: LogementRequest): Observable<Logement> {
    return this.http.post<Logement>(this.apiUrl, payload, {
      headers: this.getHeaders()
    });
  }

  updateLogement(id: number, payload: LogementRequest): Observable<Logement> {
    return this.http.put<Logement>(`${this.apiUrl}/${id}`, payload, {
      headers: this.getHeaders()
    });
  }

  deleteLogement(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, {
      headers: this.getHeaders()
    });
  }
}

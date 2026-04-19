import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Logement {
  id: number;
  nom: string;
  adresse: string;
}

export interface Categorie {
  idCategorie: number;
  nomCategorie: string;
  description: string;
  icone: string;
  statut: boolean;
  dateCreation: string;
  nbLogements: number;
  logements?: Logement[];
}

@Injectable({
  providedIn: 'root'
})
export class CategorieService {

  private apiUrl = 'http://localhost:8080/api/categories';
  private logementsApiUrl = 'http://localhost:8080/api/logements';

  constructor(private http: HttpClient) {}

  // ── GET token depuis localStorage ──────────────
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private getReadHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // ── PUBLIC — sans token ─────────────────────────
  getCategories(): Observable<Categorie[]> {
    return this.http.get<Categorie[]>(this.apiUrl);
  }

  getCategorieById(id: number): Observable<Categorie> {
    return this.http.get<Categorie>(`${this.apiUrl}/${id}`, { headers: this.getReadHeaders() });
  }

  getLogementsByCategorie(idCategorie: number): Observable<Logement[]> {
    return this.http.get<Logement[]>(`${this.logementsApiUrl}/categorie/${idCategorie}`, { headers: this.getReadHeaders() });
  }

  // ── ADMIN — avec token ──────────────────────────
  createCategorie(data: Partial<Categorie>): Observable<Categorie> {
    return this.http.post<Categorie>(
      this.apiUrl,
      data,
      { headers: this.getHeaders() }
    );
  }

  updateCategorie(
    id: number,
    data: Partial<Categorie>
  ): Observable<Categorie> {
    return this.http.put<Categorie>(
      `${this.apiUrl}/${id}`,
      data,
      { headers: this.getHeaders() }
    );
  }

  deleteCategorie(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}`,
      { headers: this.getHeaders() }
    );
  }
}
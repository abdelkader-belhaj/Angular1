import { Injectable } from '@angular/core';
import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import { categories as localCategories } from '../../data/mockData';

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

const LOCAL_CATEGORY_FALLBACK: Categorie[] = localCategories.map((category, index) => ({
  idCategorie: category.idCategorie,
  nomCategorie: category.nom,
  description: category.description,
  icone: index === 0 ? 'default.jpg' : 'appartement.jpg',
  statut: true,
  dateCreation: new Date().toISOString(),
  nbLogements: 0,
  logements: []
}));

@Injectable({
  providedIn: 'root'
})
export class CategorieService {
  // ────────────────────────────────────────────────────────────
  // 📋 SERVICE DE GESTION DES CATÉGORIES
  // ────────────────────────────────────────────────────────────
  // Ce service gère toutes les opérations liées aux catégories:
  //   - GET /api/categories (PUBLIC - sans auth)
  //   - POST /api/categories (ADMIN/HEBERGEUR - avec JWT)
  //   - PUT /api/categories/{id} (ADMIN/HEBERGEUR - avec JWT)
  //   - DELETE /api/categories/{id} (ADMIN/HEBERGEUR - avec JWT)
  //
  // 🔒 Sécurité: Les en-têtes Authorization sont ajoutés auto
  //    si un token JWT existe dans localStorage['auth_token']
  // ────────────────────────────────────────────────────────────

  private apiUrl = 'http://localhost:8080/api/categories';
  private logementsApiUrl = 'http://localhost:8080/api/logements';
  private categoriesCache$?: Observable<Categorie[]>;
  private httpPublic: HttpClient;

  constructor(private http: HttpClient, handler: HttpBackend) {
    // httpPublic contourne tous les interceptors → requête sans JWT → backend retourne TOUTES les catégories
    this.httpPublic = new HttpClient(handler);
  }

  // ── GET token depuis localStorage ──────────────
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

  private getReadHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // ── PUBLIC — sans token ─────────────────────────
  clearCache(): void {
    this.categoriesCache$ = undefined;
  }

  getCategories(): Observable<Categorie[]> {
    if (this.categoriesCache$) {
      console.log('[CategorieService] Retournant les catégories du cache');
      return this.categoriesCache$;
    }

    console.log('[CategorieService] Récupération des catégories depuis le backend...');
    // Utiliser httpPublic (sans interceptor) pour ne pas envoyer le JWT
    // → le backend retourne TOUTES les catégories (admin + hébergeurs)
    this.categoriesCache$ = this.httpPublic.get<Categorie[]>(this.apiUrl).pipe(
      tap(response => {
        console.log('[CategorieService] ✅ Réponse du backend (sans headers):', response);
        console.log('[CategorieService] Nombre de catégories reçues:', Array.isArray(response) ? response.length : 0);
      }),
      catchError(err => {
        console.error('[CategorieService] ❌ Erreur appel public:', err);
        console.log('[CategorieService] Tentative avec headers auth...');
        const headers = this.getReadHeaders();
        return this.http.get<Categorie[]>(this.apiUrl, { headers }).pipe(
          tap(response => console.log('[CategorieService] ✅ Réponse (avec headers):', response)),
          catchError(err2 => {
            console.error('[CategorieService] ❌ Erreur aussi avec headers:', err2);
            console.log('[CategorieService] Utilisation du fallback local...');
            return of([...LOCAL_CATEGORY_FALLBACK]);
          })
        );
      }),
      shareReplay(1)
    );

    return this.categoriesCache$;
  }

  getCategorieById(id: number): Observable<Categorie> {
    return this.http.get<Categorie>(`${this.apiUrl}/${id}`);
  }

  getLogementsByCategorie(idCategorie: number): Observable<Logement[]> {
    return this.http.get<Logement[]>(`${this.logementsApiUrl}/categorie/${idCategorie}`);
  }

  // ── ADMIN — avec token ──────────────────────────
  createCategorie(data: Partial<Categorie>): Observable<Categorie> {
    return this.http.post<Categorie>(
      this.apiUrl,
      data,
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => {
        this.categoriesCache$ = undefined;
      })
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
    ).pipe(
      tap(() => {
        this.categoriesCache$ = undefined;
      })
    );
  }

  deleteCategorie(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => {
        this.categoriesCache$ = undefined;
      })
    );
  }
}

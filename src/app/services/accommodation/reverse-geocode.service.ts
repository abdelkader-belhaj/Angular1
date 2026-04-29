import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface GeocodeResponse {
  address: string;
  city: string;
}

/**
 * Service pour le reverse geocoding (lat/lon → adresse/ville)
 * Utilise l'API du backend qui appelle Nominatim/OpenStreetMap
 * Fonctionne partout dans le monde, pas seulement en Tunisie!
 */
@Injectable({
  providedIn: 'root'
})
export class ReverseGeocodeService {
  private apiUrl = 'http://localhost:8080/api/logements/reverse-geocode';

  constructor(private http: HttpClient) {}

  /**
   * Convertir latitude/longitude → adresse + ville
   * Exemple: 36.8065, 10.1966 → {address: "...", city: "Tunis"}
   */
  reverseGeocode(latitude: number, longitude: number): Observable<GeocodeResponse> {
    if (latitude === undefined || longitude === undefined || 
        latitude === null || longitude === null) {
      console.warn('[ReverseGeocodeService] Coordonnées nulles');
      return of({ address: '', city: '' });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      console.warn('[ReverseGeocodeService] Coordonnées invalides: lat=', latitude, 'lon=', longitude);
      return of({ address: '', city: '' });
    }

    console.log('[ReverseGeocodeService] Appel API: lat=', latitude, 'lon=', longitude);

    return this.http.get<GeocodeResponse>(this.apiUrl, {
      params: {
        latitude: latitude.toString(),
        longitude: longitude.toString()
      }
    }).pipe(
      map(response => {
        console.log('[ReverseGeocodeService] ✅ Réponse:', response);
        return response;
      }),
      catchError(error => {
        console.error('[ReverseGeocodeService] Erreur API:', error);
        return of({ address: '', city: '' });
      })
    );
  }
}

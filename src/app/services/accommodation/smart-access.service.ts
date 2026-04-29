import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface VerifyLocationRequest {
  logementId: number;
  clientLatitude: number;
  clientLongitude: number;
}

export interface GeoAccessResponse {
  success: boolean;
  message: string;
  distanceMeters?: number;
  unlockCode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SmartAccessService {
  private http = inject(HttpClient);
  // URL Spring Boot (pas FastAPI pour cette fonctionnalitÃ©)
  private apiUrl = 'http://localhost:8080/api/smart-access';

  verifyLocation(data: VerifyLocationRequest): Observable<GeoAccessResponse> {
    return this.http.post<GeoAccessResponse>(`${this.apiUrl}/verify-location`, data);
  }
}


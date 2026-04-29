import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LicenseVerificationResult {
  valid: boolean;
  numeroMatch: boolean;
  dateMatch: boolean;
  nomMatch?: boolean;
  prenomMatch?: boolean;
  dateNaissMatch?: boolean;
  numeroExtrait: string | null;
  dateExtraite: string | null;
  nomExtrait?: string | null;
  prenomExtrait?: string | null;
  dateNaissExtraite?: string | null;
  message: string;
  rawMessage?: string;
  ocrText?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AiExtractionService {
  // L'URL de votre serveur Flask
  private readonly AI_API_URL = 'http://127.0.0.1:5000/verify-license';

  constructor(private http: HttpClient) {}

  verifyLicense(
    file: File,
    numeroPermis: string,
    dateExpiration: string,
    nom?: string,
    prenom?: string,
    dateNaiss?: string,
  ): Observable<LicenseVerificationResult> {
    const formData = new FormData();
    formData.append('licenseImage', file);
    formData.append('numeroPermis', numeroPermis);
    formData.append('dateExpiration', dateExpiration);
    if (nom) {
      formData.append('nom', nom);
    }
    if (prenom) {
      formData.append('prenom', prenom);
    }
    if (dateNaiss) {
      formData.append('dateNaiss', dateNaiss);
    }

    return this.http.post<LicenseVerificationResult>(this.AI_API_URL, formData);
  }
}

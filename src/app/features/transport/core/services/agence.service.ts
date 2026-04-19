// src/app/features/transport/core/services/agence.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AgenceLocation } from '../models'; // à créer plus tard si besoin

@Injectable({ providedIn: 'root' })
export class AgenceService {
  constructor(private api: ApiService) {}

  getAgenceById(id: number): Observable<any> {
    return this.api.get(`/agences/${id}`);
  }

  getAgenceByUtilisateurId(utilisateurId: number): Observable<any> {
    return this.api.get(`/agences/utilisateur/${utilisateurId}`);
  }
}

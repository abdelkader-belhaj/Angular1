// src/app/features/transport/core/services/annulation.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AnnulationTransport, AnnulePar } from '../models';

@Injectable({ providedIn: 'root' })
export class AnnulationService {
  constructor(private api: ApiService) {}

  // ==================== CRUD ====================

  addAnnulation(
    annulation: Partial<AnnulationTransport>,
  ): Observable<AnnulationTransport> {
    return this.api.post<AnnulationTransport>('/annulations', annulation);
  }

  getAnnulationById(id: number): Observable<AnnulationTransport> {
    return this.api.get<AnnulationTransport>(`/annulations/${id}`);
  }

  getAllAnnulations(): Observable<AnnulationTransport[]> {
    return this.api.get<AnnulationTransport[]>('/annulations');
  }

  updateAnnulation(
    id: number,
    annulation: Partial<AnnulationTransport>,
  ): Observable<AnnulationTransport> {
    return this.api.put<AnnulationTransport>(`/annulations/${id}`, {
      ...annulation,
      idAnnulation: id,
    });
  }

  deleteAnnulation(id: number): Observable<void> {
    return this.api.delete<void>(`/annulations/${id}`);
  }

  // ==================== WORKFLOW ====================
  // PUT /hypercloud/annulations/course/{courseId}/annuler?annulePar=CLIENT&raison=...

  annulerCourse(
    courseId: number,
    annulePar: AnnulePar,
    raison?: string,
  ): Observable<AnnulationTransport> {
    let path = `/annulations/course/${courseId}/annuler?annulePar=${annulePar}`;
    if (raison) path += `&raison=${encodeURIComponent(raison)}`;
    return this.api.put<AnnulationTransport>(path, {});
  }
}

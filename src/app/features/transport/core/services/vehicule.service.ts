// src/app/features/transport/core/services/vehicule.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Vehicule } from '../models';

@Injectable({ providedIn: 'root' })
export class VehiculeService {
  constructor(private api: ApiService) {}

  getVehiculeById(id: number): Observable<Vehicule> {
    return this.api.get<Vehicule>(`/vehicules/${id}`);
  }

  getAllVehicules(): Observable<Vehicule[]> {
    return this.api.get<Vehicule[]>('/vehicules');
  }

  getActiveVehicules(): Observable<Vehicule[]> {
    return this.api.get<Vehicule[]>('/vehicules/actifs');
  }

  addVehicule(vehicule: Vehicule): Observable<Vehicule> {
    return this.api.post<Vehicule>('/vehicules', vehicule);
  }

  updateVehicule(
    id: number,
    vehicule: Partial<Vehicule>,
  ): Observable<Vehicule> {
    return this.api.put<Vehicule>(`/vehicules/${id}`, vehicule);
  }

  deleteVehicule(id: number): Observable<void> {
    return this.api.delete<void>(`/vehicules/${id}`);
  }

  activateVehicule(id: number): Observable<Vehicule> {
    return this.api.put<Vehicule>(`/vehicules/${id}/activer`, {});
  }

  deactivateVehicule(id: number): Observable<Vehicule> {
    return this.api.put<Vehicule>(`/vehicules/${id}/desactiver`, {});
  }
}

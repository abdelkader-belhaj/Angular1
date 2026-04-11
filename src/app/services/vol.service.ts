import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Vol } from '../models/vol.model';

@Injectable({ providedIn: 'root' })
export class VolService {
  private readonly base = 'http://localhost:8080/api/vols';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Vol[]> {
    return this.http.get<Vol[]>(this.base);
  }

  getById(id: number): Observable<Vol> {
    return this.http.get<Vol>(`${this.base}/${id}`);
  }

  search(depart: string, arrivee: string, date: string): Observable<Vol[]> {
    const params = new HttpParams()
      .set('depart', depart)
      .set('arrivee', arrivee)
      .set('date', date);
    return this.http.get<Vol[]>(`${this.base}/search`, { params });
  }
}
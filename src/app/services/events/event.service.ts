// src/app/services/events/event.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// ✅ Chemin correct depuis services/events/ vers event/models/
import {
  EventActivity,
  EventActivityRequest,
  EventCategory,
} from '../../event/models/event.model';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly base       = 'http://localhost:8080/api/events';
  private readonly catBase    = 'http://localhost:8080/api/categories';

  constructor(private readonly http: HttpClient) {}

  // GET /api/events/published
  getPublished(): Observable<EventActivity[]> {
    return this.http.get<EventActivity[]>(`${this.base}/published`);
  }

  // GET /api/events/published/{id}
  getPublishedById(id: number): Observable<EventActivity> {
    return this.http.get<EventActivity>(`${this.base}/published/${id}`);
  }

  // GET /api/events/mes-events
  getMesEvents(): Observable<EventActivity[]> {
    return this.http.get<EventActivity[]>(`${this.base}/mes-events`);
  }

  create(payload: EventActivityRequest): Observable<EventActivity> {
    return this.http.post<EventActivity>(this.base, payload);
  }

  update(id: number, payload: EventActivityRequest): Observable<EventActivity> {
    return this.http.put<EventActivity>(`${this.base}/${id}`, payload);
  }

  cancel(id: number, reason?: string): Observable<EventActivity> {
    const payload = reason && reason.trim() ? { reason: reason.trim() } : {};
    return this.http.post<EventActivity>(`${this.base}/${id}/cancel`, payload);
  }

  // GET /api/events/type/{type}
  getByType(type: string): Observable<EventActivity[]> {
    return this.http.get<EventActivity[]>(`${this.base}/type/${type}`);
  }

  // GET /api/events/city/{city}
  getByCity(city: string): Observable<EventActivity[]> {
    return this.http.get<EventActivity[]>(`${this.base}/city/${city}`);
  }

  // GET /api/events/category/{categoryId}
  getByCategoryId(categoryId: number): Observable<EventActivity[]> {
    return this.http.get<EventActivity[]>(`${this.base}/category/${categoryId}`);
  }

  // GET /api/events/{id}/weather
  getEventWeather(id: number): Observable<any> {
    return this.http.get<any>(`${this.base}/${id}/weather`);
  }

  // GET /api/events/weather/by-city?city=Tunis
  getWeatherByCity(city: string): Observable<any> {
    const params = new HttpParams().set('city', city);
    return this.http.get<any>(`${this.base}/weather/by-city`, { params });
  }

  // ✅ GET /api/categories — utilisé dans event-list loadCategories()
  getCategories(): Observable<EventCategory[]> {
    return this.http.get<EventCategory[]>(this.catBase);
  }
}
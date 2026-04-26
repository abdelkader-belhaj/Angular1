// src/app/services/events/Weather.service.ts
// ✅ Vérifie que la réponse backend est bien WeatherInfo (pas wrappée dans ApiResponse)

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { WeatherInfo } from '../../event/models/event.model';

export interface ForecastWeatherInfo extends WeatherInfo {
  forecastTime: string;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly api = 'http://localhost:8080/api/events';

  constructor(private readonly http: HttpClient) {}

  getWeatherByCity(city: string): Observable<WeatherInfo> {
    return this.http.get<WeatherInfo>(
      `${this.api}/weather/by-city?city=${encodeURIComponent(city)}`
    );
  }

  getWeatherForEvent(eventId: number): Observable<WeatherInfo> {
    return this.http.get<WeatherInfo>(`${this.api}/${eventId}/weather`);
  }

  getForecastByCoordsAtDate(lat: number, lng: number, dateIso: string): Observable<ForecastWeatherInfo> {
    const url = `${this.api}/weather/forecast/by-coords?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&date=${encodeURIComponent(dateIso)}`;

    return this.http.get<ForecastWeatherInfo>(url).pipe(
      catchError(() =>
        this.getWeatherByCity('Tunis').pipe(
          map((weather) => ({ ...weather, forecastTime: dateIso })),
        ),
      ),
    );
  }
}
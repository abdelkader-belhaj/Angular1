// src/app/features/transport/core/services/api.service.ts
import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
  HttpHeaders,
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';

// Configuration centralisée - PAS d'environnement
const API_CONFIG = {
  baseUrl: 'http://localhost:8080',
  wsUrl: 'http://localhost:8080',
  apiPrefix: '/hypercloud', // ← Votre préfixe Spring Boot
  timeout: 30000,
};

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly apiUrl = API_CONFIG.baseUrl + API_CONFIG.apiPrefix;
  private readonly wsUrl = API_CONFIG.wsUrl;

  constructor(private http: HttpClient) {}

  getApiUrl(): string {
    return this.apiUrl;
  }

  getWsUrl(): string {
    return this.wsUrl;
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // GET avec chemin relatif (ex: '/chauffeurs/1' → devient '/hypercloud/chauffeurs/1')
  get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.http
      .get<T>(`${this.apiUrl}${path}`, {
        headers: this.getAuthHeaders(),
        params,
      })
      .pipe(timeout(API_CONFIG.timeout), catchError(this.handleError));
  }

  getBlob(path: string, params?: HttpParams): Observable<Blob> {
    const headers = this.getAuthHeaders().delete('Content-Type');

    return this.http
      .get(`${this.apiUrl}${path}`, {
        headers,
        params,
        responseType: 'blob',
      })
      .pipe(timeout(API_CONFIG.timeout), catchError(this.handleError));
  }

  // GET tolérant: utile quand le backend renvoie 200 avec JSON malformé
  getLenientJson<T>(
    path: string,
    params?: HttpParams,
    fallbackValue?: T,
  ): Observable<T> {
    return this.http
      .get(`${this.apiUrl}${path}`, {
        headers: this.getAuthHeaders(),
        params,
        responseType: 'text',
      })
      .pipe(
        timeout(API_CONFIG.timeout),
        map((raw) => {
          this.logLenientRaw(path, raw);
          return this.parseLenientJson<T>(raw, path);
        }),
        catchError((error) => {
          if (fallbackValue !== undefined) {
            console.warn(`[API][LENIENT] fallback used for ${path}`, error);
            return of(fallbackValue);
          }

          return this.handleError(error);
        }),
      );
  }

  private parseLenientJson<T>(raw: string, path: string): T {
    const sanitized = this.sanitizePossiblyCorruptedJson(raw);

    try {
      return JSON.parse(raw) as T;
    } catch {
      if (sanitized !== raw) {
        try {
          console.warn(
            `[API][LENIENT] retrying with sanitized payload for ${path}`,
          );
          return JSON.parse(sanitized) as T;
        } catch {
          // Continue with extraction/salvage
        }
      }

      console.warn(`[API][LENIENT] JSON.parse failed for ${path}`);
      const extracted = this.extractFirstJsonRoot(sanitized);
      if (extracted) {
        try {
          return JSON.parse(extracted) as T;
        } catch {
          console.warn(
            `[API][LENIENT] extracted root parse failed for ${path}, trying salvage`,
          );
          const salvaged = this.salvageCorruptedPayload<T>(sanitized, path);
          if (salvaged !== null) {
            return salvaged;
          }
          throw new Error(`JSON invalide depuis ${path}`);
        }
      }

      const salvaged = this.salvageCorruptedPayload<T>(sanitized, path);
      if (salvaged !== null) {
        return salvaged;
      }

      throw new Error(`JSON invalide depuis ${path}`);
    }
  }

  private sanitizePossiblyCorruptedJson(raw: string): string {
    let sanitized = raw;

    // Remove invalid control chars that can break JSON.parse.
    sanitized = sanitized.replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
      '',
    );
    // Remove UTF-8 BOM if present.
    sanitized = sanitized.replace(/^\uFEFF/, '');
    // Normalize non-JSON numbers frequently emitted by buggy serializers.
    sanitized = sanitized.replace(/\bNaN\b|\bInfinity\b|-Infinity\b/g, 'null');
    // Remove trailing commas before array/object closings.
    sanitized = sanitized.replace(/,\s*([}\]])/g, '$1');

    if (sanitized !== raw) {
      console.info('[API][LENIENT] payload sanitized before parse', {
        originalLength: raw.length,
        sanitizedLength: sanitized.length,
      });
    }

    return sanitized;
  }

  private salvageCorruptedPayload<T>(raw: string, path: string): T | null {
    if (path.includes('/agences-location')) {
      const agences = this.salvageAgencesFromRaw(raw);
      console.info(
        `[API][LENIENT] agences salvage count for ${path}: ${agences.length}`,
        agences.map((a) => ({
          idAgence: a['idAgence'],
          utilisateurId:
            (a['utilisateur'] as any)?.id ?? a['utilisateurId'] ?? null,
          nomAgence: a['nomAgence'],
        })),
      );
      if (agences.length > 0) {
        return agences as T;
      }
    }

    if (path.includes('/vehicules-agence')) {
      const vehicules = this.salvageVehiculesFromRaw(raw);
      console.info(
        `[API][LENIENT] vehicules salvage count for ${path}: ${vehicules.length}`,
        vehicules.map((v) => ({
          idVehiculeAgence: v['idVehiculeAgence'],
          numeroPlaque: v['numeroPlaque'],
          typeVehicule: v['typeVehicule'],
          agenceId: (v['agence'] as any)?.idAgence ?? null,
        })),
      );
      if (vehicules.length > 0) {
        return vehicules as T;
      }
    }

    if (
      path.includes('/courses/chauffeur/') ||
      path.includes('/courses/client/') ||
      path.includes('/demandes-courses/client/')
    ) {
      const courses = this.salvageCoursesFromRaw(raw);
      console.info(
        `[API][LENIENT] courses salvage count for ${path}: ${courses.length}`,
      );
      if (courses.length > 0) {
        return courses as T;
      }
    }

    return null;
  }

  private salvageCoursesFromRaw(raw: string): Array<Record<string, unknown>> {
    const searchable = this.normalizeCorruptedJsonText(raw);

    const matches = [
      ...Array.from(searchable.matchAll(/"idCourse"\s*:\s*(\d+)/g)),
      ...Array.from(searchable.matchAll(/"id_course"\s*:\s*(\d+)/g)),
    ].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    if (!matches.length) {
      return [];
    }

    const courses: Array<Record<string, unknown>> = [];

    for (let i = 0; i < matches.length; i += 1) {
      const start = matches[i].index ?? 0;
      const end = matches[i + 1]?.index ?? searchable.length;
      const chunk = searchable.slice(start, end);

      const idCourse =
        this.extractNumber(chunk, /"idCourse"\s*:\s*(\d+)/) ??
        this.extractNumber(chunk, /"id_course"\s*:\s*(\d+)/);

      if (idCourse === null) {
        continue;
      }

      const departureAddress =
        this.extractString(
          chunk,
          /"localisationDepart"\s*:\s*\{[\s\S]*?"adresse"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
        ) ??
        this.extractString(
          chunk,
          /"adresseDepart"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
        );

      const arrivalAddress =
        this.extractString(
          chunk,
          /"localisationArrivee"\s*:\s*\{[\s\S]*?"adresse"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
        ) ??
        this.extractString(
          chunk,
          /"adresseArrivee"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
        );

      const course: Record<string, unknown> = {
        idCourse,
        statut:
          this.extractString(
            chunk,
            /"statut"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
          ) ?? 'CANCELLED',
        prixFinal:
          this.extractDecimal(
            chunk,
            /"prixFinal"\s*:\s*(?:"?(-?\d+(?:\.\d+)?)"?)/,
          ) ??
          this.extractDecimal(
            chunk,
            /"prix_final"\s*:\s*(?:"?(-?\d+(?:\.\d+)?)"?)/,
          ) ??
          0,
        dateCreation:
          this.extractString(
            chunk,
            /"dateCreation"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
          ) ?? undefined,
        dateModification:
          this.extractString(
            chunk,
            /"dateModification"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
          ) ?? undefined,
      };

      if (departureAddress) {
        course['localisationDepart'] = { adresse: departureAddress };
      }
      if (arrivalAddress) {
        course['localisationArrivee'] = { adresse: arrivalAddress };
      }

      courses.push(course);
    }

    const uniqueById = new Map<number, Record<string, unknown>>();
    for (const course of courses) {
      const id = Number(course['idCourse']);
      const existing = uniqueById.get(id);
      if (!existing) {
        uniqueById.set(id, course);
        continue;
      }

      if (this.computeCourseScore(course) > this.computeCourseScore(existing)) {
        uniqueById.set(id, course);
      }
    }

    return Array.from(uniqueById.values());
  }

  private salvageVehiculesFromRaw(raw: string): Array<Record<string, unknown>> {
    const searchable = this.normalizeCorruptedJsonText(raw);

    const matches = [
      ...Array.from(searchable.matchAll(/"idVehiculeAgence"\s*:\s*(\d+)/g)),
      ...Array.from(searchable.matchAll(/"id_vehicule_agence"\s*:\s*(\d+)/g)),
    ].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    if (!matches.length) {
      return [];
    }

    const vehicules: Array<Record<string, unknown>> = [];

    for (let i = 0; i < matches.length; i += 1) {
      const current = matches[i];
      const start = current.index ?? 0;
      const end = matches[i + 1]?.index ?? searchable.length;
      const chunk = searchable.slice(start, end);

      const idVehiculeAgence =
        this.extractNumber(chunk, /"idVehiculeAgence"\s*:\s*(\d+)/) ??
        this.extractNumber(chunk, /"id_vehicule_agence"\s*:\s*(\d+)/);

      if (idVehiculeAgence === null) {
        continue;
      }

      const agenceId =
        this.extractNumber(
          chunk,
          /"agence"\s*:\s*\{[\s\S]*?"idAgence"\s*:\s*(\d+)/,
        ) ??
        this.extractNumber(chunk, /"id_agence"\s*:\s*(\d+)/) ??
        this.extractNumber(chunk, /"agenceId"\s*:\s*(\d+)/);

      const vehicule: Record<string, unknown> = {
        idVehiculeAgence,
        agence: {
          idAgence: agenceId ?? 0,
        },
        marque:
          this.extractString(
            chunk,
            /"marque"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
          ) ?? '',
        modele:
          this.extractString(
            chunk,
            /"modele"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
          ) ?? '',
        numeroPlaque:
          this.extractString(
            chunk,
            /"numeroPlaque"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
          ) ??
          this.extractString(
            chunk,
            /"numero_plaque"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
          ) ??
          `UNKNOWN-${idVehiculeAgence}`,
        typeVehicule:
          this.extractString(
            chunk,
            /"typeVehicule"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
          ) ?? 'CITADINE',
        capacitePassagers:
          this.extractNumber(chunk, /"capacitePassagers"\s*:\s*(\d+)/) ??
          this.extractNumber(chunk, /"capacite_passagers"\s*:\s*(\d+)/) ??
          undefined,
        prixKm:
          this.extractDecimal(
            chunk,
            /"prixKm"\s*:\s*(?:"?(-?\d+(?:\.\d+)?)"?)/,
          ) ??
          this.extractDecimal(
            chunk,
            /"prix_km"\s*:\s*(?:"?(-?\d+(?:\.\d+)?)"?)/,
          ) ??
          undefined,
        prixMinute:
          this.extractDecimal(
            chunk,
            /"prixMinute"\s*:\s*(?:"?(-?\d+(?:\.\d+)?)"?)/,
          ) ??
          this.extractDecimal(
            chunk,
            /"prix_minute"\s*:\s*(?:"?(-?\d+(?:\.\d+)?)"?)/,
          ) ??
          undefined,
        prixVehicule:
          this.extractDecimal(
            chunk,
            /"prixVehicule"\s*:\s*(?:"?(-?\d+(?:[\.,]\d+)?)"?)/,
          ) ??
          this.extractDecimal(
            chunk,
            /"prix_vehicule"\s*:\s*(?:"?(-?\d+(?:[\.,]\d+)?)"?)/,
          ) ??
          undefined,
        statut:
          this.extractString(
            chunk,
            /"statut"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
          ) ?? 'ACTIVE',
      };

      vehicules.push(vehicule);
    }

    const uniqueById = new Map<number, Record<string, unknown>>();
    for (const vehicule of vehicules) {
      const id = Number(vehicule['idVehiculeAgence']);
      if (!uniqueById.has(id)) {
        uniqueById.set(id, vehicule);
        continue;
      }

      const existing = uniqueById.get(id)!;
      if (
        this.computeVehiculeScore(vehicule) >
        this.computeVehiculeScore(existing)
      ) {
        uniqueById.set(id, vehicule);
      }
    }

    return Array.from(uniqueById.values());
  }

  private salvageAgencesFromRaw(raw: string): Array<Record<string, unknown>> {
    const searchable = this.normalizeCorruptedJsonText(raw);

    const matches = [
      ...Array.from(searchable.matchAll(/"idAgence"\s*:\s*(\d+)/g)),
      ...Array.from(searchable.matchAll(/"id_agence"\s*:\s*(\d+)/g)),
    ].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (!matches.length) {
      return [];
    }

    const agences: Array<Record<string, unknown>> = [];
    const utilisateurByAgence = this.extractUserIdAssociations(searchable);

    for (let i = 0; i < matches.length; i += 1) {
      const current = matches[i];
      const start = current.index ?? 0;
      const end = matches[i + 1]?.index ?? searchable.length;
      const chunk = searchable.slice(start, end);

      const idAgence =
        this.extractNumber(chunk, /"idAgence"\s*:\s*(\d+)/) ??
        this.extractNumber(chunk, /"id_agence"\s*:\s*(\d+)/);
      if (idAgence === null) {
        continue;
      }

      const utilisateurId = this.extractNumber(
        chunk,
        /"utilisateur"\s*:\s*\{[\s\S]*?"id"\s*:\s*(\d+)/,
      );
      const utilisateurIdFromJoin = this.extractNumber(
        chunk,
        /"id_utilisateur"\s*:\s*(\d+)/,
      );
      const utilisateurIdCamel = this.extractNumber(
        chunk,
        /"idUtilisateur"\s*:\s*(\d+)/,
      );
      const utilisateurIdSnake = this.extractNumber(
        chunk,
        /"id_utilisateur"\s*:\s*(\d+)/,
      );

      const agence: Record<string, unknown> = {
        idAgence,
        nomAgence:
          this.extractString(
            chunk,
            /"nomAgence"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
          ) ??
          this.extractString(
            chunk,
            /"nom_agence"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
          ) ??
          `Agence ${idAgence}`,
        telephone:
          this.extractString(
            chunk,
            /"telephone"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
          ) ?? '',
        adresse:
          this.extractString(
            chunk,
            /"adresse"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
          ) ?? '',
        statut:
          this.extractBoolean(chunk, /"statut"\s*:\s*(true|false)/) ?? true,
        solde:
          this.extractDecimal(
            chunk,
            /"solde"\s*:\s*(?:"?(-?\d+(?:\.\d+)?)"?)/,
          ) ?? 0,
      };

      const resolvedUtilisateurId =
        utilisateurId ??
        utilisateurIdFromJoin ??
        utilisateurIdCamel ??
        utilisateurIdSnake ??
        utilisateurByAgence.get(idAgence) ??
        null;

      if (resolvedUtilisateurId !== null) {
        agence['utilisateur'] = { id: resolvedUtilisateurId };
        agence['utilisateurId'] = resolvedUtilisateurId;
      }

      agences.push(agence);
    }

    const uniqueById = new Map<number, Record<string, unknown>>();
    for (const agence of agences) {
      const id = Number(agence['idAgence']);
      if (!uniqueById.has(id)) {
        uniqueById.set(id, agence);
        continue;
      }

      const existing = uniqueById.get(id)!;
      if (this.computeAgenceScore(agence) > this.computeAgenceScore(existing)) {
        uniqueById.set(id, agence);
      }
    }

    return Array.from(uniqueById.values());
  }

  private normalizeCorruptedJsonText(raw: string): string {
    let normalized = raw;

    // Some endpoints intermittently return JSON escaped as a string body.
    if ((normalized.match(/\\"/g) ?? []).length > 10) {
      normalized = normalized.replace(/\\"/g, '"');
    }

    normalized = normalized
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ');

    return normalized;
  }

  private extractUserIdAssociations(raw: string): Map<number, number> {
    const associations = new Map<number, number>();
    const patterns = [
      /"idAgence"\s*:\s*(\d+)[\s\S]{0,4000}?"utilisateur"\s*:\s*\{[\s\S]{0,4000}?"id"\s*:\s*(\d+)/g,
      /"id_agence"\s*:\s*(\d+)[\s\S]{0,4000}?"utilisateur"\s*:\s*\{[\s\S]{0,4000}?"id"\s*:\s*(\d+)/g,
      /"idAgence"\s*:\s*(\d+)[\s\S]{0,1200}?"idUtilisateur"\s*:\s*(\d+)/g,
      /"idAgence"\s*:\s*(\d+)[\s\S]{0,1200}?"id_utilisateur"\s*:\s*(\d+)/g,
      /"id_agence"\s*:\s*(\d+)[\s\S]{0,1200}?"idUtilisateur"\s*:\s*(\d+)/g,
      /"id_agence"\s*:\s*(\d+)[\s\S]{0,1200}?"id_utilisateur"\s*:\s*(\d+)/g,
    ];

    for (const pattern of patterns) {
      for (const match of raw.matchAll(pattern)) {
        const idAgence = Number(match[1]);
        const idUtilisateur = Number(match[2]);
        if (!Number.isFinite(idAgence) || !Number.isFinite(idUtilisateur)) {
          continue;
        }

        if (!associations.has(idAgence)) {
          associations.set(idAgence, idUtilisateur);
        }
      }
    }

    return associations;
  }

  private logLenientRaw(path: string, raw: string): void {
    if (!path.includes('/agences-location')) {
      return;
    }

    const idAgenceCount = (raw.match(/"idAgence"|"id_agence"/g) ?? []).length;
    const utilisateurFieldCount = (
      raw.match(/"utilisateur"\s*:\s*\{|"idUtilisateur"|"id_utilisateur"/g) ??
      []
    ).length;

    console.info(`[API][LENIENT] ${path} raw length=${raw.length}`);
    console.info('[API][LENIENT] raw preview:', raw.slice(0, 400));
    console.info('[API][LENIENT] raw key counters', {
      idAgenceCount,
      utilisateurFieldCount,
    });
  }

  private computeAgenceScore(agence: Record<string, unknown>): number {
    let score = 0;

    if (agence['idAgence'] != null) {
      score += 1;
    }
    if (agence['nomAgence']) {
      score += 1;
    }
    if (agence['telephone']) {
      score += 1;
    }
    if (agence['adresse']) {
      score += 1;
    }

    const userId =
      (agence['utilisateur'] as any)?.id ?? agence['utilisateurId'];
    if (userId != null) {
      score += 3;
    }

    return score;
  }

  private computeVehiculeScore(vehicule: Record<string, unknown>): number {
    let score = 0;

    if (vehicule['idVehiculeAgence'] != null) {
      score += 1;
    }
    if (vehicule['numeroPlaque']) {
      score += 2;
    }
    if (vehicule['typeVehicule']) {
      score += 1;
    }
    if (vehicule['marque']) {
      score += 1;
    }
    if (vehicule['modele']) {
      score += 1;
    }
    if ((vehicule['agence'] as any)?.idAgence) {
      score += 1;
    }

    return score;
  }

  private computeCourseScore(course: Record<string, unknown>): number {
    let score = 0;
    if (course['idCourse'] != null) {
      score += 1;
    }
    if (course['statut']) {
      score += 1;
    }
    if (course['dateModification']) {
      score += 1;
    }
    if (course['dateCreation']) {
      score += 1;
    }
    if (course['prixFinal'] != null) {
      score += 1;
    }
    if ((course['localisationDepart'] as any)?.adresse) {
      score += 1;
    }
    if ((course['localisationArrivee'] as any)?.adresse) {
      score += 1;
    }
    return score;
  }

  private extractString(source: string, pattern: RegExp): string | null {
    const match = source.match(pattern);
    if (!match?.[1]) {
      return null;
    }

    const escaped = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
    return escaped;
  }

  private extractNumber(source: string, pattern: RegExp): number | null {
    const match = source.match(pattern);
    if (!match?.[1]) {
      return null;
    }

    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  }

  private extractDecimal(source: string, pattern: RegExp): number | null {
    const match = source.match(pattern);
    if (!match?.[1]) {
      return null;
    }

    const normalized = match[1].replace(',', '.');
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }

  private extractBoolean(source: string, pattern: RegExp): boolean | null {
    const match = source.match(pattern);
    if (!match?.[1]) {
      return null;
    }

    return match[1] === 'true';
  }

  private extractFirstJsonRoot(raw: string): string | null {
    const start = raw.search(/[\[{]/);
    if (start < 0) {
      return null;
    }

    const opening = raw[start];
    const closing = opening === '[' ? ']' : '}';
    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let i = start; i < raw.length; i += 1) {
      const ch = raw[i];

      if (inString) {
        if (escaping) {
          escaping = false;
          continue;
        }
        if (ch === '\\') {
          escaping = true;
          continue;
        }
        if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === opening) {
        depth += 1;
      } else if (ch === closing) {
        depth -= 1;
        if (depth === 0) {
          return raw.slice(start, i + 1);
        }
      }
    }

    return null;
  }

  post<T>(path: string, body: any): Observable<T> {
    return this.http
      .post<T>(`${this.apiUrl}${path}`, body, {
        headers: this.getAuthHeaders(),
      })
      .pipe(timeout(API_CONFIG.timeout), catchError(this.handleError));
  }

  postMultipart<T>(path: string, formData: FormData): Observable<T> {
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http
      .post<T>(`${this.apiUrl}${path}`, formData, { headers })
      .pipe(timeout(API_CONFIG.timeout), catchError(this.handleError));
  }

  postForm<T>(path: string, formData: Record<string, string>): Observable<T> {
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    const body = new URLSearchParams(formData).toString();

    return this.http
      .post<T>(`${this.apiUrl}${path}`, body, { headers })
      .pipe(timeout(API_CONFIG.timeout), catchError(this.handleError));
  }

  postText(path: string, body: any): Observable<string> {
    return this.http
      .post(`${this.apiUrl}${path}`, body, {
        headers: this.getAuthHeaders(),
        responseType: 'text',
      })
      .pipe(timeout(API_CONFIG.timeout), catchError(this.handleError));
  }

  put<T>(path: string, body: any): Observable<T> {
    return this.http
      .put<T>(`${this.apiUrl}${path}`, body, {
        headers: this.getAuthHeaders(),
      })
      .pipe(timeout(API_CONFIG.timeout), catchError(this.handleError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<T>(`${this.apiUrl}${path}`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(timeout(API_CONFIG.timeout), catchError(this.handleError));
  }

  deleteWithParams<T>(path: string, params: HttpParams): Observable<T> {
    return this.http
      .delete<T>(`${this.apiUrl}${path}`, {
        headers: this.getAuthHeaders(),
        params,
      })
      .pipe(timeout(API_CONFIG.timeout), catchError(this.handleError));
  }

  private handleError(error: unknown): Observable<never> {
    let message = 'Erreur serveur';

    if (error instanceof Error && !(error instanceof HttpErrorResponse)) {
      message = error.message || 'Erreur inattendue';
      console.error('API Error:', error);
      return throwError(() => new Error(message));
    }

    const httpError = error as HttpErrorResponse;

    if (httpError.error instanceof ErrorEvent) {
      message = `Client: ${httpError.error.message}`;
    } else {
      switch (httpError.status) {
        case 0:
          message = 'Serveur inaccessible';
          break;
        case 400:
          message =
            (typeof httpError.error === 'string' && httpError.error.trim()) ||
            httpError.error?.message ||
            'Requête invalide';
          break;
        case 401:
          message = 'Non authentifié';
          break;
        case 403:
          message = 'Accès refusé';
          break;
        case 404:
          message = 'Ressource non trouvée';
          break;
        case 500:
          message = 'Erreur serveur interne';
          break;
        default:
          message = `Erreur ${httpError.status}`;
      }
    }

    console.error('API Error:', httpError);
    return throwError(() => new Error(message));
  }
}

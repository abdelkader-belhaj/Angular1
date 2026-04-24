import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface ReservationVolResponse {
  idReservation: number;
  clientId: number;
  clientUsername?: string;
  vehiculeId?: number;
  vehiculeMarque?: string;
  vehiculeModele?: string;
  vehiculePlaque?: string;
  agenceId?: number;
  agenceNom?: string;
  agenceAdresse?: string;
  agenceTelephone?: string;
  dateDebut: string;
  dateFin: string;
  prixTotal: number;
  advanceAmount?: number;
  depositAmount?: number;
  statut: string;
  paymentPhase?: string;
  advanceStatus?: string;
  prenom?: string;
  nom?: string;
  numeroPermis?: string;
  licenseStatus?: string;
  contractPdfUrl?: string;
  // Champs spécifiques aux vols
  numeroVol?: string;
  depart?: string;
  arrivee?: string;
  dateDepart?: string;
  dateArrivee?: string;
  heureDepart?: string;
  heureArrivee?: string;
  nbPassagers?: number;
  societeNom?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReservationVolService {
  private baseUrl = 'http://localhost:8080/hypercloud/reservations-location';

  constructor(private http: HttpClient) {}

  /**
   * Récupérer toutes les réservations de vol pour un client
   */
  getReservationsByClient(clientId: number): Observable<ReservationVolResponse[]> {
    return this.http.get<any[]>(`${this.baseUrl}/client/${clientId}`).pipe(
      map(reservations => reservations.map(this.mapToReservationVolResponse)),
      catchError(this.handleError)
    );
  }

  /**
   * Récupérer une réservation par son ID
   */
  getReservationById(id: number): Observable<ReservationVolResponse> {
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(
      map(this.mapToReservationVolResponse),
      catchError(this.handleError)
    );
  }

  /**
   * Créer une nouvelle réservation de vol
   */
  createReservation(reservation: any): Observable<ReservationVolResponse> {
    return this.http.post<any>(this.baseUrl, reservation).pipe(
      map(this.mapToReservationVolResponse),
      catchError(this.handleError)
    );
  }

  /**
   * Mettre à jour une réservation
   */
  updateReservation(id: number, reservation: any): Observable<ReservationVolResponse> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, reservation).pipe(
      map(this.mapToReservationVolResponse),
      catchError(this.handleError)
    );
  }

  /**
   * Annuler une réservation
   */
  annulerReservation(id: number, reason?: string): Observable<ReservationVolResponse> {
    let params = new HttpParams();
    if (reason) {
      params = params.set('reason', reason);
    }
    return this.http.put<any>(`${this.baseUrl}/${id}/annuler`, null, { params }).pipe(
      map(this.mapToReservationVolResponse),
      catchError(this.handleError)
    );
  }

  /**
   * Confirmer une réservation
   */
  confirmerReservation(id: number): Observable<ReservationVolResponse> {
    return this.http.put<any>(`${this.baseUrl}/${id}/confirmer`, null).pipe(
      map(this.mapToReservationVolResponse),
      catchError(this.handleError)
    );
  }

  /**
   * Supprimer une réservation
   */
  deleteReservation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Mapper la réponse du backend vers notre interface
   */
  private mapToReservationVolResponse = (data: any): ReservationVolResponse => {
    return {
      idReservation: data.idReservation,
      clientId: data.clientId,
      clientUsername: data.clientUsername,
      vehiculeId: data.vehiculeId,
      vehiculeMarque: data.vehiculeMarque,
      vehiculeModele: data.vehiculeModele,
      vehiculePlaque: data.vehiculePlaque,
      agenceId: data.agenceId,
      agenceNom: data.agenceNom,
      agenceAdresse: data.agenceAdresse,
      agenceTelephone: data.agenceTelephone,
      dateDebut: data.dateDebut,
      dateFin: data.dateFin,
      prixTotal: data.prixTotal,
      advanceAmount: data.advanceAmount,
      depositAmount: data.depositAmount,
      statut: data.statut,
      paymentPhase: data.paymentPhase,
      advanceStatus: data.advanceStatus,
      prenom: data.prenom,
      nom: data.nom,
      numeroPermis: data.numeroPermis,
      licenseStatus: data.licenseStatus,
      contractPdfUrl: data.contractPdfUrl,
      // Champs pour les vols (à adapter selon votre structure)
      numeroVol: data.numeroVol || `VOL-${data.idReservation}`,
      depart: data.depart || 'Départ',
      arrivee: data.arrivee || 'Arrivée',
      dateDepart: data.dateDepart || data.dateDebut,
      dateArrivee: data.dateArrivee || data.dateFin,
      heureDepart: data.heureDepart,
      heureArrivee: data.heureArrivee,
      nbPassagers: data.nbPassagers || 1,
      societeNom: data.societeNom || 'Airline'
    };
  };

  /**
   * Gérer les erreurs HTTP
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Une erreur est survenue';

    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Erreur client: ${error.error.message}`;
    } else {
      // Erreur côté serveur
      errorMessage = `Erreur serveur: ${error.status} - ${error.message}`;
      
      if (error.status === 404) {
        errorMessage = 'Réservation non trouvée';
      } else if (error.status === 403) {
        errorMessage = 'Accès non autorisé';
      } else if (error.status === 500) {
        errorMessage = 'Erreur serveur interne';
      }
    }

    console.error('ReservationVolService Error:', errorMessage, error);
    return throwError(() => errorMessage);
  }
}

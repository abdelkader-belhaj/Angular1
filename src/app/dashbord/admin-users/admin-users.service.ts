import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface AdminUserResponse {
  id: number;
  username: string;
  email: string;
  enabled: boolean;
  role: string;
  twoFactorEnabled?: boolean;
  twoFactorActivatedAt?: string;
  hasFaceId?: boolean;
  faceModelName?: string;
  faceDetectorBackend?: string;
  faceThreshold?: number;
  phone?: string;
  bio?: string;
  profileImage?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly usersApiUrl = 'http://localhost:8080/api/users';

  constructor(private readonly http: HttpClient) {}

  getAllUsers(): Observable<AdminUserResponse[]> {
    return this.http
      .get<ApiResponse<AdminUserResponse[]>>(this.usersApiUrl)
      .pipe(map((response) => response.data));
  }

  toggleUser(id: number): Observable<AdminUserResponse> {
    return this.http
      .patch<ApiResponse<AdminUserResponse>>(`${this.usersApiUrl}/${id}/toggle`, {})
      .pipe(map((response) => response.data));
  }

  changeUserRole(id: number, role: string): Observable<AdminUserResponse> {
    const params = new HttpParams().set('role', role);
    return this.http
      .patch<ApiResponse<AdminUserResponse>>(`${this.usersApiUrl}/${id}/role`, {}, { params })
      .pipe(map((response) => response.data));
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.usersApiUrl}/${id}`).pipe(map(() => void 0));
  }
}

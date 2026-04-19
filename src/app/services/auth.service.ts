import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

interface UserResponse {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface AuthResponse {
  token: string;
  type: string;
  expiresIn: number;
  user: UserResponse;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role: string;
}

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApiUrl = 'http://localhost:8080/api/auth';
  private readonly tokenStorageKey = 'auth_token';
  private readonly userStorageKey = 'auth_user';

  constructor(private readonly http: HttpClient) {}

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.authApiUrl}/login`, payload)
      .pipe(
        map((response) => response.data),
        tap((auth) => {
          localStorage.setItem(this.tokenStorageKey, auth.token);
          localStorage.setItem(this.userStorageKey, JSON.stringify(auth.user));
        })
      );
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.authApiUrl}/register`, payload)
      .pipe(
        map((response) => response.data),
        tap((auth) => {
          localStorage.setItem(this.tokenStorageKey, auth.token);
          localStorage.setItem(this.userStorageKey, JSON.stringify(auth.user));
        })
      );
  }

  forgotPassword(payload: ForgotPasswordRequest): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.authApiUrl}/forgot-password`, payload)
      .pipe(map(() => void 0));
  }

  resetPassword(payload: ResetPasswordRequest): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.authApiUrl}/reset-password`, payload)
      .pipe(map(() => void 0));
  }

  logout(): void {
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.userStorageKey);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(this.tokenStorageKey);
  }

  getCurrentUser(): UserResponse | null {
    const raw = localStorage.getItem(this.userStorageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as UserResponse;
    } catch {
      return null;
    }
  }

  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'ADMIN';
  }
}



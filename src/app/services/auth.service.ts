import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, map, tap } from 'rxjs';

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
  enabled: boolean;
  twoFactorEnabled?: boolean;
  phone?: string;
  bio?: string;
  profileImage?: string;
  hasFaceId?: boolean;
  faceModelName?: string;
  faceDetectorBackend?: string;
  faceThreshold?: number;
}

interface AuthResponse {
  token?: string | null;
  type: string;
  expiresIn?: number | null;
  user: UserResponse;
}

interface TwoFactorSetupResponse {
  issuer: string;
  accountName: string;
  secret: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
  enabled: boolean;
}

interface TwoFactorCodeRequest {
  code: string;
}

interface SessionInfoResponse {
  sessionId: string;
  userId: number;
  email: string;
  role: string;
  sessionCreatedAt: string;
  lastAccessedAt: string;
  maxInactiveIntervalSeconds: number;
}

interface LoginRequest {
  email: string;
  password: string;
}

// Ajouté: Google login
interface GoogleLoginRequest {
  idToken: string;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role: string;
}

interface FaceRegisterRequest {
  username: string;
  email: string;
  password: string;
  imageBase64: string;
  role: string;
}

interface FaceLoginRequest {
  login: string;
  imageBase64: string;
  threshold?: number;
}

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

interface UpdateCurrentUserRequest {
  username: string;
  phone?: string;
  bio?: string;
  profileImage?: string;
}

interface UpdateCurrentFaceIdRequest {
  imageBase64: string;
}

interface ChangeCurrentPasswordRequest {
  oldPassword?: string;
  newPassword: string;
  confirmPassword: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApiUrl = 'http://localhost:8080/api/auth';
  private readonly sessionApiUrl = 'http://localhost:8080/api/session';
  private readonly usersApiUrl = 'http://localhost:8080/api/users';
  private readonly tokenStorageKey = 'auth_token';
  private readonly userStorageKey = 'auth_user';

  constructor(private readonly http: HttpClient) { }

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.authApiUrl}/login`, payload)
      .pipe(
        map((response) => response.data),
        tap((auth) => this.persistAuth(auth))
      );
  }

  // Ajouté: Google login
  loginWithGoogle(payload: GoogleLoginRequest): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.authApiUrl}/login-google`, payload)
      .pipe(
        map((response) => response.data),
        tap((auth) => this.persistAuth(auth))
      );
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.authApiUrl}/register`, payload)
      .pipe(
        map((response) => response.data),
        tap((auth) => this.persistAuth(auth))
      );
  }

  registerWithFace(payload: FaceRegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.authApiUrl}/register-face`, payload)
      .pipe(
        map((response) => response.data),
        tap((auth) => this.persistAuth(auth))
      );
  }

  loginWithFace(payload: FaceLoginRequest): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.authApiUrl}/login-face`, payload)
      .pipe(
        map((response) => response.data),
        tap((auth) => this.persistAuth(auth))
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

  updateCurrentUserProfile(payload: UpdateCurrentUserRequest): Observable<UserResponse> {
    const currentUser = this.getCurrentUser();
    if (!currentUser?.id) {
      throw new Error('Utilisateur non connecte');
    }
    return this.http
      .put<ApiResponse<UserResponse>>(`${this.usersApiUrl}/${currentUser.id}`, payload)
      .pipe(
        map((response) => response.data),
        tap((updatedUser) => {
          localStorage.setItem(this.userStorageKey, JSON.stringify(updatedUser));
        })
      );
  }

  updateCurrentUserFaceId(payload: UpdateCurrentFaceIdRequest): Observable<UserResponse> {
    const currentUser = this.getCurrentUser();
    if (!currentUser?.id) {
      throw new Error('Utilisateur non connecte');
    }
    return this.http
      .patch<ApiResponse<UserResponse>>(`${this.usersApiUrl}/${currentUser.id}/face-id`, payload)
      .pipe(
        map((response) => response.data),
        tap((updatedUser) => {
          localStorage.setItem(this.userStorageKey, JSON.stringify(updatedUser));
        })
      );
  }

  changeCurrentUserPassword(payload: ChangeCurrentPasswordRequest): Observable<void> {
    const currentUser = this.getCurrentUser();
    if (!currentUser?.id) {
      throw new Error('Utilisateur non connecte');
    }
    return this.http
      .patch<ApiResponse<null>>(`${this.usersApiUrl}/${currentUser.id}/password`, payload)
      .pipe(map(() => void 0));
  }

  getSessionInfo(): Observable<SessionInfoResponse> {
    return this.http
      .get<ApiResponse<SessionInfoResponse>>(`${this.sessionApiUrl}/me`)
      .pipe(map((response) => response.data));
  }

  logout(): Observable<void> {
    return this.http.post<ApiResponse<null>>(`${this.authApiUrl}/logout`, {}).pipe(
      tap(() => {
        localStorage.removeItem(this.tokenStorageKey);
        localStorage.removeItem(this.userStorageKey);
      }),
      finalize(() => {
        localStorage.removeItem(this.tokenStorageKey);
        localStorage.removeItem(this.userStorageKey);
      }),
      map(() => void 0)
    );
  }

  clearLocalAuth(): void {
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.userStorageKey);
  }

  setupTwoFactor(): Observable<TwoFactorSetupResponse> {
    return this.http
      .post<ApiResponse<TwoFactorSetupResponse>>(`${this.authApiUrl}/2fa/setup`, {})
      .pipe(map((response) => response.data));
  }

  verifyTwoFactor(payload: TwoFactorCodeRequest): Observable<UserResponse> {
    return this.http
      .post<ApiResponse<UserResponse>>(`${this.authApiUrl}/2fa/verify`, payload)
      .pipe(
        map((response) => response.data),
        tap((updatedUser) => {
          localStorage.setItem(this.userStorageKey, JSON.stringify(updatedUser));
        })
      );
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(this.tokenStorageKey);
  }

  // Ajouté: getToken
  getToken(): string | null {
    return localStorage.getItem(this.tokenStorageKey);
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

  // Ajouté: isOrganisateur et isClient
  isOrganisateur(): boolean {
    return this.getCurrentUser()?.role === 'ORGANISATEUR';
  }

  isClient(): boolean {
    return this.getCurrentUser()?.role === 'CLIENT_TOURISTE';
  }

  isPendingApproval(user?: UserResponse | null): boolean {
    if (!user?.role) {
      return false;
    }
    return user.role !== 'CLIENT_TOURISTE' && user.enabled === false;
  }

  getRouteForRole(role?: string | null): string {
    switch (role) {
      case 'ADMIN':
        return '/dashbord';
      case 'CLIENT_TOURISTE':
        return '/homePage';
      case 'HEBERGEUR':
        return '/hebergeur';
      case 'TRANSPORTEUR':
        return '/transport';
      case 'AIRLINE_PARTNER':
        return '/airline-partner';
      case 'ORGANISATEUR':
        return '/organisateur';
      case 'VENDEUR_ARTI':
        return '/artisan';
      case 'SOCIETE':
        return '/societe';
      default: return '/';
    }
  }

  private persistAuth(auth: AuthResponse): void {
    if (!auth?.user) { this.clearLocalAuth(); return; }
    if (this.isPendingApproval(auth.user)) { this.clearLocalAuth(); return; }
    if (!auth.token) { this.clearLocalAuth(); return; }
    localStorage.setItem(this.tokenStorageKey, auth.token);
    localStorage.setItem(this.userStorageKey, JSON.stringify(auth.user));
  }
}
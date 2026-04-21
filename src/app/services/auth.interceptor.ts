import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const isBackendApi = request.url.startsWith(environment.apiBaseUrl);
    const isPublicApi = /\/public(\?|$)/.test(request.url);
    const isCategoriesReadApi = request.method === 'GET' && /\/api\/categories(\?|$)/.test(request.url);
    const token = localStorage.getItem('auth_token');

    if (!isBackendApi) {
      // Do not force credentials for third-party APIs (prevents CORS preflight failures).
      return next.handle(request);
    }

    if (isPublicApi || isCategoriesReadApi) {
      // Public endpoints should not receive Authorization to avoid backend auth middleware conflicts.
      return next.handle(request);
    }

    if (!token) {
      // Keep public backend calls untouched when user is not authenticated.
      return next.handle(request);
    }

    return next.handle(
      request.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      })
    );
  }
}
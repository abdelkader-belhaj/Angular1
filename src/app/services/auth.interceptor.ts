import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    const token = localStorage.getItem('auth_token');

    // External services (ex: OpenStreetMap/Nominatim) must not receive
    // app credentials or auth headers, otherwise browser CORS checks fail.
    if (this.isExternalRequest(request.url)) {
      return next.handle(request);
    }

    const clonedRequest = request.clone({
      withCredentials: true,
      setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    });

    return next.handle(clonedRequest);
  }

  private isExternalRequest(url: string): boolean {
    if (!/^https?:\/\//i.test(url)) {
      return false;
    }

    if (typeof window === 'undefined' || !window.location?.origin) {
      return false;
    }

    try {
      return new URL(url).origin !== window.location.origin;
    } catch {
      return false;
    }
  }
}

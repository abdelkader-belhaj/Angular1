import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly externalUrls = [
    'nominatim.openstreetmap.org',
    'openstreetmap.org'
  ];

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = localStorage.getItem('auth_token');
    const isExternalUrl = this.externalUrls.some(url => request.url.includes(url));

    const clonedRequest = request.clone({
      withCredentials: !isExternalUrl,
      setHeaders: token ? { Authorization: `Bearer ${token}` } : {}
    });

    return next.handle(clonedRequest);
  }
}
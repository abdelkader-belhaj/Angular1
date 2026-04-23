import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'notStandaLone01';

  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    const currentUrl = this.router.url;
    const currentRole = this.authService.getCurrentUser()?.role;

    if ((currentUrl === '/' || currentUrl === '') && currentRole) {
      void this.router.navigateByUrl(
        this.authService.getRouteForRole(currentRole)
      );
    }
  }

  isAdminRoute(): boolean {
    return (
      this.router.url.startsWith('/dashbord') ||
      this.router.url.startsWith('/dashboard')
    );
  }
}
import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-dashbord-page',
  templateUrl: './dashbord-page.component.html',
  styleUrls: ['./dashbord-page.component.css']
})
export class DashbordPageComponent implements OnInit {

  isChildRoute = false;
  isCategoriePage = false;
  isFooterHidden = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.checkRoute(this.router.url);

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.checkRoute(event.urlAfterRedirects);
    });
  }

  checkRoute(url: string): void {
    this.isChildRoute = url !== '/dashbord' && url !== '/dashboard';
    this.isCategoriePage = url.includes('/categorie');
    this.isFooterHidden =
      url.includes('/categorie') ||
      url.includes('/logements') ||
      url.includes('/reservations') ||
      url.includes('/notifications') ||
      url.includes('/reclamations');
  }
}
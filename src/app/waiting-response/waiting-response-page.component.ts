import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-waiting-response-page',
  templateUrl: './waiting-response-page.component.html',
  styleUrls: ['./waiting-response-page.component.css']
})
export class WaitingResponsePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  role = '';
  email = '';

  ngOnInit(): void {
    this.role = this.route.snapshot.queryParamMap.get('role') ?? '';
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
  }

  goHome(): void {
    void this.router.navigateByUrl('/');
  }
}

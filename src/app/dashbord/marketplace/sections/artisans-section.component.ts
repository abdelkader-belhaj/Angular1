import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface Artisan {
  id: number;
  username: string;
  email: string;
  phone?: string;
  bio?: string;
  profileImage?: string;
  createdAt: string;
  productsCount?: number;
}

@Component({
  selector: 'app-artisans-section',
  templateUrl: './artisans-section.component.html',
  styleUrl: './artisans-section.component.css'
})
export class ArtisansSectionComponent implements OnInit {
  artisans: Artisan[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadArtisans();
  }

  loadArtisans() {
    this.isLoading = true;
    // Get all users with VENDEUR_ARTI role
    this.http.get<any>('http://localhost:8080/api/users/role/VENDEUR_ARTI').subscribe(
      (data) => {
        this.artisans = Array.isArray(data) ? data : data.data || [];
        this.isLoading = false;
      },
      (error) => {
        this.error = 'Failed to load artisans';
        console.error(error);
        this.isLoading = false;
      }
    );
  }
}

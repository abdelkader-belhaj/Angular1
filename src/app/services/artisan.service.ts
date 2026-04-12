import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

export interface Artisan {
  id: number;
  name: string;
  email: string;
  businessName: string;
  description: string;
  avatar?: string;
  totalProductsSold: number;
  totalRevenue: number;
  commissionPaid: number;
  status: 'active' | 'suspended' | 'pending';
  joinDate: Date;
  rating?: number;
  productsCount?: number;
}

export interface ArtisanProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  categoryId: number;
  subcategoryId?: number;
  category?: string;
  image: string;
  stockQuantity: number;
  salesCount: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt?: Date;
}

export interface ArtisanSale {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  buyerName: string;
  orderId: number;
  saleDate: Date;
  status: 'completed' | 'pending' | 'cancelled';
}

@Injectable({
  providedIn: 'root'
})
export class ArtisanService {
  private apiUrl = 'http://localhost:8080/api/ecommerce/artisan';
  private currentArtisan$ = new BehaviorSubject<Artisan | null>(null);

  constructor(private http: HttpClient) {}

  // Artisan Dashboard
  getCurrentArtisan(): Observable<Artisan> {
    return this.http.get<Artisan>(`${this.apiUrl}/profile`);
  }

  // Products Management
  getArtisanProducts(): Observable<ArtisanProduct[]> {
    return this.http.get<ArtisanProduct[]>(`${this.apiUrl}/products`);
  }

  getProductById(productId: number): Observable<ArtisanProduct> {
    return this.http.get<ArtisanProduct>(`${this.apiUrl}/products/${productId}`);
  }

  createProduct(product: Partial<ArtisanProduct>): Observable<ArtisanProduct> {
    return this.http.post<ArtisanProduct>(`${this.apiUrl}/products`, product);
  }

  updateProduct(productId: number, product: Partial<ArtisanProduct>): Observable<ArtisanProduct> {
    return this.http.put<ArtisanProduct>(`${this.apiUrl}/products/${productId}`, product);
  }

  deleteProduct(productId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/products/${productId}`);
  }

  // Sales & Orders
  getArtisanSales(filters?: any): Observable<ArtisanSale[]> {
    let url = `${this.apiUrl}/sales`;
    if (filters) {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
      });
      url += '?' + params.toString();
    }
    return this.http.get<ArtisanSale[]>(url);
  }

  getSalesStats(): Observable<{
    totalSales: number;
    totalRevenue: number;
    commissionEarned: number;
    productsSold: number;
    thisMonthRevenue: number;
    thisMonthSales: number;
  }> {
    return this.http.get<any>(`${this.apiUrl}/sales/stats`);
  }

  // Admin endpoints
  getAllArtisans(): Observable<Artisan[]> {
    return this.http.get<Artisan[]>(`http://localhost:8080/api/ecommerce/admin/artisans`);
  }

  getArtisanDetails(artisanId: number): Observable<{
    artisan: Artisan;
    products: ArtisanProduct[];
    sales: ArtisanSale[];
    stats: any;
  }> {
    return this.http.get<any>(`http://localhost:8080/api/ecommerce/admin/artisans/${artisanId}`);
  }

  suspendArtisan(artisanId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`http://localhost:8080/api/ecommerce/admin/artisans/${artisanId}/suspend`, {});
  }

  activateArtisan(artisanId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`http://localhost:8080/api/ecommerce/admin/artisans/${artisanId}/activate`, {});
  }
}

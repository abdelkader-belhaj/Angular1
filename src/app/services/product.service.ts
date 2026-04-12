import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface Product {
  id: number;
  userId: number;
  categoryId: number;
  category?: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPrice: number | null;
  discount?: number;
  stockQuantity: number;
  stock?: number;
  image: string;
  salesCount: number;
}

export interface ProductCategory {
  id: number;
  parentId: number | null;
  children: ProductCategory[];
  name: string;
  description: string;
  image: string;
  displayOrder: number;
}

export interface ArtisanStats {
  totalSales: number;
  totalRevenue: number;
  productCount: number;
  averageRating: number;
}

export interface AvailabilityInfo {
  productId: number;
  requestedQuantity: number;
  availableQuantity: number;
  isAvailable: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly apiUrl = 'http://localhost:8080/api/ecommerce';

  constructor(private readonly http: HttpClient) {}

  // ========== PRODUCT OPERATIONS ==========

  getAllProducts(): Observable<Product[]> {
    return this.http
      .get<any>(`${this.apiUrl}/products`)
      .pipe(
        map((response) => {
          console.log('API Response:', response);
          // Handle both response.data and direct array
          const products = response?.data || response || [];
          console.log('Extracted products:', products);
          return Array.isArray(products) ? products : [];
        })
      );
  }

  getProductById(id: number): Observable<Product> {
    return this.http
      .get<ApiResponse<Product>>(`${this.apiUrl}/products/${id}`)
      .pipe(map((response) => response.data));
  }

  searchProducts(query: string): Observable<Product[]> {
    return this.http
      .get<ApiResponse<Product[]>>(`${this.apiUrl}/products/search`, {
        params: { q: query }
      })
      .pipe(map((response) => response.data));
  }

  getProductsByCategory(categoryId: number): Observable<Product[]> {
    return this.http
      .get<ApiResponse<Product[]>>(`${this.apiUrl}/products/category/${categoryId}`)
      .pipe(map((response) => response.data));
  }

  getBestSellers(limit: number = 10): Observable<Product[]> {
    return this.http
      .get<ApiResponse<Product[]>>(`${this.apiUrl}/products/bestsellers`, {
        params: { limit: limit.toString() }
      })
      .pipe(map((response) => response.data));
  }

  getProductsByArtisan(userId: number): Observable<Product[]> {
    return this.http
      .get<ApiResponse<Product[]>>(`${this.apiUrl}/products/artisan/${userId}`)
      .pipe(map((response) => response.data));
  }

  // ========== STOCK & AVAILABILITY ==========

  checkAvailability(productId: number, quantity: number): Observable<AvailabilityInfo> {
    return this.http
      .get<ApiResponse<AvailabilityInfo>>(`${this.apiUrl}/products/${productId}/available`, {
        params: { quantity: quantity.toString() }
      })
      .pipe(map((response) => response.data));
  }

  // ========== CATEGORY OPERATIONS ==========

  getAllCategories(): Observable<ProductCategory[]> {
    return this.http
      .get<ApiResponse<ProductCategory[]>>(`${this.apiUrl}/categories`)
      .pipe(map((response) => response.data));
  }

  getCategoryById(id: number): Observable<ProductCategory> {
    return this.http
      .get<ApiResponse<ProductCategory>>(`${this.apiUrl}/categories/${id}`)
      .pipe(map((response) => response.data));
  }

  getChildCategories(parentId: number): Observable<ProductCategory[]> {
    return this.http
      .get<ApiResponse<ProductCategory[]>>(`${this.apiUrl}/categories/${parentId}/children`)
      .pipe(map((response) => response.data));
  }

  // ========== ARTISAN STATS ==========

  getArtisanStats(userId: number): Observable<ArtisanStats> {
    return this.http
      .get<ApiResponse<ArtisanStats>>(`${this.apiUrl}/products/artisan/${userId}/stats`)
      .pipe(map((response) => response.data));
  }

  // ========== IMAGE UPLOAD ==========

  uploadProductImage(productId: number, file: File, replaceExisting: boolean = true): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    const params = new HttpParams().set('replaceExisting', replaceExisting.toString());
    const url = `${this.apiUrl}/products/${productId}/upload-image`;
    
    return this.http.post<any>(url, formData, { params });
  }

  deleteProductImage(productId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/products/${productId}/delete-image`);
  }
}

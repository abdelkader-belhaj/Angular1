import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  stockQuantity: number;
  image?: string;
  artisanId: number;
  artisanName?: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
}

@Component({
  selector: 'app-products-section',
  templateUrl: './products-section.component.html',
  styleUrl: './products-section.component.css'
})
export class ProductsSectionComponent implements OnInit {
  products: Product[] = [];
  paginatedProducts: Product[] = [];
  isLoading = true;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 9;
  totalPages = 1;
  Math = Math;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.isLoading = true;
    this.http.get<any>('http://localhost:8080/api/products').subscribe(
      (data) => {
        this.products = Array.isArray(data) ? data : data.data || [];
        // Transform image URLs to use backend server
        this.products = this.products.map(p => ({
          ...p,
          image: p.image ? this.getImageUrl(p.image) : p.image
        }));
        this.updatePagination();
        this.isLoading = false;
      },
      (error) => {
        this.error = 'Failed to load products';
        console.error(error);
        this.isLoading = false;
      }
    );
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.products.length / this.pageSize);
    if (this.totalPages === 0) this.totalPages = 1;
    if (this.currentPage > this.totalPages) this.currentPage = 1;
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedProducts = this.products.slice(start, start + this.pageSize);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  nextPage(): void { this.goToPage(this.currentPage + 1); }
  previousPage(): void { this.goToPage(this.currentPage - 1); }

  get pages(): number[] {
    const range: number[] = [];
    const delta = 2;
    const left = Math.max(1, this.currentPage - delta);
    const right = Math.min(this.totalPages, this.currentPage + delta);
    for (let i = left; i <= right; i++) range.push(i);
    return range;
  }

  getImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;
    const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `http://localhost:8080${path}`;
  }

  calculateDiscountPercentage(originalPrice: number | null | undefined, discountPrice: number | null | undefined): number {
    if (!discountPrice || !originalPrice || discountPrice >= originalPrice) {
      return 0;
    }
    return Math.round(((originalPrice - discountPrice) / originalPrice) * 100);
  }

  toggleProductStatus(product: Product) {
    const newStatus = product.status === 'active' ? 'inactive' : 'active';
    const confirmMessage = product.status === 'active'
      ? `Êtes-vous sûr de vouloir désactiver le produit "${product.name}"?\nL'artisan recevra une notification par email.`
      : `Êtes-vous sûr de vouloir activer le produit "${product.name}"?\nL'artisan recevra une notification par email.`;

    if (confirm(confirmMessage)) {
      const payload = { status: newStatus };
      this.http.patch<any>(`http://localhost:8080/api/products/${product.id}/status`, payload).subscribe(
        (response) => {
          const updated = response.data || response;
          const index = this.products.findIndex(p => p.id === product.id);
          if (index > -1) {
            this.products[index] = { ...this.products[index], status: updated.status ?? newStatus };
            this.updatePagination();
          }
          const actionText = newStatus === 'active' ? 'activé' : 'désactivé';
          alert(`Produit ${actionText} avec succès ! ${newStatus === 'inactive' ? "L'artisan a été notifié par email." : ''}`);
        },
        (error) => {
          console.error('Error toggling product status:', error);
          alert('Erreur lors du changement de statut du produit');
        }
      );
    }
  }
}


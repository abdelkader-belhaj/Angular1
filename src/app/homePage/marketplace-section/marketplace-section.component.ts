import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ProductService, Product } from '../../services/product.service';

@Component({
  selector: 'app-marketplace-section',
  templateUrl: './marketplace-section.component.html',
  styleUrl: './marketplace-section.component.css',
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class MarketplaceSectionComponent implements OnInit {
  products: Product[] = [];
  isLoading = true;

  constructor(private productService: ProductService, private router: Router) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.productService.getAllProducts().subscribe(
      (response: any) => {
        console.log('API Response:', response);
        
        // API returns array directly
        if (Array.isArray(response)) {
          this.products = response.slice(0, 4);
          console.log('Products loaded:', this.products);
        } else if (response?.success && response?.data && Array.isArray(response.data)) {
          this.products = response.data.slice(0, 4);
          console.log('Products loaded:', this.products);
        }
        
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading products:', error);
        this.isLoading = false;
      }
    );
  }

  getProductImage(product: Product): string {
    // Image path from API is already "uploads/products/id/filename"
    if (product.image) {
      if (product.image.startsWith('http')) {
        return product.image;
      }
      return `http://localhost:8080/${product.image}`;
    }
    return '';
  }

  goToProductDetail(productId: number): void {
    this.router.navigate(['/products']);
  }
}

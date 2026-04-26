import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService, Product } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule],  // ✅ add FormsModule here
  templateUrl: './product-catalog.component.html',
})
export class ProductCatalogComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchQuery: string = '';
  selectedCategory: number | null = null;
  sortBy: 'name' | 'price' | 'popularity' = 'name';
  isLoading = false;
  error: string | null = null;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check for initial filter from route params
    this.route.queryParams.subscribe((params) => {
      if (params['category']) {
        this.selectedCategory = parseInt(params['category'], 10);
      }
      if (params['search']) {
        this.searchQuery = params['search'];
      }
      this.loadProducts();
    });
  }

  loadProducts(): void {
    this.isLoading = true;
    this.error = null;

    if (this.searchQuery.trim()) {
      this.productService.searchProducts(this.searchQuery).subscribe({
        next: (products) => {
          this.products = products;
          this.applyFiltersAndSort();
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to load products';
          console.error(err);
          this.isLoading = false;
        }
      });
    } else if (this.selectedCategory) {
      this.productService.getProductsByCategory(this.selectedCategory).subscribe({
        next: (products) => {
          this.products = products;
          this.applyFiltersAndSort();
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to load products';
          console.error(err);
          this.isLoading = false;
        }
      });
    } else {
      this.productService.getAllProducts().subscribe({
        next: (products) => {
          this.products = products;
          this.applyFiltersAndSort();
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to load products';
          console.error(err);
          this.isLoading = false;
        }
      });
    }
  }

  onSearch(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.searchQuery.trim()
        ? { search: this.searchQuery }
        : {},
      queryParamsHandling: 'merge'
    });
  }

  onCategoryChange(categoryId: number): void {
    this.selectedCategory = categoryId === 0 ? null : categoryId;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.selectedCategory ? { category: this.selectedCategory } : {},
      queryParamsHandling: 'merge'
    });
  }

  onSortChange(): void {
    this.applyFiltersAndSort();
  }

  private applyFiltersAndSort(): void {
    this.filteredProducts = [...this.products];

    // Apply sorting
    switch (this.sortBy) {
      case 'price':
        this.filteredProducts.sort(
          (a, b) => (a.discountPrice ?? a.price) - (b.discountPrice ?? b.price)
        );
        break;
      case 'popularity':
        this.filteredProducts.sort((a, b) => b.salesCount - a.salesCount);
        break;
      case 'name':
      default:
        this.filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  getDisplayPrice(product: Product): number {
    return product.discountPrice ?? product.price;
  }

  getDiscount(product: Product): number | null {
    if (!product.discountPrice) return null;
    return Math.round(((product.price - product.discountPrice) / product.price) * 100);
  }

  addToCart(product: Product): void {
    this.cartService.addToCart(product, 1);
    alert(`${product.name} added to cart!`);
  }

  viewProduct(product: Product): void {
    this.router.navigate(['/product', product.id]);
  }

  isInCart(product: Product): boolean {
    return this.cartService.isInCart(product.id);
  }

  getCartQuantity(product: Product): number {
    return this.cartService.getQuantityInCart(product.id);
  }
}

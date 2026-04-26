import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService, Product } from '../../../services/product.service';
import { CartService } from '../../../services/cart.service';

@Component({
  selector: 'app-products-page',
  templateUrl: './products-page.component.html',
  styleUrls: ['./products-page.component.css']
})
export class ProductsPageComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  paginatedProducts: Product[] = [];
  cartItemCount: number = 0;

  // Pagination
  currentPage = 1;
  pageSize = 9;
  totalPages = 1;
  Math = Math;

  // Filters
  searchQuery: string = '';
  selectedCategory: string = '';
  sortBy: string = 'newest'; // newest, price-low, price-high, popular
  priceRange = { min: 0, max: 1000 };
  inStockOnly = false;
  onPromoOnly = false;

  // Favorites
  favorites: Set<number> = new Set();

  // Modal
  showModal = false;
  selectedProduct: Product | null = null;

  // State
  isLoading = false;
  error: string | null = null;

  categories: { id: number; name: string }[] = [];
  selectedCategoryId: number | null = null;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.products = [];
    this.filteredProducts = [];
    this.loadProducts();
    this.loadCategories();
    this.subscribeToCartChanges();
  }

  subscribeToCartChanges(): void {
    this.cartService.getCartItems().subscribe((items) => {
      this.cartItemCount = items.length;
    });
  }

  loadProducts(): void {
    this.isLoading = true;
    this.error = null;

    this.productService.getAllProducts().subscribe({
      next: (products) => {
        this.products = Array.isArray(products) ? products : [];
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.error = 'Erreur lors du chargement des produits';
        this.products = [];
        this.filteredProducts = [];
        this.isLoading = false;
      }
    });
  }

  loadCategories(): void {
    this.productService.getAllCategories().subscribe({
      next: (categories) => {
        this.categories = categories.map(c => ({ id: c.id, name: c.name }));
        console.log('Categories loaded:', this.categories);
      },
      error: (err) => {
        console.error('Error loading categories:', err);
      }
    });
  }

  applyFilters(): void {
    if (!Array.isArray(this.products)) {
      this.filteredProducts = [];
      return;
    }

    let filtered = [...this.products];

    // Search
    if (this.searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }

    // Category
    if (this.selectedCategoryId) {
      console.log('Filtering by categoryId:', this.selectedCategoryId);
      console.log('All product categoryIds:', filtered.map(p => p.categoryId));
      console.log('All categories:', this.categories);
      filtered = filtered.filter(p => p.categoryId === this.selectedCategoryId);
      console.log('Products after category filter:', filtered.length);
    }

    // Price range
    filtered = filtered.filter(p => {
      const displayPrice = p.discountPrice || p.price;
      return displayPrice >= this.priceRange.min && displayPrice <= this.priceRange.max;
    });

    // Stock
    if (this.inStockOnly) {
      filtered = filtered.filter(p => (p.stock || p.stockQuantity || 0) > 0);
    }

    // Promo only
    if (this.onPromoOnly) {
      filtered = filtered.filter(p => p.discountPrice && p.discountPrice < p.price);
    }

    // Sort
    filtered = this.sortProducts(filtered);

    this.filteredProducts = filtered;
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredProducts.length / this.pageSize);
    if (this.totalPages === 0) this.totalPages = 1;
    if (this.currentPage > this.totalPages) this.currentPage = 1;
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedProducts = this.filteredProducts.slice(start, start + this.pageSize);
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

  sortProducts(products: Product[]): Product[] {
    const sorted = [...products];
    switch (this.sortBy) {
      case 'price-low':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'popular':
        sorted.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
        break;
      case 'newest':
      default:
        break;
    }
    return sorted;
  }

  onSearch(): void {
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedCategoryId = null;
    this.sortBy = 'newest';
    this.priceRange = { min: 0, max: 1000 };
    this.inStockOnly = false;
    this.onPromoOnly = false;
    this.applyFilters();
  }

  addToCart(product: Product): void {
    this.cartService.addToCart(product, 1);
  }

  viewProduct(product: Product): void {
  this.selectedProduct = { ...product };
  
  // ✅ Resolve category name from already-loaded categories
  const category = this.categories.find(c => c.id === product.categoryId);
  if (category && this.selectedProduct) {
    this.selectedProduct.category = category.name;
  }
  
  this.showModal = true;
  document.body.style.overflow = 'hidden';
}

  closeModal(): void {
    this.showModal = false;
    this.selectedProduct = null;
    document.body.style.overflow = 'auto';
  }

  addToCartFromModal(quantity: number = 1): void {
    if (this.selectedProduct) {
      this.cartService.addToCart(this.selectedProduct, quantity);
      this.closeModal();
    }
  }

  getRemainingStock(product: Product): number {
    const cartItems = this.cartService.getCurrentCartItems();
    const cartItem = cartItems.find(item => item.product.id === product.id);
    const totalStock = product.stock || product.stockQuantity || 0;
    const inCartQuantity = cartItem ? cartItem.quantity : 0;
    return totalStock - inCartQuantity;
  }

  canAddToCart(product: Product): boolean {
    return this.getRemainingStock(product) > 0;
  }

  getImageUrl(image: string): string {
    if (!image) {
      return '';
    }
    if (image.startsWith('http')) {
      return image;
    }
    // Image path already contains 'uploads/', so just prepend the base URL
    const url = `http://localhost:8080/${image}`;
    return url;
  }

  calculateDiscountPercentage(originalPrice: number | null | undefined, discountPrice: number | null | undefined): number {
    if (!discountPrice || !originalPrice || discountPrice >= originalPrice) {
      return 0;
    }
    return Math.round(((originalPrice - discountPrice) / originalPrice) * 100);
  }

  goToCart(): void {
    this.router.navigate(['/cart']);
  }

  goToOrders(): void {
    this.router.navigate(['/my-orders']);
  }
}

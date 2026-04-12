import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService, Product } from '../../services/product.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent implements OnInit {
  product: Product | null = null;
  quantity: number = 1;
  isLoading = false;
  error: string | null = null;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const productId = parseInt(params['id'], 10);
      this.loadProduct(productId);
    });
  }

  loadProduct(id: number): void {
    this.isLoading = true;
    this.error = null;

    this.productService.getProductById(id).subscribe({
      next: (product) => {
        this.product = product;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load product details';
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  addToCart(): void {
    if (this.product && this.quantity > 0) {
      this.cartService.addToCart(this.product, this.quantity);
      alert(`${this.quantity} x ${this.product.name} added to cart!`);
      this.quantity = 1;
    }
  }

  updateQuantity(delta: number): void {
    const newQuantity = this.quantity + delta;
    if (newQuantity > 0 && this.product && newQuantity <= this.product.stockQuantity) {
      this.quantity = newQuantity;
    }
  }

  isInCart(): boolean {
    return this.product ? this.cartService.isInCart(this.product.id) : false;
  }

  getDisplayPrice(): number {
    if (!this.product) return 0;
    return this.product.discountPrice ?? this.product.price;
  }

  getDiscount(): number | null {
    if (!this.product || !this.product.discountPrice) return null;
    return Math.round(((this.product.price - this.product.discountPrice) / this.product.price) * 100);
  }

  getTotalPrice(): number {
    return this.getDisplayPrice() * this.quantity;
  }

  backToCatalog(): void {
    this.router.navigate(['/products']);
  }
}

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CartService, CartItem } from '../../../services/cart.service';

@Component({
  selector: 'app-cart-page',
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.css']
})
export class CartPageComponent implements OnInit {
  cartItems: CartItem[] = [];
  
  cartSubtotal = 0;
  cartTotal = 0;
  promoCode = '';
  promoDiscount = 0;
  shippingCost = 10; // 10 TND fixed shipping

  isLoading = false;

  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCartItems();
  }

  loadCartItems(): void {
    this.cartService.getCartItems().subscribe((items) => {
      this.cartItems = items;
      this.calculateTotals();
    });
  }

  calculateTotals(): void {
    this.cartSubtotal = this.cartItems.reduce((total, item) => {
      const price = item.product.discountPrice || item.product.price;
      return total + (price * item.quantity);
    }, 0);
    this.cartTotal = this.cartSubtotal + this.shippingCost - this.promoDiscount;
  }

  getImageUrl(image: string): string {
    if (!image) {
      return '';
    }
    if (image.startsWith('http')) {
      return image;
    }
    return `http://localhost:8080/${image}`;
  }

  updateQuantity(product: any, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(product.id);
    } else {
      this.cartService.updateQuantity(product.id, quantity);
      this.calculateTotals();
    }
  }

  removeItem(productId: number): void {
    this.cartService.removeFromCart(productId);
    this.calculateTotals();
  }

  clearCart(): void {
    if (confirm('Êtes-vous sûr de vouloir vider votre panier?')) {
      this.cartService.clearCart();
      this.calculateTotals();
    }
  }

  applyPromoCode(): void {
    if (this.promoCode.trim()) {
      // Simulate promo code validation
      if (this.promoCode === 'SAVE10') {
        this.promoDiscount = this.cartSubtotal * 0.1;
      } else if (this.promoCode === 'SAVE20') {
        this.promoDiscount = this.cartSubtotal * 0.2;
      } else {
        this.promoDiscount = 0;
        alert('Code promo invalide');
      }
      this.calculateTotals();
    }
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }

  canDecrease(quantity: number): boolean {
    return quantity > 1;
  }

  canIncrease(item: CartItem): boolean {
    const availableStock = item.product.stockQuantity || 0;
    return item.quantity < availableStock;
  }

  checkout(): void {
    this.router.navigate(['/checkout']);
  }
}

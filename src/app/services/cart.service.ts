import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product } from './product.service';

export interface CartItem {
  product: Product;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly storageKey = 'shopping_cart';
  private cartItems$ = new BehaviorSubject<CartItem[]>(this.loadCartFromStorage());

  constructor() {}

  // ========== CART OPERATIONS ==========

  /**
   * Get all cart items as Observable
   */
  getCartItems(): Observable<CartItem[]> {
    return this.cartItems$.asObservable();
  }

  /**
   * Get current cart items (synchronous)
   */
  getCurrentCartItems(): CartItem[] {
    return this.cartItems$.value;
  }

  /**
   * Add product to cart
   */
  addToCart(product: Product, quantity: number = 1): void {
    const currentItems = this.cartItems$.value;
    const existingItem = currentItems.find((item) => item.product.id === product.id);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      currentItems.push({ product, quantity });
    }

    this.updateCart(currentItems);
  }

  /**
   * Remove product from cart
   */
  removeFromCart(productId: number): void {
    const currentItems = this.cartItems$.value.filter((item) => item.product.id !== productId);
    this.updateCart(currentItems);
  }

  /**
   * Update product quantity
   */
  updateQuantity(productId: number, quantity: number): void {
    const currentItems = this.cartItems$.value;
    const item = currentItems.find((i) => i.product.id === productId);

    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else {
        item.quantity = quantity;
        this.updateCart(currentItems);
      }
    }
  }

  /**
   * Clear entire cart
   */
  clearCart(): void {
    this.updateCart([]);
  }

  /**
   * Get cart count
   */
  getCartCount(): number {
    return this.cartItems$.value.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Get cart total price
   */
  getCartTotal(): number {
    return this.cartItems$.value.reduce((sum, item) => {
      const price = item.product.discountPrice ?? item.product.price;
      return sum + price * item.quantity;
    }, 0);
  }

  /**
   * Get cart subtotal (before discount)
   */
  getCartSubtotal(): number {
    return this.cartItems$.value.reduce((sum, item) => {
      return sum + item.product.price * item.quantity;
    }, 0);
  }

  /**
   * Get total discount
   */
  getTotalDiscount(): number {
    return this.getCartSubtotal() - this.getCartTotal();
  }

  /**
   * Check if product is in cart
   */
  isInCart(productId: number): boolean {
    return this.cartItems$.value.some((item) => item.product.id === productId);
  }

  /**
   * Get quantity of product in cart
   */
  getQuantityInCart(productId: number): number {
    const item = this.cartItems$.value.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  }

  // ========== PRIVATE METHODS ==========

  private updateCart(items: CartItem[]): void {
    this.cartItems$.next(items);
    this.saveCartToStorage(items);
  }

  private loadCartFromStorage(): CartItem[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveCartToStorage(items: CartItem[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch {
      console.error('Failed to save cart to storage');
    }
  }
}

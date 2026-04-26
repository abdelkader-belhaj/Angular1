import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CartService, CartItem } from '../../services/cart.service';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent implements OnInit {
  cartItems: CartItem[] = [];

  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cartService.getCartItems().subscribe((items) => {
      this.cartItems = items;
    });
  }

  updateQuantity(productId: number, newQuantity: number): void {
    if (newQuantity <= 0) {
      this.removeFromCart(productId);
    } else {
      this.cartService.updateQuantity(productId, newQuantity);
    }
  }

  removeFromCart(productId: number): void {
    this.cartService.removeFromCart(productId);
  }

  clearCart(): void {
    if (confirm('Are you sure you want to clear your cart?')) {
      this.cartService.clearCart();
    }
  }

  getCartSubtotal(): number {
    return this.cartService.getCartSubtotal();
  }

  getCartTotal(): number {
    return this.cartService.getCartTotal();
  }

  getTotalDiscount(): number {
    return this.cartService.getTotalDiscount();
  }

  getDisplayPrice(item: CartItem): number {
    return item.product.discountPrice ?? item.product.price;
  }

  getItemTotal(item: CartItem): number {
    return this.getDisplayPrice(item) * item.quantity;
  }

  getItemDiscount(item: CartItem): number | null {
    if (!item.product.discountPrice) return null;
    return item.product.price - item.product.discountPrice;
  }

  proceedToCheckout(): void {
    this.router.navigate(['/checkout']);
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
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
}

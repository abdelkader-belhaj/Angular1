import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CartService, CartItem } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit {
  checkoutForm!: FormGroup;
  cartTotal: number = 0;
  cartItems: CartItem[] = [];
  isProcessing = false;
  error: string | null = null;
  success: string | null = null;
  paymentMethods = ['Credit Card', 'Debit Card', 'PayPal', 'Bank Transfer'];
  currentStep: 'shipping' | 'payment' | 'review' = 'shipping';

  constructor(
    private fb: FormBuilder,
    private cartService: CartService,
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Load cart
    this.cartService.getCartItems().subscribe((items) => {
      this.cartItems = items;
      this.cartTotal = this.cartService.getCartTotal();

      if (items.length === 0) {
        this.router.navigate(['/cart']);
      }
    });

    // Initialize form
    this.checkoutForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10,}$/)]],
      address: ['', [Validators.required, Validators.minLength(5)]],
      city: ['', [Validators.required]],
      postalCode: ['', [Validators.required, Validators.pattern(/^\d{3,6}$/)]],
      country: ['Tunisia', [Validators.required]],
      paymentMethod: ['Credit Card', [Validators.required]],
      termsAgreed: [false, [Validators.requiredTrue]]
    });
  }

  goToStep(step: 'shipping' | 'payment' | 'review'): void {
    if (step === 'payment' && this.isShippingStepValid()) {
      this.currentStep = step;
    } else if (step === 'review' && this.checkoutForm.valid) {
      this.currentStep = step;
    } else if (step === 'shipping') {
      this.currentStep = step;
    }
  }

  isShippingStepValid(): boolean {
    return (
      this.checkoutForm.get('firstName')?.valid === true &&
      this.checkoutForm.get('lastName')?.valid === true &&
      this.checkoutForm.get('email')?.valid === true &&
      this.checkoutForm.get('phone')?.valid === true &&
      this.checkoutForm.get('address')?.valid === true &&
      this.checkoutForm.get('city')?.valid === true &&
      this.checkoutForm.get('postalCode')?.valid === true
    );
  }

  placeOrder(): void {
    if (!this.checkoutForm.valid) {
      this.error = 'Please fill in all required fields';
      return;
    }

    if (this.cartItems.length === 0) {
      this.error = 'Your cart is empty';
      return;
    }

    this.isProcessing = true;
    this.error = null;
    this.success = null;

    const formValue = this.checkoutForm.value;
    const shippingAddress = `${formValue.address}, ${formValue.city} ${formValue.postalCode}, ${formValue.country}`;

    const orderRequest = {
      shippingAddress,
      paymentMethod: formValue.paymentMethod,
      promoCode: ''
    };

    this.orderService.createOrder(orderRequest).subscribe({
      next: (order) => {
        this.success = `Order placed successfully! Order #${order.orderNumber}`;
        this.cartService.clearCart();
        this.isProcessing = false;

        setTimeout(() => {
          this.router.navigate(['/orders', order.id]);
        }, 2000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to place order. Please try again.';
        console.error(err);
        this.isProcessing = false;
      }
    });
  }

  getShippingAddress(): string {
    const form = this.checkoutForm.value;
    return `${form.address}, ${form.city} ${form.postalCode}, ${form.country}`;
  }

  backToCart(): void {
    this.router.navigate(['/cart']);
  }

  getCartSubtotal(): number {
    return this.cartService.getCartSubtotal();
  }

  getTotalDiscount(): number {
    return this.cartService.getTotalDiscount();
  }
}

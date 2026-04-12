import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { CartService, CartItem } from '../../../services/cart.service';

@Component({
  selector: 'app-checkout-page',
  templateUrl: './checkout-page.component.html',
  styleUrls: ['./checkout-page.component.css']
})
export class CheckoutPageComponent implements OnInit {
  checkoutForm!: FormGroup;
  cartItems: CartItem[] = [];
  cartTotal = 0;
  shippingCost = 10;
  
  isProcessing = false;
  currentStep: 'shipping' | 'payment' | 'review' = 'shipping';
  
  paymentMethods = ['card', 'bank_transfer', 'paypal'];
  selectedPaymentMethod = 'card';

  constructor(
    private fb: FormBuilder,
    private cartService: CartService,
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadCartItems();
  }

  initializeForm(): void {
    this.checkoutForm = this.fb.group({
      // Shipping Info
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      address: ['', Validators.required],
      city: ['', Validators.required],
      postalCode: ['', Validators.required],
      country: ['', Validators.required],
      
      // Payment Info
      cardNumber: ['', [Validators.required, Validators.pattern(/^\d{16}$/)]],
      cardHolder: ['', Validators.required],
      expiryDate: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}$/)]],
      cvv: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      
      // Order Notes
      notes: ['']
    });
  }

  loadCartItems(): void {
    this.cartService.getCartItems().subscribe((items) => {
      this.cartItems = items;
      this.cartTotal = this.cartService.getCartTotal();
    });
  }

  nextStep(): void {
    if (this.currentStep === 'shipping') {
      const shippingControls = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'postalCode', 'country'];
      const isShippingValid = shippingControls.every(control => this.checkoutForm.get(control)?.valid);
      if (isShippingValid) {
        this.currentStep = 'payment';
      }
    } else if (this.currentStep === 'payment') {
      const paymentControls = ['cardNumber', 'cardHolder', 'expiryDate', 'cvv'];
      const isPaymentValid = paymentControls.every(control => this.checkoutForm.get(control)?.valid);
      if (isPaymentValid) {
        this.currentStep = 'review';
      }
    }
  }

  prevStep(): void {
    if (this.currentStep === 'payment') {
      this.currentStep = 'shipping';
    } else if (this.currentStep === 'review') {
      this.currentStep = 'payment';
    }
  }

  submitOrder(): void {
    if (!this.checkoutForm.valid) {
      alert('Veuillez compléter le formulaire');
      return;
    }

    this.isProcessing = true;
    const orderData: any = {
      customerInfo: {
        firstName: this.checkoutForm.value.firstName,
        lastName: this.checkoutForm.value.lastName,
        email: this.checkoutForm.value.email,
        phone: this.checkoutForm.value.phone,
        address: this.checkoutForm.value.address,
        city: this.checkoutForm.value.city,
        postalCode: this.checkoutForm.value.postalCode,
        country: this.checkoutForm.value.country
      },
      shippingAddress: {
        address: this.checkoutForm.value.address,
        city: this.checkoutForm.value.city,
        postalCode: this.checkoutForm.value.postalCode,
        country: this.checkoutForm.value.country,
        name: this.checkoutForm.value.firstName + ' ' + this.checkoutForm.value.lastName
      },
      paymentMethod: this.selectedPaymentMethod,
      items: this.cartItems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity
      })),
      total: this.cartTotal + this.shippingCost,
      notes: this.checkoutForm.value.notes
    };

    this.orderService.createOrder(orderData).subscribe(
      (order) => {
        this.cartService.clearCart();
        this.router.navigate(['/order-confirmation', order.id]);
      },
      (error) => {
        console.error('Error creating order:', error);
        alert('Une erreur est survenue lors de la création de la commande');
        this.isProcessing = false;
      }
    );
  }
}

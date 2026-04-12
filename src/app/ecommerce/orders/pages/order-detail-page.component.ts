import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../services/order.service';

@Component({
  selector: 'app-order-detail-page',
  templateUrl: './order-detail-page.component.html',
  styleUrls: ['./order-detail-page.component.css']
})
export class OrderDetailPageComponent implements OnInit {
  orderId: string | null = null;
  order: any = null;
  isLoading = true;
  
  statusSteps = ['pending', 'confirmed', 'shipped', 'delivered'];

  constructor(
    private activatedRoute: ActivatedRoute,
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.activatedRoute.paramMap.subscribe((params) => {
      this.orderId = params.get('id');
      if (this.orderId) {
        this.loadOrder();
      }
    });
  }

  loadOrder(): void {
    if (!this.orderId) return;
    const orderId = Number(this.orderId);
    this.orderService.getOrderById(orderId).subscribe(
      (order) => {
        this.order = order;
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading order:', error);
        this.isLoading = false;
      }
    );
  }

  getCurrentStepIndex(): number {
    return this.statusSteps.indexOf(this.order?.status || 'pending');
  }

  isStepCompleted(stepIndex: number): boolean {
    return stepIndex < this.getCurrentStepIndex();
  }

  isCurrentStep(stepIndex: number): boolean {
    return stepIndex === this.getCurrentStepIndex();
  }

  printOrder(): void {
    window.print();
  }

  goBack(): void {
    this.router.navigate(['/my-orders']);
  }
}

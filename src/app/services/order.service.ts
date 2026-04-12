import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface OrderDetail {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  userId: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed';
  paymentMethod: string;
  subtotal: number;
  discountAmount: number;
  promoCodeId: number | null;
  totalAmount: number;
  shippingAddress: string;
  createdAt?: string; // ISO date string from backend
  orderDetails: OrderDetail[];
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  shippedOrders: number;
}

export interface CreateOrderRequest {
  shippingAddress: string;
  paymentMethod: string;
  promoCode?: string;
}

export interface FilterOrdersRequest {
  status?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly apiUrl = 'http://localhost:8080/api/ecommerce/orders';

  constructor(private readonly http: HttpClient) {}

  // ========== ORDER RETRIEVAL ==========

  /**
   * Get all orders of authenticated user
   */
  getMyOrders(): Observable<Order[]> {
    return this.http
      .get<ApiResponse<Order[]>>(`${this.apiUrl}/my-orders`)
      .pipe(map((response) => response.data));
  }

  /**
   * Get order by ID
   */
  getOrderById(id: number): Observable<Order> {
    return this.http
      .get<ApiResponse<Order>>(`${this.apiUrl}/${id}`)
      .pipe(map((response) => response.data));
  }

  /**
   * Get order by order number
   */
  getOrderByNumber(orderNumber: string): Observable<Order> {
    return this.http
      .get<ApiResponse<Order>>(`${this.apiUrl}/number/${orderNumber}`)
      .pipe(map((response) => response.data));
  }

  /**
   * Get all orders (ADMIN only)
   */
  getAllOrders(): Observable<Order[]> {
    return this.http
      .get<ApiResponse<Order[]>>(`${this.apiUrl}`)
      .pipe(map((response) => response.data));
  }

  /**
   * Get orders by status (ADMIN only)
   */
  getOrdersByStatus(status: string): Observable<Order[]> {
    return this.http
      .get<ApiResponse<Order[]>>(`${this.apiUrl}/status/${status}`)
      .pipe(map((response) => response.data));
  }

  /**
   * Get pending payment orders (ADMIN only)
   */
  getPendingPaymentOrders(): Observable<Order[]> {
    return this.http
      .get<ApiResponse<Order[]>>(`${this.apiUrl}/payment-pending`)
      .pipe(map((response) => response.data));
  }

  // ========== ORDER MANAGEMENT ==========

  /**
   * Create new order from cart
   */
  createOrder(request: CreateOrderRequest): Observable<Order> {
    return this.http
      .post<ApiResponse<Order>>(`${this.apiUrl}`, request)
      .pipe(map((response) => response.data));
  }

  /**
   * Update order status (ADMIN only)
   */
  updateOrderStatus(orderId: number, status: string): Observable<Order> {
    return this.http
      .patch<ApiResponse<Order>>(`${this.apiUrl}/${orderId}/status`, { status })
      .pipe(map((response) => response.data));
  }

  /**
   * Update payment status (ADMIN only)
   */
  updatePaymentStatus(orderId: number, paymentStatus: string): Observable<Order> {
    return this.http
      .patch<ApiResponse<Order>>(`${this.apiUrl}/${orderId}/payment-status`, { paymentStatus })
      .pipe(map((response) => response.data));
  }

  /**
   * Cancel order
   */
  cancelOrder(orderId: number): Observable<Order> {
    return this.http
      .patch<ApiResponse<Order>>(`${this.apiUrl}/${orderId}/cancel`, {})
      .pipe(map((response) => response.data));
  }

  /**
   * Delete order (ADMIN only)
   */
  deleteOrder(orderId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.apiUrl}/${orderId}`)
      .pipe(map(() => void 0));
  }

  // ========== STATISTICS ==========

  /**
   * Get order statistics (ADMIN only)
   */
  getOrderStats(): Observable<OrderStats> {
    return this.http
      .get<ApiResponse<OrderStats>>(`${this.apiUrl}/stats`)
      .pipe(map((response) => response.data));
  }

  /**
   * Validate promo code and get discount
   */
  validatePromoCode(code: string): Observable<number> {
    return this.http
      .get<ApiResponse<number>>(`${this.apiUrl}/promo-code/validate`, {
        params: { code }
      })
      .pipe(map((response) => response.data));
  }
}

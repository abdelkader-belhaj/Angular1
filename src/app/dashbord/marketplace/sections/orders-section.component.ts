import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface Order {
  id: number;
  orderNumber: string;
  clientName: string;
  clientEmail: string;
  totalAmount: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  items?: any[];
}

@Component({
  selector: 'app-orders-section',
  templateUrl: './orders-section.component.html',
  styleUrl: './orders-section.component.css'
})
export class OrdersSectionComponent implements OnInit {
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  isLoading = true;
  error: string | null = null;
  selectedOrder: Order | null = null;
  showDetailsModal = false;
  statusOptions = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  openDropdown: number | null = null;

  // Filtrage
  searchText = '';
  selectedStatus = '';
  sortOrder: 'ascending' | 'descending' = 'descending';

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.isLoading = true;
    this.http.get<any>('http://localhost:8080/api/ecommerce/orders').subscribe(
      (data) => {
        console.log('🔵 Orders API Response:', data);
        this.orders = Array.isArray(data) ? data : data.data || [];
        console.log('✅ Orders loaded:', this.orders);
        this.applyFilters();
        this.isLoading = false;
      },
      (error) => {
        this.error = 'Failed to load orders';
        console.error('❌ Error loading orders:', error);
        this.isLoading = false;
      }
    );
  }

  applyFilters() {
    let filtered = [...this.orders];

    // Filtre par nom d'utilisateur
    if (this.searchText.trim()) {
      filtered = filtered.filter(order =>
        order.clientName.toLowerCase().includes(this.searchText.toLowerCase())
      );
    }

    // Filtre par statut
    if (this.selectedStatus) {
      filtered = filtered.filter(order => order.status === this.selectedStatus);
    }

    // Tri par date
    filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return this.sortOrder === 'descending' ? dateB - dateA : dateA - dateB;
    });

    // Pagination
    this.totalPages = Math.ceil(filtered.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = 1;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.filteredOrders = filtered.slice(startIndex, startIndex + this.pageSize);
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilters();
  }

  onStatusChange() {
    this.currentPage = 1;
    this.applyFilters();
  }

  onSortChange() {
    this.currentPage = 1;
    this.applyFilters();
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyFilters();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyFilters();
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyFilters();
    }
  }

  resetFilters() {
    this.searchText = '';
    this.selectedStatus = '';
    this.sortOrder = 'descending';
    this.currentPage = 1;
    this.applyFilters();
  }

  get displayedOrdersCount(): string {
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.orders.filter(o => this.matchesFilters(o)).length);
    const total = this.orders.filter(o => this.matchesFilters(o)).length;
    return `${total > 0 ? start : 0}-${end} sur ${total}`;
  }

  private matchesFilters(order: Order): boolean {
    if (this.searchText.trim() && !order.clientName.toLowerCase().includes(this.searchText.toLowerCase())) {
      return false;
    }
    if (this.selectedStatus && order.status !== this.selectedStatus) {
      return false;
    }
    return true;
  }

  viewOrderDetails(order: Order) {
    this.selectedOrder = order;
    this.showDetailsModal = true;
  }



  closeModal() {
    this.showDetailsModal = false;
    this.selectedOrder = null;
  }

  toggleDropdown(orderId: number) {
    this.openDropdown = this.openDropdown === orderId ? null : orderId;
  }

  selectStatus(orderId: number, status: string) {
    this.updateOrderStatus(orderId, status);
    this.openDropdown = null;
  }

  updateOrderStatus(orderId: number, newStatus: string) {
    console.log('🔵 Updating order', orderId, 'to status:', newStatus, 'Type:', typeof newStatus);
    this.http.patch(`http://localhost:8080/api/ecommerce/orders/${orderId}/status`, { status: newStatus }).subscribe(
      (updated: any) => {
        console.log('✅ Status updated response:', updated);
        const order = this.orders.find(o => o.id === orderId);
        if (order) {
          order.status = newStatus as any;
          console.log('✅ Updated local order object, color should now be:', this.getStatusColor(newStatus));
        }
        if (this.selectedOrder && this.selectedOrder.id === orderId) {
          this.selectedOrder.status = newStatus as any;
        }
        this.applyFilters();
      },
      (error) => {
        console.error('❌ Error updating order status:', error);
        console.error('❌ Error message:', error.error?.message);
        console.error('❌ Error details:', error.error);
      }
    );
  }

  cancelOrder(orderId: number) {
    if (confirm('Êtes-vous sûr de vouloir annuler cette commande ?')) {
      this.updateOrderStatus(orderId, 'cancelled');
    }
  }

  deleteOrder(orderId: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette commande ?')) {
      this.http.delete(`http://localhost:8080/api/ecommerce/orders/${orderId}`).subscribe(
        () => {
          console.log('✅ Order deleted successfully');
          this.orders = this.orders.filter(o => o.id !== orderId);
          if (this.selectedOrder && this.selectedOrder.id === orderId) {
            this.closeModal();
          }
          this.applyFilters();
        },
        (error) => {
          console.error('❌ Error deleting order:', error);
          alert('Erreur lors de la suppression de la commande');
        }
      );
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-orange-100 text-orange-700';
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'shipped':
        return 'bg-blue-100 text-blue-700';
      case 'delivered':
        return 'bg-purple-100 text-purple-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'paid':
        return 'Payée';
      case 'shipped':
        return 'Expédiée';
      case 'delivered':
        return 'Livrée';
      case 'cancelled':
        return 'Annulée';
      default:
        return status;
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    const startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }
}

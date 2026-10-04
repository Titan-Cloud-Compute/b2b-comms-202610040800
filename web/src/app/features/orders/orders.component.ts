import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import { ApiClient } from '../../shared/api/api-client';
import { ToastService } from '../../shared/api/toast.service';

// Local interfaces matching backend order-management.dto.ts
interface OrderItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  orderId?: string;
}

interface Order {
  id: string;
  status: string;
  customerId?: string;
  vendorId?: string;
  items?: OrderItem[];
  estimatedDelivery?: string;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="page" data-testid="orders-screen">
      <header class="page-header"><h1>Orders</h1></header>

      <section class="card">
        <h2>How ordering works</h2>
        <p>When a customer submits a purchase order, the order is stored with status "pending" and returns 201 with the created Order record.</p>
        <p>When a vendor confirms the order and sets an estimated delivery date, the order is updated to status "confirmed" and displays to the customer as confirmed.</p>
      </section>

      <section class="card">
        <h2>Place a Purchase Order</h2>
        <form data-testid="create-order-form" class="stack" [formGroup]="orderForm" (ngSubmit)="submitOrder()">
          <div class="form-field">
            <label for="vendorId">Vendor ID</label>
            <input
              id="vendorId"
              data-testid="order-vendor-id"
              type="text"
              formControlName="vendorId"
              placeholder="Enter vendor ID"
            />
            <span class="form-error" *ngIf="orderForm.get('vendorId')?.invalid && orderForm.get('vendorId')?.touched">
              Vendor ID is required.
            </span>
          </div>

          <div class="stack">
            <h3>Line Items</h3>
            <div class="stack" formArrayName="items">
              <div *ngFor="let item of itemsArray.controls; let i = index" class="form-row" [formGroupName]="i">
                <input
                  type="text"
                  formControlName="description"
                  placeholder="Description"
                />
                <input
                  type="number"
                  formControlName="quantity"
                  placeholder="Qty"
                  min="1"
                />
                <input
                  type="number"
                  formControlName="unitPrice"
                  placeholder="Unit Price"
                  min="0"
                  step="0.01"
                />
                <button class="btn-secondary" type="button" (click)="removeItem(i)" [disabled]="itemsArray.length <= 1">
                  Remove
                </button>
              </div>
            </div>
            <button class="btn-secondary" type="button" (click)="addItem()">Add Item</button>
          </div>

          <button class="btn-primary" type="submit" [disabled]="orderForm.invalid || submitting">
            {{ submitting ? 'Placing...' : 'Place Order' }}
          </button>
        </form>
      </section>

      <section class="card">
        <h2>Order List</h2>
        <div class="stack" data-testid="order-list">
          <p class="empty-state" *ngIf="loading">Loading orders...</p>
          <p class="empty-state" *ngIf="!loading && orders.length === 0">No orders found.</p>
          <div *ngFor="let order of orders" class="list-card stack">
            <p><strong>Order ID:</strong> {{ order.id }}</p>
            <p>
              <strong>Status:</strong>
              <span data-testid="order-status">{{ order.status }}</span>
            </p>
            <div *ngIf="order.items && order.items.length">
              <strong>Items:</strong>
              <ul class="item-list">
                <li *ngFor="let item of order.items">
                  {{ item.description }} qty: {{ item.quantity }} price: {{ item.unitPrice }}
                </li>
              </ul>
            </div>
            <div *ngIf="order.estimatedDelivery">
              <p><strong>Estimated Delivery:</strong> {{ order.estimatedDelivery }}</p>
            </div>
            <div class="form-row" *ngIf="order.status === 'pending'">
              <label [for]="'delivery-' + order.id">Estimated Delivery Date</label>
              <input
                [id]="'delivery-' + order.id"
                data-testid="estimated-delivery"
                type="date"
                [min]="today"
                [(ngModel)]="deliveryDates[order.id]"
                [ngModelOptions]="{standalone: true}"
              />
              <button
                class="btn-primary"
                data-testid="confirm-order"
                (click)="confirmOrder(order)"
                [disabled]="!deliveryDates[order.id]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class OrdersComponent implements OnInit {
  private api = inject(ApiClient);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  orders: Order[] = [];
  loading = false;
  submitting = false;
  today = new Date().toISOString().split('T')[0];
  deliveryDates: Record<string, string> = {};

  orderForm: FormGroup = this.fb.group({
    vendorId: ['', Validators.required],
    items: this.fb.array([this.createItem()]),
  });

  get itemsArray(): FormArray {
    return this.orderForm.get('items') as FormArray;
  }

  createItem(): FormGroup {
    return this.fb.group({
      description: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
    });
  }

  addItem(): void {
    this.itemsArray.push(this.createItem());
  }

  removeItem(index: number): void {
    if (this.itemsArray.length > 1) {
      this.itemsArray.removeAt(index);
    }
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  async loadOrders(): Promise<void> {
    this.loading = true;
    try {
      const result = await this.api.get<unknown>('orders');
      this.orders = Array.isArray(result) ? (result as Order[]) : [];
    } catch (err: any) {
      this.toast.show(err?.message || 'Failed to load orders', 'error');
      this.orders = [];
    } finally {
      this.loading = false;
    }
  }

  async submitOrder(): Promise<void> {
    if (this.orderForm.invalid) return;
    this.submitting = true;
    const { vendorId, items } = this.orderForm.value;
    try {
      const created = await this.api.post<Order>('orders', { vendorId, items });
      this.orders = [created, ...this.orders];
      this.orderForm.reset({ vendorId: '', items: [] });
      while (this.itemsArray.length > 0) {
        this.itemsArray.removeAt(0);
      }
      this.itemsArray.push(this.createItem());
      this.toast.show('Order placed successfully', 'success');
    } catch (err: any) {
      this.toast.show(err?.message || 'Failed to place order', 'error');
    } finally {
      this.submitting = false;
    }
  }

  async confirmOrder(order: Order): Promise<void> {
    const estimatedDelivery = this.deliveryDates[order.id];
    if (!estimatedDelivery) return;
    try {
      const updated = await this.api.patch<Order>(`orders/${order.id}/confirm`, { estimatedDelivery });
      const idx = this.orders.findIndex(o => o.id === order.id);
      if (idx !== -1) {
        this.orders = [
          ...this.orders.slice(0, idx),
          { ...this.orders[idx], status: updated.status, estimatedDelivery },
          ...this.orders.slice(idx + 1),
        ];
      }
      this.toast.show('Order confirmed', 'success');
    } catch (err: any) {
      this.toast.show(err?.message || 'Failed to confirm order', 'error');
    }
  }
}

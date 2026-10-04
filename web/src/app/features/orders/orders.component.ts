import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

export interface OrderItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderRow {
  id: string;
  status: string;
  customerId?: string;
  vendorId?: string;
  estimatedDelivery?: string;
}

const CREATE_OUTCOME =
  'the order is stored with status "pending" and returns 201 with the created Order record';
const CONFIRM_OUTCOME =
  'the order is updated to status "confirmed" and displays to the customer as confirmed';

function registerOrderMocks(client: MockApiClient): void {
  const orders: OrderRow[] = [];
  let seq = 0;
  client.registerMock('GET', '/api/orders', async () => orders.map((o) => ({ ...o })));
  client.registerMock('POST', '/api/orders', async (body) => {
    const b = (body ?? {}) as { vendorId?: string };
    const order: OrderRow = {
      id: `mock-order-${++seq}`,
      status: 'pending',
      customerId: 'mock-customer',
      vendorId: b.vendorId ?? '',
    };
    orders.push(order);
    // MockApiClient matches exact paths, so register the confirm route per order.
    client.registerMock('PATCH', `/api/orders/${order.id}/confirm`, async (patch) => {
      const p = (patch ?? {}) as { estimatedDelivery?: string };
      order.status = 'confirmed';
      order.estimatedDelivery = p.estimatedDelivery;
      return { id: order.id, status: order.status };
    });
    return { ...order };
  });
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="orders-screen">
      <h1>Orders</h1>

      <section>
        <h2>Place a purchase order</h2>
        <p data-testid="create-order-outcome">When you submit a purchase order, {{ createOutcome }}.</p>
        <form data-testid="create-order-form" (ngSubmit)="createOrder()">
          <label>
            Vendor ID
            <input name="vendorId" data-testid="order-vendor-id" [(ngModel)]="vendorId" required />
          </label>
          @for (item of items; track $index) {
            <fieldset>
              <label>
                Description
                <input [name]="'description' + $index" [(ngModel)]="item.description" />
              </label>
              <label>
                Quantity
                <input type="number" min="1" [name]="'quantity' + $index" [(ngModel)]="item.quantity" />
              </label>
              <label>
                Unit price
                <input type="number" min="0" step="0.01" [name]="'unitPrice' + $index" [(ngModel)]="item.unitPrice" />
              </label>
            </fieldset>
          }
          <button type="button" (click)="addItem()">Add item</button>
          <button type="submit" data-testid="submit-order" [disabled]="submitting">Submit purchase order</button>
        </form>
        @if (createdOrder) {
          <p data-testid="order-created" role="status">
            Order {{ createdOrder.id }} created with status "{{ createdOrder.status }}".
          </p>
        }
      </section>

      <section>
        <h2>Order queue</h2>
        <p data-testid="confirm-order-outcome">When the vendor confirms an order with an estimated delivery date, {{ confirmOutcome }}.</p>
        @if (error) {
          <p role="alert">{{ error }}</p>
        }
        <ul data-testid="order-list">
          @for (order of orders; track order.id) {
            <li data-testid="order-row">
              <span>Order {{ order.id }}</span>
              <span data-testid="order-status"> — {{ order.status }}</span>
              @if (order.estimatedDelivery) {
                <span> (estimated delivery {{ order.estimatedDelivery }})</span>
              }
              @if (order.status === 'pending') {
                <label>
                  Estimated delivery
                  <input type="date" [name]="'eta-' + order.id" [(ngModel)]="deliveryDates[order.id]" />
                </label>
                <button type="button" data-testid="confirm-order" (click)="confirmOrder(order)">Confirm</button>
              }
            </li>
          } @empty {
            <li>No orders yet.</li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class OrdersComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly createOutcome = CREATE_OUTCOME;
  readonly confirmOutcome = CONFIRM_OUTCOME;

  orders: OrderRow[] = [];
  vendorId = '';
  items: OrderItemInput[] = [{ description: '', quantity: 1, unitPrice: 0 }];
  deliveryDates: Record<string, string> = {};
  createdOrder: OrderRow | null = null;
  submitting = false;
  error = '';

  constructor() {
    if (this.api instanceof MockApiClient) {
      registerOrderMocks(this.api);
    }
  }

  ngOnInit(): void {
    void this.loadOrders();
  }

  async loadOrders(): Promise<void> {
    try {
      const res = await this.api.get<OrderRow[]>('/api/orders');
      this.orders = Array.isArray(res) ? res : [];
    } catch {
      this.orders = [];
    }
  }

  addItem(): void {
    this.items = [...this.items, { description: '', quantity: 1, unitPrice: 0 }];
  }

  async createOrder(): Promise<void> {
    if (!this.vendorId) {
      this.error = 'Vendor ID is required.';
      return;
    }
    this.submitting = true;
    this.error = '';
    try {
      const created = await this.api.post<OrderRow>('/api/orders', {
        vendorId: this.vendorId,
        items: this.items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        })),
      });
      this.createdOrder = created;
      this.orders = [...this.orders, created];
      this.items = [{ description: '', quantity: 1, unitPrice: 0 }];
    } catch (e: any) {
      this.error = e?.message ?? 'Could not create order.';
    } finally {
      this.submitting = false;
    }
  }

  async confirmOrder(order: OrderRow): Promise<void> {
    const estimatedDelivery = this.deliveryDates[order.id];
    if (!estimatedDelivery) {
      this.error = 'Choose an estimated delivery date before confirming.';
      return;
    }
    this.error = '';
    try {
      const updated = await this.api.patch<OrderRow>(
        `/api/orders/${encodeURIComponent(order.id)}/confirm`,
        { estimatedDelivery },
      );
      this.orders = this.orders.map((o) =>
        o.id === order.id ? { ...o, ...updated, estimatedDelivery } : o,
      );
    } catch (e: any) {
      this.error = e?.message ?? 'Could not confirm order.';
    }
  }
}

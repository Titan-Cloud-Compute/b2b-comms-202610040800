import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, ConflictError, MockApiClient } from '../../shared/api/api-client';

interface CustomerRow {
  id: string;
  email: string;
}

interface InviteResponse {
  customerId: string;
  email: string;
  invitationSent: boolean;
}

const LIST_PATH = '/api/admin/customers';
const INVITE_PATH = '/api/admin/customers/invite';

/** Register in-memory mocks for this feature's endpoints when running against MockApiClient. */
function registerCustomerInviteMocks(client: MockApiClient): void {
  const store: CustomerRow[] = [];
  client.registerMock<CustomerRow[]>('GET', LIST_PATH, async () => store.map((c) => ({ ...c })));
  client.registerMock<InviteResponse>('POST', INVITE_PATH, async (body) => {
    const email = String((body as { email?: string })?.email ?? '').trim().toLowerCase();
    if (store.some((c) => c.email === email)) {
      throw new ConflictError('Customer already exists');
    }
    const row = { id: crypto.randomUUID(), email };
    store.unshift(row);
    return { customerId: row.id, email, invitationSent: true };
  });
}

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="admin-customers-screen">
      <h1>Customer Management</h1>

      <section>
        <h2>Invite a customer</h2>
        <ul>
          <li>When you invite a new email, a Customer record is created and returns 201 with invitationSent true.</li>
          <li>If the email is already a customer, the response returns 409 error indicating the customer already exists.</li>
        </ul>
        <form data-testid="customer-invite-form" (ngSubmit)="invite()">
          <label for="customer-invite-email">Customer email</label>
          <input
            id="customer-invite-email"
            type="email"
            name="email"
            required
            [(ngModel)]="email"
            placeholder="buyer@corp.example.com"
          />
          <button type="submit" [disabled]="submitting()">Send invitation</button>
        </form>
        @if (success()) {
          <p role="status" data-testid="customer-invite-success">{{ success() }}</p>
        }
        @if (error()) {
          <p role="alert" data-testid="customer-invite-error">{{ error() }}</p>
        }
      </section>

      <section>
        <h2>Customers</h2>
        <ul data-testid="customer-list">
          @for (c of customers(); track c.id) {
            <li>{{ c.email }}</li>
          } @empty {
            <li>No customers invited yet.</li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class AdminCustomersComponent implements OnInit {
  private readonly api = inject(ApiClient);

  email = '';
  readonly customers = signal<CustomerRow[]>([]);
  readonly submitting = signal(false);
  readonly success = signal('');
  readonly error = signal('');

  constructor() {
    if (this.api instanceof MockApiClient) {
      registerCustomerInviteMocks(this.api);
    }
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const rows = await this.api.get<CustomerRow[]>(LIST_PATH);
      this.customers.set(Array.isArray(rows) ? rows : []);
    } catch {
      this.customers.set([]);
    }
  }

  async invite(): Promise<void> {
    const email = this.email.trim();
    this.success.set('');
    this.error.set('');
    if (!email) {
      this.error.set('Enter a customer email address.');
      return;
    }
    this.submitting.set(true);
    try {
      const res = await this.api.post<InviteResponse>(INVITE_PATH, { email });
      if (res?.invitationSent) {
        const row = { id: res.customerId, email: res.email };
        this.customers.update((list) => [row, ...list.filter((c) => c.id !== row.id)]);
        this.success.set(`Invitation sent to ${res.email}.`);
        this.email = '';
      } else {
        this.error.set('The invitation could not be sent.');
      }
    } catch (err) {
      if (err instanceof ConflictError) {
        this.error.set('A customer with this email already exists.');
      } else {
        this.error.set((err as Error)?.message || 'The invitation could not be sent.');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}

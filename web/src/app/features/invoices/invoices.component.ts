import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

/** Contract: POST /api/invoices response / Invoice entity. */
export interface InvoiceDto {
  id: string;
  orderId: string;
  amount: number;
}

/** Contract: GET /api/invoices/:id/download response. */
export interface InvoiceDownloadDto {
  id: string;
  downloadUrl: string;
}

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="invoices-screen">
      <h1>Invoices</h1>

      <section>
        <h2>Generate invoice</h2>
        <p>Vendor: the invoice is created and returns 201 with the invoice id available for download.</p>
        <form data-testid="invoice-generate-form" (ngSubmit)="generate()">
          <label>
            Order ID
            <input name="orderId" type="text" required [(ngModel)]="orderId" />
          </label>
          <label>
            Amount
            <input name="amount" type="number" step="0.01" min="0" required [(ngModel)]="amount" />
          </label>
          <button type="submit" data-testid="invoice-generate-submit" [disabled]="generating">Generate invoice</button>
        </form>
        @if (created) {
          <p data-testid="invoice-created">
            Invoice <strong data-testid="invoice-created-id">{{ created.id }}</strong> created for order
            {{ created.orderId }} ({{ created.amount }}).
          </p>
        }
        @if (generateError) {
          <p role="alert" data-testid="invoice-generate-error">{{ generateError }}</p>
        }
      </section>

      <section data-testid="invoice-download-panel">
        <h2>Download invoice</h2>
        <p>Customer: the response returns 200 with a downloadUrl pointing to the stored invoice.</p>
        <form (ngSubmit)="download()">
          <label>
            Invoice ID
            <input name="invoiceId" type="text" required [(ngModel)]="invoiceId" />
          </label>
          <button type="submit" data-testid="invoice-download-submit" [disabled]="downloading">Get download link</button>
        </form>
        @if (downloadUrl) {
          <a data-testid="invoice-download-link" [href]="downloadUrl" target="_blank" rel="noopener">Download invoice</a>
        }
        @if (downloadError) {
          <p role="alert" data-testid="invoice-download-error">{{ downloadError }}</p>
        }
      </section>
    </div>
  `,
})
export class InvoicesComponent {
  private readonly api = inject(ApiClient);

  orderId = '';
  amount: number | null = null;
  invoiceId = '';

  created: InvoiceDto | null = null;
  downloadUrl: string | null = null;
  generating = false;
  downloading = false;
  generateError = '';
  downloadError = '';

  constructor() {
    if (this.api instanceof MockApiClient) {
      registerInvoiceMocks(this.api);
    }
  }

  async generate(): Promise<void> {
    this.generateError = '';
    const amount = Number(this.amount);
    if (!this.orderId.trim() || !Number.isFinite(amount) || amount < 0) {
      this.generateError = 'Enter an order id and a valid amount.';
      return;
    }
    this.generating = true;
    try {
      this.created = await this.api.post<InvoiceDto>('/api/invoices', { orderId: this.orderId.trim(), amount });
      this.invoiceId = this.created.id;
    } catch (e: any) {
      this.generateError = e?.message || 'Could not generate invoice.';
    } finally {
      this.generating = false;
    }
  }

  async download(): Promise<void> {
    this.downloadError = '';
    this.downloadUrl = null;
    const id = this.invoiceId.trim();
    if (!id) {
      this.downloadError = 'Enter an invoice id.';
      return;
    }
    this.downloading = true;
    try {
      const res = await this.api.get<InvoiceDownloadDto>(`/api/invoices/${encodeURIComponent(id)}/download`);
      this.downloadUrl = res.downloadUrl;
    } catch (e: any) {
      this.downloadError = e?.message || 'Could not fetch download link.';
    } finally {
      this.downloading = false;
    }
  }
}

const mockInvoices: InvoiceDto[] = [];

function registerInvoiceMocks(mock: MockApiClient): void {
  mock.registerMock<InvoiceDto>('POST', '/api/invoices', async (body) => {
    const b = (body ?? {}) as { orderId: string; amount: number };
    const inv: InvoiceDto = { id: crypto.randomUUID(), orderId: b.orderId, amount: Number(b.amount) };
    mockInvoices.push(inv);
    mock.registerMock<InvoiceDownloadDto>('GET', `/api/invoices/${encodeURIComponent(inv.id)}/download`, async () => ({
      id: inv.id,
      downloadUrl: `/mock-storage/invoices/${inv.id}.txt`,
    }));
    return inv;
  });
}

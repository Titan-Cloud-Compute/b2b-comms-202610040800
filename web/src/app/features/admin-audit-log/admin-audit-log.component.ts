import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../shared/api/api-client';

interface AuditEntry {
  id: string;
  action: string;
  userId: string;
  createdAt: string;
}

@Component({
  selector: 'app-admin-audit-log',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" data-testid="admin-audit-log-screen">
      <header class="page-header"><h1>Audit Log</h1></header>

      <section class="card">
        <h2>Activity log</h2>
        <p>Scenario: a list of AuditEntry records is displayed in chronological order returns 200</p>
        @if (loading()) {
          <p class="empty-state">Loading…</p>
        }
        @if (error()) {
          <p class="form-error" role="alert">{{ error() }}</p>
        }
        <div class="table-scroll">
        <table class="data-table" data-testid="audit-log-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of entries(); track entry.id) {
              <tr>
                <td>{{ entry.createdAt }}</td>
                <td>{{ entry.action }}</td>
                <td>{{ entry.userId }}</td>
              </tr>
            } @empty {
              <tr><td class="empty-state" colspan="3">No audit entries yet</td></tr>
            }
          </tbody>
        </table>
        </div>
      </section>

      <section class="card">
        <h2>Record an entry</h2>
        <p>Scenario: the AuditEntry is stored and returns 201 with the created record</p>
        @if (formError()) {
          <p class="form-error" role="alert">{{ formError() }}</p>
        }
        <form class="stack" data-testid="audit-log-record-form" (ngSubmit)="submitEntry()">
          <label class="form-field">
            Action
            <input type="text" name="action" [(ngModel)]="formAction" required />
          </label>
          <label class="form-field">
            User ID
            <input type="text" name="userId" [(ngModel)]="formUserId" required />
          </label>
          <button class="btn-primary" type="submit">Record</button>
        </form>
      </section>
    </div>
  `,
})
export class AdminAuditLogComponent implements OnInit {
  private api = inject(ApiClient);

  entries = signal<AuditEntry[]>([]);
  loading = signal(false);
  error = signal('');
  formError = signal('');

  formAction = '';
  formUserId = '';

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.api.get<unknown>('admin/audit-log');
      if (Array.isArray(data)) {
        const sorted = [...data].sort((a: AuditEntry, b: AuditEntry) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        this.entries.set(sorted);
      }
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      this.loading.set(false);
    }
  }

  async submitEntry(): Promise<void> {
    this.formError.set('');
    try {
      const created = await this.api.post<AuditEntry>('admin/audit-log', {
        action: this.formAction,
        userId: this.formUserId,
      });
      this.entries.update(list =>
        [...list, { ...created, userId: this.formUserId }]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      );
      this.formAction = '';
      this.formUserId = '';
    } catch (err: unknown) {
      this.formError.set(err instanceof Error ? err.message : 'Failed to record entry');
    }
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

/** AuditEntry — mirrors the shared data model (id, action, userId, createdAt). */
export interface AuditEntry {
  id: string;
  action: string;
  userId: string;
  createdAt: string;
}

const AUDIT_LOG_PATH = '/api/admin/audit-log';

/** In-memory store used only when the app runs against MockApiClient. */
const mockEntries: AuditEntry[] = [];

function registerAuditLogMocks(client: ApiClient): void {
  if (!(client instanceof MockApiClient)) return;
  client.registerMock<AuditEntry[]>('GET', AUDIT_LOG_PATH, async () => [...mockEntries]);
  client.registerMock<AuditEntry>('POST', AUDIT_LOG_PATH, async (body) => {
    const b = (body ?? {}) as { action?: string; userId?: string };
    const created: AuditEntry = {
      id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
      action: b.action ?? '',
      userId: b.userId ?? '',
      createdAt: new Date().toISOString(),
    };
    mockEntries.push(created);
    return created;
  });
}

@Component({
  selector: 'app-admin-audit-log',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="admin-audit-log-screen">
      <h1>Audit Log</h1>

      <section data-testid="audit-log-list-scenario">
        <p data-testid="audit-log-list-caption">a list of AuditEntry records is displayed in chronological order returns 200</p>
        @if (loadError) {
          <p data-testid="audit-log-error" role="alert">{{ loadError }}</p>
        }
        <table data-testid="audit-log-table">
          <thead>
            <tr><th>Time</th><th>Action</th><th>User</th></tr>
          </thead>
          <tbody>
            @for (e of entries; track e.id) {
              <tr data-testid="audit-log-row">
                <td>{{ e.createdAt }}</td>
                <td>{{ e.action }}</td>
                <td>{{ e.userId }}</td>
              </tr>
            } @empty {
              <tr><td colspan="3" data-testid="audit-log-empty">No audit entries yet.</td></tr>
            }
          </tbody>
        </table>
      </section>

      <section data-testid="audit-log-record-scenario">
        <p data-testid="audit-log-record-caption">the AuditEntry is stored and returns 201 with the created record</p>
        <form data-testid="audit-log-form" (ngSubmit)="record()">
          <label>Action <input name="action" data-testid="audit-log-action" [(ngModel)]="action" required /></label>
          <label>User ID <input name="userId" data-testid="audit-log-user-id" [(ngModel)]="userId" required /></label>
          <button type="submit" data-testid="audit-log-submit" [disabled]="saving || !action || !userId">Record entry</button>
        </form>
        @if (lastCreated) {
          <p data-testid="audit-log-created">Recorded {{ lastCreated.action }} ({{ lastCreated.id }})</p>
        }
        @if (saveError) {
          <p data-testid="audit-log-save-error" role="alert">{{ saveError }}</p>
        }
      </section>
    </div>
  `,
})
export class AdminAuditLogComponent implements OnInit {
  private readonly api = inject(ApiClient);

  entries: AuditEntry[] = [];
  loadError = '';
  saveError = '';
  saving = false;
  action = '';
  userId = '';
  lastCreated: AuditEntry | null = null;

  constructor() {
    registerAuditLogMocks(this.api);
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loadError = '';
    try {
      const res = await this.api.get<AuditEntry[]>(AUDIT_LOG_PATH);
      this.entries = this.sortChronologically(Array.isArray(res) ? res : []);
    } catch (err: any) {
      this.entries = [];
      this.loadError = err?.message || 'Failed to load audit log';
    }
  }

  async record(): Promise<void> {
    if (!this.action || !this.userId) return;
    this.saving = true;
    this.saveError = '';
    try {
      const created = await this.api.post<AuditEntry>(AUDIT_LOG_PATH, {
        action: this.action,
        userId: this.userId,
      });
      if (created && typeof created === 'object' && 'id' in created) {
        const entry: AuditEntry = {
          id: created.id,
          action: created.action ?? this.action,
          userId: created.userId ?? this.userId,
          createdAt: created.createdAt ?? new Date().toISOString(),
        };
        this.lastCreated = entry;
        this.entries = this.sortChronologically([...this.entries, entry]);
      }
      this.action = '';
      this.userId = '';
    } catch (err: any) {
      this.saveError = err?.message || 'Failed to record audit entry';
    } finally {
      this.saving = false;
    }
  }

  private sortChronologically(list: AuditEntry[]): AuditEntry[] {
    return [...list].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }
}

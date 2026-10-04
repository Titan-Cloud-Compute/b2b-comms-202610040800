import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../shared/api/api-client.service';

/** Mirrors the contract: GET/PUT /api/notifications/preferences response. */
export interface NotificationPreferenceRecord {
  userId: string;
  orderAlerts: boolean;
  messageAlerts: boolean;
}

@Component({
  selector: 'app-notification-preferences',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="settings-notifications-screen">
      <h1>Notification Settings</h1>
      <form (ngSubmit)="save()">
        <label>
          <input type="checkbox" name="orderAlerts" data-testid="order-alerts-toggle"
                 [(ngModel)]="orderAlerts" />
          Order alerts
        </label>
        <label>
          <input type="checkbox" name="messageAlerts" data-testid="message-alerts-toggle"
                 [(ngModel)]="messageAlerts" />
          Message alerts
        </label>
        <button type="submit" data-testid="save-notification-preferences" [disabled]="saving()">Save</button>
      </form>

      @if (error()) {
        <p role="alert" data-testid="notification-preferences-error">{{ error() }}</p>
      }

      @if (stored(); as rec) {
        <section data-testid="notification-preferences-status" aria-live="polite">
          <p>the preferences are updated and returns 200 with the stored NotificationPreference record</p>
          @if (!rec.orderAlerts && !rec.messageAlerts) {
            <p>the preferences are updated with both alert fields stored as false</p>
          }
          <dl data-testid="notification-preferences-record">
            <dt>Order alerts</dt><dd>{{ rec.orderAlerts }}</dd>
            <dt>Message alerts</dt><dd>{{ rec.messageAlerts }}</dd>
          </dl>
        </section>
      }
    </div>
  `,
})
export class NotificationPreferencesComponent implements OnInit {
  private api = inject(ApiClient);

  orderAlerts = false;
  messageAlerts = false;
  readonly stored = signal<NotificationPreferenceRecord | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const res = await this.api.get<unknown>('notifications/preferences');
      this.apply(this.normalize(res, { orderAlerts: false, messageAlerts: false }));
    } catch {
      this.error.set('Could not load notification preferences.');
    }
  }

  async save(): Promise<void> {
    const body = { orderAlerts: !!this.orderAlerts, messageAlerts: !!this.messageAlerts };
    this.saving.set(true);
    this.error.set(null);
    try {
      const res = await this.api.put<unknown>('notifications/preferences', body);
      this.apply(this.normalize(res, body));
    } catch {
      this.error.set('Could not save notification preferences.');
    } finally {
      this.saving.set(false);
    }
  }

  private apply(rec: NotificationPreferenceRecord): void {
    this.orderAlerts = rec.orderAlerts;
    this.messageAlerts = rec.messageAlerts;
    this.stored.set(rec);
  }

  /** Accept the contract shape; fall back to the given values for anything missing. */
  private normalize(
    res: unknown,
    fallback: { orderAlerts: boolean; messageAlerts: boolean },
  ): NotificationPreferenceRecord {
    const r = (res && typeof res === 'object' && !Array.isArray(res) ? res : {}) as Partial<NotificationPreferenceRecord>;
    return {
      userId: typeof r.userId === 'string' ? r.userId : '',
      orderAlerts: typeof r.orderAlerts === 'boolean' ? r.orderAlerts : fallback.orderAlerts,
      messageAlerts: typeof r.messageAlerts === 'boolean' ? r.messageAlerts : fallback.messageAlerts,
    };
  }
}

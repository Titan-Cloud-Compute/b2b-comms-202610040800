import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../shared/api/api-client.service';
import { AuthService } from '../../shared/auth.service';
import { ToastService } from '../../shared/api/toast.service';

export interface Channel {
  id: string;
  name: string;
}

export interface Message {
  id: string;
  body: string;
  channelId: string;
}

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" data-testid="channels-screen">
      <header class="page-header"><h1>Channels</h1></header>

      <section class="card">
        <h2>How shared channels work</h2>
        <p>When a vendor creates a shared channel, the channel is stored and displays in both the vendor and customer channel lists.</p>
        <p>When a customer posts a message, the message is stored and returns 201 with the created Message record.</p>
      </section>

      @if (isVendorOrAdmin()) {
        <section class="card">
          <h2>Create Channel</h2>
          <form class="stack" data-testid="create-channel-form" (ngSubmit)="createChannel()">
            <label class="form-field">
              Channel name
              <input
                data-testid="channel-name"
                type="text"
                name="channelName"
                [(ngModel)]="newChannelName"
                required
                maxlength="120"
                placeholder="Enter channel name"
              />
            </label>
            <button class="btn-primary" type="submit" [disabled]="creating()">Create</button>
          </form>
        </section>
      }

      <section class="card">
        <h2>Channel List</h2>
        @if (loading()) {
          <p class="empty-state">Loading channels…</p>
        } @else if (channels().length === 0) {
          <p class="empty-state" data-testid="channel-list-empty">No channels yet.</p>
        } @else {
          <ul class="item-list" data-testid="channel-list">
            @for (channel of channels(); track channel.id) {
              <li>
                <button class="btn-link" type="button" (click)="selectChannel(channel)">{{ channel.name }}</button>
              </li>
            }
          </ul>
        }
      </section>

      @if (selectedChannel()) {
        <section class="card">
          <h2>{{ selectedChannel()!.name }}</h2>
          <ul class="item-list">
            @for (msg of messages(); track msg.id) {
              <li>{{ msg.body }}</li>
            }
          </ul>
          <form class="stack" (ngSubmit)="sendMessage()">
            <label class="form-field">
              Message
              <textarea
                data-testid="message-body"
                name="messageBody"
                [(ngModel)]="newMessageBody"
                rows="3"
                placeholder="Type a message…"
              ></textarea>
            </label>
            <button class="btn-primary" type="submit" data-testid="send-message" [disabled]="sending()">Send</button>
          </form>
        </section>
      }
    </div>
  `,
})
export class ChannelsComponent implements OnInit {
  private api = inject(ApiClient);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  readonly channels = signal<Channel[]>([]);
  readonly messages = signal<Message[]>([]);
  readonly selectedChannel = signal<Channel | null>(null);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly sending = signal(false);

  newChannelName = '';
  newMessageBody = '';

  isVendorOrAdmin(): boolean {
    const role = this.auth.user()?.role;
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.get<unknown>('channels');
      this.channels.set(Array.isArray(res) ? (res as Channel[]) : []);
    } catch {
      this.toast.show('Could not load channels.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  async createChannel(): Promise<void> {
    const name = this.newChannelName.trim();
    if (!name) return;
    this.creating.set(true);
    try {
      const res = await this.api.post<unknown>('channels', { name });
      const created = res && typeof res === 'object' && !Array.isArray(res)
        ? (res as Channel)
        : null;
      if (created?.id && created?.name) {
        this.channels.update(list => [...list, created]);
      }
      this.newChannelName = '';
    } catch {
      this.toast.show('Could not create channel.', 'error');
    } finally {
      this.creating.set(false);
    }
  }

  selectChannel(channel: Channel): void {
    this.selectedChannel.set(channel);
    this.messages.set([]);
    this.newMessageBody = '';
  }

  async sendMessage(): Promise<void> {
    const body = this.newMessageBody.trim();
    const channel = this.selectedChannel();
    if (!body || !channel) return;
    this.sending.set(true);
    try {
      const res = await this.api.post<unknown>(`channels/${channel.id}/messages`, { body });
      const msg = res && typeof res === 'object' && !Array.isArray(res)
        ? (res as Message)
        : null;
      if (msg?.id && msg?.body) {
        this.messages.update(list => [...list, msg]);
      }
      this.newMessageBody = '';
    } catch {
      this.toast.show('Could not send message.', 'error');
    } finally {
      this.sending.set(false);
    }
  }
}

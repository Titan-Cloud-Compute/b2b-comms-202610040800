import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

interface Channel {
  id: string;
  name: string;
}

interface Message {
  id: string;
  body: string;
  channelId: string;
}

/** Register in-memory mocks for the shared-channel endpoints (USE_MOCKS mode). */
function registerChannelMocks(api: MockApiClient): (channelId: string) => void {
  const channels: Channel[] = [];
  let seq = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  api.registerMock('GET', '/api/channels', async () => channels.map(c => ({ ...c })));
  api.registerMock('POST', '/api/channels', async (body) => {
    const ch: Channel = { id: nextId(), name: String((body as { name?: string })?.name ?? '') };
    channels.unshift(ch);
    return ch;
  });
  // Message endpoint is path-parameterised; MockApiClient matches exact paths,
  // so per-channel handlers are registered when a channel is created/listed.
  return (id: string) =>
    api.registerMock('POST', `/api/channels/${id}/messages`, async (body) => ({
      id: nextId(),
      body: String((body as { body?: string })?.body ?? ''),
      channelId: id,
    }));
}

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="channels-screen">
      <h1>Channels</h1>
      <p data-testid="channels-outcomes">
        When a vendor creates a channel, the channel is stored and displays in both the vendor and customer channel lists.
        When a customer posts in a channel, the message is stored and returns 201 with the created Message record.
      </p>

      <form data-testid="create-channel-form" (ngSubmit)="createChannel()">
        <label for="channel-name">Channel name</label>
        <input id="channel-name" name="channelName" data-testid="channel-name-input" [(ngModel)]="newName" required />
        <button type="submit" data-testid="create-channel-button" [disabled]="!newName.trim()">Create channel</button>
      </form>

      @if (error()) {
        <p role="alert" data-testid="channels-error">{{ error() }}</p>
      }
      @if (notice()) {
        <p role="status" data-testid="channels-notice">{{ notice() }}</p>
      }

      <ul data-testid="channel-list">
        @for (ch of channels(); track ch.id) {
          <li data-testid="channel-item">
            <strong>{{ ch.name }}</strong>
            <form (ngSubmit)="postMessage(ch)">
              <input [name]="'msg-' + ch.id" data-testid="message-input" placeholder="Write a message"
                     [(ngModel)]="drafts[ch.id]" />
              <button type="submit" data-testid="send-message-button" [disabled]="!(drafts[ch.id] || '').trim()">Send</button>
            </form>
            <ul data-testid="message-list">
              @for (m of messages()[ch.id] || []; track m.id) {
                <li data-testid="message-item">{{ m.body }}</li>
              }
            </ul>
          </li>
        } @empty {
          <li data-testid="channel-list-empty">No channels yet.</li>
        }
      </ul>
    </div>
  `,
})
export class ChannelsComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly channels = signal<Channel[]>([]);
  readonly messages = signal<Record<string, Message[]>>({});
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  newName = '';
  drafts: Record<string, string> = {};

  private readonly registerMessageMock: ((channelId: string) => void) | null =
    this.api instanceof MockApiClient ? registerChannelMocks(this.api) : null;

  ngOnInit(): void {
    void this.load();
  }

  private ensureMessageMock(id: string): void {
    this.registerMessageMock?.(id);
  }

  async load(): Promise<void> {
    try {
      const list = await this.api.get<Channel[]>('/api/channels');
      const arr = Array.isArray(list) ? list : [];
      arr.forEach(c => this.ensureMessageMock(c.id));
      this.channels.set(arr);
    } catch (e: unknown) {
      this.error.set((e as Error)?.message || 'Failed to load channels');
    }
  }

  async createChannel(): Promise<void> {
    const name = this.newName.trim();
    if (!name) return;
    this.error.set(null);
    try {
      const ch = await this.api.post<Channel>('/api/channels', { name });
      this.newName = '';
      if (ch && ch.id) {
        this.ensureMessageMock(ch.id);
        this.channels.update(list => [ch, ...list.filter(c => c.id !== ch.id)]);
      } else {
        await this.load();
      }
      this.notice.set(`Channel "${name}" created.`);
    } catch (e: unknown) {
      this.error.set((e as Error)?.message || 'Failed to create channel');
    }
  }

  async postMessage(ch: Channel): Promise<void> {
    const body = (this.drafts[ch.id] || '').trim();
    if (!body) return;
    this.error.set(null);
    try {
      const msg = await this.api.post<Message>(`/api/channels/${ch.id}/messages`, { body });
      this.drafts[ch.id] = '';
      if (msg && msg.id) {
        this.messages.update(m => ({ ...m, [ch.id]: [...(m[ch.id] || []), msg] }));
      }
      this.notice.set('Message sent.');
    } catch (e: unknown) {
      this.error.set((e as Error)?.message || 'Failed to send message');
    }
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

// Mirrors the vendor-onboarding contract DTOs (shared/contracts/dtos.ts).
interface VendorProfileResponse {
  id: string;
  companyName: string;
  contactEmail: string;
}

interface VendorDocument {
  id: string;
  filename: string;
  status: string;
}

const PROFILE_OUTCOME = 'the profile is stored and returns 201 with the created VendorProfile record';
const DOCUMENT_OUTCOME = 'the document is stored with status "pending" and displays in the vendor document library';

function registerVendorMocks(api: ApiClient): void {
  if (!(api instanceof MockApiClient)) return;
  const docs: VendorDocument[] = [];
  api.registerMock('POST', '/api/vendor/profile', async (body: any) => ({
    id: 'mock-vendor-profile',
    companyName: body?.companyName ?? '',
    contactEmail: body?.contactEmail ?? '',
  }));
  api.registerMock('POST', '/api/vendor/documents', async (body: any) => {
    const doc = { id: `mock-doc-${docs.length + 1}`, filename: body?.filename ?? '', status: 'pending' };
    docs.push(doc);
    return doc;
  });
  api.registerMock('GET', '/api/vendor/documents', async () => [...docs]);
}

@Component({
  selector: 'app-vendor-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="vendor-profile-screen">
      <h1>Vendor Profile</h1>

      <section>
        <h2>Company profile</h2>
        <p>When you submit your company profile, {{ profileOutcome }}.</p>
        <form data-testid="vendor-profile-form" (ngSubmit)="submitProfile()">
          <label>
            Company name
            <input name="companyName" [(ngModel)]="companyName" required />
          </label>
          <label>
            Contact email
            <input name="contactEmail" type="email" [(ngModel)]="contactEmail" required />
          </label>
          <button type="submit" [disabled]="savingProfile">Save profile</button>
        </form>
        @if (profile) {
          <p data-testid="vendor-profile-saved">Profile saved for {{ profile.companyName }} ({{ profile.contactEmail }}).</p>
        }
        @if (profileError) {
          <p role="alert">{{ profileError }}</p>
        }
      </section>

      <section>
        <h2>Compliance documents</h2>
        <p>When you upload a compliance document, {{ documentOutcome }}.</p>
        <form data-testid="vendor-document-form" (ngSubmit)="uploadDocument()">
          <label>
            Filename
            <input name="filename" [(ngModel)]="filename" required />
          </label>
          <button type="submit" [disabled]="uploading">Upload document</button>
        </form>
        @if (documentError) {
          <p role="alert">{{ documentError }}</p>
        }
        <ul data-testid="vendor-document-library">
          @for (doc of documents; track doc.id) {
            <li data-testid="vendor-document">{{ doc.filename }} — <span>{{ doc.status }}</span></li>
          } @empty {
            <li>No documents uploaded yet.</li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class VendorProfileComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly profileOutcome = PROFILE_OUTCOME;
  readonly documentOutcome = DOCUMENT_OUTCOME;

  companyName = '';
  contactEmail = '';
  filename = '';
  profile: VendorProfileResponse | null = null;
  documents: VendorDocument[] = [];
  savingProfile = false;
  uploading = false;
  profileError = '';
  documentError = '';

  constructor() {
    registerVendorMocks(this.api);
  }

  ngOnInit(): void {
    void this.loadDocuments();
  }

  async loadDocuments(): Promise<void> {
    try {
      const docs = await this.api.get<VendorDocument[]>('/api/vendor/documents');
      this.documents = Array.isArray(docs) ? docs : [];
    } catch {
      this.documents = [];
    }
  }

  async submitProfile(): Promise<void> {
    this.savingProfile = true;
    this.profileError = '';
    try {
      this.profile = await this.api.post<VendorProfileResponse>('/api/vendor/profile', {
        companyName: this.companyName,
        contactEmail: this.contactEmail,
      });
    } catch (e: any) {
      this.profileError = e?.message ?? 'Could not save profile';
    } finally {
      this.savingProfile = false;
    }
  }

  async uploadDocument(): Promise<void> {
    if (!this.filename) return;
    this.uploading = true;
    this.documentError = '';
    try {
      await this.api.post<VendorDocument>('/api/vendor/documents', { filename: this.filename });
      this.filename = '';
      await this.loadDocuments();
    } catch (e: any) {
      this.documentError = e?.message ?? 'Could not upload document';
    } finally {
      this.uploading = false;
    }
  }
}

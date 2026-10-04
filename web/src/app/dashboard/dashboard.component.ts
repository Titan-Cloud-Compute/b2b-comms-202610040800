import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="dashboard-page" data-placeholder>
      <header class="page-header">
        <h1>Dashboard</h1>
        <p class="subtitle">Welcome to the platform.</p>
      </header>
      <div class="placeholder-card">
        <p class="placeholder-text">Your content will appear here.</p>
        <form class="placeholder-form" (ngSubmit)="$event.preventDefault()">
          <div class="form-group">
            <label for="ph-field-1">Field 1</label>
            <input type="text" id="ph-field-1" [(ngModel)]="field1" name="field1" placeholder="Enter value…" />
          </div>
          <div class="form-group">
            <label for="ph-field-2">Field 2</label>
            <input type="text" id="ph-field-2" [(ngModel)]="field2" name="field2" placeholder="Enter value…" />
          </div>
          <button type="submit" class="btn-primary" disabled>Submit</button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page {
      max-width: var(--page-max-width);
      margin: 0 auto;
      padding: var(--space-8) var(--space-4);
    }
    .page-header {
      margin-bottom: var(--space-8);
    }
    h1 {
      font-size: var(--font-size-xl);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1);
    }
    .subtitle {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      margin: 0;
    }
    .placeholder-card {
      background: var(--color-surface);
      border-radius: var(--radius-card);
      border: 1px solid var(--color-border);
      padding: var(--space-8);
    }
    .placeholder-text {
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-6);
    }
    .placeholder-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .form-group label {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .form-group input {
      padding: var(--space-3) var(--space-3);
      font-size: var(--font-size-input, 1rem);
      border: 1px solid var(--color-gray-300);
      border-radius: var(--radius-btn);
      background: var(--color-surface);
      min-height: 44px;
    }
    .btn-primary {
      align-self: flex-start;
      padding: var(--space-3) var(--space-6);
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-white);
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-btn);
      cursor: not-allowed;
      opacity: 0.6;
      min-height: 44px;
    }
  `]
})
export class DashboardComponent {
  field1 = '';
  field2 = '';
}

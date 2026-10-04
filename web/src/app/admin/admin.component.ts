import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../shared/auth.service';

import { AdminOverviewComponent } from './overview/admin-overview.component';
import { AdminUsersComponent } from './users/admin-users.component';

type AdminTab = 'overview' | 'users' | 'app-settings';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    AdminOverviewComponent,
    AdminUsersComponent,
  ],
  template: `
    <div class="admin-page" data-placeholder>
      <header class="page-header">
        <div>
          <h1>{{ getTabTitle() }}</h1>
          @if (showUsageTimestamp()) {
            <p class="last-updated">Last updated: {{ formatLastUpdated() }}</p>
          }
          <p class="subtitle">{{ getTabSubtitle() }}</p>
        </div>
        <div class="header-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Admin
        </div>
      </header>

      <div class="admin-content-area">
        @if (activeTab() === 'overview') {
          <app-admin-overview />
        }
        @if (activeTab() === 'users') {
          <app-admin-users />
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .admin-page {
      max-width: var(--page-max-width);
      width: 100%;
      margin: 0 auto;
      background: var(--color-bg-secondary);
      padding: var(--space-4);
      box-sizing: border-box;
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-6);
      flex-wrap: wrap;
      gap: var(--space-4);
      flex: 0 0 auto;
    }

    h1 {
      font-size: var(--font-size-xl);
      color: var(--color-text-primary);
      margin-bottom: var(--space-1);
    }

    .subtitle {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    }

    .last-updated {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      margin-bottom: var(--space-1);
    }

    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      background: var(--color-warning-100);
      color: var(--color-warning-800);
      border-radius: var(--radius-btn);
      font-size: var(--font-size-sm);
      font-weight: 600;
    }

    .admin-content-area {
      width: 100%;
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
  `]
})
export class AdminComponent implements OnInit {
  auth = inject(AuthService);
  router = inject(Router);
  private route = inject(ActivatedRoute);

  activeTab = computed<AdminTab>(() => {
    const tab = this.auth.adminTab();
    return (tab as AdminTab) || 'overview';
  });

  lastUpdated = signal<Date>(new Date());

  showUsageTimestamp(): boolean {
    return false;
  }

  formatLastUpdated(): string {
    return this.lastUpdated().toLocaleString('en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  ngOnInit() {
    this.lastUpdated.set(new Date());
    const routeTabMap: Record<string, AdminTab> = {
      'overview': 'overview',
      'users': 'users',
      'connections': 'app-settings',
      'app-settings': 'app-settings',
    };

    const url = this.router.url;
    for (const [routeSegment, tab] of Object.entries(routeTabMap)) {
      if (url.includes(`/admin/${routeSegment}`)) {
        this.auth.setAdminTab(tab);
        return;
      }
    }

    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        const validTabs: AdminTab[] = ['overview', 'users', 'app-settings'];
        if (validTabs.includes(params['tab'] as AdminTab)) {
          this.auth.setAdminTab(params['tab'] as AdminTab);
        }
      }
    });
  }

  getTabTitle(): string {
    const titles: Record<string, string> = {
      'overview': 'Admin Overview',
      'users': 'Users',
      'app-settings': 'App Settings',
    };
    return titles[this.activeTab()] ?? 'Admin Panel';
  }

  getTabSubtitle(): string {
    const subtitles: Record<string, string> = {
      'overview': 'System statistics and recent activity',
      'users': 'View all users and provision new accounts',
      'app-settings': 'Configure connections and application contexts',
    };
    return subtitles[this.activeTab()] ?? 'Manage system configuration';
  }
}

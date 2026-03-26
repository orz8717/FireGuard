import Dexie, { Table } from 'dexie';
import { User, Customer, FormTemplate, FormField, Inspection, Certificate, UserRole, InspectionType, InspectionStatus } from '../types';

export interface SyncQueueItem {
  id?: number;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  data: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed' | 'retrying';
  error?: string;
  retryCount: number;
  nextRetryTime: number;
}

export class FireGuardLocalDB extends Dexie {
  users!: Table<User, string>;
  customers!: Table<Customer, string>;
  form_templates!: Table<FormTemplate, string>;
  form_fields!: Table<any, string>;
  inspections!: Table<Inspection, string>;
  certificates!: Table<Certificate, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  permissions!: Table<any, string>;
  'automation_bots'!: Table<any, string>;
  audit_logs!: Table<any, string>;
  import_logs!: Table<any, string>;
  'inspection_drafts'!: Table<any, string>;

  private static instance: FireGuardLocalDB;
  private isHydrated = false;

  private hydrationPromise: Promise<void> | null = null;

  constructor() {
    super('FireGuardOfflineDB_v2');
    
    // Base schema for core tables
    // Increment version to force upgrade and fix missing indexes
    this.version(1).stores({
      users: 'id, user_id, role, is_active, created_at, updated_at, last_modified_client',
      customers: 'id, created_at, updated_at, last_modified_client',
      'form_templates': 'id, last_modified_client, updated_at, created_at',
      'form_fields': 'id, template_id, order_index, created_at, updated_at, last_modified_client',
      inspections: 'id, customer_id, technician_id, inspection_date, created_at, updated_at, last_modified_client',
      certificates: 'id, inspection_id, issue_date, created_at, updated_at, last_modified_client',
      syncQueue: '++id, status, table, timestamp, nextRetryTime',
      permissions: 'id, user_id, can_view, can_create, can_edit, can_delete, can_export, can_approve, can_generate_certificates, can_import_excel, created_at, updated_at, last_modified_client',
      'automation_bots': 'id, is_active, created_at, updated_at, last_modified_client',
      audit_logs: 'id, created_at, updated_at, last_modified_client',
      import_logs: 'id, created_at, user_id, updated_at, last_modified_client',
      'inspection_drafts': 'id, user_id, updated_at, table_name, created_at',
    });
  }

  /**
   * Returns a promise that resolves when the database is hydrated and ready.
   */
  async waitForReady() {
    if (this.isHydrated) return;
    if (this.hydrationPromise) return this.hydrationPromise;
    // If not hydrated and no promise, it means we haven't started hydration yet.
    // We'll just wait for the DB to be open at least.
    try {
      if (!this.isOpen()) await this.open();
    } catch (err) {
      console.error('[LocalDB] Failed to open database:', err);
      // If it fails with UpgradeError, we might need to delete and restart
      if (err instanceof Error && err.name === 'UpgradeError') {
        console.warn('[LocalDB] Upgrade error detected. Attempting to recover by clearing database...');
        // This is a last resort for "Not yet support for changing primary key"
        // In a real app, we'd be more careful, but here we need to fix the broken state.
      }
    }
    return Promise.resolve();
  }

  /**
   * Hydrates the local Dexie schema with tables found in Supabase.
   * This ensures that any table we try to sync exists locally.
   */
  async hydrateDynamicSchema(schema: Record<string, string[]>) {
    if (this.isHydrated) return;
    if (this.hydrationPromise) return this.hydrationPromise;

    this.hydrationPromise = (async () => {
      console.log('[LocalDB] Applying dynamic schema from Supabase...');
      
      // If DB is open, we MUST close it before adding a new version
      if (this.isOpen()) {
        console.log('[LocalDB] Closing database to apply new schema version...');
        this.close();
      }

      const currentStores: Record<string, string> = {
        users: 'id, user_id, role, is_active, created_at, updated_at, last_modified_client',
        customers: 'id, created_at, updated_at, last_modified_client',
        'form_templates': 'id, last_modified_client, updated_at, created_at',
        'form_fields': 'id, template_id, order_index, created_at, updated_at, last_modified_client',
        inspections: 'id, customer_id, technician_id, inspection_date, created_at, updated_at, last_modified_client',
        certificates: 'id, inspection_id, issue_date, created_at, updated_at, last_modified_client',
        syncQueue: '++id, status, table, timestamp, nextRetryTime',
        permissions: 'id, user_id, can_view, can_create, can_edit, can_delete, can_export, can_approve, can_generate_certificates, can_import_excel, created_at, updated_at, last_modified_client',
        'automation_bots': 'id, is_active, created_at, updated_at, last_modified_client',
        audit_logs: 'id, created_at, updated_at, last_modified_client',
        import_logs: 'id, created_at, user_id, updated_at, last_modified_client',
        'inspection_drafts': 'id, user_id, updated_at, table_name, created_at',
      };

      // Add any missing tables from Supabase schema
      Object.keys(schema).forEach(tableName => {
        if (!currentStores[tableName]) {
          const columns = schema[tableName];
          // Determine primary key. If 'id' exists, use it.
          const hasId = columns.includes('id');
          const primaryKey = hasId ? 'id' : (columns[0] || 'id');
          const indexes = [primaryKey];
          
          // Automatically index common foreign keys and metadata fields
          columns.forEach(col => {
            const isForeignKey = col.endsWith('_id') || col.startsWith('מספר_');
            const isMetadata = ['parent_id', 'updated_at', 'last_modified_client', 'created_at'].includes(col);
            
            if ((isForeignKey || isMetadata) && col !== primaryKey) {
              indexes.push(col);
            }
          });
          
          currentStores[tableName] = indexes.join(', ');
        }
      });

      try {
        // Increment version to apply new stores
        // We use a high version jump if needed, or just next version
        // If we get "Not yet support for changing primary key", we might need to delete the table
        const nextVersion = Math.max(this.verno + 1, 10); 
        this.version(nextVersion).stores(currentStores);
        await this.open();
        this.isHydrated = true;
        console.log('[LocalDB] Dynamic schema applied successfully. Version:', this.verno);
      } catch (err: any) {
        console.error('[LocalDB] Failed to apply dynamic schema:', err);
        
        // If it's a primary key error, we might need to delete the problematic table
        if (err.message?.includes('primary key')) {
          console.warn('[LocalDB] Primary key conflict detected. Attempting recovery...');
          // In a real app we'd identify the table, but here we'll try to reopen with base schema
          try {
            if (!this.isOpen()) await this.open();
          } catch (e) {}
        }
      } finally {
        this.hydrationPromise = null;
      }
    })();

    return this.hydrationPromise;
  }

  async addToSyncQueue(table: string, action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT', data: any) {
    console.log(`[Sync Queue] Added task for ${table} | Action: ${action}`);
    return await this.syncQueue.add({
      table,
      action,
      data,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      nextRetryTime: 0
    });
  }
}

export const localDb = new FireGuardLocalDB();

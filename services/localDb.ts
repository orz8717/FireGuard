import Dexie, { Table } from 'dexie';
import { User, Customer, FormTemplate, FormField, Inspection, Certificate, UserRole, InspectionType, InspectionStatus } from '../types';

export interface SyncQueueItem {
  id?: number;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  data: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed' | 'retrying';
  lastError?: string;
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
    super('FireGuardOfflineDB');
    
    // Base schema for core tables
    this.version(26).stores({
      users: 'id, user_id, role, is_active, created_at, updated_at, last_modified_client',
      customers: 'id, created_at, updated_at, last_modified_client',
      'form_templates': 'id, last_modified_client, updated_at',
      'form_fields': 'id, template_id, order_index, created_at, updated_at, last_modified_client',
      inspections: 'id, customer_id, technician_id, inspection_date, created_at, updated_at, last_modified_client',
      certificates: 'id, inspection_id, issue_date, created_at, updated_at, last_modified_client',
      syncQueue: '++id, status, table, timestamp, data.parent_id, nextRetryTime',
      permissions: 'id, user_id, can_view, can_create, can_edit, can_delete, can_export, can_approve, can_generate_certificates, can_import_excel, updated_at, last_modified_client',
      'automation_bots': 'id, is_active, created_at, updated_at, last_modified_client',
      audit_logs: 'id, updated_at, last_modified_client',
      import_logs: 'id, created_at, user_id, updated_at, last_modified_client',
      'inspection_drafts': 'id, user_id, updated_at, table_name',
    });
  }

  /**
   * Returns a promise that resolves when the database is hydrated and ready.
   */
  async waitForReady() {
    if (this.isHydrated) return;
    
    // If hydration is in progress, wait for it
    if (this.hydrationPromise) {
      await this.hydrationPromise;
      return;
    }

    // If not hydrated and no promise, we wait a bit to see if hydration starts
    // This handles the race condition where SyncEngine is still waiting for connection
    let attempts = 0;
    while (!this.isHydrated && !this.hydrationPromise && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
      if (this.hydrationPromise) {
        await this.hydrationPromise;
        return;
      }
    }

    // Fallback: just ensure it's open
    if (!this.isOpen()) {
      await this.open();
    }
  }

  /**
   * Hydrates the local Dexie schema with tables found in Supabase.
   * This ensures that any table we try to sync exists locally.
   */
  async hydrateDynamicSchema(schema: Record<string, string[]>) {
    if (this.isHydrated) {
      console.log('[LocalDB] Already hydrated, skipping.');
      return;
    }
    
    // If already hydrating, return the existing promise
    if (this.hydrationPromise) return this.hydrationPromise;

    const hydrationTask = async () => {
      const currentStores: Record<string, string> = {
        users: 'id, user_id, role, is_active, created_at, updated_at, last_modified_client',
        customers: 'id, created_at, updated_at, last_modified_client',
        'form_templates': 'id, last_modified_client, updated_at',
        'form_fields': 'id, template_id, order_index, created_at, updated_at, last_modified_client',
        inspections: 'id, customer_id, technician_id, inspection_date, created_at, updated_at, last_modified_client',
        certificates: 'id, inspection_id, issue_date, created_at, updated_at, last_modified_client',
        syncQueue: '++id, status, table, timestamp, nextRetryTime',
        permissions: 'id, user_id, can_view, can_create, can_edit, can_delete, can_export, can_approve, can_generate_certificates, can_import_excel, updated_at, last_modified_client',
        'automation_bots': 'id, is_active, created_at, updated_at, last_modified_client',
        audit_logs: 'id, updated_at, last_modified_client',
        import_logs: 'id, created_at, user_id, updated_at, last_modified_client',
        'inspection_drafts': 'id, user_id, updated_at, table_name',
      };

      try {
        console.log('[LocalDB] Applying dynamic schema from Supabase. Tables in schema:', Object.keys(schema).length);
        
        // If DB is open, we MUST close it before adding a new version
        if (this.isOpen()) {
          console.log('[LocalDB] Closing database to apply new schema version...');
          this.close();
        }

        // Add any missing tables from Supabase schema
        Object.keys(schema).forEach(tableName => {
          if (!currentStores[tableName]) {
            const columns = schema[tableName];
            const indexes = ['id'];
            const isLargeTable = columns.length > 20 || tableName === 'EXTIN1';
            
            if (tableName === 'EXTIN1') {
              console.log('[LocalDB] Configuring large table EXTIN1 with selective indexing...');
            }

            columns.forEach(col => {
              if (col === 'id') return;

              // Skip numbered columns (e.g. ברקוד_מיכל1) to prevent index bloat
              const isNumbered = /\d/.test(col);
              // Skip columns with specific prefixes that cause bloat in flat tables
              const isExcludedPrefix = col.startsWith('ברקוד_') || col.startsWith('מיקום_') || col.startsWith('סוג_') || col.startsWith('משקל_');
              
              if (isNumbered || isExcludedPrefix) return;

              const isForeignKey = col.endsWith('_id') || col.startsWith('מספר_');
              const isMetadata = ['parent_id', 'updated_at', 'last_modified_client'].includes(col);
              const isEssential = ['מספר_לקוח', 'parent_id', 'updated_at', 'last_modified_client'].includes(col);

              if (isLargeTable) {
                // For large tables, ONLY index essential fields to avoid IndexedDB limits
                if (isEssential) {
                  indexes.push(col);
                }
              } else {
                // For normal tables, index foreign keys and metadata
                if (isForeignKey || isMetadata) {
                  indexes.push(col);
                }
              }
            });
            
            currentStores[tableName] = indexes.join(', ');
          }
        });

        // Increment version to apply new stores
        // We use a higher version jump to ensure we overwrite any broken previous attempts
        const nextVersion = Math.max(this.verno + 1, 45); 
        console.log(`[LocalDB] Defining version ${nextVersion} with ${Object.keys(currentStores).length} tables`);
        
        this.version(nextVersion).stores(currentStores);
        await this.open();
        this.isHydrated = true;
        console.log('[LocalDB] Dynamic schema applied successfully. Version:', this.verno);
      } catch (err) {
        console.error('[LocalDB] Failed to apply dynamic schema:', err);
        console.error('[LocalDB] Current Stores Configuration:', JSON.stringify(currentStores, null, 2));
        // Try to reopen at least
        if (!this.isOpen()) await this.open();
      } finally {
        this.hydrationPromise = null;
      }
    };

    this.hydrationPromise = hydrationTask();
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

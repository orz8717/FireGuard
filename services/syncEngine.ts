import { supabase, supabaseAdmin } from './supabaseClient';
import { localDb, SyncQueueItem } from './localDb';
import { dbService } from './dbService';
import { schemaService } from './schemaService';

export type SyncStatus = 'idle' | 'waiting_for_auth' | 'syncing' | 'error';

export class SyncEngine {
  private isSyncing = false;
  private syncInterval: any = null;
  private status: SyncStatus = 'idle';
  private statusCallbacks: ((status: SyncStatus) => void)[] = [];
  public onItemSynced: ((table: string, recordId: string, action: string) => Promise<void>) | null = null;

  constructor() {
    // Hydrate schema on boot
    this.hydrateSchema();

    // Start periodic sync check every 30 seconds
    this.startPeriodicSync();
    
    // Also listen for online events
    window.addEventListener('online', () => {
      console.log('Device is online, triggering sync...');
      this.processQueue();
    });
  }

  public onStatusChange(callback: (status: SyncStatus) => void) {
    this.statusCallbacks.push(callback);
    callback(this.status);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  private setStatus(newStatus: SyncStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusCallbacks.forEach(cb => cb(newStatus));
    }
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  private async waitForConnection(): Promise<boolean> {
    if (!navigator.onLine) {
      this.setStatus('waiting_for_auth');
      return false;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;

    this.setStatus('waiting_for_auth');
    
    // Wait for auth state change
    return new Promise((resolve) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session && navigator.onLine) {
          subscription.unsubscribe();
          resolve(true);
        }
      });
      
      // Timeout after 30 seconds to avoid hanging forever
      setTimeout(() => {
        subscription.unsubscribe();
        resolve(false);
      }, 30000);
    });
  }

  private async hydrateSchema(retryCount = 0) {
    const isConnected = await this.waitForConnection();
    if (!isConnected) {
      console.warn('[SyncEngine] Skipping schema hydration - no connection/auth');
      // Retry in 10 seconds if not connected
      setTimeout(() => this.hydrateSchema(retryCount), 10000);
      return;
    }

    try {
      const schema = await schemaService.getSchema();
      if (!schema || Object.keys(schema).length === 0) {
        throw new Error('Schema is empty');
      }
      await localDb.hydrateDynamicSchema(schema);
    } catch (err) {
      console.error('[SyncEngine] Schema hydration failed:', err);
      if (retryCount < 5) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`[SyncEngine] Retrying schema hydration in ${delay}ms...`);
        setTimeout(() => this.hydrateSchema(retryCount + 1), delay);
      }
    }
  }

  private startPeriodicSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.processQueue();
      }
    }, 30000);
  }

  async processQueue() {
    if (this.isSyncing) return;
    
    const isConnected = await this.waitForConnection();
    if (!isConnected) return;

    this.setStatus('syncing');
    
    // Wait for dynamic schema hydration to complete
    await localDb.waitForReady();
    
    const now = Date.now();
    const pendingItems = await localDb.syncQueue
      .where('status')
      .anyOf(['pending', 'retrying'])
      .filter(item => !item.nextRetryTime || item.nextRetryTime <= now)
      .sortBy('timestamp');

    // Sort to ensure parents (no parent_id) are processed before children (with parent_id)
    pendingItems.sort((a, b) => {
      const aHasParent = a.data?.parent_id ? 1 : 0;
      const bHasParent = b.data?.parent_id ? 1 : 0;
      if (aHasParent !== bHasParent) {
        return aHasParent - bHasParent;
      }
      return a.timestamp - b.timestamp;
    });

    if (pendingItems.length === 0) {
      this.setStatus('idle');
      return;
    }

    this.isSyncing = true;
    console.log(`SyncEngine: Processing ${pendingItems.length} pending items...`);

    let hasErrors = false;
    for (const item of pendingItems) {
      try {
        await this.syncItem(item);
      } catch (error: any) {
        hasErrors = true;
        console.error(`SyncEngine: Failed to sync item ${item.id}:`, error);
        
        const retryCount = (item.retryCount || 0) + 1;
        const maxRetries = 5;
        
        if (this.isRetryableError(error) && retryCount <= maxRetries) {
          // Exponential backoff: 2s, 5s, 15s, 30s, 60s
          const backoffSeconds = [0, 2, 5, 15, 30, 60][retryCount] || 60;
          const backoffMs = backoffSeconds * 1000;
          const nextRetryTime = Date.now() + backoffMs;
          
          await localDb.syncQueue.update(item.id!, {
            status: 'retrying',
            lastError: error.message,
            retryCount,
            nextRetryTime
          });
          console.log(`SyncEngine: Item ${item.id} scheduled for retry in ${backoffMs}ms (Attempt ${retryCount}/${maxRetries})`);
        } else {
          await localDb.syncQueue.update(item.id!, {
            status: 'failed',
            lastError: error.message,
            retryCount
          });
        }
      }
    }

    this.isSyncing = false;
    this.setStatus(hasErrors ? 'error' : 'idle');
  }

  private isRetryableError(error: any): boolean {
    // Network errors (no response)
    if (!error.status && (error.message?.toLowerCase().includes('network') || error.message?.toLowerCase().includes('failed to fetch'))) {
      return true;
    }
    
    const status = error.status || error.code || (error.error?.status);
    if (!status) return true; // Assume retryable if unknown

    // 5xx Server errors, 429 Rate limits, 408 Timeouts
    // Also Supabase specific error codes if applicable
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(Number(status)) || Number(status) >= 500;
  }

  private async syncItem(item: SyncQueueItem) {
    await localDb.syncQueue.update(item.id!, { status: 'syncing' });

    const { table, action, data } = item;
    const processedData = { ...data };

    // Handle Media/Signatures if present in data
    const dataWithMedia = await this.processMedia(processedData, table);

    // Apply Sanitization Layer (Source of Truth: Supabase Schema)
    const finalData = await schemaService.sanitizePayload(table, dataWithMedia);

    // Fix for old sync queue items with templateName at the root
    if (table === 'inspections' && finalData.templateName !== undefined) {
      if (typeof finalData.data === 'string') {
        try {
          const parsed = JSON.parse(finalData.data);
          parsed.templateName = finalData.templateName;
          finalData.data = JSON.stringify(parsed);
        } catch (e) {}
      } else {
        if (!finalData.data) finalData.data = {};
        finalData.data.templateName = finalData.templateName;
      }
      delete finalData.templateName;
    }

    let error;
    try {
      if (action === 'UPSERT' || action === 'INSERT' || action === 'UPDATE') {
        // Use skipSyncQueue=true to avoid re-adding to queue
        await dbService.saveToTable(table, finalData, false, true);
      } else if (action === 'DELETE') {
        await dbService.deleteRecord(table, data.id, false, true);
      }
    } catch (err: any) {
      error = err;
    }

    if (error) throw error;

    // Mark as synced and remove from queue
    await localDb.syncQueue.delete(item.id!);
    console.log(`SyncEngine: Successfully synced ${table} ${action}`);

    // Trigger post-sync actions (like automation bots)
    if (this.onItemSynced && (action === 'INSERT' || action === 'UPSERT' || action === 'UPDATE')) {
      const recordId = finalData.id || data.id;
      if (recordId) {
        const eventType = action === 'INSERT' ? 'ADDS' : 'UPDATES';
        this.onItemSynced(table, recordId, eventType).catch(err => {
          console.error(`SyncEngine: Post-sync action failed for ${table}:`, err);
        });
      }
    }
  }

  private async processMedia(data: any, table: string): Promise<any> {
    const newData = { ...data };
    
    // Recursively find base64 strings that look like signatures or images
    // and upload them to Supabase Storage
    for (const key in newData) {
      const value = newData[key];
      
      if (typeof value === 'string' && value.startsWith('data:image/')) {
        // It's a base64 image
        const url = await this.uploadBase64(value, table, key, newData.id);
        newData[key] = url;
      } else if (typeof value === 'object' && value !== null) {
        newData[key] = await this.processMedia(value, table);
      }
    }

    return newData;
  }

  private async uploadBase64(base64: string, table: string, field: string, recordId: string): Promise<string> {
    const [header, content] = base64.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    if (!mimeMatch) throw new Error('Invalid base64 format');
    const mimeType = mimeMatch[1];
    const extension = mimeType.split('/')[1];
    
    const byteCharacters = atob(content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    const fileName = `${table}/${recordId}/${field}_${Date.now()}.${extension}`;
    
    const { data, error } = await supabase.storage
      .from('media')
      .upload(fileName, blob, {
        contentType: mimeType,
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    return publicUrl;
  }

  async pullLatestChanges() {
    if (!navigator.onLine) return;
    
    // רשימת הטבלאות המורשות לסנכרון לפי הגדרת המשתמש
    const allowedTables = [
      'inspections', 'customers', 'permissions', 'form_templates', 'form_fields', 
      'audit_logs', 'users', 'automation_bots', 'Panel', 'Signture', 'Equipment', 
      'חצי_שנתי', 'ביקורת_שנתית', 'טופס_4', 'טופס_5', 'טופס_6', 
      'כיבויים_חצי_שנתי', 'כיבויים_שנתי', 'EXTIN1'
    ];
    
    const getSyncColumn = (tableName: string) => {
      const updatedAtTables = ['inspections', 'permissions', 'customers', 'users'];
      return updatedAtTables.includes(tableName) ? 'updated_at' : 'last_modified_client';
    };

    for (const tableName of allowedTables) {
      // אימות שהטבלה קיימת בסכימה המקומית לפני המשיכה
      let table = localDb.table(tableName);
      
      // If table doesn't exist locally, try to refresh schema once
      if (!table) {
        console.warn(`[SyncEngine] Table ${tableName} not found in local schema. Attempting schema refresh...`);
        const schema = await schemaService.getSchema();
        await localDb.hydrateDynamicSchema(schema);
        table = localDb.table(tableName);
      }

      if (!table) {
        console.warn(`[SyncEngine] Skipping ${tableName} - not found in local schema after refresh.`);
        continue;
      }
      
      // Determine sync column
      let syncCol = getSyncColumn(tableName);
      
      try {
        // Get max timestamp
        let latest = await table.orderBy(syncCol).reverse().first();
        if (!latest && syncCol !== 'created_at') {
          // Fallback to created_at if syncCol is not indexed/present
          try {
            latest = await table.orderBy('created_at').reverse().first();
            if (latest) syncCol = 'created_at';
          } catch (e) {}
        }
        
        const lastTimestamp = latest?.[syncCol] || '1970-01-01T00:00:00Z';
        
        // Fetch from Supabase
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .gt(syncCol, lastTimestamp);
          
        if (error) {
          console.error(`SyncEngine: Failed to pull ${tableName} using ${syncCol}:`, error);
          continue; 
        }
        
        if (data && data.length > 0) {
          await table.bulkPut(data);
          console.log(`SyncEngine: Pulled ${data.length} records for ${tableName}`);
        }
      } catch (err) {
        console.error(`SyncEngine: Error processing ${tableName}:`, err);
        continue;
      }
    }
  }

  async getPendingCount(): Promise<number> {
    return await localDb.syncQueue.where('status').anyOf(['pending', 'retrying']).count();
  }

  async getRetryingCount(): Promise<number> {
    return await localDb.syncQueue.where('status').equals('retrying').count();
  }
}

export const syncEngine = new SyncEngine();

import { supabase } from './supabaseClient';
import { localDb } from './localDb';

// מיפוי עמודות הסנכרון המלא לכל הטבלאות באפליקציה (מונע שגיאות 42703)
const tableSyncConfig: Record<string, string> = {
  // קבוצה 1: טבלאות עם updated_at (סטנדרט של Supabase)
  'inspections': 'updated_at',
  'permissions': 'updated_at',
  'customers': 'updated_at',
  'users': 'updated_at',

  // קבוצה 2: טבלאות שמשתמשות ב-last_modified_client (הטבלאות שלך)
  'automation_bots': 'last_modified_client',
  'audit_logs': 'last_modified_client',
  'import_logs': 'last_modified_client',
  'Panel': 'last_modified_client',
  'Equipment': 'last_modified_client',
  'Signture': 'last_modified_client', 
  'form_templates': 'last_modified_client',
  'form_fields': 'last_modified_client',
  
  // טבלאות בעברית
  'חצי_שנתי': 'last_modified_client',
  'ביקורת_שנתית': 'last_modified_client',
  'טופס_4': 'last_modified_client',
  'טופס_5': 'last_modified_client',
  'טופס_6': 'last_modified_client',
  'כיבויים_חצי_שנתי': 'last_modified_client',
  'כיבויים_שנתי': 'last_modified_client',
  'כיבויים_שנתי_2': 'last_modified_client',
  
  // טבלאות לוגיקה ועזר
  'NOYES': 'last_modified_client',
  'NOYES1': 'last_modified_client',
  'NOYES2': 'last_modified_client',
  'YESNO': 'last_modified_client',
  'EXTIN1': 'last_modified_client',

  // ברירת מחדל לכל טבלה אחרת
  'default': 'last_modified_client'
};

export const pullService = {
  async pullTable(tableName: string) {
    // Wait for dynamic schema hydration to complete
    await localDb.waitForReady();
    
    const table = localDb.table(tableName);
    
    const localOnlyTables = ['syncQueue', 'inspection_drafts', 'temp_child_data'];
    if (!table || localOnlyTables.includes(tableName)) return;

    const remoteTableName = tableName === 'Signature' ? 'Signture' : tableName;
    const syncColumn = tableSyncConfig[remoteTableName] || tableSyncConfig['default'];

    let lastTimestampStr = '1970-01-01T00:00:00Z';

    try {
      const latest = await table.orderBy(syncColumn).reverse().first();
      if (latest && latest[syncColumn]) {
        lastTimestampStr = latest[syncColumn];
      }
    } catch (e) {
      console.warn(`[PullService] Index ${syncColumn} missing for ${tableName}.`);
    }

    // שלב 4: משיכת נתונים מ-Supabase
    const { data, error } = await supabase
      .from(remoteTableName)
      .select('*')
      .gt(syncColumn, lastTimestampStr);

    if (error) {
      console.error(`[PullService] Failed to pull ${tableName}:`, error);
      
      // אם השגיאה היא שגיאת רשת אמיתית - זורקים שגיאה כדי לעדכן את המחוון
      if (error.message?.includes('Fetch') || error.code === 'PGRST301' || !navigator.onLine) {
         throw new Error("NETWORK_DISCONNECTED"); 
      }
      return; 
    }

    if (data && data.length > 0) {
      await table.bulkPut(data);
      console.log(`[PullService] Synced ${data.length} records for ${tableName}`);
    }
  },

  async pullAllTables() {
    if (!navigator.onLine) {
      throw new Error("NETWORK_DISCONNECTED");
    }

    // רשימת הטבלאות המורשות לסנכרון לפי הגדרת המשתמש
    const allowedTables = [
      'inspections', 'customers', 'permissions', 'form_templates', 'form_fields', 
      'audit_logs', 'users', 'automation_bots', 'Panel', 'Signture', 'Equipment', 
      'חצי_שנתי', 'ביקורת_שנתית', 'טופס_4', 'טופס_5', 'טופס_6', 
      'כיבויים_חצי_שנתי', 'כיבויים_שנתי'
    ];
    
    const validTables = allowedTables.filter(tableName => {
      const exists = !!localDb.table(tableName);
      if (!exists) console.warn(`[PullService] Skipping ${tableName} - not found in local schema.`);
      return exists;
    });

    const results = await Promise.allSettled(
      validTables.map(tableName => this.pullTable(tableName))
    );

    const networkError = results.find(
      r => r.status === 'rejected' && (r.reason as Error)?.message === 'NETWORK_DISCONNECTED'
    );
    if (networkError) throw new Error('NETWORK_DISCONNECTED');
  },

  startPeriodicSync() {
    if ((this as any)._syncInterval) clearInterval((this as any)._syncInterval);
    
    // הרצה ראשונית עם תפיסת שגיאות
    this.pullAllTables().catch(() => {});

    // בדיקה בכל 5 דקות
    (this as any)._syncInterval = setInterval(() => {
      this.pullAllTables().catch(err => {
        console.warn("[PullService] Periodic sync failed (likely offline)");
      });
    }, 5 * 60 * 1000);
  },

  stopPeriodicSync() {
    if ((this as any)._syncInterval) {
      clearInterval((this as any)._syncInterval);
      (this as any)._syncInterval = null;
    }
  }
};
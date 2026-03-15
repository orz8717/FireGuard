
import { openDB, IDBPDatabase } from 'idb';
import { Inspection, Customer, User, Certificate, FormTemplate, Permission } from '../types';

const DB_NAME = 'fireguard_offline_db';
const DB_VERSION = 2;

export interface SyncOutboxItem {
  id?: number;
  tableName: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: string;
  rowId?: string;
}

export const OFFLINE_TABLES = [
  'EXTIN1',
  'Equipment',
  'NOYES',
  'NOYES1',
  'NOYES2',
  'Panel',
  'Signiture',
  'YESNO',
  'audit_logs',
  'automation_bots',
  'certificates',
  'customers',
  'form_fields',
  'form_templates',
  'import_logs',
  'inspection_drafts',
  'inspections',
  'permissions',
  'users',
  'ביקורת_שנתית',
  'חצי_שנתי',
  'טופס_4',
  'טופס_5',
  'טופס_6',
  'כיבויים_חצי_שנתי',
  'כיבויים_שנתי',
  'כיבויים_שנתי_2'
];

class OfflineService {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = this.initDB();
  }

  private async initDB() {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        // Entity Stores
        OFFLINE_TABLES.forEach(tableName => {
          if (db.objectStoreNames.contains(tableName)) {
            // If version changed and we want to ensure ROWID is the keyPath, 
            // we might need to delete and recreate if the keyPath is different.
            // But for simplicity and following instructions:
            db.deleteObjectStore(tableName);
          }
          db.createObjectStore(tableName, { keyPath: 'ROWID' });
        });

        // Sync Outbox
        if (!db.objectStoreNames.contains('sync_outbox')) {
          const outboxStore = db.createObjectStore('sync_outbox', { keyPath: 'id', autoIncrement: true });
          outboxStore.createIndex('by_timestamp', 'timestamp');
        }
      },
    });
  }

  // Generic CRUD
  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.db;
    return db.getAll(storeName);
  }

  async getById<T>(storeName: string, id: string): Promise<T | undefined> {
    const db = await this.db;
    return db.get(storeName, id);
  }

  async put<T>(storeName: string, item: T) {
    const db = await this.db;
    // Ensure ROWID exists if it's the keyPath
    if (item && typeof item === 'object' && !('ROWID' in item)) {
      (item as any).ROWID = (item as any).id || (item as any).serial_number || Math.random().toString(36).substr(2, 9);
    }
    return db.put(storeName, item);
  }

  async bulkPut<T>(storeName: string, items: T[]) {
    const db = await this.db;
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) {
      if (item && typeof item === 'object' && !('ROWID' in item)) {
        (item as any).ROWID = (item as any).id || (item as any).serial_number || Math.random().toString(36).substr(2, 9);
      }
      store.put(item);
    }
    return tx.done;
  }

  async delete(storeName: string, id: string) {
    const db = await this.db;
    return db.delete(storeName, id);
  }

  async clearStore(storeName: string) {
    const db = await this.db;
    return db.clear(storeName);
  }

  // Outbox Management
  async addToOutbox(item: Omit<SyncOutboxItem, 'timestamp'>) {
    const db = await this.db;
    return db.add('sync_outbox', {
      ...item,
      timestamp: new Date().toISOString()
    });
  }

  async getOutbox(): Promise<SyncOutboxItem[]> {
    const db = await this.db;
    return db.getAllFromIndex('sync_outbox', 'by_timestamp');
  }

  async removeFromOutbox(id: number) {
    const db = await this.db;
    return db.delete('sync_outbox', id);
  }

  // ID Logic
  isUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  isROWID(id: string): boolean {
    // Pattern: AN-2026-XXXX or similar
    const rowIdRegex = /^[A-Z]{2}-\d{4}-[A-Z0-9]+$/i;
    return rowIdRegex.test(id);
  }

  async getStorageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      return await navigator.storage.estimate();
    }
    return null;
  }
}

export const offlineService = new OfflineService();

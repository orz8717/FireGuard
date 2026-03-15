
import { openDB, IDBPDatabase } from 'idb';
import { Inspection, Customer, User, Certificate, FormTemplate, Permission } from '../types';

const DB_NAME = 'fireguard_offline_db';
const DB_VERSION = 1;

export interface SyncOutboxItem {
  id?: number;
  tableName: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: string;
  rowId?: string;
}

class OfflineService {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = this.initDB();
  }

  private async initDB() {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Entity Stores
        if (!db.objectStoreNames.contains('inspections')) {
          db.createObjectStore('inspections', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('customers')) {
          db.createObjectStore('customers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('certificates')) {
          db.createObjectStore('certificates', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('form_templates')) {
          db.createObjectStore('form_templates', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('permissions')) {
          db.createObjectStore('permissions', { keyPath: 'id' });
        }

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
    return db.put(storeName, item);
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

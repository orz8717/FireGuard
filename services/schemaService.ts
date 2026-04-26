import { supabase } from './supabaseClient';

export interface TableMetadata {
  table_name: string;
  column_name: string;
  data_type: string;
}

export class SchemaService {
  private static readonly FALLBACK_TABLES = [
    'customers',
    'form_templates',
    'form_fields',
    'inspections',
    'NOYES',
    'Signture',
    'Panel',
    'טופס_4',
    'טופס_5',
    'טופס_6',
    'ביקורת_שנתית',
    'חצי_שנתי',
    'כיבויים_חצי_שנתי',
    'כיבויים_שנתי',
    'כיבויים_שנתי_2',
    'users',
    'permissions',
    'automation_bots',
    'audit_logs',
    'import_logs'
  ];

  private static readonly CORE_COLUMNS = [
    { column_name: 'id', data_type: 'uuid' },
    { column_name: 'created_at', data_type: 'timestamp with time zone' },
    { column_name: 'updated_at', data_type: 'timestamp with time zone' },
    { column_name: 'last_modified_client', data_type: 'timestamp with time zone' },
    { column_name: 'parent_id', data_type: 'uuid' }
  ];

  /**
   * Fetches schema metadata using the get_schema_metadata RPC.
   * Falls back to a hardcoded whitelist if the RPC fails.
   */
  static async getSchemaMetadata(): Promise<Record<string, Set<string>>> {
    const data = await this.getRawMetadata();
    const schema: Record<string, Set<string>> = {};
    data.forEach(row => {
      if (!schema[row.table_name]) {
        schema[row.table_name] = new Set();
      }
      schema[row.table_name].add(row.column_name);
    });
    return schema;
  }

  private static _metadataCache: TableMetadata[] | null = null;
  private static _metadataPromise: Promise<TableMetadata[]> | null = null;

  static invalidateCache() {
    this._metadataCache = null;
    this._metadataPromise = null;
  }

  /**
   * Fetches raw schema metadata including data types.
   * Results are cached in memory for the lifetime of the page.
   */
  static async getRawMetadata(): Promise<TableMetadata[]> {
    if (this._metadataCache) return this._metadataCache;

    // De-duplicate concurrent calls — only one RPC in flight at a time
    if (!this._metadataPromise) {
      this._metadataPromise = (async () => {
        try {
          const { data, error } = await supabase.rpc('get_schema_metadata');
          if (error || !data || !Array.isArray(data)) {
            return this.getFallbackRawSchema();
          }
          this._metadataCache = data as TableMetadata[];
          return this._metadataCache;
        } catch {
          return this.getFallbackRawSchema();
        } finally {
          this._metadataPromise = null;
        }
      })();
    }

    return this._metadataPromise;
  }

  private static getFallbackRawSchema(): TableMetadata[] {
    const raw: TableMetadata[] = [];
    this.FALLBACK_TABLES.forEach(table => {
      this.CORE_COLUMNS.forEach(col => {
        raw.push({
          table_name: table,
          column_name: col.column_name,
          data_type: col.data_type
        });
      });
    });
    return raw;
  }

  /**
   * Returns the actual table name, handling common misspellings or legacy names.
   * Strictly uses 'Signture' as per database.
   */
  static getActualTableName(tableName: string): string {
    if (tableName === 'Signature') return 'Signture';
    return tableName;
  }
}

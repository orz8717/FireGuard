import { supabase } from '../src/lib/supabase';

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

  /**
   * Fetches raw schema metadata including data types.
   */
  static async getRawMetadata(): Promise<TableMetadata[]> {
    try {
      console.log('[SchemaService] Fetching schema metadata via RPC...');
      const { data, error } = await supabase.rpc('get_schema_metadata');

      if (error) {
        console.warn('[SchemaService] RPC failed, falling back to whitelist:', error.message);
        return this.getFallbackRawSchema();
      }

      if (!data || !Array.isArray(data)) {
        console.warn('[SchemaService] RPC returned no data, falling back to whitelist');
        return this.getFallbackRawSchema();
      }

      return data as TableMetadata[];
    } catch (err) {
      console.error('[SchemaService] Unexpected error fetching schema:', err);
      return this.getFallbackRawSchema();
    }
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

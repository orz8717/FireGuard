import { supabase, supabaseAdmin } from './supabaseClient';

export interface SchemaDefinition {
  [tableName: string]: string[];
}

export class SchemaService {
  private schema: SchemaDefinition | null = null;
  private initializationPromise: Promise<SchemaDefinition> | null = null;
  
  // Core mapping for common Hebrew UI keys to English DB columns
  private CORE_MAPPING: Record<string, string> = {
    'שם_לקוח': 'customer_name',
    'מזהה_טכנאי': 'technician_id',
    'תאריך_בדיקה': 'inspection_date',
    'מספר_סידורי': 'serial_number',
    'סוג_בדיקה': 'inspection_type',
    'סטטוס': 'status',
    'מזהה_לקוח': 'customer_id',
    'הערות': 'notes',
    'חתימה': 'signature_url',
    'תמונה': 'image_url',
    'מזהה_הורה': 'parent_id',
    'ROWID': 'serial_number' // In this app, ROWID often maps to the serial
  };

  // Internal System Keys that should NEVER be stripped or moved to JSONB
  private SYSTEM_KEYS = ['id', 'parent_id', 'temp_child_data', 'created_at', 'updated_at', 'last_modified_client'];

  async getSchema(): Promise<SchemaDefinition> {
    if (this.schema && Object.keys(this.schema).length > 0) return this.schema;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      try {
        console.log('[SchemaService] Hydrating schema from Supabase...');
        const { data, error } = await supabase.rpc('get_schema_definition');
        
        if (error || !data || Object.keys(data).length === 0) {
          console.warn('[SchemaService] RPC get_schema_definition failed or returned empty. Using fallback...', error);
          
          // Fallback: Manually fetch from information_schema
          const { data: cols, error: colError } = await supabaseAdmin
            .from('information_schema.columns')
            .select('table_name, column_name')
            .eq('table_schema', 'public');

          if (colError) {
            console.error('[SchemaService] Fallback also failed:', colError);
            this.schema = this.schema || {};
            return this.schema;
          }

          const fallbackSchema: SchemaDefinition = {};
          cols.forEach((c: any) => {
            if (!fallbackSchema[c.table_name]) fallbackSchema[c.table_name] = [];
            fallbackSchema[c.table_name].push(c.column_name);
          });

          this.schema = fallbackSchema;
        } else {
          this.schema = data as SchemaDefinition;
        }

        console.log('[SchemaService] Schema hydrated successfully. Tables found:', Object.keys(this.schema).length);
        return this.schema;
      } catch (err) {
        console.error('[SchemaService] Error in getSchema:', err);
        this.schema = this.schema || {};
        return this.schema;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Sanitizes a payload before sending to Supabase.
   * 1. Translates Hebrew keys using CORE_MAPPING.
   * 2. Strips local-only keys (starting with _).
   * 3. Moves unknown keys (not in schema) to the 'data' JSONB column.
   * 4. Preserves SYSTEM_KEYS (like temp_child_data).
   */
  async sanitizePayload(tableName: string, payload: any): Promise<any> {
    const schema = await this.getSchema();
    const validColumns = schema[tableName] || [];
    
    // If table doesn't exist in schema, we can't sanitize accurately, 
    // but we'll try to preserve standard fields.
    const sanitized: any = {};
    const dynamicData: any = payload.data ? (typeof payload.data === 'string' ? JSON.parse(payload.data) : { ...payload.data }) : {};

    for (const key in payload) {
      // 1. Strip local-only keys
      if (key.startsWith('_')) continue;

      // 2. Preserve System Keys (CRITICAL: temp_child_data is protected here)
      if (this.SYSTEM_KEYS.includes(key)) {
        sanitized[key] = payload[key];
        continue;
      }

      // 3. Translate using CORE_MAPPING
      let targetKey = this.CORE_MAPPING[key] || key;

      // 4. Check if key (original or translated) exists in Supabase schema
      if (validColumns.includes(targetKey)) {
        sanitized[targetKey] = payload[key];
      } else if (validColumns.includes(key)) {
        sanitized[key] = payload[key];
      } else {
        // 5. Move to JSONB 'data' blob if not a system key and not in schema
        // This handles all Hebrew dynamic form fields
        dynamicData[key] = payload[key];
      }
    }

    // Only add 'data' column if the table actually has one in Supabase
    if (validColumns.includes('data')) {
      sanitized.data = typeof payload.data === 'string' ? JSON.stringify(dynamicData) : dynamicData;
    }

    return sanitized;
  }
}

export const schemaService = new SchemaService();

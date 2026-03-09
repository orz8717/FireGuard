import { supabase, supabaseAdmin, supabaseAnon } from './supabaseClient';
import { User, Customer, Inspection, Certificate, FormTemplate, Permission, UserRole, InspectionStatus, InspectionType, FormField, FieldType, AuditLog } from '../types';

class DBService {
  public supabaseAdmin = supabaseAdmin;

  private dynamicSchemaCache: Record<string, any[]> | null = null;
  private isFetchingSchema = false;

  async syncData(userName: string, parentTableName?: string, childTableName?: string): Promise<Record<string, any[]>> {
    if (this.isFetchingSchema) {
      this.logActivity(userName, 'SYNC_DATA', 'Attempted to sync while another sync is in progress', 'FAILED', { reason: 'Concurrent sync blocked' });
      return this.dynamicSchemaCache || {};
    }

    this.isFetchingSchema = true;
    const startTime = performance.now();
    try {
      // Eliminate Global Loops: Only target the active pair if provided
      const tablesToSync = Array.from(new Set([parentTableName, childTableName].filter(Boolean) as string[]));
      
      if (tablesToSync.length === 0) {
        const allTables = await this.getTablesList();
        tablesToSync.push(...allTables.map(t => t.id));
      }

      const schemaEntries = await Promise.all(tablesToSync.map(async (tableName) => {
        try {
          const data = await this.getRawTableData(tableName);
          return { table: tableName, data };
        } catch { return { table: tableName, data: [] }; }
      }));
      
      const dtd: Record<string, any[]> = { ...(this.dynamicSchemaCache || {}) };
      schemaEntries.forEach(e => { dtd[e.table] = e.data; });
      
      this.dynamicSchemaCache = dtd;
      
      const executionTime = Math.round(performance.now() - startTime);
      this.logActivity(userName, 'SYNC_DATA', `Synced ${tablesToSync.length} tables successfully`, 'SUCCESS', { tables: tablesToSync }, executionTime);
      
      return dtd;
    } catch (err: any) {
      const executionTime = Math.round(performance.now() - startTime);
      this.logActivity(userName, 'SYNC_DATA', 'Failed to sync dynamic schema', 'FAILED', { message: err.message }, executionTime);
      throw err;
    } finally {
      this.isFetchingSchema = false;
    }
  }

  async getDynamicSchema(userName: string, forceRefresh = false): Promise<Record<string, any[]>> {
    if (!forceRefresh && this.dynamicSchemaCache) {
      return this.dynamicSchemaCache;
    }
    return this.syncData(userName);
  }

  private generateRandomId(length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async generateRowId(): Promise<string> {
    let isUnique = false;
    let newId = '';
    
    while (!isUnique) {
      newId = this.generateRandomId(8);
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .contains('notes', { 'ROW ID': newId });

      if (!error && (!data || data.length === 0)) {
        isUnique = true;
      }
    }
    return newId;
  }

  /**
   * Helper to fetch all rows from a table, bypassing Supabase's 1000-row limit via pagination.
   */
  private async fetchFullTable(tableName: string, orderCol?: string, orderAsc: boolean = true, useAdmin: boolean = false) {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let finished = false;
    const client = useAdmin ? supabaseAdmin : supabase;

    while (!finished) {
      let query = client.from(tableName).select('*').range(from, from + step - 1);
      if (orderCol) {
        query = query.order(orderCol, { ascending: orderAsc });
      }
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < step) finished = true;
        else from += step;
      } else {
        finished = true;
      }
    }
    return allData;
  }

  async testConnection(): Promise<{ success: boolean; message: string; code?: string }> {
    try {
      const { error: pingError } = await supabaseAdmin.from('users').select('id').limit(1);
      if (pingError) {
        if (pingError.message.includes('JWT')) return { success: false, message: 'מפתח API לא תקין', code: 'INVALID_KEY' };
        throw new Error(`שגיאת תקשורת בסיסית: ${pingError.message}`);
      }
      const { error: rpcError } = await supabaseAdmin.rpc('check_table_exists', { p_table_name: 'users' });
      if (rpcError) return { success: false, message: 'יש להריץ את סקריפט ה-SQL ב-Supabase תחילה', code: 'SQL_NOT_RUN' };
      return { success: true, message: 'חיבור תקין' };
    } catch (err: any) {
      return { success: false, message: `שגיאת חיבור: ${err.message}` };
    }
  }

  async getTablesList(): Promise<{ id: string; label: string }[]> {
    try {
      const { data, error } = await supabaseAdmin.rpc('get_public_tables');
      if (error) return [];
      return (data || []).map((t: { table_name: string }) => ({ id: t.table_name, label: t.table_name }));
    } catch { return []; }
  }

  async reloadSchemaCache(): Promise<void> {
    try { await supabaseAdmin.rpc('reload_schema_cache'); } catch {}
  }

  async getRawTableData(tableName: string): Promise<any[]> {
    try {
      return await this.fetchFullTable(tableName, 'created_at', false, true);
    } catch {
      // Fallback if created_at doesn't exist
      try {
        return await this.fetchFullTable(tableName, undefined, true, true);
      } catch {
        return [];
      }
    }
  }

  async getTableColumns(tableName: string): Promise<{ column_name: string; data_type: string; ordinal_position: number; is_updatable: string }[]> {
    try {
      const { data, error } = await supabaseAdmin.rpc('get_table_columns', { p_table_name: tableName });
      if (error) {
        console.error(`[DB] Error getting columns for ${tableName}:`, error);
        return [];
      }
      return data || [];
    } catch (err) { 
      console.error(`[DB] Exception getting columns for ${tableName}:`, err);
      return []; 
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin.rpc('check_table_exists', { p_table_name: tableName });
      return error ? false : !!data;
    } catch { return false; }
  }

  async deleteRecord(tableName: string, id: string | number) {
    const { error } = await supabaseAdmin.from(tableName).delete().eq('id', id);
    if (error) throw error;
  }

  async getUsers(): Promise<User[]> {
    const data = await this.fetchFullTable('users', 'created_at', false, true);
    return (data || []).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      isActive: u.is_active,
      createdAt: u.created_at,
      updatedAt: u.updated_at
    }));
  }

  async updateUser(id: string, updates: Partial<User>) {
    const payload: any = { ...updates };
    if (updates.isActive !== undefined) {
      payload.is_active = updates.isActive;
      delete payload.isActive;
    }
    delete payload.password; // Ensure password is not sent to public.users
    const { error } = await supabase.from('users').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      if (error.code === '42501') {
        window.location.href = '/';
      }
      throw error;
    }
  }

  async addUser(user: Partial<User>) {
    if (!user.email || !user.password) {
      throw new Error('Email and password are required for user creation');
    }

    console.log('Starting addUser (Client-Side Simulation) for:', user.email);

    let authUserId: string | undefined;

    // 1. Check if user already exists
    try {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const found = (listData?.users as any[])?.find(u => u.email === user.email);
      if (found) {
        console.log('User already exists in Auth:', found.id);
        authUserId = found.id;
      }
    } catch (e) {
      console.warn('List users failed, proceeding...');
    }

    // 2. If not found, create using a FRESH client instance (mimicking the user's snippet)
    // This avoids logging out the current admin user while using the public signUp method
    // which seems to work better with the broken triggers than admin.createUser.
    if (!authUserId) {
      console.log('Using shared non-persisting client for registration...');
      
      const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
        email: user.email,
        password: user.password
      });

      if (authError) {
        console.error('SignUp failed:', authError.message);
        
        // Check if it was created despite error
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const found = (listData?.users as any[])?.find(u => u.email === user.email);
        
        if (found) {
          authUserId = found.id;
        } else {
          throw new Error(`שגיאה ברישום משתמש (SignUp): ${authError.message}`);
        }
      } else {
        authUserId = authData.user?.id;
      }
    }

    if (!authUserId) throw new Error('User identification failed');

    // 3. Upsert the profile using Admin client (Service Role)
    // This ensures we bypass RLS for the profile creation
    const payload: any = {
      id: authUserId,
      email: user.email,
      full_name: user.name,
      name: user.name,
      phone: user.phone,
      role: user.role || UserRole.USER,
      is_active: true,
      updated_at: new Date().toISOString()
    };
    
    console.log('Upserting profile for:', authUserId);
    const { data, error } = await supabaseAdmin.from('users').upsert(payload).select().single();
    
    if (error) {
      console.error('Profile upsert failed:', error);
      throw new Error(`המשתמש נוצר ב-Auth אך נכשלה יצירת הפרופיל: ${error.message}`);
    }
    
    // 4. Auto-confirm email using Admin client
    // Since signUp leaves the user unconfirmed by default, we fix it here.
    try {
       console.log('Auto-confirming email...');
       await supabaseAdmin.auth.admin.updateUserById(authUserId, { email_confirm: true });
    } catch (e) {
       console.warn('Could not auto-confirm email:', e);
    }

    return data;
  }

  async getPermissions(userId: string): Promise<Permission[]> {
    const { data, error } = await supabase.from('permissions').select('*').eq('user_id', userId);
    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      userId: p.user_id,
      screenKey: p.screen_key,
      canView: !!p.can_view,
      canCreate: !!p.can_create,
      canEdit: !!p.can_edit,
      canDelete: !!p.can_delete,
      canExport: !!p.can_export,
      canApprove: !!p.can_approve,
      canGenerateCertificates: !!p.can_generate_certificates,
      canImportExcel: !!p.can_import_excel
    }));
  }

  async savePermissions(userId: string, permissions: Partial<Permission>[]) {
    await supabase.from('permissions').delete().eq('user_id', userId);
    const payload = permissions.map(p => ({
      user_id: userId,
      screen_key: p.screenKey,
      can_view: p.canView,
      can_create: p.canCreate,
      can_edit: p.canEdit,
      can_delete: p.canDelete,
      can_export: p.canExport,
      can_approve: p.canApprove,
      can_generate_certificates: p.canGenerateCertificates,
      can_import_excel: p.canImportExcel
    }));
    await supabase.from('permissions').insert(payload);
  }

  async getCustomers(): Promise<Customer[]> {
    const data = await this.fetchFullTable('customers', 'name', true, false);
    return (data || []).map(c => ({
      id: c.id,
      customerNumber: c.customer_number,
      name: c.name,
      address: c.address,
      city: c.city,
      contactName: c.contact_name,
      contactPhone: c.contact_phone,
      contactEmail: c.contact_email,
      notes: c.notes,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));
  }

  async addCustomer(customer: Partial<Customer>) {
    let notesObj: any = {};
    try { notesObj = JSON.parse(customer.notes || '{}'); } catch {}
    if (!notesObj['ROW ID']) notesObj['ROW ID'] = await this.generateRowId();
    const payload: any = {
      id: (customer as any).id,
      customer_number: customer.customerNumber,
      name: customer.name,
      address: customer.address,
      city: customer.city,
      contact_name: customer.contactName,
      contact_phone: customer.contactPhone,
      contact_email: customer.contactEmail,
      notes: JSON.stringify(notesObj)
    };
    if (payload.id === "" || payload.id === undefined) delete payload.id;
    const { data, error } = await supabase.from('customers').insert([payload]).select().single();
    if (error) throw error;
    return data;
  }

  async updateCustomer(id: string, customer: Partial<Customer>) {
    const { data: existing } = await supabase.from('customers').select('notes').eq('id', id).single();
    let eNotes: any = {}; try { eNotes = JSON.parse(existing?.notes || '{}'); } catch {}
    let nNotes: any = {}; try { nNotes = JSON.parse(customer.notes || '{}'); } catch {}
    nNotes['ROW ID'] = eNotes['ROW ID'] || await this.generateRowId();
    const payload = {
      customer_number: customer.customerNumber,
      name: customer.name,
      address: customer.address,
      city: customer.city,
      contact_name: customer.contactName,
      contact_phone: customer.contactPhone,
      contact_email: customer.contactEmail,
      notes: JSON.stringify(nNotes),
      updated_at: new Date().toISOString()
    };
    await supabase.from('customers').update(payload).eq('id', id);
  }

  async addCustomersBatch(customers: Partial<Customer>[]) {
    const processed = await Promise.all(customers.map(async (c) => {
      let nObj: any = {}; try { nObj = JSON.parse(c.notes || '{}'); } catch {}
      if (!nObj['ROW ID']) nObj['ROW ID'] = await this.generateRowId();
      return {
        customer_number: String(c.customerNumber || ''),
        name: c.name,
        address: c.address,
        city: c.city,
        contact_name: c.contactName,
        contact_phone: String(c.contactPhone || ''),
        contact_email: c.contactEmail,
        notes: JSON.stringify(nObj)
      };
    }));
    await supabase.from('customers').insert(processed);
  }

  async getInspections(): Promise<Inspection[]> {
    const data = await this.fetchFullTable('inspections', 'created_at', false, false);
    return (data || []).map(item => ({
      id: item.id,
      inspectionSerialNumber: item.serial_number,
      inspectionType: item.type as InspectionType,
      templateName: item.data?.templateName || item.template_name, // Try to get from data or column if it exists
      customerId: item.customer_id,
      technicianId: item.technician_id,
      inspectionDate: item.inspection_date,
      status: item.status as InspectionStatus,
      data: item.data,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
  }

  async addInspection(inspection: Partial<Inspection>, tableName: string = 'inspections') {
    console.log(`[DB] Initiating addInspection. Target Table: ${tableName}`);
    if (tableName && tableName !== 'inspections') {
      const columns = await this.getTableColumns(tableName);
      const columnNames = columns.map(c => c.column_name);
      
      const rawData = { ...inspection.data };
      if ((inspection as any).id) rawData.id = (inspection as any).id;
      
      const payload: any = {};
      
      if (columnNames.length > 0) {
        // Only include keys that exist as columns in the target table
        Object.keys(rawData).forEach(key => {
          if (columnNames.includes(key)) {
            payload[key] = rawData[key];
          }
        });
      } else {
        // Fallback if we can't get columns: remove known system fields that often cause issues
        Object.assign(payload, rawData);
        delete payload.customerId;
        delete payload.technicianId;
        delete payload.inspectionDate;
        delete payload.status;
        delete payload.templateName;
      }

      console.log(`[DB] Final Payload for custom table '${tableName}':`, payload);
      const { data, error } = await supabaseAdmin.from(tableName).insert([payload]).select();
      if (error) {
        console.error(`[DB] Error inserting into ${tableName}:`, error);
        throw error;
      }
      console.log('Database Confirmation:', data);
      console.log(`[DB] Successfully inserted into ${tableName}`);
      return data?.[0] || data;
    }

    const payload: any = {
      id: (inspection as any).id,
      serial_number: inspection.inspectionSerialNumber,
      type: inspection.inspectionType,
      customer_id: inspection.customerId,
      technician_id: inspection.technicianId,
      inspection_date: inspection.inspectionDate,
      status: inspection.status,
      data: {
        ...inspection.data,
        templateName: inspection.templateName // Store template name in the JSON data
      }
    };

    // Fix 22P02 error: invalid input syntax for type uuid: ""
    if (payload.customer_id === "") payload.customer_id = null;
    if (payload.technician_id === "") payload.technician_id = null;
    if (payload.id === "" || payload.id === undefined) delete payload.id;

    console.log(`[DB] Final Payload for default table 'inspections':`, payload);
    const { data, error } = await supabaseAdmin.from(tableName).insert([payload]).select();
    if (error) {
      console.error(`[DB] Error inserting into ${tableName}:`, error);
      throw error;
    }
    console.log('Database Confirmation:', data);
    console.log(`[DB] Successfully inserted into ${tableName}`);
    return data?.[0] || data;
  }

  async updateInspection(id: string, inspection: Partial<Inspection>, tableName: string = 'inspections') {
    console.log(`[DB] Initiating updateInspection. Target Table: ${tableName}, ID: ${id}`);
    if (tableName && tableName !== 'inspections') {
      const columns = await this.getTableColumns(tableName);
      const columnNames = columns.map(c => c.column_name);
      
      const rawData = { ...inspection.data };
      const payload: any = {};
      
      if (columnNames.length > 0) {
        Object.keys(rawData).forEach(key => {
          if (columnNames.includes(key)) {
            payload[key] = rawData[key];
          }
        });
      } else {
        Object.assign(payload, rawData);
        delete payload.customerId;
        delete payload.technicianId;
        delete payload.inspectionDate;
        delete payload.status;
        delete payload.templateName;
      }

      console.log(`[DB] Final Payload for custom table '${tableName}':`, payload);
      const { data, error } = await supabaseAdmin.from(tableName).update(payload).eq('id', id).select();
      if (error) {
        console.error(`[DB] Error updating ${tableName}:`, error);
        throw error;
      }
      console.log('Database Confirmation:', data);
      console.log(`[DB] Successfully updated ${tableName}`);
      return data?.[0] || data;
    }

    const payload: any = {};
    if (inspection.customerId !== undefined) payload.customer_id = inspection.customerId === "" ? null : inspection.customerId;
    if (inspection.technicianId !== undefined) payload.technician_id = inspection.technicianId === "" ? null : inspection.technicianId;
    if (inspection.inspectionDate !== undefined) payload.inspection_date = inspection.inspectionDate;
    if (inspection.status !== undefined) payload.status = inspection.status;
    if (inspection.data !== undefined) {
      payload.data = {
        ...inspection.data,
        templateName: inspection.templateName || inspection.data.templateName
      };
    }

    console.log(`[DB] Final Payload for default table 'inspections':`, payload);
    const { data, error } = await supabaseAdmin.from(tableName).update(payload).eq('id', id).select();
    if (error) {
      console.error(`[DB] Error updating ${tableName}:`, error);
      throw error;
    }
    console.log('Database Confirmation:', data);
    console.log(`[DB] Successfully updated ${tableName}`);
    return data?.[0] || data;
  }

  async deleteInspection(id: string) {
    const { error } = await supabaseAdmin.from('inspections').delete().eq('id', id);
    if (error) throw error;
  }

  async getBots() {
    const data = await this.fetchFullTable('automation_bots', 'created_at', false, true);
    return data || [];
  }

  async saveBot(bot: any) {
    let authId, tableId, role;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let user = session?.user || (await supabase.auth.getUser()).data.user;
      
      // Fallback to localStorage if Supabase session is lost in iframe
      if (!user) {
        const saved = localStorage.getItem('fireguard_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id) {
            user = { id: parsed.id } as any;
          }
        }
      }

      if (!user) {
        throw new Error('User is not authenticated. Please log in again.');
      }

      authId = user.id;
      const { data: userData, error: userError } = await supabaseAdmin.from('users').select('id, role').eq('id', user.id).single();
      
      if (userError || !userData) {
        console.error('Profile fetch error:', userError);
        throw new Error(`User profile not found in database for ID: ${user.id}`);
      }

      tableId = userData.id;
      role = userData.role;

      const isAdmin = role === UserRole.ADMIN || role === 'ADMIN';
      const isOffice = role === UserRole.OFFICE || role === 'OFFICE';

      if (!isAdmin && !isOffice) {
        throw new Error(`User is not an ADMIN or OFFICE (Current Role: ${role || 'None'})`);
      }

      const payload: any = {
        name: bot.name,
        event_type: bot.event.type,
        table_name: bot.event.targetTable,
        condition_formula: bot.event.conditionFormula || '',
        action_type: 'MULTI_STEP',
        action_config: { 
          event: bot.event, 
          steps: bot.steps,
          linked_child_tables: bot.linked_child_tables || []
        },
        is_active: bot.isActive,
        template_id: bot.templateId
      };
      
      if (bot.id && bot.id.includes('-')) {
        payload.id = bot.id;
      }

      // Use supabaseAdmin to bypass RLS session issues in iframe, 
      // since we've already verified the user's role manually above.
      const { data, error } = await supabaseAdmin.from('automation_bots').upsert(payload).select().single();
      if (error) {
        throw error;
      }
      return data;
    } catch (error: any) {
      if (error?.code === '42501') {
        console.log("Auth ID:", authId, "Table ID:", tableId, "Role:", role);
      }
      throw error;
    }
  }

  async updateBotStatus(id: string, isActive: boolean) {
    const { error } = await supabaseAdmin.from('automation_bots').update({ is_active: isActive }).eq('id', id);
    if (error) throw error;
  }

  async deleteBot(id: string) {
    let authId, tableId, role;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let user = session?.user || (await supabase.auth.getUser()).data.user;
      
      // Fallback to localStorage if Supabase session is lost in iframe
      if (!user) {
        const saved = localStorage.getItem('fireguard_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id) {
            user = { id: parsed.id } as any;
          }
        }
      }

      if (!user) {
        throw new Error('User is not authenticated. Please log in again.');
      }

      authId = user.id;
      const { data: userData, error: userError } = await supabaseAdmin.from('users').select('id, role').eq('id', user.id).single();
      
      if (userError || !userData) {
        console.error('Profile fetch error:', userError);
        throw new Error(`User profile not found in database for ID: ${user.id}`);
      }

      tableId = userData.id;
      role = userData.role;

      if (role !== UserRole.ADMIN && role !== 'ADMIN') {
        throw new Error(`User is not an ADMIN (Current Role: ${role || 'None'})`);
      }

      const { error } = await supabaseAdmin.from('automation_bots').delete().eq('id', id);
      if (error) {
        throw error;
      }
    } catch (error: any) {
      throw error;
    }
  }

  async generateInspectionSerialNumber(type: InspectionType, tableName: string = 'inspections'): Promise<string> {
    const prefix = type === InspectionType.ANNUAL ? 'AN' : (type === InspectionType.SEMI_ANNUAL ? 'SA' : 'OT');
    const year = new Date().getFullYear();
    
    let query = supabase.from(tableName).select('*', { count: 'exact', head: true });
    if (tableName === 'inspections') {
      query = query.eq('type', type);
    }
    
    const { count } = await query;
    return `${prefix}-${year}-${String((count || 0) + 1).padStart(4, '0')}`;
  }

  async getFormTemplates(): Promise<FormTemplate[]> {
    const templates = await this.fetchFullTable('form_templates', 'created_at', true, false);
    const fields = await this.fetchFullTable('form_fields', 'order_index', true, false);

    return templates.map(t => ({
      id: t.id,
      formKey: t.form_key,
      name: t.name,
      description: t.description,
      isActive: t.is_active,
      tableName: t.table_name,
      createdAt: t.created_at,
      navigation_config: t.navigation_config,
      fields: fields.filter(f => f.template_id === t.id).map(f => {
        const rawOptions = (f.options || {}) as any;
        const isLegacyArray = Array.isArray(rawOptions);
        return {
          id: f.id,
          formTemplateId: f.template_id,
          fieldKey: f.field_key,
          label: f.label,
          fieldType: f.field_type,
          isRequired: f.is_required,
          defaultValue: f.default_value,
          orderIndex: f.order_index,
          visibilityCondition: f.visibility_condition,
          validationFormula: f.validation_formula, 
          calculationFormula: f.calculation_formula,
          options: isLegacyArray ? rawOptions : (rawOptions.selection || []),
          yesLabel: isLegacyArray ? f.yes_label : (rawOptions.yesLabel || f.yes_label),
          noLabel: isLegacyArray ? f.no_label : (rawOptions.noLabel || f.no_label),
          dataSourceType: isLegacyArray ? f.data_source_type : (rawOptions.dataSourceType || f.data_source_type),
          displayMode: isLegacyArray ? f.display_mode : (rawOptions.displayMode || f.display_mode),
          manualOptions: isLegacyArray ? (f.manual_options || []) : (rawOptions.manualOptions || f.manual_options || []),
          supabaseConfig: isLegacyArray ? f.supabase_config : (rawOptions.supabaseConfig || f.supabase_config),
          targetFormId: isLegacyArray ? f.target_form_id : (rawOptions.targetFormId || f.target_form_id),
          isVirtual: isLegacyArray ? !!f.is_virtual : !!(rawOptions.isVirtual || f.is_virtual),
          isHidden: isLegacyArray ? !!f.is_hidden : !!(rawOptions.isHidden || f.is_hidden)
        };
      })
    })) as FormTemplate[];
  }

  async getFormTemplate(formKey: string): Promise<FormTemplate | null> {
    const templates = await this.getFormTemplates();
    return templates.find(t => t.formKey === formKey) || null;
  }

  async createFormTemplate(template: { name: string; formKey: string; description: string; tableName?: string }) {
    const payload = {
      name: template.name,
      form_key: template.formKey,
      description: template.description,
      table_name: template.tableName,
      is_active: true
    };
    const { data, error } = await supabase.from('form_templates').insert([payload]).select().single();
    if (error) throw error;
    return data;
  }

  async deleteFormTemplate(id: string) {
    // Delete fields first
    await supabase.from('form_fields').delete().eq('template_id', id);
    const { error } = await supabase.from('form_templates').delete().eq('id', id);
    if (error) throw error;
  }

  async updateFormTemplate(id: string, updates: Partial<FormTemplate>) {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.tableName !== undefined) payload.table_name = updates.tableName;
    if (updates.navigation_config !== undefined) payload.navigation_config = updates.navigation_config;

    const { error } = await supabase.from('form_templates').update(payload).eq('id', id);
    if (error) throw error;
  }

  async saveFormFields(templateId: string, fields: FormField[], deletedIds: string[]) {
    try {
      if (deletedIds.length > 0) {
        const actualDeletedIds = deletedIds.filter(id => !id.startsWith('temp_'));
        if (actualDeletedIds.length > 0) await supabase.from('form_fields').delete().in('id', actualDeletedIds);
      }
      const upsertPayload = fields.map(f => ({
        ...(f.id.startsWith('temp_') ? {} : { id: f.id }),
        template_id: templateId,
        field_key: f.fieldKey,
        label: f.label,
        field_type: f.fieldType,
        is_required: f.isRequired,
        order_index: f.orderIndex,
        default_value: f.defaultValue,
        visibility_condition: f.visibilityCondition,
        validation_formula: f.validationFormula,
        calculation_formula: f.calculationFormula,
        options: {
          selection: f.options || [],
          displayMode: f.displayMode,
          dataSourceType: f.dataSourceType,
          manualOptions: f.manualOptions || [],
          supabaseConfig: f.supabaseConfig,
          yesLabel: f.yesLabel,
          noLabel: f.noLabel,
          targetFormId: f.targetFormId,
          isVirtual: !!f.isVirtual,
          isHidden: !!f.isHidden
        }
      }));
      if (upsertPayload.length > 0) await supabase.from('form_fields').upsert(upsertPayload);
    } catch (err) { throw err; }
  }

  async getCertificates(): Promise<Certificate[]> {
    const data = await this.fetchFullTable('certificates', undefined, true, false);
    return (data || []).map(c => ({
      id: c.id,
      inspectionId: c.inspection_id,
      certificateType: c.type,
      certificateNumber: c.certificate_number,
      issueDate: c.issue_date,
      status: c.status,
      notes: c.notes,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));
  }

  async createDynamicTable(tableName: string, columns: any[], overwrite: boolean = false): Promise<void> {
    const { error } = await supabaseAdmin.rpc('create_dynamic_table', {
      p_table_name: tableName,
      p_columns: columns,
      p_overwrite: overwrite
    });
    if (error) throw error;
  }

  async addColumnToTable(tableName: string, columnName: string, columnType: string): Promise<void> {
    const { error } = await supabaseAdmin.rpc('add_column_to_table', {
      p_table_name: tableName,
      p_column_name: columnName,
      p_column_type: columnType
    });
    if (error) throw error;
  }

  async syncTableColumns(tableName: string, columns: string[]): Promise<void> {
    const { error } = await supabaseAdmin.rpc('sync_table_columns', {
      target_table: tableName,
      columns_to_add: columns.map(c => c.trim().toLowerCase().replace(/[^a-z0-9א-ת_]/g, '_'))
    });
    if (error) {
      console.error(`[DB] syncTableColumns error for ${tableName}:`, error);
      throw error;
    }
  }

  async bulkInsertIntoTable(
    tableName: string, 
    data: any[], 
    rowByRow: boolean = false, 
    onProgress?: (p: number) => void
  ): Promise<{ successCount: number; failedCount: number; errors: any[] }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    try {
      if (!data || data.length === 0) return { successCount: 0, failedCount: 0, errors: [] };

      // 1. Get Table Schema
      let columns = await this.getTableColumns(tableName);
      if (columns.length === 0) {
        console.log(`[DB] No columns found for ${tableName}, reloading schema cache...`);
        await this.reloadSchemaCache();
        await new Promise(r => setTimeout(r, 1000));
        columns = await this.getTableColumns(tableName);
      }

      const columnNames = columns.map(c => c.column_name);
      
      // 2. Data Sanitization (Excel-Resilient)
      const filteredData = data.map((row, index) => {
        if (typeof row !== 'object' || row === null || Array.isArray(row)) return null;
        
        const cleanRow: any = {};
        Object.keys(row).forEach(key => {
          // Convert all keys: replace spaces with underscores + trim
          const transformedKey = key.trim().replace(/\s+/g, '_');
          
          // Explicitly remove the id field to let Supabase generate it
          if (transformedKey.toLowerCase() === 'id') return;

          // Remove any keys that are not actual column names in the table
          if (columnNames.includes(transformedKey)) {
            let val = row[key];
            
            // Sanitization: If value is an empty string, a space " ", or undefined, set to null
            if (val === undefined || val === null || (typeof val === 'string' && (val.trim() === '' || val === ' '))) {
              cleanRow[transformedKey] = null;
            } else {
              // Format Check: Ensure all values are sent as Strings (TEXT columns)
              cleanRow[transformedKey] = String(val).trim();
            }
          }
        });

        return Object.keys(cleanRow).length > 0 ? cleanRow : null;
      }).filter(Boolean);

      if (filteredData.length === 0) {
        console.warn(`[DB] No valid data found for ${tableName} after sanitization.`);
        return { successCount: 0, failedCount: 0, errors: [] };
      }

      // 3. Batching & Error Recovery (Drill-down approach)
      const batchSize = 20;
      
      // Identify potential unique keys for upsert
      const uniqueKeyCandidates = ['customer_id', 'client_id', 'מספר_לקוח', 'id_number', 'serial_number'];
      const upsertKey = columnNames.find(name => uniqueKeyCandidates.includes(name.toLowerCase()));

      for (let i = 0; i < filteredData.length; i += batchSize) {
        const batch = filteredData.slice(i, i + batchSize);
        const range = `rows ${i + 1} to ${Math.min(i + batchSize, filteredData.length)}`;

        try {
          // Try Batch Insert/Upsert
          await this.executeBatch(tableName, batch, upsertKey);
          successCount += batch.length;
          console.log(`[DB] Successfully processed ${range} for ${tableName}`);
        } catch (batchErr: any) {
          console.warn(`[DB] Batch failed at ${range}. Drilling down to row-by-row...`);
          
          // Drill down to Row-by-Row
          for (let j = 0; j < batch.length; j++) {
            const row = batch[j];
            const rowIndex = i + j + 1;
            try {
              await this.executeBatch(tableName, [row], upsertKey);
              successCount++;
            } catch (rowErr: any) {
              console.warn(`[DB] Row ${rowIndex} failed. Drilling down to cell-by-cell...`);
              failedCount++;
              
              // Drill down to Cell-by-Cell (Field-by-Field)
              const cellErrors: string[] = [];
              const fields = Object.keys(row);
              
              for (const field of fields) {
                try {
                  // Try to insert just this field (with upsert key if exists)
                  const testObj: any = { [field]: row[field] };
                  if (upsertKey && row[upsertKey]) {
                    testObj[upsertKey] = row[upsertKey];
                  }
                  
                  // We use a separate check for the field
                  const { error: cellError } = await supabaseAdmin
                    .from(tableName)
                    .insert([testObj]);
                  
                  // If it's an upsert and it failed because of duplicate key, that's fine for a cell test
                  // But if it's a Bad Request (400), it's likely a type or constraint issue
                  if (cellError && cellError.code === '22P02') { // Invalid text representation
                    cellErrors.push(`שדה "${field}" מכיל ערך לא תקין: "${row[field]}"`);
                  } else if (cellError && cellError.code === '23505') {
                    // Duplicate key is expected in cell-by-cell test if row already exists
                  } else if (cellError) {
                    // Other errors
                    console.log(`[DB Cell Test] Field ${field} error:`, cellError);
                  }
                } catch (e) {
                  // Ignore local errors
                }
              }

              errors.push({
                row: rowIndex,
                error: rowErr.message || 'שגיאה לא ידועה בשורה',
                details: rowErr.details,
                cellErrors: cellErrors.length > 0 ? cellErrors : undefined,
                data: row
              });
            }
          }
        }

        if (onProgress) onProgress(Math.round((Math.min(i + batchSize, filteredData.length) / filteredData.length) * 100));
      }

      return { successCount, failedCount, errors };

    } catch (err: any) {
      console.error(`[DB] bulkInsertIntoTable Critical Exception for ${tableName}:`, err);
      throw err;
    }
  }

  private async executeBatch(tableName: string, batch: any[], upsertKey?: string) {
    if (upsertKey) {
      const keys = batch.map(r => r[upsertKey]).filter(Boolean);
      if (keys.length > 0) {
        const { data: existingRecords, error: fetchError } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .in(upsertKey, keys);

        if (!fetchError && existingRecords) {
          const existingMap = new Map(existingRecords.map(r => [String(r[upsertKey]), r]));
          const toUpdate = [];
          const toInsert = [];

          for (const record of batch) {
            const existing = existingMap.get(String(record[upsertKey]));
            if (existing) {
              const mergedRecord = { ...record };
              Object.keys(existing).forEach(key => {
                const existingVal = existing[key];
                if (existingVal !== null && existingVal !== undefined && existingVal !== '') {
                  mergedRecord[key] = existingVal;
                }
              });
              toUpdate.push(mergedRecord);
            } else {
              toInsert.push(record);
            }
          }

          for (const record of toUpdate) {
            const { error: updateError } = await supabaseAdmin
              .from(tableName)
              .update(record)
              .eq(upsertKey, record[upsertKey]);
            if (updateError) throw updateError;
          }

          if (toInsert.length > 0) {
            const { error: insertError } = await supabaseAdmin.from(tableName).insert(toInsert);
            if (insertError) throw insertError;
          }
          return;
        }
      }
    }
    
    const { error: insertError } = await supabaseAdmin.from(tableName).insert(batch);
    if (insertError) throw insertError;
  }

  async logImport(tableName: string, rowCount: number, userId: string, status: string = 'SUCCESS'): Promise<void> {
    await supabaseAdmin.from('import_logs').insert([{ table_name: tableName, row_count: rowCount, status, user_id: userId }]);
  }

  async logActivity(
    userName: string, 
    actionType: string, 
    description: string, 
    status: 'SUCCESS' | 'FAILED' | 'PENDING' = 'SUCCESS',
    errorDetails?: any,
    executionTime?: number
  ): Promise<void> {
    // Fire and forget (asynchronous) to avoid performance lag
    supabaseAdmin.from('audit_logs').insert([{
      user_name: userName,
      action_type: actionType,
      description: description,
      status: status,
      error_details: errorDetails ? (typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails)) : null,
      execution_time: executionTime
    }]).then(({ error }) => {
      if (error) console.error('Failed to write audit log:', error);
    });
  }

  /**
   * Triggers automation bots for a specific table and record.
   * This replicates the logic found in TriggersPage.tsx but for automatic execution.
   */
  async triggerBots(tableName: string, recordId: string, eventType: 'ADDS' | 'UPDATES' | 'DELETES' = 'ADDS') {
    console.log(`[Automation] Checking for bots on table: ${tableName}, Event: ${eventType}, Record: ${recordId}`);
    
    try {
      // 1. Fetch active bots for this table
      const { data: bots, error: botsError } = await supabaseAdmin
        .from('automation_bots')
        .select('*')
        .eq('table_name', tableName)
        .eq('is_active', true);

      if (botsError) throw botsError;
      if (!bots || bots.length === 0) {
        console.log(`[Automation] No active bots found for table ${tableName}`);
        return;
      }

      // 2. Filter bots by event type
      const relevantBots = bots.filter(bot => {
        const botEvent = bot.action_config?.event || { dataChangeType: bot.event_type };
        return botEvent.dataChangeType === 'ALL' || botEvent.dataChangeType === eventType;
      });

      if (relevantBots.length === 0) {
        console.log(`[Automation] No bots match the event type: ${eventType}`);
        return;
      }

      // 3. Fetch the main record data
      let finalRowData = null;
      const { data: rowData, error: fetchError } = await supabaseAdmin
        .from(tableName)
        .select('*')
        .eq('ROWID', recordId)
        .maybeSingle();

      if (fetchError || !rowData) {
        // Try fetching by UUID if ROWID fails
        const { data: uuidData } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .eq('id', recordId)
          .maybeSingle();
        
        if (!uuidData) {
          console.warn(`[Automation] Could not find record ${recordId} in ${tableName} for automation.`);
          return;
        }
        finalRowData = uuidData;
      } else {
        finalRowData = rowData;
      }

      // Use the actual ROWID from the fetched record for child lookups
      // This is critical because children are linked via the Friendly ID (ROWID)
      const effectiveRowId = finalRowData.ROWID || recordId;

      const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx9Aprjm7RISvTet4j6xip62QlaUPeEnAy5cWDj6JKexwmifRyqDQ0PjuDP0Y3cB9Cg/exec';

      // 4. Execute each bot
      for (const bot of relevantBots) {
        console.log(`[Automation] Executing bot: ${bot.name}`);
        
        const steps = bot.action_config?.steps || [];
        const linkedChildTables = bot.action_config?.linked_child_tables || [];

        // Fetch child data if needed
        const childData: Record<string, any[]> = {};
        for (const childTable of linkedChildTables) {
          const { data: children } = await supabaseAdmin
            .from(childTable)
            .select('*')
            .eq('ROWID', effectiveRowId);
          childData[childTable] = children || [];
        }

        for (const step of steps) {
          if (step.type === 'RUN_TASK' && step.task?.type === 'EMAIL') {
            const payload = {
              task: step.task,
              rowData: finalRowData,
              childData: childData
            };

            console.log(`[Automation] Dispatching email task for bot ${bot.name} to GAS...`);
            
            // We use no-cors and remove 'await' to make the UI instant.
            // The script will run in the background on Google's servers.
            fetch(GAS_WEB_APP_URL, {
              method: 'POST',
              mode: 'no-cors',
              body: JSON.stringify(payload)
            }).catch(err => console.error(`[Automation] Fetch error:`, err));
            
            console.log(`[Automation] Bot ${bot.name} task dispatched.`);
          }
        }
      }
    } catch (err) {
      console.error(`[Automation] Error in triggerBots:`, err);
    }
  }

  /**
   * Global robust handler for sequential (Parent-Child) save operations.
   * Prevents 23503 (Foreign Key) errors by verifying parent existence before child sync.
   */
  async safeSequentialSave<T>(
    tableName: string,
    parentSavePromise: Promise<T>,
    childSyncFn: (parentData: T) => Promise<void>
  ): Promise<T> {
    // Phase 1: Parent Save
    const savedParent = await parentSavePromise;
    if (!savedParent) throw new Error(`[Sync Guard] Parent save returned no data for table ${tableName}`);

    const parentData = Array.isArray(savedParent) ? savedParent[0] : savedParent;
    
    // Extract ID - handle various possible ID field names
    const parentId = parentData.id || parentData.ROWID || parentData.inspectionSerialNumber || parentData.serial_number;
    
    if (!parentId) {
      throw new Error(`[Sync Guard] Could not extract ID from saved parent in table ${tableName}`);
    }

    // Phase 2: The Handshake (Existence Check)
    // We perform a "Existence Check" against the parent table using the returned ID.
    // This ensures the record is not just saved, but visible to the current session.
    let exists = false;
    
    // Get actual columns to avoid querying non-existent columns which causes 400 errors
    const columns = await this.getTableColumns(tableName);
    const columnNames = columns.map(c => c.column_name);
    
    const potentialSearchFields = ['id', 'serial_number', 'inspectionSerialNumber', 'ROWID'];
    const validSearchFields = potentialSearchFields.filter(f => columnNames.length === 0 || columnNames.includes(f));
    
    if (validSearchFields.length === 0 && columnNames.length > 0) {
      console.warn(`[Sync Guard] No standard ID columns found in table ${tableName}. Columns:`, columnNames);
      // Fallback: if we can't find a standard ID column, we might have to skip the check or use the first column
      exists = true; 
    } else {
      // Try up to 3 times with small delays to account for any DB replication/latency
      for (let i = 0; i < 3; i++) {
        try {
          // Build an OR filter for all valid ID columns
          const orFilter = (validSearchFields.length > 0 ? validSearchFields : ['id'])
            .map(field => `${field}.eq."${parentId}"`).join(',');
          
          const { data, error } = await supabaseAdmin
            .from(tableName)
            .select(validSearchFields.length > 0 ? validSearchFields[0] : '*')
            .or(orFilter)
            .maybeSingle();

          if (error) {
            console.error(`[Sync Guard] Handshake query failed for ${tableName}:`, error.message);
            // If the query itself fails (e.g. column mismatch), we might be better off 
            // assuming it exists if Phase 1 succeeded, or at least not blocking if it's a schema issue
            if (error.code === '42703' || error.code === 'P0001') { // Undefined column or similar
               console.warn(`[Sync Guard] Schema mismatch during handshake, proceeding with caution.`);
               exists = true;
               break;
            }
          }

          if (data) {
            exists = true;
            break;
          }
        } catch (err) {
          console.error(`[Sync Guard] Handshake exception for ${tableName}:`, err);
        }
        
        if (i < 2) await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (!exists) {
      throw new Error(`[Sync Guard] Parent Record [${parentId}] in Table [${tableName}] is not reachable. Aborting Child Sync to prevent FK violation.`);
    }

    // Phase 3: Child Sync
    // Only if the Handshake succeeds, proceed to the bulk insert of the children.
    await childSyncFn(parentData);

    return savedParent;
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    const data = await this.fetchFullTable('audit_logs', 'created_at', false, true);
    return (data || []).map(log => ({
      id: log.id,
      created_at: log.created_at,
      user_name: log.user_name,
      action_type: log.action_type,
      description: log.description,
      status: log.status as 'SUCCESS' | 'FAILED' | 'PENDING',
      error_details: log.error_details,
      execution_time: log.execution_time
    }));
  }
}

export const dbService = new DBService();
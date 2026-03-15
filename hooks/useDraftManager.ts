import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../services/supabaseClient';
import { dbService } from '../services/dbService';
import { offlineService } from '../services/offlineService';

export interface DraftData {
  user_id: string;
  table_name: string;
  data: any;
  last_updated?: string;
}

export const useDraftManager = (userId: string, tableName: string, isPreview: boolean = false) => {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const currentDataRef = useRef<any>(null);
  const isCancellingRef = useRef(false);

  const setIsCancelling = useCallback((val: boolean) => {
    isCancellingRef.current = val;
  }, []);

  // Check for existing draft on load
  useEffect(() => {
    const checkDraft = async () => {
      if (!userId || !tableName) {
        setIsChecking(false);
        return;
      }
      
      try {
        // Try online first if possible
        let data: any = null;
        
        if (navigator.onLine) {
          try {
            const { data: onlineData, error } = await supabase
              .from('inspection_drafts')
              .select('data, last_updated')
              .eq('user_id', userId)
              .eq('table_name', tableName)
              .maybeSingle();

            if (!error && onlineData) {
              data = onlineData;
              // Cache locally
              await offlineService.put('inspection_drafts', {
                user_id: userId,
                table_name: tableName,
                data: onlineData.data,
                last_updated: onlineData.last_updated,
                ROWID: `${userId}_${tableName}`
              });
            }
          } catch (onlineErr) {
            console.warn('Online draft check failed, falling back to local:', onlineErr);
          }
        }

        // Fallback to local if online failed or we are offline
        if (!data) {
          const localDraft = await offlineService.getById<any>('inspection_drafts', `${userId}_${tableName}`);
          if (localDraft) {
            data = localDraft;
          }
        }

        if (data && data.data) {
          setHasDraft(true);
          setDraftData(data.data);
        } else {
          setHasDraft(false);
          setDraftData(null);
        }
      } catch (err) {
        console.error('Failed to check draft:', err);
      } finally {
        setIsChecking(false);
      }
    };

    checkDraft();
  }, [userId, tableName]);

  // Update ref whenever data changes to avoid deep cloning and dependency issues in unmount
  const updateCurrentData = useCallback((data: any) => {
    currentDataRef.current = data;
  }, []);

  // Delete draft on submit
  const deleteDraft = useCallback(async () => {
    if (!userId || !tableName) return;
    
    try {
      // Use dbService to handle offline/online sync
      // The deterministic ROWID for drafts is user_id_table_name
      const draftRowId = `${userId}_${tableName}`;
      await dbService.deleteRecord('inspection_drafts', draftRowId);
        
      setHasDraft(false);
      setDraftData(null);
      currentDataRef.current = null;
    } catch (err) {
      console.error('Error deleting draft:', err);
    }
  }, [userId, tableName]);

  // Save draft manually or auto-save
  const saveDraft = useCallback(async (dataToSave?: any) => {
    if (isPreview || isCancellingRef.current) return;

    const data = dataToSave || currentDataRef.current;
    if (!userId || !tableName || !data) return;

    const INTERNAL_KEYS = ['technicianId', 'ROWID', 'rowid', 'customerId', 'מספר_לקוח', 'templateName', 'customerName', 'id', 'created_at', 'editingInspectionId'];
    
    // A draft should ONLY be saved if at least one key in the data object is NOT in the INTERNAL_KEYS list 
    // and has a value that is not an empty string, null, or undefined.
    const hasActualContent = Object.keys(data).some(key => {
      if (INTERNAL_KEYS.includes(key)) return false;
      const val = data[key];
      return val !== null && val !== undefined && val !== '';
    });

    // If no real content, don't save. If a draft existed, delete it.
    if (!hasActualContent) {
      if (hasDraft) {
        await deleteDraft();
      }
      return;
    }

    setIsSaving(true);
    try {
      // Use dbService to handle offline/online sync
      await dbService.saveToTable('inspection_drafts', {
        user_id: userId,
        table_name: tableName,
        data: data,
        last_updated: new Date().toISOString()
      });

      setHasDraft(true);
      setDraftData(data);
    } catch (err) {
      console.error('Error saving draft:', err);
    } finally {
      setIsSaving(false);
    }
  }, [userId, tableName, hasDraft, deleteDraft, isPreview]);

  // Auto-save on unmount and beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isPreview || isCancellingRef.current) return;
      
      const data = currentDataRef.current;
      if (!userId || !tableName || !data) return;

      const INTERNAL_KEYS = ['technicianId', 'ROWID', 'rowid', 'customerId', 'מספר_לקוח', 'templateName', 'customerName', 'id', 'created_at', 'editingInspectionId'];
      const hasActualContent = Object.keys(data).some(key => {
        if (INTERNAL_KEYS.includes(key)) return false;
        const val = data[key];
        return val !== null && val !== undefined && val !== '';
      });

      if (!hasActualContent) return;

      if (userId && tableName && data && Object.keys(data).length > 0) {
        // Use sendBeacon for reliable delivery during unload
        const payload = JSON.stringify({
          user_id: userId,
          table_name: tableName,
          data: data,
          last_updated: new Date().toISOString()
        });
        
        // We can't easily use sendBeacon with Supabase directly due to auth headers,
        // so we use fetch with keepalive
        if (supabaseUrl && supabaseAnonKey) {
          fetch(`${supabaseUrl}/rest/v1/inspection_drafts?on_conflict=user_id,table_name`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: payload,
            keepalive: true
          }).catch(console.error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also save on unmount if we have data
      if (!isPreview && currentDataRef.current && Object.keys(currentDataRef.current).length > 0) {
        saveDraft(currentDataRef.current);
      }
    };
  }, [userId, tableName, saveDraft, isPreview]);

  return {
    hasDraft,
    draftData,
    isChecking,
    isSaving,
    saveDraft,
    deleteDraft,
    updateCurrentData,
    setHasDraft,
    setIsCancelling
  };
};

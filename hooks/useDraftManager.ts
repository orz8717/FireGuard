import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../services/supabaseClient';

export interface DraftData {
  user_id: string;
  table_name: string;
  data: any;
  last_updated?: string;
}

export const useDraftManager = (userId: string, tableName: string) => {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const currentDataRef = useRef<any>(null);

  // Check for existing draft on load
  useEffect(() => {
    const checkDraft = async () => {
      if (!userId || !tableName) {
        setIsChecking(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('inspection_drafts')
          .select('data, last_updated')
          .eq('user_id', userId)
          .eq('table_name', tableName)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking draft:', error);
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

  // Save draft manually or auto-save
  const saveDraft = useCallback(async (dataToSave?: any) => {
    const data = dataToSave || currentDataRef.current;
    if (!userId || !tableName || !data || Object.keys(data).length === 0) return;

    setIsSaving(true);
    try {
      const { data: result, error } = await supabase
        .from('inspection_drafts')
        .upsert({
          user_id: userId,
          table_name: tableName,
          data: data,
          last_updated: new Date().toISOString()
        }, { onConflict: 'user_id, table_name' })
        .select();

      if (error) throw error;
      if (!result || result.length === 0) {
        throw new Error(`Data sync failed for table: inspection_drafts`);
      }

      setHasDraft(true);
      setDraftData(data);
    } catch (err) {
      console.error('Error saving draft:', err);
    } finally {
      setIsSaving(false);
    }
  }, [userId, tableName]);

  // Delete draft on submit
  const deleteDraft = useCallback(async () => {
    if (!userId || !tableName) return;
    
    try {
      await supabase
        .from('inspection_drafts')
        .delete()
        .eq('user_id', userId)
        .eq('table_name', tableName);
        
      setHasDraft(false);
      setDraftData(null);
      currentDataRef.current = null;
    } catch (err) {
      console.error('Error deleting draft:', err);
    }
  }, [userId, tableName]);

  // Auto-save on unmount and beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const data = currentDataRef.current;
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
      if (currentDataRef.current && Object.keys(currentDataRef.current).length > 0) {
        saveDraft(currentDataRef.current);
      }
    };
  }, [userId, tableName, saveDraft]);

  return {
    hasDraft,
    draftData,
    isChecking,
    isSaving,
    saveDraft,
    deleteDraft,
    updateCurrentData,
    setHasDraft
  };
};

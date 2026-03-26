import { useState, useEffect, useCallback, useRef } from 'react';
import { dbService } from '../services/dbService';

export const useDraftManager = (userId: string, templateId: string, isPreview: boolean = false) => {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const currentDataRef = useRef<any>(null);

  const updateCurrentData = useCallback((data: any) => {
    currentDataRef.current = data;
  }, []);

  const checkDraft = useCallback(async () => {
    if (!userId || isPreview) {
      setIsChecking(false);
      return;
    }

    try {
      const drafts = await dbService.getInspectionDrafts(userId);
      // Find draft for this specific record if possible, otherwise fallback to template
      const currentId = currentDataRef.current?.id || currentDataRef.current?.ROWID;
      let existingDraft = null;
      
      if (currentId) {
        existingDraft = drafts.find(d => d.data?.id === currentId || d.data?.ROWID === currentId);
      }
      
      if (!existingDraft) {
        existingDraft = drafts.find(d => d.table_name === templateId);
      }
      
      if (existingDraft) {
        setHasDraft(true);
        setDraftData(existingDraft.data);
      }
    } catch (err) {
      console.error('Error checking for draft:', err);
    } finally {
      setIsChecking(false);
    }
  }, [userId, templateId, isPreview]);

  useEffect(() => {
    checkDraft();
  }, [checkDraft]);

  const saveDraft = useCallback(async (data?: any) => {
    if (!userId || isPreview || isCancelling) return;

    const dataToSave = data || currentDataRef.current;
    if (!dataToSave) return;

    setIsSaving(true);
    try {
      const draftId = dataToSave.id || dataToSave.ROWID;
      await dbService.saveInspectionDraft({
        id: draftId, // Pass the definitive ID to ensure consistency
        user_id: userId,
        table_name: templateId,
        data: dataToSave,
        last_updated: new Date().toISOString()
      });
      setHasDraft(true);
    } catch (err) {
      console.error('Error saving draft:', err);
    } finally {
      setIsSaving(false);
    }
  }, [userId, templateId, isPreview, isCancelling]);

  const deleteDraft = useCallback(async () => {
    if (!userId || isPreview) return;

    try {
      const drafts = await dbService.getInspectionDrafts(userId);
      const currentId = currentDataRef.current?.id || currentDataRef.current?.ROWID;
      let existingDraft = null;
      
      if (currentId) {
        existingDraft = drafts.find(d => d.data?.id === currentId || d.data?.ROWID === currentId);
      }
      
      if (!existingDraft) {
        existingDraft = drafts.find(d => d.table_name === templateId);
      }
      
      if (existingDraft) {
        await dbService.deleteInspectionDraft(existingDraft.id);
        setHasDraft(false);
        setDraftData(null);
      }
    } catch (err) {
      console.error('Error deleting draft:', err);
    }
  }, [userId, templateId, isPreview]);

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

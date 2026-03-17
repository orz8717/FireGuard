
export const offlineService = {
  isOnline: () => navigator.onLine,
  saveDraft: async (key: string, data: any) => {
    console.log('Offline save:', key, data);
  },
  getDraft: async (key: string) => {
    return null;
  },
  deleteDraft: async (key: string) => {
    console.log('Offline delete:', key);
  },
  getAllDrafts: async () => {
    return [];
  }
};

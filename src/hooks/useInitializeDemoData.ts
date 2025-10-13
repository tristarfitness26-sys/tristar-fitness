import { useEffect } from 'react'
import { useDataStore } from '@/lib/dataSync'
import { loadSyncedJSON } from '@/lib/utils'

export const useInitializeDemoData = () => {
  const dataStore = useDataStore()
  
  if (!dataStore) {
    console.log('DataStore not available yet, skipping initialization');
    return;
  }
  
  const { 
    members, 
    trainers, 
    visitors, 
    invoices, 
    followUps, 
    activities,
    proteins, 
    initializeDemoData,
    importData 
  } = dataStore
  
  useEffect(() => {
    // Always try to load fresh data from backend on app startup
    const loadBackendData = async () => {
      try {
        const [membersData, trainersData, visitorsData, invoicesData, followUpsData, activitiesData, proteinsData] = await Promise.all([
          loadSyncedJSON('members'),
          loadSyncedJSON('trainers'),
          loadSyncedJSON('visitors'),
          loadSyncedJSON('invoices'),
          loadSyncedJSON('followups'),
          loadSyncedJSON('activities'),
          loadSyncedJSON('proteins')
        ]);

        // If we have any data from backend, use it
        if (membersData.length || trainersData.length || visitorsData.length || 
            invoicesData.length || followUpsData.length || activitiesData.length || 
            proteinsData.length) {
          console.log('Loading fresh data from backend...');
          importData(JSON.stringify({
            members: membersData,
            trainers: trainersData,
            visitors: visitorsData,
            invoices: invoicesData,
            followUps: followUpsData,
            activities: activitiesData,
            proteins: proteinsData
          }));
          return true;
        }
        return false;
      } catch (error) {
        console.error('Failed to load backend data:', error);
        return false;
      }
    };

    // Always try to load data from backend first
    const checkAndInitialize = async () => {
      console.log('Attempting to load fresh data from backend...');
      const hasBackendData = await loadBackendData();
      if (!hasBackendData) {
        console.log('No backend data found, initializing empty data store...');
        initializeDemoData();
      }
    };

    // Add a small delay to ensure the store is properly initialized
    const timeoutId = setTimeout(() => {
      checkAndInitialize();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []) // Remove dependencies to prevent re-running on every data change
}


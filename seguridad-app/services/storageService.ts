import { Site, InspectionLog } from '../types';
import { supabase, checkSupabaseConfig } from './supabaseClient';
import { toast } from 'react-hot-toast';

const SITES_KEY = 'sp_sites';
const INSPECTIONS_KEY = 'sp_inspections';

// Seed data
const SEED_SITES: Site[] = [
  {
    id: 'site-1',
    name: 'Cantera Los Álamos (Demo)',
    areas: [
      {
        id: 'area-1',
        name: 'Caseta de Control',
        points: [
          { id: 'pt-1', name: 'Extintor Principal', question: '¿El extintor está cargado?', requiresPhoto: true, photoInstruction: 'Foto manómetro' }
        ]
      }
    ]
  }
];

export const storageService = {
  // --- SITES MANAGEMENT ---

  getSites: (): Site[] => {
    const data = localStorage.getItem(SITES_KEY);
    if (!data) {
      localStorage.setItem(SITES_KEY, JSON.stringify(SEED_SITES));
      return SEED_SITES;
    }
    return JSON.parse(data);
  },

  saveSite: async (site: Site) => {
    // 1. Save Local
    const sites = storageService.getSites();
    const index = sites.findIndex(s => s.id === site.id);
    site.synced = false; // Mark as unsynced initially
    
    if (index >= 0) sites[index] = site;
    else sites.push(site);
    
    localStorage.setItem(SITES_KEY, JSON.stringify(sites));

    // 2. Try Sync to Supabase
    if (checkSupabaseConfig() && navigator.onLine && supabase) {
      try {
        const { error } = await supabase
          .from('sites')
          .upsert({ id: site.id, data: site });
        
        if (!error) {
          // Update local status to synced
          site.synced = true;
          if (index >= 0) sites[index] = site;
          else sites[sites.length - 1] = site;
          localStorage.setItem(SITES_KEY, JSON.stringify(sites));
        }
      } catch (e) {
        console.warn("Offline: Site saved locally only.");
      }
    }
  },

  deleteSite: async (siteId: string) => {
    // 1. Delete Local
    const sites = storageService.getSites().filter(s => s.id !== siteId);
    localStorage.setItem(SITES_KEY, JSON.stringify(sites));

    // 2. Delete Remote
    if (checkSupabaseConfig() && navigator.onLine && supabase) {
      await supabase.from('sites').delete().eq('id', siteId);
    }
  },

  // --- INSPECTIONS MANAGEMENT ---

  getInspections: (): InspectionLog[] => {
    const data = localStorage.getItem(INSPECTIONS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveInspection: async (inspection: InspectionLog) => {
    // 1. ALWAYS Save Local First (Safety)
    const data = localStorage.getItem(INSPECTIONS_KEY);
    const inspections: InspectionLog[] = data ? JSON.parse(data) : [];
    
    // Check if exists to avoid dupes on retries
    const existingIndex = inspections.findIndex(i => i.id === inspection.id);
    
    inspection.synced = false; // Default to not synced
    
    if (existingIndex >= 0) {
      inspections[existingIndex] = inspection;
    } else {
      inspections.push(inspection);
    }
    
    localStorage.setItem(INSPECTIONS_KEY, JSON.stringify(inspections));

    // 2. Try Sync immediately if online
    if (checkSupabaseConfig() && navigator.onLine && supabase) {
      try {
         await storageService.uploadInspectionToSupabase(inspection);
         // If upload succeeds, mark local as synced
         inspection.synced = true;
         // Update local storage again with synced status
         const updatedInspections = storageService.getInspections();
         const idx = updatedInspections.findIndex(i => i.id === inspection.id);
         if(idx >= 0) {
             updatedInspections[idx].synced = true;
             localStorage.setItem(INSPECTIONS_KEY, JSON.stringify(updatedInspections));
         }
         return true;
      } catch (error) {
        console.warn("Upload failed, saved locally.");
        return false;
      }
    }
    return false;
  },

  // Helper to upload a single record
  uploadInspectionToSupabase: async (log: InspectionLog) => {
    if (!supabase) return;
    const { error } = await supabase.from('inspections').upsert({
      id: log.id,
      site_name: log.siteName,
      inspector_name: log.inspectorName,
      date: log.date,
      data: log
    });
    if (error) throw error;
  },

  // --- SYNC MECHANISM ---

  syncPendingData: async () => {
    if (!navigator.onLine || !checkSupabaseConfig() || !supabase) return { syncedCount: 0, error: null };

    let syncedCount = 0;
    
    // 1. Sync Inspections
    const inspections = storageService.getInspections();
    const pendingInspections = inspections.filter(i => !i.synced);
    
    for (const insp of pendingInspections) {
      try {
        await storageService.uploadInspectionToSupabase(insp);
        insp.synced = true;
        syncedCount++;
      } catch (e) {
        console.error(`Failed to sync inspection ${insp.id}`, e);
      }
    }
    
    if (syncedCount > 0) {
      localStorage.setItem(INSPECTIONS_KEY, JSON.stringify(inspections));
    }

    // 2. Sync Sites (Configuration)
    const sites = storageService.getSites();
    const pendingSites = sites.filter(s => !s.synced);
    for (const site of pendingSites) {
      try {
         await supabase.from('sites').upsert({ id: site.id, data: site });
         site.synced = true;
      } catch (e) { console.error("Site sync fail", e); }
    }
    if (pendingSites.length > 0) {
        localStorage.setItem(SITES_KEY, JSON.stringify(sites));
    }

    // 3. Download remote sites (Conflict resolution: Server wins for config usually, but here we just merge newly added)
    // For simplicity in this version, we just ensure our local changes go up. 
    // A full bidirectional sync is complex, but pulling new sites is useful.
    try {
        const { data: remoteSites } = await supabase.from('sites').select('data');
        if (remoteSites) {
             const localSites = storageService.getSites();
             const localIds = new Set(localSites.map(s => s.id));
             let newFound = false;
             remoteSites.forEach((row: any) => {
                 const rSite = row.data as Site;
                 if (!localIds.has(rSite.id)) {
                     rSite.synced = true;
                     localSites.push(rSite);
                     newFound = true;
                 }
             });
             if (newFound) localStorage.setItem(SITES_KEY, JSON.stringify(localSites));
        }
    } catch(e) { console.error("Download sites error", e); }

    return { syncedCount };
  }
};
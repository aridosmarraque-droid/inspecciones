import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN DE SUPABASE ---
// Para producción en Vercel, usamos variables de entorno que empiezan por VITE_
// Mantenemos los valores hardcoded solo como fallback para desarrollo local/demo
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://tdgyqgrzjkafxwfkqtix.supabase.co'; 
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZ3lxZ3J6amthZnh3ZmtxdGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MjEyODQsImV4cCI6MjA4MDQ5NzI4NH0.qplUc1Dy1dUdQgijek-J0cA1aMOxwqia_8W7LhmbxiY';
// ---------------------------------

// Verificamos si las claves parecen válidas
const isConfigured = SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;

export const supabase = isConfigured 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    }) 
  : null;

export const checkSupabaseConfig = () => isConfigured;
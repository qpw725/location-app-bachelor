import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const rawSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
const supabaseUrl = rawSupabaseUrl.trim()
const supabaseAnonKey = rawSupabaseAnonKey.trim()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // important for React Native
  },
})

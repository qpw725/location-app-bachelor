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

export function getSupabaseDebugInfo() {
  return {
    url: supabaseUrl,
    urlHasWhitespace: rawSupabaseUrl !== supabaseUrl,
    anonKeyPrefix: supabaseAnonKey.slice(0, 18),
    anonKeyLength: supabaseAnonKey.length,
    keyHasWhitespace: rawSupabaseAnonKey !== supabaseAnonKey,
  }
}

export async function testSupabaseConnection() {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        apikey: supabaseAnonKey,
      },
    })

    return {
      ok: response.ok,
      status: response.status,
      bodyPreview: (await response.text()).slice(0, 200),
    }
  } catch (error: unknown) {
    return {
      ok: false,
      status: 0,
      bodyPreview: error instanceof Error ? error.message : 'Unknown network error',
    }
  }
}

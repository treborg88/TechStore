import { createClient } from '@supabase/supabase-js';
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
  console.log('--- Test Supabase app_settings ---');
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*');
    
    if (error) {
      console.error('❌ Error capturado:', error);
      if (error.code === '42P01') {
        console.log('💡 La tabla "app_settings" no existe. Debes ejecutar el SQL en Supabase.');
      }
    } else {
      console.log('✅ Tabla accesible. Registros encontrados:', data.length);
      console.log('Datos:', data);
    }
  } catch (e) {
    console.error('❌ Error de excepción:', e.message);
  }
}

test();

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Загружаем переменные из .env
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Ошибка: В .env отсутствуют NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function initStorage() {
  console.log('--- Настройка Supabase Storage ---');
  console.log(`URL: ${supabaseUrl}`);
  
  try {
    console.log('Проверка бакета "questions"...');

    const { error: bucketError } = await supabase.storage.createBucket('questions', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
      fileSizeLimit: 5242880
    });

    if (bucketError) {
      if (bucketError.message.includes('already exists')) {
        console.log('✅ Бакет "questions" уже существует.');
      } else {
        throw bucketError;
      }
    } else {
      console.log('🚀 Бакет "questions" успешно создан!');
    }

    console.log('\n--- Настройка завершена! ---');
    console.log('Теперь вы можете загружать тесты с картинками через админку.');
    
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('\n❌ Произошла ошибка при настройке:');
    console.error(message);
    if (message.includes('JWT')) {
      console.error('СОВЕТ: Проверьте SUPABASE_SERVICE_ROLE_KEY. Он должен быть длинным (начинаться на ey...)');
    }
  }
}

initStorage();

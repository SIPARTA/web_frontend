const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  // Try querying without created_at to see if it works
  const { data, error } = await supabase
    .from('transaction_logs')
    .select('id, tx_hash, status, entity_type, entity_id, retry_count')
    .limit(1);
    
  console.log('Query result:', error || data);
}
run();

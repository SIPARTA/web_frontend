const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://qttpjrgcatioxrfccnmt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0dHBqcmdjYXRpb3hyZmNjbm10Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njg4NzQxMiwiZXhwIjoyMTAyNDYzNDEyfQ.gwcE4q9QZUGXgwQzuYRLD_fNhZ6gBlc9_iEatWKIiC4'
);

async function check() {
  const { data, error } = await supabase.from('incident_events').select('user_id').limit(1);
  console.log('incident_events.user_id:', data, error);
}
check();

import os
from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

for table in ["crm_leads", "portal_leads"]:
    print(f"--- {table} ---")
    res = supabase.table(table).select("*").limit(1).execute()
    if res.data:
        print(res.data[0].keys())
    else:
        print("No data")

with open('frontend-dashboard/lib/api.ts', 'r') as f:
    content = f.read()

old = '''export async function getTopPerformersRange(params: {
  symbol: string;
  method: string;
  session: string;
  buyMin: number;
  buyMax: number;
  sellMin: number;
  sellMax: number;
  startDate: string;
  endDate: string;
  limit?: number;
}): Promise<TopPerformersResponse> {
  const response = await api.post("/api/events/best-performers-range", params);
  return response.data;
}'''

new = '''export async function getTopPerformersRange(params: {
  symbol: string;
  method?: string;
  session?: string;
  buyMin: number;
  buyMax: number;
  sellMin: number;
  sellMax: number;
  startDate: string;
  endDate: string;
  limit?: number;
}): Promise<TopPerformersResponse> {
  const response = await api.post("/api/events/best-performers-range", params);
  return response.data;
}'''

if old in content:
    content = content.replace(old, new)
    with open('frontend-dashboard/lib/api.ts', 'w') as f:
        f.write(content)
    print("✅ Updated API types to make method and session optional")
else:
    print("❌ Could not find exact match")
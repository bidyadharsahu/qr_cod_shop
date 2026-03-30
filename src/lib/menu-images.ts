import type { MenuItem } from './types';

const CATEGORY_DEFAULT_IMAGE: Record<string, string> = {
  appetizers: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?auto=format&fit=crop&w=900&q=80',
  salads: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80',
  mains: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
  sandwiches: 'https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=900&q=80',
  desserts: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=80',
  sides: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=900&q=80',
  cocktails: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80',
  beer: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80',
  whiskey: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=900&q=80',
};

const KEYWORD_IMAGE: Array<{ keyword: string; url: string }> = [
  { keyword: 'oyster', url: 'https://images.unsplash.com/photo-1625943553852-781c6dd46faa?auto=format&fit=crop&w=900&q=80' },
  { keyword: 'shrimp', url: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=80' },
  { keyword: 'lobster', url: 'https://images.unsplash.com/photo-1625944525533-473f1b7d8ff9?auto=format&fit=crop&w=900&q=80' },
  { keyword: 'steak', url: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=900&q=80' },
  { keyword: 'lamb', url: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=900&q=80' },
  { keyword: 'salmon', url: 'https://images.unsplash.com/photo-1485921325833-c519f76c4927?auto=format&fit=crop&w=900&q=80' },
  { keyword: 'chicken', url: 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?auto=format&fit=crop&w=900&q=80' },
  { keyword: 'salad', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80' },
  { keyword: 'pasta', url: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80' },
  { keyword: 'dessert', url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=80' },
  { keyword: 'burger', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80' },
];

export function getDefaultMenuImage(name: string, category: string): string {
  const n = name.toLowerCase();
  const hit = KEYWORD_IMAGE.find(entry => n.includes(entry.keyword));
  if (hit) return hit.url;

  const categoryKey = category.toLowerCase().trim();
  return CATEGORY_DEFAULT_IMAGE[categoryKey] || 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80';
}

export function withResolvedMenuImage(item: MenuItem): MenuItem & { image_url: string } {
  return {
    ...item,
    image_url: item.image_url || getDefaultMenuImage(item.name, item.category),
  };
}

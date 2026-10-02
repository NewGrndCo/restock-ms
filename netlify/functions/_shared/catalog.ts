import { read, write, type CatalogProduct } from './store'

export const defaultCatalog: CatalogProduct[] = [
  { name: 'Strawberry Lemonade', color: '#e31b18', inventory: 0 },
  { name: 'Classic Lemonade', color: '#ffc400', inventory: 0 },
  { name: 'Half & Half', color: '#f36b16', inventory: 0 },
  { name: 'Alkaline Water', color: '#38bdf8', inventory: 0 },
  { name: 'Blueberry Lemonade', color: '#4f46e5', inventory: 0 },
  { name: 'Mango Lemonade', color: '#f59e0b', inventory: 0 },
  { name: 'Raspberry Lemonade', color: '#be185d', inventory: 0 },
  { name: 'Pineapple Lemonade', color: '#facc15', inventory: 0 },
]

export async function readCatalog() {
  const catalog = await read<CatalogProduct[]>('catalog', [])
  if (catalog.length) return catalog
  await write('catalog', defaultCatalog)
  return defaultCatalog
}

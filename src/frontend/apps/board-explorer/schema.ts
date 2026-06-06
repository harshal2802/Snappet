// The Aurora SQLite schema contract — shared by the in-browser reader, the `.db`
// exporter, and the validator. These lists mirror snappet-mobile's
// `tools/kilter/build_bundled_db.py` (FULL_TABLES / CLIMB_TABLES) and
// `KilterCatalogValidator` so an exported file imports cleanly into the mobile
// app's "Import catalog file…" flow (issue #42).

/** Reference / geometry tables — copied WHOLE into an export (never subset). */
export const FULL_TABLES = [
  'difficulty_grades',
  'products',
  'product_sizes',
  'layouts',
  'sets',
  'product_sizes_layouts_sets',
  'products_angles',
  'placement_roles',
  'holes',
  'holds',
  'placements',
  'leds',
] as const

/** Climb tables — subset by uuid. Maps table → its climb-key column. */
export const CLIMB_TABLES: Record<string, string> = {
  climbs: 'uuid',
  climb_stats: 'climb_uuid',
  climb_cache_fields: 'climb_uuid',
  beta_links: 'climb_uuid',
}

/** Tables `KilterCatalogValidator` requires to be present. */
export const REQUIRED_TABLES = [
  'difficulty_grades',
  'layouts',
  'climbs',
  'climb_stats',
  'placements',
  'holes',
  'placement_roles',
  'leds',
] as const

/** snappet-mobile's importer only reads layouts 1 (Original) + 8 (Homewall). */
export const MOBILE_LAYOUT_IDS = [1, 8] as const

/** KilterCatalogValidator's size cap (512 × 1,000,000 bytes). */
export const MAX_CATALOG_BYTES = 512 * 1_000_000

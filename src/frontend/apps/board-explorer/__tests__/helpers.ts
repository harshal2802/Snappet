import initSqlJs from 'sql.js'
import type { Database, SqlJsStatic } from 'sql.js'

let sqlPromise: Promise<SqlJsStatic> | null = null
export function getSQL(): Promise<SqlJsStatic> {
  if (!sqlPromise) sqlPromise = initSqlJs()
  return sqlPromise
}

/**
 * Build a tiny synthetic, Aurora-shaped catalog (zero real data) covering the
 * required tables, so validator/export logic can be exercised in Node.
 *
 * Three listed climbs:
 *  - "Crimp Sender"  layout 1, angle 40, V5(16), 100 ascents, 3★, frames_count 1
 *  - "Sloper Storm"  layout 8, angle 30, V8(19), 250 ascents, 4★, frames_count 1, benchmark
 *  - "Dyno Maze"     layout 1, angle 50, V2(13),  20 ascents, 2★, frames_count 2 (multi-frame)
 * Plus one DRAFT (is_listed 0) that must never appear in listed results.
 */
export async function buildSourceDb(): Promise<{ SQL: SqlJsStatic; db: Database }> {
  const SQL = await getSQL()
  const db = new SQL.Database()
  db.run(`
    CREATE TABLE difficulty_grades (difficulty INTEGER PRIMARY KEY, boulder_name TEXT, is_listed INTEGER);
    CREATE TABLE layouts (id INTEGER PRIMARY KEY, name TEXT, is_listed INTEGER);
    CREATE TABLE placements (id INTEGER PRIMARY KEY, layout_id INTEGER, hole_id INTEGER);
    CREATE TABLE holes (id INTEGER PRIMARY KEY, x INTEGER, y INTEGER);
    CREATE TABLE placement_roles (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE leds (id INTEGER PRIMARY KEY, hole_id INTEGER, position INTEGER);
    CREATE TABLE climbs (uuid TEXT PRIMARY KEY, layout_id INTEGER, setter_username TEXT, name TEXT,
                         frames_count INTEGER, is_listed INTEGER, created_at TEXT);
    CREATE TABLE climb_stats (climb_uuid TEXT, angle INTEGER, display_difficulty REAL,
                             benchmark_difficulty REAL, ascensionist_count INTEGER, quality_average REAL);
    CREATE INDEX climb_stats_uuid ON climb_stats (climb_uuid);
  `)
  db.run("INSERT INTO difficulty_grades VALUES (13,'6B/V2',1),(16,'6C+/V5',1),(19,'7B/V8',1)")
  db.run("INSERT INTO layouts VALUES (1,'Kilter Original',1),(8,'Kilter Homewall',1)")
  db.run('INSERT INTO holes VALUES (1,4,4),(2,8,8)')
  db.run("INSERT INTO placement_roles VALUES (12,'start'),(13,'hand')")
  db.run('INSERT INTO placements VALUES (1,1,1),(2,8,2)')
  db.run('INSERT INTO leds VALUES (1,1,1),(2,2,2)')

  db.run(`INSERT INTO climbs VALUES
    ('U1',1,'asana','Crimp Sender',1,1,'2021-01-01'),
    ('U2',8,'boltz','Sloper Storm',1,1,'2021-02-01'),
    ('U3',1,'asana','Dyno Maze',2,1,'2021-03-01'),
    ('U4',1,'ghost','Draft Climb',1,0,'2021-04-01')`)
  db.run(`INSERT INTO climb_stats VALUES
    ('U1',40,16.2,NULL,100,3.0),
    ('U2',30,19.1,19.1,250,4.0),
    ('U3',50,13.0,NULL,20,2.0),
    ('U4',40,15.0,NULL,5,1.0)`)
  return { SQL, db }
}

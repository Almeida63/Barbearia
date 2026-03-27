const fs = require('fs');
const path = require('path');
const { getDb, dbPath } = require('./database');

async function runMigrations() {
  const db = await getDb();
  await db.exec('PRAGMA foreign_keys = ON');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const existing = await db.get('SELECT name FROM migrations WHERE name = ?', file);
    if (existing) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.exec('BEGIN');
    try {
      await db.exec(sql);
      await db.run('INSERT INTO migrations (name) VALUES (?)', file);
      await db.exec('COMMIT');
      console.log(`Migration aplicada: ${file}`);
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }

  await db.close();
  console.log(`Banco pronto em: ${dbPath}`);
}

runMigrations().catch((error) => {
  console.error('Erro ao rodar migrations:', error);
  process.exit(1);
});

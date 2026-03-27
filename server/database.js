const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'admin',
  database: 'barbearia',
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err);
});

async function getDb() {
  const client = await pool.connect();

  return {
    // Retorna a primeira linha ou undefined (equivalente ao db.get do SQLite)
    get: async (text, ...params) => {
      const res = await client.query(text, params);
      return res.rows[0];
    },

    // Retorna todas as linhas (equivalente ao db.all do SQLite)
    all: async (text, ...params) => {
      const res = await client.query(text, params);
      return res.rows;
    },

    // Executa uma query e retorna { lastID } para manter compatibilidade (equivalente ao db.run do SQLite)
    run: async (text, ...params) => {
      const res = await client.query(text, params);
      const lastID = res.rows[0]?.id ?? null;
      return { lastID };
    },

    // Libera o client de volta ao pool (equivalente ao db.close do SQLite)
    close: () => client.release(),
  };
}

module.exports = { getDb, pool };

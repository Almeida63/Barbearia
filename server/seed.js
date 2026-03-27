const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

async function seed() {
  const db = await getDb();
  const servicos = [
    { nome: 'Corte Tradicional', preco: 45.0, duracao_minutos: 30 },
    { nome: 'Barba Premium', preco: 35.0, duracao_minutos: 30 },
    { nome: 'Combo Corte + Barba', preco: 70.0, duracao_minutos: 60 },
    { nome: 'Sobrancelha', preco: 20.0, duracao_minutos: 30 },
    { nome: 'Pigmentação', preco: 30.0, duracao_minutos: 30 },
    { nome: 'Combo Completo', preco: 95.0, duracao_minutos: 90 }
  ];

  for (const servico of servicos) {
    const existing = await db.get('SELECT id FROM servicos WHERE nome = ?', servico.nome);
    if (!existing) {
      await db.run(
        'INSERT INTO servicos (nome, preco, duracao_minutos) VALUES (?, ?, ?)',
        servico.nome,
        servico.preco,
        servico.duracao_minutos
      );
    }
  }

  const adminEmail = 'admin@barbearia.com';
  const adminPassword = 'admin123';
  const existingAdmin = await db.get('SELECT id FROM admins WHERE email = ?', adminEmail);
  if (!existingAdmin) {
    const senha_hash = await bcrypt.hash(adminPassword, 10);
    await db.run('INSERT INTO admins (email, senha_hash) VALUES (?, ?)', adminEmail, senha_hash);
    console.log('Admin padrão criado.');
  }

  await db.close();
  console.log('Seed finalizado.');
}

seed().catch((error) => {
  console.error('Erro no seed:', error);
  process.exit(1);
});

const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Faça login como admin para continuar.' });
  }
  return next();
}

function generateTimes() {
  const times = [];
  for (let hour = 9; hour < 20; hour += 1) {
    times.push(`${String(hour).padStart(2, '0')}:00`);
    times.push(`${String(hour).padStart(2, '0')}:30`);
  }
  times.push('20:00');
  return times;
}

function normalizePhone(phone = '') {
  return phone.replace(/\D/g, '');
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function expandSlots(startTime, durationMinutes = 30) {
  const slots = [];
  const start = timeToMinutes(startTime);
  const total = Math.max(30, durationMinutes);
  for (let offset = 0; offset < total; offset += 30) {
    slots.push(minutesToTime(start + offset));
  }
  return slots;
}

async function findUserByEmailAndPhone(db, email, telefone) {
  // No PostgreSQL usamos REGEXP_REPLACE para remover caracteres não numéricos do telefone
  return db.get(
    `SELECT * FROM users
     WHERE lower(email) = lower($1)
     AND REGEXP_REPLACE(telefone, '[^0-9]', '', 'g') = $2`,
    email,
    normalizePhone(telefone)
  );
}

function buildWhatsappMessage({ protocolo, clienteNome, servico, dataHora, status }) {
  const date = new Date(dataHora);
  const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
  const horario = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(date);

  const statusLabel = {
    confirmado: 'confirmado',
    pendente: 'recebido e está pendente de confirmação',
    cancelado: 'cancelado',
  }[status] || status;

  return (
    `Olá, ${clienteNome}! Seu agendamento na BarberGold foi ${statusLabel}.\n` +
    `Protocolo: #${protocolo}\n` +
    `Serviço: ${servico}\n` +
    `Data: ${data}\n` +
    `Horário: ${horario}\n` +
    `Acompanhe seu status em: http://localhost:3000/perfil`
  );
}

function buildWhatsappUrl(phone, message) {
  const normalizedPhone = normalizePhone(phone);
  return `https://wa.me/55${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

async function getService(db, servicoId) {
  const service = await db.get('SELECT * FROM servicos WHERE id = $1', servicoId);
  if (!service) {
    throw new Error('Serviço não encontrado.');
  }
  return service;
}

async function buildAvailability(db, date, servicoId) {
  const service = await getService(db, servicoId);

  // No PostgreSQL usamos DATE() para extrair a data de um TIMESTAMP
  const appointments = await db.all(
    `SELECT a.data_hora, s.duracao_minutos
     FROM agendamentos a
     INNER JOIN servicos s ON s.id = a.servico_id
     WHERE DATE(a.data_hora) = $1::date
     AND a.status IN ('pendente', 'confirmado')`,
    date
  );

  // A tabela horarios_bloqueados no PostgreSQL usa data_inicio/data_fim
  // Calculamos a duração em minutos a partir do intervalo entre as duas colunas
  const blocked = await db.all(
    `SELECT data_inicio AS data_hora,
            EXTRACT(EPOCH FROM (data_fim - data_inicio)) / 60 AS duracao_minutos
     FROM horarios_bloqueados
     WHERE DATE(data_inicio) = $1::date`,
    date
  );

  const occupied = new Set();

  appointments.forEach((item) => {
    // data_hora vem como objeto Date do pg, então formatamos para HH:MM
    const startTime = new Date(item.data_hora).toTimeString().slice(0, 5);
    expandSlots(startTime, item.duracao_minutos).forEach((slot) => occupied.add(slot));
  });

  blocked.forEach((item) => {
    const startTime = new Date(item.data_hora).toTimeString().slice(0, 5);
    expandSlots(startTime, Number(item.duracao_minutos)).forEach((slot) => occupied.add(slot));
  });

  const allSlots = generateTimes();
  const lastMinute = 20 * 60;
  const requiredSlots = Math.max(1, Math.ceil(service.duracao_minutos / 30));

  const times = allSlots.map((time) => {
    const startMinute = timeToMinutes(time);
    const endMinute = startMinute + service.duracao_minutos;
    const needed = Array.from({ length: requiredSlots }, (_, index) =>
      minutesToTime(startMinute + index * 30)
    );

    const withinBusinessHours = endMinute <= lastMinute;
    const everySlotExists = needed.every((slot) => allSlots.includes(slot));
    const free = needed.every((slot) => !occupied.has(slot));

    return {
      horario: time,
      disponivel: withinBusinessHours && everySlotExists && free,
      servico: service.nome,
      duracao_minutos: service.duracao_minutos,
    };
  });

  return { service, times };
}

// ─── ROTAS PÚBLICAS ──────────────────────────────────────────────────────────

router.get('/services', async (_req, res) => {
  try {
    const db = await getDb();
    const services = await db.all('SELECT * FROM servicos ORDER BY preco ASC');
    await db.close();
    return res.json(services);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao buscar serviços.' });
  }
});

router.get('/available-times', async (req, res) => {
  const { date, servico_id } = req.query;

  if (!date) return res.status(400).json({ error: 'Informe uma data válida.' });
  if (!servico_id) return res.status(400).json({ error: 'Selecione um serviço para carregar os horários.' });

  try {
    const db = await getDb();
    const availability = await buildAvailability(db, date, servico_id);
    await db.close();
    return res.json(availability.times);
  } catch (error) {
    console.error(error);
    const status = error.message === 'Serviço não encontrado.' ? 404 : 500;
    return res.status(status).json({ error: status === 404 ? error.message : 'Erro ao buscar horários disponíveis.' });
  }
});

router.post('/appointments-public', async (req, res) => {
  const { nome, email, telefone, servico_id, data, horario } = req.body;

  if (!nome || !email || !telefone || !servico_id || !data || !horario) {
    return res.status(400).json({ error: 'Preencha nome, e-mail, telefone, serviço, data e horário.' });
  }

  const data_hora = `${data}T${horario}:00`;

  try {
    const db = await getDb();
    const availability = await buildAvailability(db, data, servico_id);
    const selectedSlot = availability.times.find((item) => item.horario === horario);

    if (!selectedSlot || !selectedSlot.disponivel) {
      await db.close();
      return res.status(409).json({ error: 'Este horário não está mais disponível para o serviço escolhido.' });
    }

    // Upsert do usuário — no PostgreSQL usamos RETURNING para obter o id
    let user = await db.get('SELECT * FROM users WHERE lower(email) = lower($1)', email);

    if (!user) {
      user = await db.get(
        'INSERT INTO users (nome, email, telefone, senha_hash) VALUES ($1, $2, $3, $4) RETURNING *',
        nome, email, telefone, 'SEM_LOGIN'
      );
    } else {
      await db.run(
        'UPDATE users SET nome = $1, telefone = $2 WHERE id = $3',
        nome, telefone, user.id
      );
      user = { ...user, nome, telefone };
    }

    // INSERT com RETURNING id para obter o lastID no PostgreSQL
    const result = await db.get(
      'INSERT INTO agendamentos (user_id, servico_id, data_hora, status) VALUES ($1, $2, $3, $4) RETURNING id',
      user.id, servico_id, data_hora, 'pendente'
    );

    await db.close();

    const whatsappText = encodeURIComponent(
      `Olá! Acabei de fazer um agendamento na barbearia.\n` +
      `Protocolo: #${result.id}\n` +
      `Cliente: ${nome}\n` +
      `Serviço: ${availability.service.nome}\n` +
      `Data: ${data}\n` +
      `Horário: ${horario}`
    );

    return res.json({
      message: 'Agendamento criado com sucesso.',
      id: result.id,
      whatsapp_url: `https://wa.me/?text=${whatsappText}`,
      service: availability.service,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar agendamento.' });
  }
});

router.get('/public-appointments', async (req, res) => {
  const { email, telefone } = req.query;
  if (!email || !telefone) {
    return res.status(400).json({ error: 'Informe e-mail e telefone.' });
  }

  try {
    const db = await getDb();
    const user = await findUserByEmailAndPhone(db, email, telefone);
    if (!user) {
      await db.close();
      return res.status(404).json({ error: 'Nenhum cliente encontrado com esses dados.' });
    }

    const appointments = await db.all(
      `SELECT a.id, a.data_hora, a.status, a.created_at,
              s.nome AS servico, s.preco, s.duracao_minutos
       FROM agendamentos a
       INNER JOIN servicos s ON s.id = a.servico_id
       WHERE a.user_id = $1
       ORDER BY a.data_hora DESC`,
      user.id
    );
    await db.close();

    return res.json({
      user: { id: user.id, nome: user.nome, email: user.email, telefone: user.telefone },
      appointments,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao buscar agendamentos.' });
  }
});

router.delete('/public-appointments/:id', async (req, res) => {
  const appointmentId = req.params.id;

  try {
    const db = await getDb();
    const appointment = await db.get('SELECT * FROM agendamentos WHERE id = $1', appointmentId);
    if (!appointment) {
      await db.close();
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    await db.run('UPDATE agendamentos SET status = $1 WHERE id = $2', 'cancelado', appointmentId);
    await db.close();
    return res.json({ message: 'Agendamento cancelado com sucesso.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao cancelar agendamento.' });
  }
});

// ─── ROTAS ADMIN ─────────────────────────────────────────────────────────────

router.get('/admin/appointments', requireAdmin, async (_req, res) => {
  try {
    const db = await getDb();
    const appointments = await db.all(
      `SELECT a.id, a.data_hora, a.status, a.created_at,
              u.nome AS cliente_nome, u.email AS cliente_email, u.telefone,
              s.nome AS servico, s.preco, s.duracao_minutos
       FROM agendamentos a
       INNER JOIN users u ON u.id = a.user_id
       INNER JOIN servicos s ON s.id = a.servico_id
       ORDER BY a.data_hora ASC`
    );
    await db.close();
    res.json(appointments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar agendamentos.' });
  }
});

router.get('/admin/customers', requireAdmin, async (_req, res) => {
  try {
    const db = await getDb();
    const customers = await db.all(
      `SELECT u.id, u.nome, u.email, u.telefone, u.created_at,
              COUNT(a.id) AS total_agendamentos
       FROM users u
       LEFT JOIN agendamentos a ON a.user_id = u.id
       GROUP BY u.id
       ORDER BY u.nome ASC`
    );
    await db.close();
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
});

router.patch('/admin/appointments/:id/confirm', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const appointment = await db.get(
      `SELECT a.id, a.data_hora, a.status,
              u.nome AS cliente_nome, u.email AS cliente_email, u.telefone,
              s.nome AS servico
       FROM agendamentos a
       INNER JOIN users u ON u.id = a.user_id
       INNER JOIN servicos s ON s.id = a.servico_id
       WHERE a.id = $1`,
      req.params.id
    );

    if (!appointment) {
      await db.close();
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    await db.run('UPDATE agendamentos SET status = $1 WHERE id = $2', 'confirmado', req.params.id);
    await db.close();

    const whatsappMessage = buildWhatsappMessage({
      protocolo: appointment.id,
      clienteNome: appointment.cliente_nome,
      servico: appointment.servico,
      dataHora: appointment.data_hora,
      status: 'confirmado',
    });

    return res.json({
      message: 'Agendamento confirmado.',
      whatsapp_url: buildWhatsappUrl(appointment.telefone, whatsappMessage),
      telefone: appointment.telefone,
      cliente_nome: appointment.cliente_nome,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao confirmar agendamento.' });
  }
});

router.get('/admin/appointments/:id/notification', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const appointment = await db.get(
      `SELECT a.id, a.data_hora, a.status,
              u.nome AS cliente_nome, u.email AS cliente_email, u.telefone,
              s.nome AS servico
       FROM agendamentos a
       INNER JOIN users u ON u.id = a.user_id
       INNER JOIN servicos s ON s.id = a.servico_id
       WHERE a.id = $1`,
      req.params.id
    );

    await db.close();

    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    const whatsappMessage = buildWhatsappMessage({
      protocolo: appointment.id,
      clienteNome: appointment.cliente_nome,
      servico: appointment.servico,
      dataHora: appointment.data_hora,
      status: appointment.status,
    });

    return res.json({
      whatsapp_url: buildWhatsappUrl(appointment.telefone, whatsappMessage),
      telefone: appointment.telefone,
      status: appointment.status,
      cliente_nome: appointment.cliente_nome,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao gerar notificação.' });
  }
});

router.delete('/admin/appointments/:id', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    await db.run('DELETE FROM agendamentos WHERE id = $1', req.params.id);
    await db.close();
    res.json({ message: 'Agendamento removido.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao remover agendamento.' });
  }
});

router.post('/admin/block', requireAdmin, async (req, res) => {
  const { data, horario, motivo, duracao_minutos } = req.body;
    console.log('BLOCK RECEBIDO:', { data, horario, motivo, duracao_minutos }); // adiciona aqui
  if (!data || !horario) {
    return res.status(400).json({ error: 'Informe data e horário.' });
  }

  const duration = Math.max(30, Number(duracao_minutos) || 30);
  const data_inicio = `${data}T${horario}:00`;

  // Calculamos data_fim somando a duração em minutos ao data_inicio
  const data_fim = new Date(new Date(data_inicio).getTime() + duration * 60000).toISOString();

  try {
    const db = await getDb();
    // No PostgreSQL não existe INSERT OR IGNORE; usamos ON CONFLICT DO NOTHING
    await db.run(
      `INSERT INTO horarios_bloqueados (data_inicio, data_fim, motivo)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      data_inicio, data_fim, motivo || 'Horário bloqueado'
    );
    await db.close();
    res.json({ message: 'Horário bloqueado com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao bloquear horário.' });
  }
});

router.get('/admin/blocked', requireAdmin, async (_req, res) => {
  try {
    const db = await getDb();
    // Recalculamos a duração em minutos a partir de data_inicio e data_fim
    const blocked = await db.all(
      `SELECT id, data_inicio, data_fim, motivo, created_at,
              EXTRACT(EPOCH FROM (data_fim - data_inicio)) / 60 AS duracao_minutos
       FROM horarios_bloqueados
       ORDER BY data_inicio ASC`
    );
    await db.close();
    res.json(blocked);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar horários bloqueados.' });
  }
});

router.delete('/admin/blocked/:id', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    await db.run('DELETE FROM horarios_bloqueados WHERE id = $1', req.params.id);
    await db.close();
    res.json({ message: 'Bloqueio removido.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao remover bloqueio.' });
  }
});

module.exports = router;

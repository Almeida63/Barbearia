async function loadAdmin() {
  const session = await getSession();
  const loginArea = document.getElementById('admin-login-area');
  const dashboard = document.getElementById('admin-dashboard');

  if (!session.admin) {
    loginArea.classList.remove('hidden');
    dashboard.classList.add('hidden');
    return;
  }

  loginArea.classList.add('hidden');
  dashboard.classList.remove('hidden');
  document.getElementById('admin-email').textContent = session.admin.email;
  await Promise.all([loadAppointments(), loadCustomers(), loadBlocked()]);
}

function getStatusActions(item) {
  const confirmButton = item.status === 'confirmado'
    ? '<button class="btn-small" disabled>Confirmado</button>'
    : `<button class="btn-small" data-confirm="${item.id}">Confirmar</button>`;

  const notifyLabel = item.status === 'confirmado' ? 'WhatsApp' : 'Aviso pendente';
  const notifyClass = item.status === 'confirmado' ? 'btn-whatsapp' : 'btn-small';
  const notifyDisabled = item.status === 'confirmado' ? '' : 'disabled';

  return `
    <div class="table-actions">
      ${confirmButton}
      <button class="${notifyClass}" data-notify="${item.id}" ${notifyDisabled}>${notifyLabel}</button>
      <button class="btn-danger" data-delete="${item.id}">Remover</button>
    </div>
  `;
}

async function loadAppointments() {
  const appointments = await fetchJSON('/api/admin/appointments');
  const body = document.getElementById('admin-appointments-body');
  if (!appointments.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum agendamento encontrado.</td></tr>';
    return;
  }

  body.innerHTML = appointments.map((item) => `
    <tr>
      <td>${item.cliente_nome}</td>
      <td>${item.cliente_email}<br>${item.telefone}</td>
      <td>${item.servico}</td>
      <td>${item.duracao_minutos} min</td>
      <td>${formatDateTime(item.data_hora)}</td>
      <td><span class="status-badge status-${item.status}">${item.status}</span></td>
      <td>${currencyBRL(item.preco)}</td>
      <td>${getStatusActions(item)}</td>
    </tr>
  `).join('');

  body.querySelectorAll('[data-confirm]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const response = await fetchJSON(`/api/admin/appointments/${button.dataset.confirm}/confirm`, {
          method: 'PATCH',
        });
        showMessage('admin-message', 'success', `${response.message} Abra o WhatsApp para avisar ${response.cliente_nome}.`);
        if (response.whatsapp_url) {
          window.open(response.whatsapp_url, '_blank', 'noopener');
        }
        await loadAppointments();
      } catch (error) {
        showMessage('admin-message', 'error', error.message);
      }
    });
  });

  body.querySelectorAll('[data-notify]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const response = await fetchJSON(`/api/admin/appointments/${button.dataset.notify}/notification`);
        window.open(response.whatsapp_url, '_blank', 'noopener');
        showMessage('admin-message', 'success', `WhatsApp aberto para avisar ${response.cliente_nome}.`);
      } catch (error) {
        showMessage('admin-message', 'error', error.message);
      }
    });
  });

  body.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Deseja remover este agendamento?')) return;
      try {
        const response = await fetchJSON(`/api/admin/appointments/${button.dataset.delete}`, { method: 'DELETE' });
        showMessage('admin-message', 'success', response.message);
        await loadAppointments();
        await loadCustomers();
      } catch (error) {
        showMessage('admin-message', 'error', error.message);
      }
    });
  });
}

async function loadCustomers() {
  const customers = await fetchJSON('/api/admin/customers');
  const body = document.getElementById('customers-body');
  if (!customers.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum cliente encontrado.</td></tr>';
    return;
  }

  body.innerHTML = customers.map((item) => `
    <tr>
      <td>${item.nome}</td>
      <td>${item.email}</td>
      <td>${item.telefone}</td>
      <td>${Number(item.total_agendamentos || 0)}</td>
      <td>${new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
    </tr>
  `).join('');
}

async function loadBlocked() {
  const blocked = await fetchJSON('/api/admin/blocked');
  const body = document.getElementById('blocked-body');
  if (!blocked.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum horário bloqueado.</td></tr>';
    return;
  }

  body.innerHTML = blocked.map((item) => `
    <tr>
      <td>${formatDateTime(item.data_inicio)}</td> 
      <td>${item.duracao_minutos} min</td>
      <td>${item.motivo || '—'}</td>
      <td>${new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
      <td><button class="btn-danger" data-unblock="${item.id}">Remover</button></td>
    </tr>
  `).join('');

  body.querySelectorAll('[data-unblock]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const response = await fetchJSON(`/api/admin/blocked/${button.dataset.unblock}`, { method: 'DELETE' });
        showMessage('admin-message', 'success', response.message);
        await loadBlocked();
      } catch (error) {
        showMessage('admin-message', 'error', error.message);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('admin-login-form');
  const blockForm = document.getElementById('block-form');
  const logoutButton = document.getElementById('admin-logout-btn');
  document.getElementById('block-date').min = new Date().toISOString().split('T')[0];

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage('admin-message');
    try {
      const payload = Object.fromEntries(new FormData(loginForm).entries());
      const response = await fetchJSON('/api/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showMessage('admin-message', 'success', response.message);
      loginForm.reset();
      await loadAdmin();
    } catch (error) {
      showMessage('admin-message', 'error', error.message);
    }
  });

  blockForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage('admin-message');
    try {
      const payload = Object.fromEntries(new FormData(blockForm).entries());
      const response = await fetchJSON('/api/admin/block', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showMessage('admin-message', 'success', response.message);
      blockForm.reset();
      await loadBlocked();
      await loadAppointments();
    } catch (error) {
      showMessage('admin-message', 'error', error.message);
    }
  });

  logoutButton.addEventListener('click', logout);

  try {
    await loadAdmin();
  } catch (error) {
    showMessage('admin-message', 'error', error.message);
  }
});

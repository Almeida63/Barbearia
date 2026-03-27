function applyPhoneMask(input) {
  input.addEventListener('input', () => {
    let value = input.value.replace(/\D/g, '').slice(0, 11);
    if (value.length > 10) {
      value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    } else if (value.length > 6) {
      value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else if (value.length > 2) {
      value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    } else if (value.length > 0) {
      value = value.replace(/(\d{0,2})/, '($1');
    }
    input.value = value;
  });
}

function renderAppointments(customer, appointments) {
  const resultsBox = document.getElementById('results-box');
  const body = document.getElementById('appointments-body');
  document.getElementById('customer-name').textContent = customer?.nome ? `Agendamentos de ${customer.nome}` : 'Seus agendamentos';
  resultsBox.classList.remove('hidden');

  if (!appointments.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum agendamento encontrado.</td></tr>';
    return;
  }

  body.innerHTML = appointments.map((appointment) => `
    <tr>
      <td>${appointment.servico}</td>
      <td>${formatDateTime(appointment.data_hora)}</td>
      <td>${currencyBRL(appointment.preco)}</td>
      <td><span class="status-badge status-${appointment.status}">${appointment.status}</span></td>
      <td>${appointment.status === 'cancelado' ? '—' : `<button class="btn-danger" data-id="${appointment.id}">Cancelar</button>`}</td>
    </tr>
  `).join('');

  body.querySelectorAll('.btn-danger').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await fetchJSON(`/api/public-appointments/${button.dataset.id}`, { method: 'DELETE' });
        showMessage('profile-message', 'success', 'Agendamento cancelado com sucesso.');
        document.getElementById('lookup-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      } catch (error) {
        showMessage('profile-message', 'error', error.message);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('lookup-form');
  const phoneInput = document.getElementById('lookup-telefone');
  applyPhoneMask(phoneInput);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage('profile-message');

    const params = new URLSearchParams(new FormData(form));
    try {
      const response = await fetchJSON(`/api/public-appointments?${params.toString()}`);
      renderAppointments(response.user, response.appointments);
      if (!response.appointments.length) {
        showMessage('profile-message', 'info', 'Nenhum agendamento encontrado com os dados informados.');
      }
    } catch (error) {
      document.getElementById('results-box').classList.add('hidden');
      showMessage('profile-message', 'error', error.message);
    }
  });
});

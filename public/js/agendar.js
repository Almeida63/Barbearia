let selectedTime = '';
let selectedDate = '';
let servicesCache = [];

function setLoading(isLoading) {
  const spinner = document.getElementById('booking-spinner');
  const text = document.getElementById('booking-submit-text');
  const button = document.getElementById('booking-submit-btn');
  spinner.classList.toggle('hidden', !isLoading);
  text.textContent = isLoading ? 'Agendando...' : 'Confirmar agendamento';
  button.disabled = isLoading;
}

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

function getSelectedService() {
  const serviceId = document.getElementById('servico_id').value;
  return servicesCache.find((item) => String(item.id) === String(serviceId));
}

function updateServiceSummary() {
  const summary = document.getElementById('service-summary');
  const service = getSelectedService();

  if (!service) {
    summary.innerHTML = 'Selecione um serviço para visualizar duração e preço.';
    return;
  }

  summary.innerHTML = `
    <strong>${service.nome}</strong><br>
    ${currencyBRL(service.preco)} · ${service.duracao_minutos} min
  `;
}

function getLocalToday() {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

async function loadServices() {
  const select = document.getElementById('servico_id');
  servicesCache = await fetchJSON('/api/services');
  select.innerHTML = '<option value="">Selecione um serviço</option>' + servicesCache.map((service) => `
    <option value="${service.id}">${service.nome} — ${currencyBRL(service.preco)} (${service.duracao_minutos} min)</option>
  `).join('');
}

function renderTimes(times) {
  const container = document.getElementById('times-container');
  if (!container) return;

  if (!times.length || !times.some((item) => item.disponivel)) {
    container.innerHTML = '<div class="message info">Nenhum horário disponível nesta data para este serviço.</div>';
    return;
  }

  container.innerHTML = times.map((item) => `
    <button type="button" class="time-slot ${item.disponivel ? '' : 'disabled'}" data-time="${item.horario}" ${item.disponivel ? '' : 'disabled'}>
      ${item.horario}
    </button>
  `).join('');

  container.querySelectorAll('.time-slot:not(.disabled)').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedTime = btn.dataset.time;
      container.querySelectorAll('.time-slot').forEach((el) => el.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('selected-time-text').textContent = `Horário selecionado: ${selectedTime}`;
    });
  });
}

async function loadAvailableTimes() {
  const date = document.getElementById('data').value;
  const serviceId = document.getElementById('servico_id').value;

  if (!date || !serviceId) {
    document.getElementById('times-container').innerHTML = '';
    document.getElementById('selected-time-text').textContent = 'Selecione um serviço e uma data';
    return;
  }

  selectedTime = '';
  document.getElementById('selected-time-text').textContent = 'Selecione um horário abaixo';
  const times = await fetchJSON(`/api/available-times?date=${date}&servico_id=${serviceId}`);
  renderTimes(times);
}

async function renderCalendarStrip() {
  const strip = document.getElementById('calendar-strip');
  const serviceId = document.getElementById('servico_id').value;

  if (!serviceId) {
    strip.innerHTML = '<div class="message info">Escolha um serviço para visualizar os dias com disponibilidade.</div>';
    return;
  }

  strip.innerHTML = '<div class="inline-loader"><span class="spinner"></span>Carregando dias...</div>';
  const today = new Date(getLocalToday());
  const dayPromises = [];

  for (let index = 0; index < 10; index += 1) {
    const current = new Date(today);
    current.setDate(today.getDate() + index);
    const isoDate = current.toISOString().split('T')[0];
    dayPromises.push(
      fetchJSON(`/api/available-times?date=${isoDate}&servico_id=${serviceId}`)
        .then((times) => ({
          date: isoDate,
          availableCount: times.filter((item) => item.disponivel).length,
          weekday: current.toLocaleDateString('pt-BR', { weekday: 'short' }),
          day: current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        }))
        .catch(() => ({
          date: isoDate,
          availableCount: 0,
          weekday: current.toLocaleDateString('pt-BR', { weekday: 'short' }),
          day: current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        }))
    );
  }

  const days = await Promise.all(dayPromises);
  strip.innerHTML = days.map((item) => `
    <button type="button" class="calendar-day ${item.availableCount ? '' : 'is-full'} ${selectedDate === item.date ? 'selected' : ''}" data-date="${item.date}">
      <span>${item.weekday.replace('.', '').toUpperCase()}</span>
      <strong>${item.day}</strong>
      <small>${item.availableCount ? `${item.availableCount} horários` : 'Lotado'}</small>
    </button>
  `).join('');

  strip.querySelectorAll('.calendar-day').forEach((button) => {
    button.addEventListener('click', async () => {
      const picked = button.dataset.date;
      selectedDate = picked;
      document.getElementById('data').value = picked;
      strip.querySelectorAll('.calendar-day').forEach((el) => el.classList.remove('selected'));
      button.classList.add('selected');
      try {
        await loadAvailableTimes();
      } catch (error) {
        showMessage('booking-message', 'error', error.message);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const dateInput = document.getElementById('data');
  const phoneInput = document.getElementById('telefone');
  const bookingForm = document.getElementById('booking-form');
  const serviceSelect = document.getElementById('servico_id');
  if (!dateInput || !bookingForm) return;

  applyPhoneMask(phoneInput);
  dateInput.min = getLocalToday();
  dateInput.value = getLocalToday();
  selectedDate = getLocalToday();

  try {
    await loadServices();
    updateServiceSummary();
    await renderCalendarStrip();
  } catch (error) {
    showMessage('booking-message', 'error', error.message);
  }

  serviceSelect.addEventListener('change', async () => {
    updateServiceSummary();
    document.getElementById('booking-success-card').classList.add('hidden');
    try {
      await renderCalendarStrip();
      if (dateInput.value) {
        await loadAvailableTimes();
      }
    } catch (error) {
      showMessage('booking-message', 'error', error.message);
    }
  });

  dateInput.addEventListener('change', async () => {
    selectedDate = dateInput.value;
    try {
      await renderCalendarStrip();
      await loadAvailableTimes();
    } catch (error) {
      showMessage('booking-message', 'error', error.message);
    }
  });

  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage('booking-message');

    if (!serviceSelect.value) {
      showMessage('booking-message', 'error', 'Selecione um serviço.');
      return;
    }

    if (!selectedTime) {
      showMessage('booking-message', 'error', 'Selecione um horário disponível.');
      return;
    }

    const formData = new FormData(bookingForm);
    const payload = Object.fromEntries(formData.entries());
    payload.horario = selectedTime;

    setLoading(true);
    try {
      const response = await fetchJSON('/api/appointments-public', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const service = getSelectedService();
      document.getElementById('success-copy').textContent =
        `Protocolo #${response.id} · ${service.nome} em ${formatDateTime(`${payload.data}T${selectedTime}:00`)}`;
      const whatsappLink = document.getElementById('whatsapp-share-link');
      whatsappLink.href = response.whatsapp_url;
      document.getElementById('booking-success-card').classList.remove('hidden');

      showMessage('booking-message', 'success', `${response.message} Protocolo: #${response.id}`);
      bookingForm.reset();
      selectedTime = '';
      document.getElementById('selected-time-text').textContent = 'Selecione um serviço e uma data';
      document.getElementById('times-container').innerHTML = '';
      serviceSelect.value = '';
      updateServiceSummary();
      dateInput.value = getLocalToday();
      selectedDate = getLocalToday();
      await renderCalendarStrip();
    } catch (error) {
      showMessage('booking-message', 'error', error.message);
    } finally {
      setLoading(false);
    }
  });
});

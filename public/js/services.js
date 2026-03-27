document.addEventListener('DOMContentLoaded', async () => {
  const servicesContainer = document.getElementById('services-list');
  try {
    const services = await fetchJSON('/api/services');
    servicesContainer.innerHTML = services.map((service) => `
      <article class="card fade-up">
        <h3>${service.nome}</h3>
        <p class="service-price">${currencyBRL(service.preco)}</p>
        <p>Atendimento com acabamento premium e máxima atenção aos detalhes.</p>
        <p><strong>Duração:</strong> ${service.duracao_minutos} minutos</p>
        <a class="btn" href="/agendar">Agendar agora</a>
      </article>
    `).join('');
    initFadeAnimations();
  } catch (error) {
    servicesContainer.innerHTML = `<div class="message error">${error.message}</div>`;
  }
});

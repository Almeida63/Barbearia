document.addEventListener('DOMContentLoaded', async () => {
  const servicesContainer = document.getElementById('featured-services');
  if (!servicesContainer) return;

  try {
    const services = await fetchJSON('/api/services');
    servicesContainer.innerHTML = services.slice(0, 3).map((service) => `
      <article class="card fade-up">
        <h3>${service.nome}</h3>
        <p class="service-price">${currencyBRL(service.preco)}</p>
        <p>Duração média: ${service.duracao_minutos} minutos.</p>
      </article>
    `).join('');
    initFadeAnimations();
  } catch (error) {
    servicesContainer.innerHTML = `<div class="message error">${error.message}</div>`;
  }
});

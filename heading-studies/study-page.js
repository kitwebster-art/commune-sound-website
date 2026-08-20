(() => {
  const root = document.querySelector('[data-heading-study]');
  if (!(root instanceof HTMLElement) || !window.CommuneHeadingStudies) return;
  const optionId = new URLSearchParams(location.search).get('option') || document.body.dataset.option;
  const { option } = window.CommuneHeadingStudies.create({ container: root, optionId });
  document.querySelector('[data-study-number]').textContent = `${option.number} / ${window.CommuneHeadingStudies.options.length}`;
  document.querySelector('[data-study-family]').textContent = option.family;
  document.querySelector('[data-study-title]').textContent = option.title;
  document.querySelector('[data-study-description]').textContent = option.description;
  document.title = `${option.title} | Commune Sound Heading Study`;
  const nav = document.querySelector('[data-option-nav]');
  window.CommuneHeadingStudies.options.forEach((item) => {
    const link = document.createElement('a');
    link.href = `view.html?option=${item.id}`;
    link.dataset.optionLink = item.id;
    link.innerHTML = `<span>${item.number}</span>${item.title}`;
    if (item.id === option.id) link.setAttribute('aria-current', 'page');
    nav.append(link);
  });
  document.body.dataset.renderStatus = 'ready';
})();

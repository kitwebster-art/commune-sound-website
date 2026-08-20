(() => {
  if (!window.CommuneHeadingStudies) return;
  document.querySelectorAll('[data-option-card]').forEach((card) => {
    const option = window.CommuneHeadingStudies.optionById(card.dataset.optionCard);
    const art = card.querySelector('[data-card-art]');
    window.CommuneHeadingStudies.create({ container: art, optionId: option.id });
  });
  document.body.dataset.renderStatus = 'ready';
})();

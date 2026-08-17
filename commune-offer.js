(() => {
  const setText = (selector, value) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = value;
    });
  };

  const update = () => {
    setText("[data-offer-label]", "General admission");
    setText("[data-offer-price]", "25");
    setText("[data-offer-countdown]", "Tickets on sale now");
    setText("[data-ticket-button-label]", "Get tickets");
    setText(
      "[data-event-pricing]",
      "$25 general admission · $40 for two dancers"
    );
    document.body.dataset.offerState = "general-admission";
  };

  window.CommuneOffer = { update };
  update();
})();

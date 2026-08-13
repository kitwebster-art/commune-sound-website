(() => {
  const deadline = new Date("2026-08-16T23:59:00+10:00");

  const setText = (selector, value) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = value;
    });
  };

  const formatRemaining = (milliseconds) => {
    const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];

    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);

    return parts.join(" ");
  };

  const update = (now = new Date()) => {
    const remaining = deadline.getTime() - now.getTime();

    if (remaining <= 0) {
      setText("[data-offer-label]", "General admission");
      setText("[data-offer-price]", "25");
      setText("[data-offer-countdown]", "Tickets on sale now");
      setText("[data-ticket-button-label]", "Get tickets");
      setText("[data-event-pricing]", "$40 for two dancers");
      document.body.dataset.offerState = "general-admission";
      return;
    }

    setText("[data-offer-label]", "Book by Sunday night");
    setText("[data-offer-price]", "20");
    setText(
      "[data-offer-countdown]",
      `${formatRemaining(remaining)} left · Ends Sunday at 11:59pm`
    );
    setText("[data-ticket-button-label]", "Get $20 tickets");
    setText(
      "[data-event-pricing]",
      "$25 general admission from Monday · $40 for two dancers"
    );
    document.body.dataset.offerState = "book-this-week";
  };

  window.CommuneOffer = { deadline, update };
  update();
  window.setInterval(update, 60000);
})();

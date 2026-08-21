(() => {
  const setText = (selector, value) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = value;
    });
  };

  const update = () => {
    setText("[data-offer-label]", "Early bird tickets");
    setText("[data-offer-price]", "20");
    setText("[data-offer-countdown]", "Only until Sunday");
    setText("[data-ticket-button-label]", "Get tickets");
    setText(
      "[data-event-pricing]",
      "$20 early bird until Sunday · $40 for two dancers"
    );
    document.body.dataset.offerState = "early-bird";
  };

  const installMobileTicketDock = () => {
    const dock = document.querySelector(".mobile-join-dock");
    const primaryButton = document.querySelector(".event-ticket-button");
    const signup = document.querySelector(".signup-hero");
    if (!(dock instanceof HTMLAnchorElement) || !(primaryButton instanceof HTMLAnchorElement)) return;

    const render = (primaryIsAbove, signupIsVisible) => {
      const visible = primaryIsAbove && !signupIsVisible;
      dock.dataset.visible = visible ? "true" : "false";
      dock.dataset.formVisible = signupIsVisible ? "true" : "false";
      dock.setAttribute("aria-hidden", visible ? "false" : "true");
    };

    let frame = 0;
    const updateFromLayout = () => {
      frame = 0;
      const primaryBounds = primaryButton.getBoundingClientRect();
      const signupBounds = signup instanceof HTMLElement ? signup.getBoundingClientRect() : null;
      const primaryIsAbove = primaryBounds.bottom <= 0;
      const signupIsVisible = Boolean(
        signupBounds
        && signupBounds.top < window.innerHeight
        && signupBounds.bottom > 0
      );
      render(primaryIsAbove, signupIsVisible);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = requestAnimationFrame(updateFromLayout);
    };

    addEventListener("scroll", scheduleUpdate, { passive: true });
    addEventListener("resize", scheduleUpdate, { passive: true });
    updateFromLayout();
  };

  window.CommuneOffer = { update };
  update();
  installMobileTicketDock();
})();

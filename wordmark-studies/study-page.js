(() => {
  const bootstrap = async () => {
    const stage = document.querySelector('.wordmark-stage');
    const frame = document.querySelector('.wordmark-frame');
    const variant = document.body.dataset.variant;
    if (!stage || !frame || !variant || !window.CommuneWordmarkParticles) {
      document.body.dataset.studyError = 'Wordmark study setup missing';
      return;
    }
    try {
      const result = await window.CommuneWordmarkParticles.create({
        container: stage,
        anchor: frame,
        imageSrc: '../../assets/commune-wordmark-cropped.jpeg',
        variant,
        seed: 17
      });
      document.body.dataset.studyStatus = 'ready';
      document.body.dataset.sourceGeometry = result.canvas.dataset.sourceGeometry;
    } catch (error) {
      document.body.dataset.studyStatus = 'failed';
      document.body.dataset.studyError = error.message;
    }
  };
  bootstrap();
})();

(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const OPTIONS = Object.freeze([
    { id: 'loop-stack', number: '01', family: 'Ribbon typography', title: 'Loop Stack', description: 'Fine rounded contours accumulate into a continuous architectural wordmark.' },
    { id: 'ribbon-current', number: '02', family: 'Ribbon typography', title: 'Ribbon Current', description: 'A broad flowing outline is threaded with moving parallel signal lines.' },
    { id: 'chrome-monolith', number: '03', family: 'Gradient geometry', title: 'Chrome Monolith', description: 'Heavy geometric letters become polished purple and green light volumes.' },
    { id: 'soft-void', number: '04', family: 'Gradient geometry', title: 'Soft Void', description: 'Soft dimensional shading meets hard, fully closed typographic silhouettes.' },
    { id: 'deep-groove', number: '05', family: 'Concentric forms', title: 'Deep Groove', description: 'Nested contour bands turn the heading into a dense optical groove.' },
    { id: 'split-orbit', number: '06', family: 'Concentric forms', title: 'Split Orbit', description: 'Circular contour systems intersect the letters like moving turntables.' },
    { id: 'kinetic-archive', number: '07', family: 'Echo extrusion', title: 'Kinetic Archive', description: 'Offset outline layers pull the type backward into rhythmic depth.' },
    { id: 'perspective-choir', number: '08', family: 'Echo extrusion', title: 'Perspective Choir', description: 'A fan of repeated letterforms converges on one sharp fluorescent face.' },
    { id: 'prism-lattice', number: '09', family: 'Isometric mesh', title: 'Prism Lattice', description: 'Transparent triangular planes weave through a crystalline word structure.' },
    { id: 'crystal-relay', number: '10', family: 'Isometric mesh', title: 'Crystal Relay', description: 'Shifted glass letter planes exchange colour through a luminous lattice.' },
    { id: 'folded-signal', number: '11', family: 'Folded geometry', title: 'Folded Signal', description: 'Diagonal facets fold a monumental headline into alternating light planes.' },
    { id: 'paper-cut', number: '12', family: 'Folded geometry', title: 'Paper Cut', description: 'Crisp sliced planes create a tactile typographic object with hard shadows.' },
    { id: 'instrument-type', number: '13', family: 'Technical display', title: 'Instrument Type', description: 'The heading becomes a calibrated audio instrument with ticks and nodes.' },
    { id: 'signal-console', number: '14', family: 'Technical display', title: 'Signal Console', description: 'A neon schematic combines full letters, sequencer bars and live data marks.' }
  ]);

  const optionById = (id) => OPTIONS.find((option) => option.id === id) || OPTIONS[0];
  const text = (className, y, extra = '') => `<text class="${className}" x="600" y="${y}" text-anchor="middle" ${extra}>${y < 350 ? 'COMMUNE' : 'SOUND'}</text>`;
  const pair = (className, extra = '') => `${text(className, 245, extra)}${text(className, 442, extra)}`;
  const echoes = (className, count, dx, dy, scale = 0) => Array.from({ length: count }, (_, index) => {
    const depth = count - index;
    return `<g transform="translate(${depth * dx} ${depth * dy}) scale(${1 + depth * scale / count}) translate(${-600 * depth * scale / count} ${-280 * depth * scale / count})">${pair(className)}</g>`;
  }).join('');
  const nodes = (count, seed = 17) => {
    let value = seed >>> 0;
    const random = () => {
      value = Math.imul(value ^ (value >>> 15), 1 | value);
      value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    return Array.from({ length: count }, (_, index) => {
      const x = 70 + random() * 1060;
      const y = 70 + random() * 430;
      const radius = 1.4 + random() * 3.6;
      return `<circle class="signal-node node-${index % 3}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}"/>`;
    }).join('');
  };

  const definitions = `
    <defs>
      <linearGradient id="violetAcid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6047ff"/><stop offset="0.47" stop-color="#bd3cff"/><stop offset="1" stop-color="#d3ff7d"/></linearGradient>
      <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#190b38"/><stop offset="0.18" stop-color="#a47aff"/><stop offset="0.38" stop-color="#f8efff"/><stop offset="0.54" stop-color="#471886"/><stop offset="0.78" stop-color="#d3ff7d"/><stop offset="1" stop-color="#291150"/></linearGradient>
      <linearGradient id="softChrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8efff"/><stop offset="0.3" stop-color="#6a4cff"/><stop offset="0.58" stop-color="#140720"/><stop offset="0.82" stop-color="#c33eff"/><stop offset="1" stop-color="#d3ff7d"/></linearGradient>
      <pattern id="particleFill" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.45" fill="#d3ff7d"/><circle cx="7" cy="6" r="1.1" fill="#874fff"/></pattern>
      <pattern id="meshFill" width="44" height="38" patternUnits="userSpaceOnUse"><path d="M0 38L22 0l22 38M0 0l44 38M44 0L0 38" fill="none" stroke="#72ffd0" stroke-width="1" opacity=".55"/></pattern>
      <filter id="glow" x="-30%" y="-40%" width="160%" height="180%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="softShadow" x="-30%" y="-30%" width="180%" height="180%"><feDropShadow dx="16" dy="18" stdDeviation="13" flood-color="#000" flood-opacity=".82"/></filter>
      <clipPath id="topHalf"><rect width="1200" height="280"/></clipPath>
      <clipPath id="bottomHalf"><rect y="280" width="1200" height="280"/></clipPath>
      <clipPath id="diagonalA"><path d="M0 0H1200L780 560H0Z"/></clipPath>
      <clipPath id="diagonalB"><path d="M1200 0V560H0L420 0Z"/></clipPath>
    </defs>`;

  const composition = (id) => {
    switch (id) {
      case 'loop-stack':
        return `<g class="loop-stack">${echoes('ribbon-fine', 11, 0.9, -1.15)}${pair('ribbon-core')}</g>`;
      case 'ribbon-current':
        return `<g class="ribbon-current">${pair('ribbon-wide')}${pair('ribbon-dash')}${pair('ribbon-core-thin')}</g>`;
      case 'chrome-monolith':
        return `<g class="chrome-monolith" filter="url(#softShadow)">${pair('monolith-shadow', 'transform="translate(18 18)"')}${pair('monolith-core')}${pair('monolith-facet', 'clip-path="url(#diagonalA)"')}</g>`;
      case 'soft-void':
        return `<g class="soft-void">${pair('void-haze', 'transform="translate(-17 0)"')}${pair('void-core')}${pair('void-edge')}</g>`;
      case 'deep-groove':
        return `<g class="deep-groove">${pair('groove-outer')}${pair('groove-mid')}${pair('groove-inner')}${pair('groove-core')}</g>`;
      case 'split-orbit':
        return `<g class="split-orbit"><circle class="orbit-ring orbit-a" cx="272" cy="230" r="182"/><circle class="orbit-ring orbit-b" cx="924" cy="342" r="168"/><circle class="orbit-ring orbit-c" cx="612" cy="278" r="246"/>${pair('orbit-core')}${pair('orbit-highlight')}</g>`;
      case 'kinetic-archive':
        return `<g class="kinetic-archive">${echoes('archive-echo', 16, 3.2, -2.2)}${pair('archive-face')}</g>`;
      case 'perspective-choir':
        return `<g class="perspective-choir">${echoes('choir-echo', 13, -3.4, 1.7, 0.016)}${pair('choir-face')}</g>`;
      case 'prism-lattice':
        return `<g class="prism-lattice">${pair('prism-shadow', 'transform="translate(22 18) skewX(-8)"')}${pair('prism-mesh')}${pair('prism-edge')}</g>`;
      case 'crystal-relay':
        return `<g class="crystal-relay">${pair('crystal-back', 'transform="translate(-22 0) skewY(-3)"')}${pair('crystal-front', 'transform="translate(22 0) skewY(3)"')}${pair('crystal-edge')}</g>`;
      case 'folded-signal':
        return `<g class="folded-signal" filter="url(#softShadow)">${pair('fold-base')}${pair('fold-light', 'clip-path="url(#diagonalA)" transform="translate(-10 -5)"')}${pair('fold-dark', 'clip-path="url(#diagonalB)" transform="translate(10 5)"')}${pair('fold-edge')}</g>`;
      case 'paper-cut':
        return `<g class="paper-cut">${pair('paper-shadow', 'transform="translate(20 22)"')}${pair('paper-top', 'clip-path="url(#topHalf)" transform="translate(-8 -7)"')}${pair('paper-bottom', 'clip-path="url(#bottomHalf)" transform="translate(8 7)"')}${pair('paper-edge')}</g>`;
      case 'instrument-type':
        return `<g class="instrument-type"><path class="measure-line" d="M60 95H1140M60 500H1140M83 68V520M1117 68V520"/>${nodes(32, 29)}${pair('instrument-core')}${pair('instrument-scan')}<text class="micro-label" x="84" y="86">CS / TYPOGRAPHIC INSTRUMENT / 13</text><text class="micro-label" x="1116" y="520" text-anchor="end">FREQ 27.08 / MOVEMENT MUSIC LIGHT</text></g>`;
      case 'signal-console':
        return `<g class="signal-console">${nodes(52, 43)}<path class="console-wave" d="M58 286H164l18-28 26 61 30-48 26 15h142l22-31 30 62 24-31h152l24-34 32 67 26-33h148l21-22 28 44 23-22h74"/>${pair('console-core')}${pair('console-bars')}<text class="micro-label" x="76" y="78">COMMUNE SIGNAL SYSTEM</text><text class="micro-label" x="1124" y="512" text-anchor="end">LIVE / HUMAN / SONIC</text></g>`;
      default:
        return pair('ribbon-core');
    }
  };

  const create = ({ container, optionId }) => {
    if (!(container instanceof HTMLElement)) throw new Error('Heading study container missing');
    const option = optionById(optionId);
    const params = new URLSearchParams(location.search);
    const debugMode = params.get('debug') === 'base' ? 'base' : 'final';
    const motionMode = params.get('motion') === 'off' ? 'off' : 'on';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1200 560');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Commune Sound heading option ${option.number}, ${option.title}`);
    svg.classList.add('heading-art', `heading-${option.id}`);
    svg.dataset.option = option.id;
    svg.dataset.family = option.family;
    svg.dataset.silhouette = 'continuous-base-letterforms';
    svg.dataset.referenceMode = 'original-interpretation-not-source-reproduction';
    svg.dataset.debugMode = debugMode;
    svg.dataset.motionMode = motionMode;
    svg.dataset.visualContract = 'continuous-readable-commune-sound-silhouette|family-specific-construction|purple-green-palette|mobile-legibility';
    svg.innerHTML = `${definitions}<rect class="art-backdrop" width="1200" height="560" rx="2"/>${composition(option.id)}<g class="diagnostic-base">${pair('diagnostic-core')}</g>`;
    container.append(svg);
    return { svg, option };
  };

  window.CommuneHeadingStudies = Object.freeze({ create, options: OPTIONS, optionById });
})();

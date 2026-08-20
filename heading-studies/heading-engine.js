(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const OPTIONS = Object.freeze([
    { id: 'parallel-ritual', number: '01', family: 'Continuous line alphabet', title: 'Parallel Ritual', description: 'Custom rounded glyphs built entirely from nested parallel tubes.' },
    { id: 'loop-current', number: '02', family: 'Continuous line alphabet', title: 'Loop Current', description: 'A looser single-line alphabet with doubled loops and woven crossings.' },
    { id: 'radial-groove', number: '03', family: 'Concentric alphabet', title: 'Radial Groove', description: 'Letters expand as alternating contour bands with deep black counters.' },
    { id: 'echo-architecture', number: '04', family: 'Extruded alphabet', title: 'Echo Architecture', description: 'Angular custom glyphs extend backward as precise architectural echoes.' },
    { id: 'prism-wire', number: '05', family: 'Isometric alphabet', title: 'Prism Wire', description: 'Sharp letter skeletons become transparent spatial wire structures.' },
    { id: 'crystal-code', number: '06', family: 'Isometric alphabet', title: 'Crystal Code', description: 'Faceted letter strokes overlap as luminous purple and green prisms.' },
    { id: 'folded-modules', number: '07', family: 'Folded alphabet', title: 'Folded Modules', description: 'Every letter is assembled from hard folded slabs and diagonal joints.' },
    { id: 'negative-machines', number: '08', family: 'Negative-space alphabet', title: 'Negative Machines', description: 'Heavy geometric letter machines are cut open by sharp black channels.' },
    { id: 'instrument-glyphs', number: '09', family: 'Technical alphabet', title: 'Instrument Glyphs', description: 'A calibrated custom alphabet behaves like a set of audio instruments.' },
    { id: 'signal-organisms', number: '10', family: 'Living signal alphabet', title: 'Signal Organisms', description: 'Hand-drawn letter paths host particles, pulses and orbiting signal nodes.' },
    { id: 'circuit-choreography', number: '11', family: 'Instrument-panel alphabet', title: 'Circuit Choreography', description: 'Letters are assembled as playable diagrams of rails, meters, gates and signal junctions.' },
    { id: 'contour-flux', number: '12', family: 'Topographic alphabet', title: 'Contour Flux', description: 'Elastic letter paths spread into a moving field of tightly spaced contours.' },
    { id: 'lattice-relay', number: '13', family: 'Constructed lattice alphabet', title: 'Lattice Relay', description: 'Triangulated strokes and cross-braced joints make each letter feel engineered in space.' },
    { id: 'aperture-sequence', number: '14', family: 'Radial aperture alphabet', title: 'Aperture Sequence', description: 'Broken rings, rotating sectors and open counters turn the wordmark into a sequence of lenses.' },
    { id: 'split-monoliths', number: '15', family: 'Cut-volume alphabet', title: 'Split Monoliths', description: 'Massive geometric letter bodies are sliced into offset slabs with luminous internal edges.' },
    { id: 'kinetic-notation', number: '16', family: 'Movement-score alphabet', title: 'Kinetic Notation', description: 'Directional strokes, beat marks and small waveforms draw the title like a choreographic score.' }
  ]);

  const WORDS = Object.freeze([
    { letters: [...'COMMUNE'], x: 76, y: 82, step: 150, scale: 1.03 },
    { letters: [...'SOUND'], x: 220, y: 322, step: 166, scale: 1.08 }
  ]);

  const ROUND = Object.freeze({
    C: 'M84 22C68 4 34 4 17 28C1 51 3 101 20 122C37 143 68 139 85 120',
    O: 'M50 8C22 8 10 30 10 72C10 113 22 134 50 134C78 134 90 113 90 72C90 30 78 8 50 8Z',
    M: 'M10 132V12L50 78L90 12V132',
    U: 'M10 12V88C10 120 25 134 50 134C75 134 90 120 90 88V12',
    N: 'M10 132V12L90 132V12',
    E: 'M88 12H12V132H88M12 70H72',
    S: 'M86 24C69 6 29 7 14 30C0 54 22 66 50 72C79 78 95 92 84 116C72 139 27 140 10 118',
    D: 'M12 12V132H42C75 132 90 112 90 72C90 31 74 12 42 12Z'
  });

  const ANGULAR = Object.freeze({
    C: 'M88 12H35L10 38V106L35 132H88',
    O: 'M35 12H65L90 38V106L65 132H35L10 106V38Z',
    M: 'M10 132V12L50 78L90 12V132',
    U: 'M10 12V106L35 132H65L90 106V12',
    N: 'M10 132V12L90 132V12',
    E: 'M90 12H10V132H90M10 70H74',
    S: 'M90 12H31L10 35V64H72L90 82V109L69 132H10',
    D: 'M10 12V132H62L90 104V40L62 12Z'
  });

  const LOOP = Object.freeze({
    C: 'M91 30C72 1 31 0 11 38C-2 70 5 124 43 136C68 144 88 126 92 106',
    O: 'M50 6C17 6 5 35 12 78C20 123 41 141 67 133C94 124 98 83 87 42C78 12 62 5 50 6Z',
    M: 'M8 132V25C8 5 27 5 35 24L50 65L66 23C75 4 92 7 92 27V132',
    U: 'M8 14V83C8 121 24 138 48 138C78 138 94 115 91 76L86 12',
    N: 'M8 132V23C8 4 24 3 34 20L76 111C84 128 92 119 92 101V12',
    E: 'M91 14H34C15 14 9 27 9 43V108C9 125 20 132 38 132H91M9 72H74',
    S: 'M91 30C72 3 25 4 11 37C0 63 28 70 53 74C84 79 97 95 82 121C67 145 25 139 7 113',
    D: 'M9 12V132H42C76 132 94 109 91 67C89 29 72 12 42 12Z'
  });

  const RADIAL = Object.freeze({
    C: 'M92 28A48 60 0 1 0 92 116M73 45A27 40 0 1 0 73 99',
    O: 'M50 7A42 65 0 1 0 50 137A42 65 0 1 0 50 7M50 30A20 42 0 1 1 50 114A20 42 0 1 1 50 30',
    M: 'M7 132V18L50 91L93 18V132M27 132V68L50 108L73 68V132',
    U: 'M7 12V88A43 46 0 0 0 93 88V12M27 12V86A23 25 0 0 0 73 86V12',
    N: 'M7 132V12L93 132V12M28 132V60L72 121V12',
    E: 'M94 12H7V132H94M7 72H78M30 34H85M30 108H85',
    S: 'M91 28A46 30 0 0 0 8 46C8 67 28 70 52 74C79 78 94 90 91 109A46 30 0 0 1 8 116',
    D: 'M7 12V132H43A43 60 0 0 0 43 12ZM28 34V110H42A23 38 0 0 0 42 34Z'
  });

  const PRISM = Object.freeze({
    C: 'M92 12H34L8 40V104L34 132H92L69 108H42L30 95V50L43 36H69Z',
    O: 'M34 10H66L94 40V104L66 134H34L6 104V40ZM44 38L32 52V92L45 106H56L68 92V52L56 38Z',
    M: 'M6 132V12L50 70L94 12V132L72 110V65L50 96L28 65V110Z',
    U: 'M6 12L30 36V94L43 108H57L70 94V36L94 12V106L67 134H33L6 106Z',
    N: 'M6 132V12L72 98V12H94V132L28 46V132Z',
    E: 'M94 12H6V132H94L70 108H32V86H72L52 66H32V36H70Z',
    S: 'M94 12H31L6 39V70H67L72 76V98L62 108H6L31 132H70L94 106V64H35L30 59V42L37 36H70Z',
    D: 'M6 12V132H64L94 101V43L64 12ZM32 38H55L68 52V92L55 106H32Z'
  });

  const MODULAR = Object.freeze({
    C: 'M90 14H36L10 40M10 48V98M10 106L36 132H90',
    O: 'M34 12H66M74 20L90 38M90 48V98M90 108L66 132M56 132H34M25 124L10 106M10 96V46M10 36L34 12',
    M: 'M10 132V12M18 20L50 74M50 74L82 20M90 12V132',
    U: 'M10 12V100M18 112L34 130M44 134H58M68 130L84 112M90 100V12',
    N: 'M10 132V12M18 26L82 118M90 132V12',
    E: 'M90 12H10M10 22V122M10 132H90M10 70H72',
    S: 'M88 20L70 12H34M22 18L10 34V60M18 68L72 76M84 84L90 100V116M80 126L68 132H22',
    D: 'M10 12V132M20 132H60M70 124L90 100M90 90V50M84 38L64 12H20'
  });

  const FOLD = Object.freeze({
    C: 'M92 18L70 38H40L26 52V96L40 110H70L92 130H32L6 104V42L32 16Z',
    O: 'M31 10H69L94 39V105L69 134H31L6 105V39ZM43 43L31 56V89L43 102H57L69 89V56L57 43Z',
    M: 'M6 132V12L50 77L94 12V132H68V70L50 101L32 70V132Z',
    U: 'M6 12H32V94L43 107H57L68 94V12H94V106L68 134H32L6 106Z',
    N: 'M6 132V12H30L70 82V12H94V132H70L30 62V132Z',
    E: 'M94 12H6V132H94V108H32V83H75V59H32V36H94Z',
    S: 'M94 12H29L6 38V73H67V108H6V132H72L94 107V62H32V36H94Z',
    D: 'M6 12V132H65L94 101V43L65 12ZM32 38H55L68 53V91L55 106H32Z'
  });

  const BLOCK = Object.freeze({
    C: 'M94 12H18L6 24V120L18 132H94V104H38V40H94Z',
    O: 'M18 12H82L94 24V120L82 132H18L6 120V24ZM38 40V104H62V40Z',
    M: 'M6 132V12H34L50 50L66 12H94V132H68V61L50 102L32 61V132Z',
    U: 'M6 12H34V102H66V12H94V118L80 132H20L6 118Z',
    N: 'M6 132V12H32L68 78V12H94V132H68L32 66V132Z',
    E: 'M94 12H6V132H94V104H38V84H78V58H38V40H94Z',
    S: 'M94 12H18L6 24V78H66V104H6V132H82L94 120V52H34V40H94Z',
    D: 'M6 12V132H76L94 114V30L76 12ZM38 40H62V104H38Z'
  });

  const ORGANIC = Object.freeze({
    C: 'M90 28C70 3 29 1 11 35C-5 66 5 121 44 137C68 147 90 126 94 103',
    O: 'M49 5C17 4 3 35 10 77C17 124 38 141 65 135C94 129 101 85 89 39C80 10 64 5 49 5Z',
    M: 'M7 134C9 92 3 47 12 15C17-1 31 7 38 28L51 68L67 24C73 5 90 2 92 24L94 134',
    U: 'M7 10C9 43 3 88 14 114C26 142 62 147 82 120C97 99 89 49 93 10',
    N: 'M7 134C10 91 2 46 12 17C17 3 30 9 39 29L77 113C84 130 94 122 93 101L90 9',
    E: 'M93 13C70 17 35 5 18 19C4 31 10 111 17 126C31 139 71 127 94 132M12 72C32 64 55 80 78 70',
    S: 'M93 27C72 0 27 3 10 36C-2 60 29 70 52 74C83 79 98 97 82 123C66 147 22 139 5 110',
    D: 'M8 9C13 45 3 102 12 135C34 128 64 143 83 116C102 89 98 39 74 18C54 1 30 15 8 9Z'
  });

  const TECH = Object.freeze({
    C: 'M88 24A48 58 0 1 0 88 120M18 72H48',
    O: 'M50 8A40 64 0 1 0 50 136A40 64 0 1 0 50 8M50 24V42M50 118V136',
    M: 'M8 132V12L50 86L92 12V132M28 48H72',
    U: 'M10 12V96A40 38 0 0 0 90 96V12M50 116V140',
    N: 'M10 132V12L90 132V12M10 74H32M68 70H90',
    E: 'M90 12H10V132H90M10 70H76M55 52V88',
    S: 'M88 22C69 5 27 8 12 33C0 55 23 68 50 72C80 77 96 92 84 118C72 141 28 139 10 118M50 56V88',
    D: 'M10 12V132H43A47 60 0 0 0 43 12ZM44 72H92'
  });

  const CIRCUIT = Object.freeze({
    C: 'M92 27A46 58 0 1 0 92 117M18 72H47M47 72V52M47 72V92',
    O: 'M50 8A41 64 0 1 0 50 136A41 64 0 1 0 50 8M50 30A21 42 0 1 1 50 114A21 42 0 1 1 50 30M8 72H29M71 72H92',
    M: 'M8 132V12L50 78L92 12V132M8 40H27M73 40H92M50 78V112',
    U: 'M9 12V94A41 40 0 0 0 91 94V12M30 12V88A20 20 0 0 0 70 88V12M50 109V140',
    N: 'M9 132V12L91 132V12M9 48H26M74 96H91M50 72V100',
    E: 'M92 12H9V132H92M9 72H76M50 52V92M73 12V31M73 113V132',
    S: 'M90 25C70 4 27 8 12 34C1 56 24 68 50 72C80 77 96 93 83 119C70 141 28 138 9 117M50 55V89M32 72H68',
    D: 'M9 12V132H43A47 60 0 0 0 43 12ZM43 35A24 37 0 0 1 43 109M43 72H92'
  });

  const CONTOUR = Object.freeze({
    C: 'M92 31C74 1 34 0 13 34C-3 61 2 116 38 136C63 150 89 131 95 103',
    O: 'M49 5C18 3 3 34 9 76C15 123 37 142 66 136C96 129 101 83 88 38C80 11 64 5 49 5Z',
    M: 'M6 134C11 94 1 46 13 15C20-3 34 11 41 33L52 70L66 25C73 4 91 3 93 25L95 134',
    U: 'M7 9C10 44 2 90 15 116C29 145 65 145 83 118C98 95 89 46 93 9',
    N: 'M6 134C11 91 1 45 13 16C19 2 32 9 41 30L77 113C85 132 96 120 93 98L89 8',
    E: 'M94 13C71 18 34 4 17 20C3 34 10 111 17 127C32 140 73 126 95 132M12 72C35 60 56 83 80 69',
    S: 'M94 28C72 0 26 2 9 37C-3 62 30 70 53 74C84 79 99 98 82 124C65 149 21 138 4 109',
    D: 'M7 8C14 46 1 102 13 136C36 127 66 144 85 115C103 87 97 38 73 17C52 0 30 16 7 8Z'
  });

  const LATTICE = Object.freeze({
    C: 'M92 16H33L7 43V104L33 130H92M7 43L92 130M7 104L92 16',
    O: 'M33 12H67L93 40V104L67 132H33L7 104V40ZM33 12L67 132M67 12L33 132M7 40L93 104M93 40L7 104',
    M: 'M7 132V12L50 78L93 12V132M7 12L50 132L93 12M7 132L50 78L93 132',
    U: 'M7 12V104L33 132H67L93 104V12M7 12L67 132M93 12L33 132M7 104H93',
    N: 'M7 132V12L93 132V12M7 12L93 74M7 70L93 132M50 43V101',
    E: 'M93 12H7V132H93M7 72H76M7 12L76 72M7 132L76 72',
    S: 'M93 12H31L7 38V70H70L93 94V108L69 132H7M7 38L93 108M7 70L69 132',
    D: 'M7 12V132H64L93 103V41L64 12ZM7 12L93 103M7 132L93 41M36 40V104'
  });

  const APERTURE = Object.freeze({
    C: 'M91 25A46 62 0 1 0 91 119M73 45A25 40 0 1 0 73 99M50 8V32M50 112V136',
    O: 'M50 7A43 65 0 1 0 50 137A43 65 0 1 0 50 7M50 29A21 43 0 1 1 50 115A21 43 0 1 1 50 29M7 72H29M71 72H93',
    M: 'M7 132V15L50 88L93 15V132M28 132V74L50 111L72 74V132M50 88V55',
    U: 'M7 12V88A43 47 0 0 0 93 88V12M28 12V86A22 25 0 0 0 72 86V12M50 111V137',
    N: 'M7 132V12L93 132V12M28 132V65L72 121V12M50 72A18 18 0 1 0 50 71',
    E: 'M94 12H7V132H94M7 72H79M30 35H86M30 109H86M7 72A32 32 0 0 0 39 40',
    S: 'M91 27A46 31 0 0 0 8 46C8 67 29 70 53 74C80 78 95 91 91 110A46 31 0 0 1 8 116M50 55A18 18 0 1 0 50 89',
    D: 'M7 12V132H43A43 60 0 0 0 43 12ZM28 34V110H42A23 38 0 0 0 42 34ZM43 52A20 20 0 1 1 43 92'
  });

  const SPLIT = Object.freeze({
    C: 'M94 12H22L6 28V116L22 132H94V103H39V41H94ZM6 72H63',
    O: 'M20 12H80L94 26V118L80 132H20L6 118V26ZM39 41V103H61V41ZM6 72H94',
    M: 'M6 132V12H33L50 50L67 12H94V132H68V62L50 103L32 62V132ZM6 72H36M64 72H94',
    U: 'M6 12H34V102H66V12H94V118L80 132H20L6 118ZM6 72H34M66 72H94',
    N: 'M6 132V12H32L68 78V12H94V132H68L32 66V132ZM6 72H35M65 72H94',
    E: 'M94 12H6V132H94V103H39V84H79V58H39V41H94ZM6 72H79',
    S: 'M94 12H20L6 26V78H66V103H6V132H80L94 118V52H34V41H94ZM6 72H66',
    D: 'M6 12V132H76L94 114V30L76 12ZM39 41H61V103H39ZM6 72H39M61 72H94'
  });

  const NOTATION = Object.freeze({
    C: 'M91 27A47 58 0 1 0 91 117M18 52L7 72L18 92M69 28L82 18L91 27',
    O: 'M50 8A41 64 0 1 0 50 136A41 64 0 1 0 50 8M50 8V31M50 113V136M9 72H29M71 72H91',
    M: 'M8 132V12L50 82L92 12V132M8 112L22 98M78 98L92 112M50 82V112',
    U: 'M9 12V95A41 39 0 0 0 91 95V12M9 35L23 49M77 49L91 35M50 115V140',
    N: 'M9 132V12L91 132V12M9 91L23 105M77 39L91 53M42 62L58 82',
    E: 'M92 12H9V132H92M9 72H76M60 12V30M60 114V132M76 62V82',
    S: 'M90 26C70 5 28 7 12 34C1 56 24 68 50 72C80 77 96 93 83 119C70 141 28 138 9 117M22 25L34 38M66 106L79 119',
    D: 'M9 12V132H43A47 60 0 0 0 43 12ZM43 30V48M43 96V114M72 45L86 33M72 99L86 111'
  });

  const optionById = (id) => OPTIONS.find((option) => option.id === id) || OPTIONS[0];
  const glyphInstances = (alphabet, className, extra = '') => WORDS.map((word, row) => word.letters.map((letter, index) => {
    const x = word.x + index * word.step;
    return `<path class="${className} glyph glyph-${letter}" data-letter="${letter}" data-row="${row}" d="${alphabet[letter]}" transform="translate(${x} ${word.y}) scale(${word.scale})" ${extra}/>`;
  }).join('')).join('');

  const repeatGlyphs = (alphabet, className, count, dx, dy) => Array.from({ length: count }, (_, index) => {
    const depth = count - index;
    return `<g transform="translate(${depth * dx} ${depth * dy})">${glyphInstances(alphabet, className)}</g>`;
  }).join('');

  const deterministicNodes = (count, seed) => {
    let state = seed >>> 0;
    const random = () => {
      state = Math.imul(state ^ (state >>> 15), 1 | state);
      state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
      return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
    };
    return Array.from({ length: count }, (_, index) => `<circle class="signal-node node-${index % 3}" cx="${(45 + random() * 1110).toFixed(1)}" cy="${(50 + random() * 465).toFixed(1)}" r="${(1.2 + random() * 3.2).toFixed(1)}"/>`).join('');
  };

  const defs = `
    <defs>
      <linearGradient id="spectrum" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#694cff"/><stop offset=".46" stop-color="#c33cff"/><stop offset="1" stop-color="#d3ff7d"/></linearGradient>
      <linearGradient id="fold" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#2b1156"/><stop offset=".25" stop-color="#7650ff"/><stop offset=".5" stop-color="#f4ecff"/><stop offset=".72" stop-color="#b83dff"/><stop offset="1" stop-color="#d3ff7d"/></linearGradient>
      <pattern id="mesh" width="24" height="22" patternUnits="userSpaceOnUse"><path d="M0 22L12 0l12 22M0 0l24 22M24 0L0 22" fill="none" stroke="#72ffd0" stroke-width=".75" opacity=".7"/></pattern>
      <pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.35" fill="#d3ff7d"/><circle cx="7" cy="6" r="1" fill="#7a50ff"/></pattern>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="shadow" x="-40%" y="-40%" width="200%" height="200%"><feDropShadow dx="12" dy="14" stdDeviation="8" flood-color="#000" flood-opacity=".9"/></filter>
    </defs>`;

  const buildParallel = () => {
    const bands = [34, 29, 24, 19, 14, 9, 4].map((width, i) => glyphInstances(ROUND, `parallel-band band-${i}`, `style="stroke-width:${width}"`)).join('');
    return `<g class="parallel-ritual">${bands}</g>`;
  };
  const buildLoopCurrent = () => `<g class="loop-current">${glyphInstances(LOOP, 'loop-shadow')}${glyphInstances(LOOP, 'loop-body')}${glyphInstances(LOOP, 'loop-thread')}${deterministicNodes(34, 17)}</g>`;
  const buildRadial = () => {
    const bands = [42, 35, 28, 21, 14, 7].map((width, i) => glyphInstances(RADIAL, `radial-band radial-${i}`, `style="stroke-width:${width}"`)).join('');
    return `<g class="radial-groove">${bands}<circle class="groove-orbit" cx="600" cy="280" r="244"/></g>`;
  };
  const buildEcho = () => `<g class="echo-architecture">${repeatGlyphs(ANGULAR, 'echo-line', 15, 3.2, -2.4)}${glyphInstances(ANGULAR, 'echo-face')}</g>`;
  const buildPrism = () => `<g class="prism-wire">${repeatGlyphs(PRISM, 'prism-depth', 7, 3.5, 2.2)}${glyphInstances(PRISM, 'prism-core')}${glyphInstances(PRISM, 'prism-mesh')}</g>`;
  const buildCrystal = () => `<g class="crystal-code">${glyphInstances(MODULAR, 'crystal-violet')}${repeatGlyphs(MODULAR, 'crystal-plane', 4, -4.5, 2.8)}${glyphInstances(MODULAR, 'crystal-light')}</g>`;
  const buildFolded = () => `<g class="folded-modules" filter="url(#shadow)">${glyphInstances(FOLD, 'fold-shadow')}${glyphInstances(FOLD, 'fold-body')}${glyphInstances(FOLD, 'fold-seam')}</g>`;
  const buildNegative = () => `<g class="negative-machines">${glyphInstances(BLOCK, 'machine-block')}${glyphInstances(BLOCK, 'machine-cut')}${repeatGlyphs(BLOCK, 'machine-echo', 3, 5, 4)}</g>`;
  const buildInstrument = () => `<g class="instrument-glyphs"><path class="calibration" d="M50 54H1150M50 510H1150M62 42V520M1138 42V520M600 42V520"/>${glyphInstances(TECH, 'instrument-path')}${glyphInstances(TECH, 'instrument-pulse')}${deterministicNodes(46, 31)}</g>`;
  const buildOrganisms = () => `<g class="signal-organisms">${glyphInstances(ORGANIC, 'organism-halo')}${glyphInstances(ORGANIC, 'organism-body')}${glyphInstances(ORGANIC, 'organism-flow')}${deterministicNodes(72, 47)}<circle class="organism-orbit orbit-a" cx="265" cy="175" r="140"/><circle class="organism-orbit orbit-b" cx="910" cy="400" r="126"/></g>`;
  const buildCircuit = () => `<g class="circuit-choreography"><path class="circuit-grid" d="M48 48H1152M48 280H1152M48 512H1152M120 36V524M600 36V524M1080 36V524"/>${glyphInstances(CIRCUIT, 'circuit-rail')}${glyphInstances(CIRCUIT, 'circuit-signal')}${deterministicNodes(58, 83)}</g>`;
  const buildContour = () => `<g class="contour-flux">${repeatGlyphs(CONTOUR, 'contour-line', 13, 2.6, -2.3)}${glyphInstances(CONTOUR, 'contour-core')}</g>`;
  const buildLattice = () => `<g class="lattice-relay">${glyphInstances(LATTICE, 'lattice-shadow')}${glyphInstances(LATTICE, 'lattice-beam')}${glyphInstances(LATTICE, 'lattice-thread')}</g>`;
  const buildAperture = () => `<g class="aperture-sequence">${glyphInstances(APERTURE, 'aperture-halo')}${glyphInstances(APERTURE, 'aperture-ring')}${glyphInstances(APERTURE, 'aperture-index')}${deterministicNodes(32, 113)}</g>`;
  const buildSplit = () => `<g class="split-monoliths">${glyphInstances(SPLIT, 'split-shadow')}${glyphInstances(SPLIT, 'split-body')}${glyphInstances(SPLIT, 'split-cut')}</g>`;
  const buildNotation = () => `<g class="kinetic-notation"><path class="score-line" d="M48 278H1152M48 290H1152"/>${glyphInstances(NOTATION, 'notation-stroke')}${glyphInstances(NOTATION, 'notation-beat')}${deterministicNodes(38, 167)}</g>`;

  const composition = (id) => ({
    'parallel-ritual': buildParallel,
    'loop-current': buildLoopCurrent,
    'radial-groove': buildRadial,
    'echo-architecture': buildEcho,
    'prism-wire': buildPrism,
    'crystal-code': buildCrystal,
    'folded-modules': buildFolded,
    'negative-machines': buildNegative,
    'instrument-glyphs': buildInstrument,
    'signal-organisms': buildOrganisms,
    'circuit-choreography': buildCircuit,
    'contour-flux': buildContour,
    'lattice-relay': buildLattice,
    'aperture-sequence': buildAperture,
    'split-monoliths': buildSplit,
    'kinetic-notation': buildNotation
  }[id] || buildParallel)();

  const alphabetForOption = (id) => ({
    'parallel-ritual': ROUND,
    'loop-current': LOOP,
    'radial-groove': RADIAL,
    'echo-architecture': ANGULAR,
    'prism-wire': PRISM,
    'crystal-code': MODULAR,
    'folded-modules': FOLD,
    'negative-machines': BLOCK,
    'instrument-glyphs': TECH,
    'signal-organisms': ORGANIC,
    'circuit-choreography': CIRCUIT,
    'contour-flux': CONTOUR,
    'lattice-relay': LATTICE,
    'aperture-sequence': APERTURE,
    'split-monoliths': SPLIT,
    'kinetic-notation': NOTATION
  }[id] || ROUND);

  const create = ({ container, optionId }) => {
    if (!(container instanceof HTMLElement)) throw new Error('Heading study container missing');
    const option = optionById(optionId);
    const params = new URLSearchParams(location.search);
    const debugMode = params.get('debug') === 'skeleton' ? 'skeleton' : 'final';
    const motionMode = params.get('motion') === 'off' ? 'off' : 'on';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1200 560');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Custom-drawn Commune Sound heading option ${option.number}, ${option.title}`);
    svg.classList.add('heading-art', `heading-${option.id}`);
    svg.dataset.option = option.id;
    svg.dataset.family = option.family;
    svg.dataset.geometrySource = 'custom-svg-path-alphabet';
    svg.dataset.fontElements = '0';
    svg.dataset.debugMode = debugMode;
    svg.dataset.motionMode = motionMode;
    svg.dataset.visualContract = 'no-font-glyphs|custom-letter-anatomy|recognisable-commune-sound|purple-green-palette|mobile-legibility';
    svg.innerHTML = `${defs}<rect class="art-backdrop" width="1200" height="560"/>${composition(option.id)}<g class="diagnostic-skeleton">${glyphInstances(alphabetForOption(option.id), 'skeleton-path')}</g>`;
    container.append(svg);
    return { svg, option };
  };

  window.CommuneHeadingStudies = Object.freeze({ create, options: OPTIONS, optionById });
})();

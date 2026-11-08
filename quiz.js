(function () {
  const D = QUIZ_DATA, E = DinoEngine;
  const app = document.getElementById('app'), bar = document.getElementById('bar');
  const TOTAL = D.questions.length;
  let S;

  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    kids.flat().forEach((c) => e.append(c));
    return e;
  };
  const show = (...nodes) => {
    app.replaceChildren(...nodes);
    window.scrollTo(0, 0);
    const h = app.querySelector('h1, h2');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  };
  const progress = (done, total) => (bar.style.width = (done / total) * 100 + '%');
  const back = (fn) => el('button', { class: 'link', type: 'button', onclick: fn }, 'Back');

  // Shrink long names so they always fit inside the panel.
  const fit = (el) => {
    el.style.fontSize = '';
    const room = el.parentElement.clientWidth;
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > room && size > 18) { size -= 2; el.style.fontSize = size + 'px'; }
  };
  const fitNames = () => document.querySelectorAll('.genus, .epithet').forEach(fit);
  window.addEventListener('resize', fitNames);
  if (document.fonts) document.fonts.ready.then(fitNames);

  function intro() {
    S = { answers: [], follow: {}, queue: [] };
    progress(0, 1);
    show(
      el('h1', {}, 'Which dinosaur are you?'),
      el('p', { class: 'lede' }, `Answer ${TOTAL} questions about how you think and act, then give your height and weight. We match you to one of ${Object.values(D.speciesDatabase).reduce((n, g) => n + Object.keys(g).length, 0)} prehistoric species.`),
      el('p', { class: 'note' }, 'Your answers stay in your browser. Nothing is sent anywhere.'),
      el('button', { class: 'btn', type: 'button', onclick: () => question(0) }, 'Start the quiz')
    );
  }

  function choices(options, current, onPick) {
    return el('ul', { class: 'opts' }, options.map((text, i) =>
      el('li', {}, el('button', { class: 'opt' + (current === i + 1 ? ' on' : ''), type: 'button', onclick: () => onPick(i + 1) }, text))));
  }

  function question(i) {
    const q = D.questions[i];
    progress(i, TOTAL + 1);
    show(
      el('p', { class: 'kicker' }, `Question ${i + 1} of ${TOTAL}`),
      el('h2', {}, q.title),
      choices(q.options, S.answers[i], (a) => {
        S.answers[i] = a;
        if (i + 1 < TOTAL) return question(i + 1);
        S.result = E.groupScores(S.answers);
        S.queue = S.result.selected.filter((g) => D.followups[g] && D.followups[g].options.length);
        S.queue.length ? follow(0) : bio();
      }),
      i > 0 ? back(() => question(i - 1)) : ''
    );
  }

  function follow(idx) {
    const g = S.queue[idx], f = D.followups[g];
    progress(TOTAL + idx, TOTAL + S.queue.length + 1);
    show(
      el('p', { class: 'kicker' }, S.result.selected.length > 1 ? `Follow-up for ${g} (${idx + 1} of ${S.queue.length})` : 'One follow-up'),
      el('h2', {}, f.prompt),
      choices(f.options, S.follow[g], (a) => {
        S.follow[g] = a;
        idx + 1 < S.queue.length ? follow(idx + 1) : bio();
      }),
      back(() => (idx > 0 ? follow(idx - 1) : question(TOTAL - 1)))
    );
  }

  function bio() {
    progress(TOTAL + S.queue.length, TOTAL + S.queue.length + 1);
    const num = (id, label, attrs) => el('div', {}, el('label', { for: id }, label), el('input', Object.assign({ id, name: id, type: 'number', inputmode: 'decimal', required: '' }, attrs)));
    const err = el('p', { class: 'err', role: 'alert' });
    const form = el('form', { novalidate: '' },
      el('fieldset', {}, el('legend', {}, 'Compare my height to the average for'),
        el('div', { class: 'radios' },
          el('label', {}, el('input', { type: 'radio', name: 'gender', value: 'male', checked: '' }), 'Male'),
          el('label', {}, el('input', { type: 'radio', name: 'gender', value: 'female' }), 'Female'))),
      num('age', 'Age (18 to 100)', { min: 18, max: 100, step: 1 }),
      num('weight', 'Weight in pounds', { min: 1, step: 'any' }),
      el('div', { class: 'row' }, num('ft', 'Height: feet', { min: 0, max: 8, step: 1 }), num('inch', 'inches', { min: 0, step: 'any' })),
      el('div', {}, el('label', { for: 'build' }, 'Build'),
        el('select', { id: 'build', name: 'build' }, [['skinny', 'Skinny'], ['skinny-muscular', 'Skinny muscular'], ['muscular', 'Muscular'], ['skinny-fat', 'Skinny fat'], ['fat-muscular', 'Fat muscular'], ['fat', 'Fat']].map(([v, t]) => el('option', { value: v }, t)))),
      err,
      el('button', { class: 'btn', type: 'submit' }, 'Find my dinosaur')
    );
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = new FormData(form);
      const age = Number(f.get('age')), weight = Number(f.get('weight'));
      const height = Number(f.get('ft')) * 12 + Number(f.get('inch'));
      if (!Number.isInteger(age) || age < 18 || age > 100) return (err.textContent = 'Enter a whole-number age from 18 to 100.');
      if (!(weight > 0)) return (err.textContent = 'Enter your weight in pounds.');
      if (!(height > 0)) return (err.textContent = 'Enter your height in feet and inches.');
      result({ gender: f.get('gender'), age, weight, height, build: f.get('build') });
    });
    show(
      el('p', { class: 'kicker' }, 'Last step'),
      el('h2', {}, 'Now a little about your body'),
      el('p', { class: 'note' }, 'We compare your size, stockiness and power to each dinosaur. This stays in your browser.'),
      form,
      back(() => (S.queue.length ? follow(S.queue.length - 1) : question(TOTAL - 1)))
    );
  }

  function result(input) {
    progress(1, 1);
    const me = E.biometrics(input);
    const pool = E.eligible(S.result.selected, S.follow);
    const match = E.closest(me, pool);
    const stats = pool[match.name];
    const [genus, ...rest] = match.name.split(' ');
    const group = Object.keys(D.speciesDatabase).find((g) => match.name in D.speciesDatabase[g]);
    const row = (label, k) => el('div', {},
      el('div', { class: 'stat-top' }, el('span', {}, label), el('span', {}, `${me[k]} vs ${stats[k]}`)),
      el('div', { class: 'track' }, el('div', { class: 'fill you', style: `width:${me[k] * 10}%` })),
      el('div', { class: 'track' }, el('div', { class: 'fill dino', style: `width:${stats[k] * 10}%` })));
    show(
      el('p', { class: 'kicker' }, S.result.selected.length > 1 ? `You tied between ${S.result.selected.join(' and ')}. Your closest match is in ${group}.` : `Your group: ${group}`),
      el('h1', { class: 'name' }, el('span', { class: 'genus' }, genus), el('span', { class: 'epithet' }, rest.join(' '))),
      el('div', { class: 'card stats' },
        row('Size', 'size'), row('Stockiness', 'stockiness'), row('Power', 'power'),
        el('div', { class: 'key' }, el('span', {}, el('span', { class: 'sw you' }), 'You'), el('span', {}, el('span', { class: 'sw dino' }), genus))),
      el('p', { class: 'note' }, `Picked from ${Object.keys(pool).length} species in your group.`),
      el('button', { class: 'btn', type: 'button', onclick: intro }, 'Take it again')
    );
    fitNames();
  }

  intro();
})();

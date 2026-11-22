// Public, browser-local illustration only. No research API or user data.
export const EXAMPLES = [
  {
    id: 'coastal-temperature', title: 'How does coastal water temperature change?',
    environment: 'water', location: 'Coastal site', grades: ['3–5', '6–8'], added: '2026-11-01',
    keywords: 'ocean sea temperature water change time',
    description: 'Explore a sequence of temperature observations and ask what more would be needed to explain a change.',
    input: 'Planned input: temperature observations with location, observation time, units and source attribution.',
    processing: 'Planned processing: check time coverage and comparability, retain source values, and prepare a time-series chart with gaps and limitations visible.',
    output: 'Planned output: a reviewed chart, an explanation of what it shows, source references and questions suitable for the selected grade level.',
    source: 'NOAA Coral Reef Watch is an example source for sea-surface-temperature records. These invented values are not NOAA observations.',
    sourceUrl: 'https://coralreefwatch.noaa.gov/product/5km/tutorial/crw05a_sst_product.php',
    sourceLabel: 'Read about NOAA sea-surface-temperature data',
    values: [24, 25, 25, 26], labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4'], unit: '°C',
    questions: ['What changes do you notice before reading an explanation?', 'What is your best explanation, and what evidence could challenge it?', 'What additional dates or locations would you need before making a broader claim?'],
    limits: 'Four invented values demonstrate a chart. They cannot establish a real trend, explain a cause or support a scientific conclusion.'
  },
  {
    id: 'shade-observations', title: 'What can observations in shade tell us?',
    environment: 'land', location: 'School grounds', grades: ['K–2', '3–5'], added: '2026-11-08',
    keywords: 'forest trees shade sun school temperature land observations',
    description: 'Use a local observation question to connect measurements, possible explanations and a fair comparison.',
    input: 'Planned input: field notes and measurements with the observation location, time, instrument and conditions.',
    processing: 'Planned processing: check whether observations were made consistently and keep measured values separate from interpretations.',
    output: 'Planned output: a reviewed local-observation summary and an age-appropriate investigation prompt.',
    source: 'Illustrative school-ground observations. No field submission or source dataset is attached.',
    values: [18, 19, 19, 20], labels: ['Visit 1', 'Visit 2', 'Visit 3', 'Visit 4'], unit: '°C',
    questions: ['What do you notice about these example measurements?', 'What might explain the differences?', 'How would you compare sun and shade while keeping other conditions similar?'],
    limits: 'These invented values describe only a teaching example. There is no measured sun-versus-shade comparison here.'
  },
  {
    id: 'polar-seasons', title: 'What evidence helps us compare polar seasons?',
    environment: 'polar', location: 'Polar observation site', grades: ['3–5', '6–8'], added: '2026-11-15',
    keywords: 'polar arctic antarctic ice seasons temperature climate',
    description: 'Consider what repeated observations could tell us, and why a short series leaves important questions unanswered.',
    input: 'Planned input: repeated observations at a documented site, with dates, units and information about missing records.',
    processing: 'Planned processing: compare suitable periods and locations, document gaps and retain uncertainty in the interpretation.',
    output: 'Planned output: a reviewed seasonal comparison with a chart and discussion questions.',
    source: 'Illustrative polar observations. No station, real monitoring period or source dataset is represented.',
    values: [-16, -12, -7, -3], labels: ['Period 1', 'Period 2', 'Period 3', 'Period 4'], unit: '°C',
    questions: ['What pattern do you notice in the example?', 'What dates and site information would help you interpret it?', 'Why would several years of evidence be needed to study longer-term change?'],
    limits: 'The values and periods are invented. They are not evidence of seasonal or climate change at any actual location.'
  }
];

export function filterExamples(records, { query = '', environment = '', grade = '', location = '', date = '' } = {}) {
  const terms = query.trim().toLocaleLowerCase('en').split(/\s+/).filter(Boolean);
  return records.filter(record => {
    const searchable = [record.title, record.description, record.keywords, record.location].join(' ').toLocaleLowerCase('en');
    return terms.every(term => searchable.includes(term))
      && (!environment || record.environment === environment)
      && (!grade || record.grades.includes(grade))
      && (!location || record.location === location)
      && (!date || record.added >= date);
  });
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function exampleChart(record) {
  const figure = element('figure', undefined, 'resource-chart');
  const caption = element('figcaption', 'Illustrative chart · invented values (' + record.unit + ')');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 560 220');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', record.values.map((value, index) => record.labels[index] + ': ' + value + ' ' + record.unit).join('; ') + '. Invented example values.');
  const min = Math.min(...record.values) - 1, max = Math.max(...record.values) + 1;
  const points = record.values.map((value, index) => [55 + index * 150, 170 - (value - min) / (max - min) * 130]);
  const line = document.createElementNS(ns, 'polyline');
  line.setAttribute('points', points.map(point => point.join(',')).join(' '));
  line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#136d70'); line.setAttribute('stroke-width', '3');
  svg.append(line);
  points.forEach(([x, y], index) => {
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', '5'); dot.setAttribute('fill', '#136d70'); svg.append(dot);
    for (const [text, ty] of [[String(record.values[index]) + record.unit, y - 12], [record.labels[index], 204]]) {
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', x); label.setAttribute('y', ty); label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '15'); label.setAttribute('fill', '#143b4a'); label.textContent = text; svg.append(label);
    }
  });
  figure.append(caption, svg);
  return figure;
}

function resource(record) {
  const article = element('article', undefined, 'learning-result');
  article.append(element('p', 'Illustrative learning resource · not a research finding', 'sample-label'),
    element('h4', record.title), element('p', record.description),
    element('p', 'Grades ' + record.grades.join(' / ') + ' · ' + record.location + ' · Example catalog date: ' + record.added, 'resource-meta'));
  const details = element('details');
  details.append(element('summary', 'Open example: ' + record.title));
  const body = element('div', undefined, 'resource-detail');
  body.append(element('h5', 'From input to output'), element('p', record.input), element('p', record.processing), element('p', record.output), exampleChart(record));
  const table = element('table', undefined, 'example-table');
  table.append(element('caption', 'Invented chart values'));
  const header = element('tr');
  for (const label of ['Example observation', 'Temperature (' + record.unit + ')']) { const cell = element('th', label); cell.scope = 'col'; header.append(cell); }
  const thead = element('thead'); thead.append(header); table.append(thead);
  const tbody = element('tbody');
  record.values.forEach((value, index) => { const row = element('tr'); row.append(element('td', record.labels[index]), element('td', String(value))); tbody.append(row); });
  table.append(tbody);
  body.append(table, element('h5', 'Source and limitations'), element('p', record.source), element('p', record.limits));
  if (record.sourceUrl) { const link = element('a', record.sourceLabel); link.href = record.sourceUrl; body.append(link); }
  body.append(element('h5', 'Classroom questions'));
  const questions = element('ul');
  record.questions.forEach(question => questions.append(element('li', question)));
  body.append(questions);
  details.append(body); article.append(details);
  return article;
}

if (typeof document !== 'undefined') {
  const form = document.getElementById('learning-search');
  const results = document.getElementById('learning-results');
  const count = document.getElementById('learning-count');
  function render() {
    const filters = Object.fromEntries(new FormData(form));
    const matches = filterExamples(EXAMPLES, filters);
    results.replaceChildren(...matches.map(resource));
    count.textContent = matches.length + ' illustrative resource' + (matches.length === 1 ? '' : 's') + ' found.';
    if (!matches.length) results.append(element('p', 'No examples match these filters. Try a broader search or clear the filters.'));
  }
  form.addEventListener('submit', event => { event.preventDefault(); render(); });
  document.getElementById('learning-clear').addEventListener('click', () => { form.reset(); render(); });
  render();
}

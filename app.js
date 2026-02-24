// Weather PWA (no API key) using Open‑Meteo APIs.
// - Geocoding: https://geocoding-api.open-meteo.com/v1/search
// - Forecast:  https://api.open-meteo.com/v1/forecast

const els = {
  darkToggle: document.getElementById('darkToggle'),
  cityInput: document.getElementById('cityInput'),
  suggestions: document.getElementById('suggestions'),
  btnLocate: document.getElementById('btnLocate'),
  status: document.getElementById('status'),

  placeName: document.getElementById('placeName'),
  timeNow: document.getElementById('timeNow'),
  dateNow: document.getElementById('dateNow'),

  tempNow: document.getElementById('tempNow'),
  feelsNow: document.getElementById('feelsNow'),
  sunrise: document.getElementById('sunrise'),
  sunset: document.getElementById('sunset'),
  wxIcon: document.getElementById('wxIcon'),
  wxText: document.getElementById('wxText'),

  humidity: document.getElementById('humidity'),
  wind: document.getElementById('wind'),
  pressure: document.getElementById('pressure'),
  uv: document.getElementById('uv'),

  daysList: document.getElementById('daysList'),
  hourlyRow: document.getElementById('hourlyRow'),
};

const STORAGE_KEY = 'weather_pwa_v1';
const THEME_KEY = 'weather_theme_v1';

function setStatus(msg){ els.status.textContent = msg; }

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function fmtTime(date, tz){
  return new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(date);
}
function fmtDate(date, tz){
  return new Intl.DateTimeFormat('nl-NL', { weekday:'long', day:'2-digit', month:'short', year:'numeric', timeZone: tz }).format(date);
}
function fmtDay(date, tz){
  return new Intl.DateTimeFormat('nl-NL', { weekday:'long', day:'2-digit', month:'short', timeZone: tz }).format(date);
}

function wmoToText(code){
  // Based on Open‑Meteo WMO weather interpretation codes.
  const map = new Map([
    [0,'Helder'], [1,'Licht bewolkt'], [2,'Half bewolkt'], [3,'Bewolkt'],
    [45,'Mist'], [48,'Depositing rime fog'],
    [51,'Lichte motregen'], [53,'Motregen'], [55,'Zware motregen'],
    [56,'Freezing drizzle'], [57,'Freezing drizzle'],
    [61,'Lichte regen'], [63,'Regen'], [65,'Zware regen'],
    [66,'Freezing rain'], [67,'Freezing rain'],
    [71,'Lichte sneeuw'], [73,'Sneeuw'], [75,'Zware sneeuw'],
    [77,'Sneeuw grains'], [80,'Regen showers'], [81,'Regen showers'], [82,'Violent rain showers'],
    [85,'Sneeuw showers'], [86,'Zware sneeuw showers'],
    [95,'Onweer'], [96,'Onweer hail'], [99,'Onweer hail']
  ]);
  return map.get(code) ?? '—';
}

function wmoToEmoji(code){
  if (code === 0) return '☀️';
  if (code === 1) return '🌤️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if ([45,48].includes(code)) return '🌫️';
  if ([51,53,55,56,57].includes(code)) return '🌦️';
  if ([61,63,65,66,67,80,81,82].includes(code)) return '🌧️';
  if ([71,73,75,77,85,86].includes(code)) return '🌨️';
  if ([95,96,99].includes(code)) return '⛈️';
  return '🌡️';
}

function drawSunIcon(){
  // SVG-ish sun using CSS background via inline SVG.
  const svg = `
  <svg viewBox="0 0 140 140" width="140" height="140" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="none">
      <circle cx="70" cy="70" r="28" fill="var(--accent)"/>
      ${Array.from({length:8}).map((_,i)=>{
        const a = (Math.PI*2*i)/8;
        const x1 = 70 + Math.cos(a)*44;
        const y1 = 70 + Math.sin(a)*44;
        const x2 = 70 + Math.cos(a)*58;
        const y2 = 70 + Math.sin(a)*58;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--accent)" stroke-width="6" stroke-linecap="round"/>`;
      }).join('')}
    </g>
  </svg>`;
  els.wxIcon.innerHTML = svg;
}

function drawCloudIcon(){
  const svg = `
  <svg viewBox="0 0 140 140" width="140" height="140" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="none">
      <path d="M46 86c-12 0-22-9-22-21 0-10 7-18 16-20 3-14 15-25 30-25 15 0 27 10 30 24 10 1 18 10 18 21 0 12-10 21-22 21H46z" fill="rgba(255,255,255,.9)"/>
      <path d="M44 92c-16 0-28-12-28-27 0-12 8-23 20-26 5-16 20-28 38-28 18 0 33 11 38 27 13 2 23 13 23 27 0 15-13 27-28 27H44z" fill="rgba(255,255,255,.18)"/>
    </g>
  </svg>`;
  els.wxIcon.innerHTML = svg;
}

function setWxIcon(code){
  // Keep it "reference-like": use a big sun for clear, cloud for cloudy, otherwise emoji.
  if (code === 0) { drawSunIcon(); return; }
  if ([1,2,3].includes(code)) { drawCloudIcon(); return; }
  els.wxIcon.textContent = wmoToEmoji(code);
  els.wxIcon.style.fontSize = '96px';
  els.wxIcon.style.display = 'grid';
  els.wxIcon.style.placeItems = 'center';
}

function applyTheme(theme){
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  els.darkToggle.checked = theme !== 'light';
}

function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return applyTheme(saved);
  // default: dark like reference
  applyTheme('dark');
}

els.darkToggle.addEventListener('change', () => {
  applyTheme(els.darkToggle.checked ? 'dark' : 'light');
});

let clockTimer = null;
function startClock(tz){
  if (clockTimer) clearInterval(clockTimer);
  const tick = () => {
    const now = new Date();
    els.timeNow.textContent = fmtTime(now, tz);
    els.dateNow.textContent = fmtDate(now, tz);
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}

async function geocodeCity(q){
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', q);
  url.searchParams.set('count', '6');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding failed');
  return res.json();
}

async function fetchForecast(lat, lon, tz){
  // We'll request: current weather, hourly temperature/wind, daily max/min and sun.
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure');
  url.searchParams.set('hourly', 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m');
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max');
  url.searchParams.set('timezone', tz || 'auto');
  url.searchParams.set('forecast_days', '5');
  const res = await fetch(url);
  if (!res.ok) throw new Error('Forecast failed');
  return res.json();
}

function renderCurrent(data){
  const c = data.current;
  els.tempNow.textContent = `${Math.round(c.temperature_2m)}°C`;
  els.feelsNow.textContent = `${Math.round(c.apparent_temperature)}°C`;
  els.humidity.textContent = `${Math.round(c.relative_humidity_2m)}%`;
  els.wind.textContent = `${Math.round(c.wind_speed_10m)} km/h`;
  els.pressure.textContent = `${Math.round(c.surface_pressure)} hPa`;

  const code = c.weather_code;
  els.wxText.textContent = wmoToText(code);
  setWxIcon(code);
}

function renderSunAndUv(data){
  const d = data.daily;
  const tz = data.timezone;
  const sunrise = new Date(d.sunrise[0]);
  const sunset = new Date(d.sunset[0]);
  els.sunrise.textContent = fmtTime(sunrise, tz);
  els.sunset.textContent = fmtTime(sunset, tz);
  els.uv.textContent = Math.round(d.uv_index_max[0]);
}

function render5Days(data){
  const d = data.daily;
  const tz = data.timezone;
  els.daysList.innerHTML = '';
  for (let i=0;i<d.time.length;i++){
    const dt = new Date(d.time[i] + 'T12:00:00');
    const code = d.weather_code[i];
    const hi = Math.round(d.temperature_2m_max[i]);
    const lo = Math.round(d.temperature_2m_min[i]);
    const row = document.createElement('div');
    row.className = 'day';
    row.innerHTML = `
      <div class="d-ico">${wmoToEmoji(code)}</div>
      <div>
        <div class="d-temp">${hi}° / ${lo}°</div>
      </div>
      <div class="d-date">${fmtDay(dt, tz)}</div>
    `;
    els.daysList.appendChild(row);
  }
}

function findNearestHourIndex(times, nowISO){
  // times are ISO strings like "2026-02-24T22:00"
  // We'll find the first index >= now.
  const now = new Date(nowISO);
  for (let i=0;i<times.length;i++){
    if (new Date(times[i]) >= now) return i;
  }
  return 0;
}

function renderHourly(data){
  const h = data.hourly;
  const tz = data.timezone;
  els.hourlyRow.innerHTML = '';

  const start = findNearestHourIndex(h.time, new Date().toISOString());
  const count = 6; // like reference: 5 cards, we'll show 6 on wider screens
  for (let k=0;k<count;k++){
    const i = clamp(start+k, 0, h.time.length-1);
    const t = new Date(h.time[i]);
    const code = h.weather_code[i];
    const temp = Math.round(h.temperature_2m[i]);
    const ws = Math.round(h.wind_speed_10m[i]);
    const wd = h.wind_direction_10m[i];
    const card = document.createElement('div');
    card.className = 'hour';
    card.innerHTML = `
      <div class="h-time">${fmtTime(t, tz)}</div>
      <div class="h-ico">${wmoToEmoji(code)}</div>
      <div class="h-temp">${temp}°C</div>
      <div class="wind-arrow" style="transform: rotate(${wd}deg)"></div>
      <div class="h-wind">${ws}km/h</div>
    `;
    els.hourlyRow.appendChild(card);
  }
}

function saveLast(payload){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
function loadLast(){
  try{
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  }catch{ return null; }
}

async function loadCity(place){
  // place: { name, admin1, country, latitude, longitude, timezone? }
  const label = `${place.name}${place.admin1 ? ', ' + place.admin1 : ''}`;
  els.placeName.textContent = label;
  setStatus('Loading weather…');

  const data = await fetchForecast(place.latitude, place.longitude, place.timezone || 'auto');

  startClock(data.timezone);
  renderCurrent(data);
  renderSunAndUv(data);
  render5Days(data);
  renderHourly(data);

  setStatus('Updated ✓');

  saveLast({
    place,
    data,
    savedAt: Date.now()
  });
}

function hideSuggestions(){ els.suggestions.hidden = true; els.suggestions.innerHTML=''; }

let sugAbort = 0;
els.cityInput.addEventListener('input', async () => {
  const q = els.cityInput.value.trim();
  if (q.length < 2){ hideSuggestions(); return; }
  const id = ++sugAbort;
  try{
    const res = await geocodeCity(q);
    if (id !== sugAbort) return;
    const results = res.results || [];
    if (!results.length){ hideSuggestions(); return; }
    els.suggestions.hidden = false;
    els.suggestions.innerHTML = results.map((r, idx) => {
      const right = `${r.country}${r.admin1 ? ' · ' + r.admin1 : ''}`;
      return `<div class="sug" data-idx="${idx}">
        <span>${r.name}</span>
        <small>${right}</small>
      </div>`;
    }).join('');
    Array.from(els.suggestions.querySelectorAll('.sug')).forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.idx);
        const r = results[idx];
        els.cityInput.value = `${r.name}`;
        hideSuggestions();
        loadCity(r).catch(err => setStatus(err.message));
      });
    });
  }catch{
    // ignore
  }
});

document.addEventListener('click', (e) => {
  if (!els.suggestions.contains(e.target) && e.target !== els.cityInput) hideSuggestions();
});

els.cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideSuggestions();
  if (e.key === 'Enter') {
    hideSuggestions();
    // best effort: geocode first result
    const q = els.cityInput.value.trim();
    if (!q) return;
    geocodeCity(q).then(res => {
      const r = (res.results || [])[0];
      if (!r) throw new Error('City not found');
      return loadCity(r);
    }).catch(err => setStatus(err.message));
  }
});

els.btnLocate.addEventListener('click', () => {
  if (!navigator.geolocation){ setStatus('Geolocation not supported'); return; }
  setStatus('Getting location…');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try{
      const { latitude, longitude } = pos.coords;
      // Reverse lookup: use Open‑Meteo reverse? Not available; use forecast timezone auto and label as "Current location"
      const place = { name: 'Current Location', admin1: '', country: '', latitude, longitude, timezone: 'auto' };
      els.cityInput.value = '';
      await loadCity(place);
    }catch(err){
      setStatus(err.message || 'Failed');
    }
  }, (err) => setStatus(err.message || 'Permission denied'), { enableHighAccuracy:true, timeout: 12000 });
});

function init(){
  initTheme();

  const last = loadLast();
  if (last?.place){
    els.placeName.textContent = last.place.name || '—';
    setStatus('Loading last location…');
    // Try fresh fetch; fallback to cached data if offline
    loadCity(last.place).catch(() => {
      if (last?.data){
        const data = last.data;
        startClock(data.timezone || 'auto');
        renderCurrent(data);
        renderSunAndUv(data);
        render5Days(data);
        renderHourly(data);
        setStatus('Offline (showing last data)');
      } else {
        setStatus('Offline');
      }
    });
  } else {
    // Default city
    loadCity({ name:'Amsterdam', admin1:'Noord-Holland', country:'NL', latitude:52.3676, longitude:4.9041, timezone:'Europe/Amsterdam' })
      .catch(err => setStatus(err.message));
  }

  // SW
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
}

init();

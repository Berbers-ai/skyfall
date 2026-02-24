
const tempEl = document.getElementById('temp');
const descEl = document.getElementById('desc');
const windEl = document.getElementById('wind');
const humEl = document.getElementById('humidity');
const pressEl = document.getElementById('pressure');
const placeEl = document.getElementById('place');
const input = document.getElementById('cityInput');
const btn = document.getElementById('locBtn');

async function loadWeather(lat, lon){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,surface_pressure&timezone=auto`;
  const res = await fetch(url);
  const data = await res.json();
  const c = data.current;

  tempEl.textContent = Math.round(c.temperature_2m) + "°C";
  windEl.textContent = Math.round(c.wind_speed_10m) + " km/h";
  humEl.textContent = Math.round(c.relative_humidity_2m) + "%";
  pressEl.textContent = Math.round(c.surface_pressure) + " hPa";

  descEl.textContent = "Actueel weer";
}

async function geocode(city){
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`;
  const res = await fetch(url);
  const data = await res.json();
  if(data.results){
    const r = data.results[0];
    placeEl.textContent = r.name;
    loadWeather(r.latitude, r.longitude);
  }
}

btn.addEventListener('click', () => {
  navigator.geolocation.getCurrentPosition(pos=>{
    loadWeather(pos.coords.latitude, pos.coords.longitude);
  });
});

input.addEventListener('keydown', e=>{
  if(e.key==='Enter'){
    geocode(input.value);
  }
});

// Default Amsterdam
loadWeather(52.3676, 4.9041);

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('service-worker.js');
}

const API_URL = "https://script.google.com/macros/s/AKfycbz5wKrKzcn2kdK5prJok6z8CXl9CYmC5lq8YCXGgfT2zsNc3Cb37AfVok-Z2_qP1ao/exec";

let currentActiveRate = 0, todayRate = 0, todayRateEuro = 0, currentMode = "today";
const $ = id => document.getElementById(id);
const usdInput = $('usdInput'), vesInput = $('vesInput');
const usdLivePreview = $('usdLivePreview'), vesLivePreview = $('vesLivePreview');
const rateDisplay = $('rateDisplay'), rateLabel = $('rateLabel'), dateAppliedDisplay = $('dateAppliedDisplay');
const statusBadge = $('statusBadge'), usdLabel = $('usdLabel');
const btnRefresh = $('btnRefresh'), btnCopy = $('btnCopy'), btnNotif = $('btnNotif');
const tabHoyBtn = $('tabHoyBtn'), tabEuroBtn = $('tabEuroBtn'), tabHistorialBtn = $('tabHistorialBtn');
const historyDateGroup = $('historyDateGroup'), historyDateInput = $('historyDateInput');
let audioSilencioso = null;

const num = v => parseFloat(String(v ?? '').replace(',', '.'));
const fmt = n => n.toFixed(4);

document.addEventListener('DOMContentLoaded', () => {
  todayRate = num(localStorage.getItem('bcv_rate_d1')) || 0;
  todayRateEuro = num(localStorage.getItem('bcv_rate_eur')) || 0;
  const t = localStorage.getItem('bcv_time_d1');
  setTab('today');
  if (todayRate > 0 && t) {
    const f = new Date(t);
    dateAppliedDisplay.textContent = `Actualizado: ${f.toLocaleString('es-VE')}`;
    const viejo = (new Date() - f) / 36e5 > 24;
    statusBadge.textContent = viejo ? "Tasa desactualizada (>24h)" : "Caché Local";
    statusBadge.classList.toggle('warning', viejo);
  }
  obtenerTasaD1();
});

function setTab(modo) {
  currentMode = modo;
  tabHoyBtn.classList.toggle('active', modo === 'today');
  tabEuroBtn.classList.toggle('active', modo === 'euro');
  tabHistorialBtn.classList.toggle('active', modo === 'history');
  historyDateGroup.style.display = modo === 'history' ? 'flex' : 'none';
  usdLabel.textContent = modo === 'euro' ? 'Euros (€ EUR)' : 'Dólares ($ USD)';

  if (modo === 'history') {
    if (!historyDateInput.value) {
      const n = new Date();
      historyDateInput.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    }
    cargarHistoricoAsincrono().then(buscarTasaPorFecha);
    return;
  }
  currentActiveRate = modo === 'euro' ? todayRateEuro : todayRate;
  rateLabel.textContent = modo === 'euro' ? 'Euro de Hoy' : 'Tasa de Hoy';
  rateDisplay.textContent = currentActiveRate > 0 ? `${fmt(currentActiveRate)} Bs.` : '--.--';
  dateAppliedDisplay.textContent = currentActiveRate > 0 ? 'Tasa del día actual' : 'Sin dato disponible';
  recalcularLive('usd');
}

async function obtenerTasaD1() {
  statusBadge.textContent = "Conectando...";
  statusBadge.classList.remove('warning');
  try {
    const data = await (await fetch(`${API_URL}?action=tasa`)).json();
    const d = num(data.tasa), e = num(data.tasa_euro);
    if (!(d > 0)) { statusBadge.textContent = "La hoja no tiene tasa (D1)"; return; }
    todayRate = d;
    todayRateEuro = e > 0 ? e : 0;
    localStorage.setItem('bcv_rate_d1', todayRate);
    localStorage.setItem('bcv_rate_eur', todayRateEuro);
    localStorage.setItem('bcv_time_d1', new Date().toISOString());
    statusBadge.textContent = "Conectado";
    if (currentMode !== 'history') {
      setTab(currentMode);
      if (currentActiveRate > 0) dateAppliedDisplay.textContent = `Actualizado: ${new Date().toLocaleString('es-VE')}`;
    }
    cargarHistoricoAsincrono();
  } catch (err) {
    console.error("Error obteniendo tasa:", err);
    statusBadge.textContent = "Sin conexión";
  }
}

async function cargarHistoricoAsincrono() {
  try {
    const data = await (await fetch(API_URL)).json();
    if (data && data.datos) localStorage.setItem('bcv_historico', JSON.stringify(data.datos));
  } catch (err) {
    console.error("Error cargando histórico:", err);
  }
}

tabHoyBtn.addEventListener('click', () => setTab('today'));
tabEuroBtn.addEventListener('click', () => setTab('euro'));
tabHistorialBtn.addEventListener('click', () => setTab('history'));

function buscarTasaPorFecha() {
  const sel = historyDateInput.value;
  if (!sel) return;
  const hist = JSON.parse(localStorage.getItem('bcv_historico') || '[]')
    .map(r => ({ fecha: String(r.fecha || '').substring(0, 10), tasa: num(r.tasa) }))
    .filter(r => r.fecha && r.tasa > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const exacto = hist.find(r => r.fecha === sel);
  // Si no hay registro ese día (fin de semana, feriado), usa el último anterior
  const previo = exacto || hist.filter(r => r.fecha <= sel).pop();

  if (previo) {
    currentActiveRate = previo.tasa;
    rateLabel.textContent = `Tasa del ${sel}`;
    rateDisplay.textContent = `${fmt(currentActiveRate)} Bs.`;
    dateAppliedDisplay.textContent = exacto ? 'Registro histórico' : `Último registro anterior: ${previo.fecha}`;
  } else {
    currentActiveRate = 0;
    rateLabel.textContent = 'Sin registro';
    rateDisplay.textContent = '--.--';
    dateAppliedDisplay.textContent = `No hay datos para el ${sel}`;
  }
  recalcularLive('usd');
}

historyDateInput.addEventListener('change', buscarTasaPorFecha);

function limpiarCampos() {
  vesInput.value = '';
  usdLivePreview.classList.remove('visible');
  vesLivePreview.classList.remove('visible');
}

function recalcularLive(origen) {
  if (!(currentActiveRate > 0)) { limpiarCampos(); return; }
  if (origen === 'usd') {
    const v = parseFloat(usdInput.value);
    if (v > 0) {
      const bs = v * currentActiveRate;
      vesInput.value = bs.toFixed(2);
      usdLivePreview.textContent = `= ${bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.`;
      usdLivePreview.classList.add('visible');
      vesLivePreview.classList.remove('visible');
    } else limpiarCampos();
  } else {
    const v = parseFloat(vesInput.value);
    if (v > 0) {
      const usd = v / currentActiveRate;
      usdInput.value = usd.toFixed(2);
      const simbolo = currentMode === 'euro' ? '€' : '$';
      vesLivePreview.textContent = `= ${simbolo}${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      vesLivePreview.classList.add('visible');
      usdLivePreview.classList.remove('visible');
    } else {
      usdInput.value = '';
      vesLivePreview.classList.remove('visible');
    }
  }
}

function copiar(texto, mensaje) {
  navigator.clipboard.writeText(texto).then(() => {
    if ('vibrate' in navigator) navigator.vibrate(50);
    btnCopy.textContent = mensaje;
    setTimeout(() => btnCopy.textContent = "📋 Copiar", 2200);
  }).catch(() => alert('No se pudo copiar. Cópialo manualmente: ' + texto));
}

function copiarMontoFrecuente(monto) {
  if (!(currentActiveRate > 0)) { alert('No hay tasa cargada para calcular.'); return; }
  usdInput.value = monto;
  recalcularLive('usd');
  if (vesInput.value) copiar(vesInput.value, `¡${monto} Copiado (${vesInput.value} Bs)! ✓`);
}

usdInput.addEventListener('input', () => recalcularLive('usd'));
vesInput.addEventListener('input', () => recalcularLive('ves'));
btnRefresh.addEventListener('click', obtenerTasaD1);
btnCopy.addEventListener('click', () => {
  if (!vesInput.value) { alert('No hay monto en bolívares para copiar.'); return; }
  copiar(vesInput.value, "¡Copiado! ✓");
});

/* ---------- Modo notificación (Media Session) ---------- */
let cicloModo = 0, montoValor = 10;
const INICIO = [10, 1000, 10000, 10];
const SUBE = [1, 1000, 5000, 1];
const BAJA = [0.5, 500, 1000, 0.5];
const MAXIMO = [100, 20000, 200000, 100];
const IMAGEN = ['mitasa.png', 'bs_dol_peq.png', 'bs_dol_g.png', 'euro.png'];

// Síncrona y con buffer de 1 s en loop: no consume memoria y no pierde el gesto del toque
function crearAudioSilencioso() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const source = ctx.createBufferSource();
  source.buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  source.loop = true;
  const dest = ctx.createMediaStreamDestination();
  source.connect(dest);
  source.start();
  if (ctx.state === 'suspended') ctx.resume();
  const audio = new Audio();
  audio.srcObject = dest.stream;
  audio.loop = true;
  return audio;
}

function actualizarMediaSessionInteligente() {
  if (!('mediaSession' in navigator)) return;
  const m = cicloModo;
  const rate = m === 3 ? todayRateEuro : todayRate;
  if (!(rate > 0)) return;

  let title, artist, album;
  if (m === 0) {
    title = `💵 ${montoValor.toFixed(2)} USD`;
    artist = `Equivale a: ${(montoValor * rate).toFixed(2)} Bs.`;
    album = 'Modo: Dólares ➔ Bolívares';
  } else if (m === 3) {
    title = `💶 ${montoValor.toFixed(2)} EUR`;
    artist = `Equivale a: ${(montoValor * rate).toFixed(2)} Bs.`;
    album = 'Modo: Euros ➔ Bolívares';
  } else {
    title = `🇻🇪 ${montoValor.toLocaleString()} Bs. (${m === 1 ? 'Peq' : 'Grandes'})`;
    artist = `Equivale a: $${(montoValor / rate).toFixed(2)} USD`;
    album = `Modo: Bolívares (${m === 1 ? 'Pequeños' : 'Grandes'})`;
  }

  const src = IMAGEN[m];
  navigator.mediaSession.metadata = new MediaMetadata({
    title, artist, album,
    artwork: ['96x96', '128x128', '192x192', '512x512'].map(sizes => ({ src, sizes, type: 'image/png' }))
  });
  navigator.mediaSession.playbackState = 'playing';

  if ('setPositionState' in navigator.mediaSession) {
    try {
      navigator.mediaSession.setPositionState({
        duration: MAXIMO[m], playbackRate: 1.0,
        position: Math.min(Math.max(0, montoValor), MAXIMO[m])
      });
    } catch (e) { console.error("Error al establecer la barra:", e); }
  }
}

btnNotif.addEventListener('click', async () => {
  if (!(todayRate > 0)) { alert('Espera a que cargue la tasa antes de activar el modo notificación.'); return; }
  try {
    if (!audioSilencioso) audioSilencioso = crearAudioSilencioso();
    await audioSilencioso.play();

    const ms = navigator.mediaSession;
    ms.setActionHandler('nexttrack', () => { montoValor += SUBE[cicloModo]; actualizarMediaSessionInteligente(); });
    ms.setActionHandler('previoustrack', () => { montoValor = Math.max(0, montoValor - BAJA[cicloModo]); actualizarMediaSessionInteligente(); });
    const rotarCiclo = () => {
      cicloModo = (cicloModo + 1) % 4;
      montoValor = INICIO[cicloModo];
      actualizarMediaSessionInteligente();
    };
    ms.setActionHandler('play', rotarCiclo);
    ms.setActionHandler('pause', rotarCiclo);
    ms.setActionHandler('seekto', d => {
      if (d.seekTime !== undefined) { montoValor = d.seekTime; actualizarMediaSessionInteligente(); }
    });

    actualizarMediaSessionInteligente();
    alert('¡Notificación inteligente activada!\n\n• Usa la barra deslizable para ajustar el monto directamente.');
  } catch (err) {
    console.error("Error al iniciar el modo notificación:", err);
    alert('No se pudo iniciar el audio: ' + (err && err.name ? err.name : err));
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => console.log('SW registrado:', reg.scope));
  });
}

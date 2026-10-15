const API_URL = "https://script.google.com/macros/s/AKfycbyPxwzfR3U0uSKex_DJkIuOVrhAekDJk4AWJ5-7_6De7PYH3Xy2y08P0DrCj6-AqFYg/exec";

let currentActiveRate = 0;
let todayRate = 0;
let currentMode = "today";

const usdInput = document.getElementById('usdInput');
const vesInput = document.getElementById('vesInput');
const usdLivePreview = document.getElementById('usdLivePreview');
const vesLivePreview = document.getElementById('vesLivePreview');
const rateDisplay = document.getElementById('rateDisplay');
const rateLabel = document.getElementById('rateLabel');
const dateAppliedDisplay = document.getElementById('dateAppliedDisplay');
const statusBadge = document.getElementById('statusBadge');
const btnRefresh = document.getElementById('btnRefresh');
const btnCopy = document.getElementById('btnCopy');
const btnNotif = document.getElementById('btnNotif');

const tabHoyBtn = document.getElementById('tabHoyBtn');
const tabHistorialBtn = document.getElementById('tabHistorialBtn');
const historyDateGroup = document.getElementById('historyDateGroup');
const historyDateInput = document.getElementById('historyDateInput');

let audioSilencioso = null;

document.addEventListener('DOMContentLoaded', () => {
  const cachedRate = localStorage.getItem('bcv_rate_d1');
  const cachedTime = localStorage.getItem('bcv_time_d1');

  if (cachedRate) {
    currentActiveRate = parseFloat(cachedRate);
    todayRate = currentActiveRate;
    rateDisplay.textContent = `${currentActiveRate.toFixed(2)} Bs.`;
    
    if (cachedTime) {
      const fechaGuardada = new Date(cachedTime);
      dateAppliedDisplay.textContent = `Actualizado: ${fechaGuardada.toLocaleString('es-VE')}`;
      
      const horasDiferencia = (new Date() - fechaGuardada) / (1000 * 60 * 60);
      if (horasDiferencia > 24) {
        statusBadge.textContent = "Tasa desactualizada (>24h)";
        statusBadge.classList.add('warning');
      } else {
        statusBadge.textContent = "Caché Local";
      }
    }
  }

  obtenerTasaD1();
  cargarHistoricoAsincrono();
});

async function obtenerTasaD1() {
  statusBadge.textContent = "Conectando...";
  try {
    const response = await fetch(`${API_URL}?action=tasa`);
    const data = await response.json();

    if (data && data.tasa) {
      let rawValue = data.tasa.toString().replace(',', '.');
      let parsedRate = parseFloat(rawValue);

      if (!isNaN(parsedRate)) {
        todayRate = parsedRate;
        if (currentMode === "today") {
          currentActiveRate = parsedRate;
          rateDisplay.textContent = `${currentActiveRate.toFixed(2)} Bs.`;
          dateAppliedDisplay.textContent = `Actualizado: ${new Date().toLocaleString('es-VE')}`;
        }
        
        statusBadge.textContent = "Conectado";
        statusBadge.classList.remove('warning');

        localStorage.setItem('bcv_rate_d1', currentActiveRate);
        localStorage.setItem('bcv_time_d1', new Date().toISOString());
        
        recalcularLive('usd');
        cargarHistoricoAsincrono();
      } else {
        rateDisplay.textContent = "Error";
        dateAppliedDisplay.textContent = "El valor en D1 no es válido";
      }
    }
  } catch (error) {
    console.error("Error obteniendo D1:", error);
    statusBadge.textContent = "Sin conexión";
  }
}

async function cargarHistoricoAsincrono() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    if (data && data.datos) {
      localStorage.setItem('bcv_historico', JSON.stringify(data.datos));
    }
  } catch (error) {
    console.error("Error cargando histórico:", error);
  }
}

tabHoyBtn.addEventListener('click', () => {
  currentMode = "today";
  tabHoyBtn.classList.add('active');
  tabHistorialBtn.classList.remove('active');
  historyDateGroup.style.display = "none";
  
  rateLabel.textContent = "Tasa de Hoy";
  if (todayRate > 0) {
    currentActiveRate = todayRate;
    rateDisplay.textContent = `${currentActiveRate.toFixed(2)} Bs.`;
    dateAppliedDisplay.textContent = `Tasa del día actual`;
  }
  recalcularLive('usd');
});

tabHistorialBtn.addEventListener('click', async () => {
  currentMode = "history";
  tabHistorialBtn.classList.add('active');
  tabHoyBtn.classList.remove('active');
  historyDateGroup.style.display = "flex";

  if (!historyDateInput.value) {
    const now = new Date();
    historyDateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  
  await cargarHistoricoAsincrono();
  buscarTasaPorFecha();
});

function buscarTasaPorFecha() {
  const fechaSeleccionada = historyDateInput.value;
  if (!fechaSeleccionada) return;

  const historicoGuardado = JSON.parse(localStorage.getItem('bcv_historico') || '[]');
  const registroEncontrado = historicoGuardado.find(item => {
    if (!item.fecha) return false;
    return item.fecha.substring(0, 10) === fechaSeleccionada;
  });

  if (registroEncontrado) {
    currentActiveRate = parseFloat(registroEncontrado.tasa);
    rateLabel.textContent = `Tasa del ${fechaSeleccionada}`;
    rateDisplay.textContent = `${currentActiveRate.toFixed(2)} Bs.`;
    dateAppliedDisplay.textContent = `Registro histórico`;
  } else {
    currentActiveRate = 0;
    rateLabel.textContent = `Sin registro`;
    rateDisplay.textContent = "--.--";
    dateAppliedDisplay.textContent = `No hay datos para el ${fechaSeleccionada}`;
  }
  recalcularLive('usd');
}

historyDateInput.addEventListener('change', buscarTasaPorFecha);

function recalcularLive(origen) {
  if (currentActiveRate <= 0) return;

  if (origen === 'usd') {
    const valUSD = parseFloat(usdInput.value);
    if (!isNaN(valUSD) && valUSD > 0) {
      const resultadoBs = valUSD * currentActiveRate;
      vesInput.value = resultadoBs.toFixed(2);
      usdLivePreview.textContent = `= ${resultadoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.`;
      usdLivePreview.classList.add('visible');
      vesLivePreview.classList.remove('visible');
    } else {
      vesInput.value = '';
      usdLivePreview.classList.remove('visible');
    }
  } else if (origen === 'ves') {
    const valVES = parseFloat(vesInput.value);
    if (!isNaN(valVES) && valVES > 0) {
      const resultadoUSD = valVES / currentActiveRate;
      usdInput.value = resultadoUSD.toFixed(2);
      vesLivePreview.textContent = `= $${resultadoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      vesLivePreview.classList.add('visible');
      usdLivePreview.classList.remove('visible');
    } else {
      usdInput.value = '';
      vesLivePreview.classList.remove('visible');
    }
  }
}

function copiarMontoFrecuente(montoUSD) {
  if (currentActiveRate <= 0) {
    alert('Espera a que cargue la tasa antes de calcular.');
    return;
  }
  usdInput.value = montoUSD;
  recalcularLive('usd');
  const totalBs = vesInput.value;
  
  if (totalBs) {
    navigator.clipboard.writeText(totalBs).then(() => {
      if ('vibrate' in navigator) navigator.vibrate(50);
      btnCopy.textContent = `¡${montoUSD}$ Copiado (${totalBs} Bs)! ✓`;
      setTimeout(() => btnCopy.textContent = "📋 Copiar.", 2500);
    });
  }
}

usdInput.addEventListener('input', () => recalcularLive('usd'));
vesInput.addEventListener('input', () => recalcularLive('ves'));
btnRefresh.addEventListener('click', obtenerTasaD1);

btnCopy.addEventListener('click', () => {
  const val = vesInput.value;
  if (!val) {
    alert('No hay monto en bolívares para copiar.');
    return;
  }
  navigator.clipboard.writeText(val).then(() => {
    if ('vibrate' in navigator) navigator.vibrate(50);
    btnCopy.textContent = "¡Copiado! ✓";
    setTimeout(() => btnCopy.textContent = "📋 Copiar.", 2000);
  });
});

let cicloModo = 0;
let montoValor = 10.00;

async function crearAudioSilenciosoLargo() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 3600, ctx.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  
  const dest = ctx.createMediaStreamDestination();
  source.connect(dest);
  source.start();

  const audio = new Audio();
  audio.srcObject = dest.stream;
  audio.loop = true;
  return audio;
}

function actualizarMediaSessionInteligente() {
  if (currentActiveRate <= 0) return;

  let title = "";
  let artist = "";
  let album = "";
  let imagenLogo = "mitasa.png";
  let maxDuration = 100;

  if (cicloModo === 0) {
    imagenLogo = "mitasa.png";
    maxDuration = 100;
    const totalBs = (montoValor * currentActiveRate).toFixed(2);
    title = `💵 ${montoValor.toFixed(2)} USD`;
    artist = `Equivale a: ${totalBs} Bs.`;
    album = 'Modo: Dólares ➔ Bolívares';
  } 
  else if (cicloModo === 1) {
    imagenLogo = "bs_dol_peq.png";
    maxDuration = 20000;
    const totalUSD = (montoValor / currentActiveRate).toFixed(2);
    title = `🇻🇪 ${montoValor.toFixed(2)} Bs. (Peq)`;
    artist = `Equivale a: $${totalUSD} USD`;
    album = 'Modo: Bolívares (Pequeños)';
  } 
  else if (cicloModo === 2) {
    imagenLogo = "bs_dol_g.png";
    maxDuration = 200000;
    const totalUSD = (montoValor / currentActiveRate).toFixed(2);
    title = `🇻🇪 ${montoValor.toLocaleString()} Bs. (Grandes)`;
    artist = `Equivale a: $${totalUSD} USD`;
    album = 'Modo: Bolívares (Grandes)';
  } 
  else if (cicloModo === 3) {
    imagenLogo = "euro.png";
    maxDuration = 100;
    const totalBs = (montoValor * currentActiveRate).toFixed(2);
    title = `💶 ${montoValor.toFixed(2)} EUR`;
    artist = `Equivale a: ${totalBs} Bs.`;
    album = 'Modo: Euros ➔ Bolívares';
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: artist,
      album: album,
      artwork: [
        { src: imagenLogo, sizes: '96x96', type: 'image/png' },
        { src: imagenLogo, sizes: '128x128', type: 'image/png' },
        { src: imagenLogo, sizes: '192x192', type: 'image/png' },
        { src: imagenLogo, sizes: '512x512', type: 'image/png' }
      ]
    });

    if ('setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration: maxDuration,
          playbackRate: 1.0,
          position: Math.min(Math.max(0, montoValor), maxDuration)
        });
      } catch (e) {
        console.error("Error al establecer la barra:", e);
      }
    }
  }
}

btnNotif.addEventListener('click', async () => {
  if (currentActiveRate <= 0) {
    alert('Espera a que cargue la tasa antes de activar el modo notificación.');
    return;
  }

  try {
    if (!audioSilencioso) {
      audioSilencioso = await crearAudioSilenciosoLargo();
    }
    await audioSilencioso.play();

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (cicloModo === 0) montoValor += 1.0;
      else if (cicloModo === 1) montoValor += 1000;
      else if (cicloModo === 2) montoValor += 5000;
      else if (cicloModo === 3) montoValor += 1.0;
      actualizarMediaSessionInteligente();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (cicloModo === 0) montoValor = Math.max(0, montoValor - 0.5);
      else if (cicloModo === 1) montoValor = Math.max(0, montoValor - 500);
      else if (cicloModo === 2) montoValor = Math.max(0, montoValor - 1000);
      else if (cicloModo === 3) montoValor = Math.max(0, montoValor - 0.5);
      actualizarMediaSessionInteligente();
    });

    const rotarCiclo = () => {
      cicloModo = (cicloModo + 1) % 4;
      if (cicloModo === 0) montoValor = 10.00;
      else if (cicnoModo === 1) montoValor = 1000.00;
      else if (cicloModo === 2) montoValor = 10000.00;
      else if (cicloModo === 3) montoValor = 10.00;
      actualizarMediaSessionInteligente();
    };

    navigator.mediaSession.setActionHandler('play', rotarCiclo);
    navigator.mediaSession.setActionHandler('pause', rotarCiclo);

    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        montoValor = details.seekTime;
        actualizarMediaSessionInteligente();
      }
    });

    actualizarMediaSessionInteligente();
    alert('¡Notificación inteligente activada!\n\n• Usa la barra deslizable para ajustar el monto directamente.');
  } catch (err) {
    console.error("Error al iniciar audio:", err);
    alert('Permite la reproducción de audio para activar las notificaciones.');
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registrado:', reg.scope));
  });
}

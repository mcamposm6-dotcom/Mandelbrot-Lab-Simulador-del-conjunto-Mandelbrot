
"use strict";

// ==========================================
// MANDELBROT LAB - SIMULADOR EDUCATIVO
// ==========================================

const $ = id => document.getElementById(id);

const fractal = $("fractal");
const marcador = $("marcador");

const ctx = fractal.getContext("2d", {
  alpha: false
});

const pen = marcador.getContext("2d");

// CONFIGURACIÓN INICIAL

const inicial = {
  cx: -0.5,
  cy: 0,
  span: 3.5,
  maxIter: 150,
  quality: 0.75,
  palette: "ocean"
};

const s = {
  ...inicial,
  job: 0,
  paused: false,
  running: false,
  continueJob: null,
  selection: null,
  pointer: null
};

// ==========================================
// PALETAS DE COLORES
// ==========================================

const colores = {
  ocean: [
    [4, 10, 35],
    [20, 55, 134],
    [12, 181, 195],
    [115, 234, 190],
    [255, 239, 153]
  ],
  fire: [
    [30, 5, 8],
    [140, 28, 22],
    [243, 95, 22],
    [255, 195, 77],
    [255, 245, 190]
  ],
  violet: [
    [15, 8, 40],
    [68, 37, 156],
    [144, 73, 211],
    [246, 92, 187],
    [252, 212, 240]
  ],
  mono: [
    [15, 22, 34],
    [70, 83, 106],
    [145, 164, 185],
    [225, 234, 244],
    [255, 255, 255]
  ]
};

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function numero(v) {
  return Number.isFinite(v)
    ? Number(v.toPrecision(7)).toString()
    : "No finito";
}

function leer(id) {
  const v = $(id).value.trim();
  return v === "" ? NaN : Number(v);
}

function ajustar() {
  const r = fractal.getBoundingClientRect();
  const dpr = Math.min(
    window.devicePixelRatio || 1,
    1.5
  );

  const w = Math.max(
    2,
    Math.round(r.width * dpr)
  );

  const h = Math.max(
    2,
    Math.round(r.height * dpr)
  );

  fractal.width = marcador.width = w;
  fractal.height = marcador.height = h;
}

function limites() {
  const hy = s.span / 2;
  const hx = hy * fractal.width / fractal.height;

  return {
    left: s.cx - hx,
    top: s.cy + hy,
    width: 2 * hx,
    height: 2 * hy
  };
}

function aComplejo(px, py) {
  const q = limites();

  return {
    a: q.left + px / fractal.width * q.width,
    b: q.top - py / fractal.height * q.height
  };
}

function aPixel(a, b) {
  const q = limites();

  return {
    x: (a - q.left) / q.width * fractal.width,
    y: (q.top - b) / q.height * fractal.height
  };
}

function posicion(e) {
  const r = marcador.getBoundingClientRect();

  return {
    x: (e.clientX - r.left) /
       r.width * marcador.width,

    y: (e.clientY - r.top) /
       r.height * marcador.height
  };
}

function actualizar() {
  $("indicadorZoom").textContent =
    numero(3.5 / s.span) + "×";

  $("indicadorReal").textContent = numero(s.cx);
  $("indicadorImag").textContent = numero(s.cy);

  $("centroReal").value = numero(s.cx);
  $("centroImag").value = numero(s.cy);
}

// ==========================================
// EJES Y MARCADOR DEL PUNTO
// ==========================================

function dibujarMarcador() {
  pen.clearRect(
    0,
    0,
    marcador.width,
    marcador.height
  );

  const q = limites();

  pen.save();

  pen.strokeStyle = "rgba(255,255,255,.27)";
  pen.lineWidth = 1;

  // EJE VERTICAL

  if (
    q.left <= 0 &&
    q.left + q.width >= 0
  ) {
    const x =
      -q.left / q.width * marcador.width;

    pen.beginPath();
    pen.moveTo(x, 0);
    pen.lineTo(x, marcador.height);
    pen.stroke();
  }

  // EJE HORIZONTAL

  if (
    q.top >= 0 &&
    q.top - q.height <= 0
  ) {
    const y =
      q.top / q.height * marcador.height;

    pen.beginPath();
    pen.moveTo(0, y);
    pen.lineTo(marcador.width, y);
    pen.stroke();
  }

  // PUNTO SELECCIONADO

  if (s.selection) {
    const p = aPixel(
      s.selection.a,
      s.selection.b
    );

    if (
      p.x >= 0 &&
      p.y >= 0 &&
      p.x <= marcador.width &&
      p.y <= marcador.height
    ) {
      pen.strokeStyle = "white";
      pen.lineWidth = 2;

      pen.beginPath();
      pen.arc(p.x, p.y, 8, 0, Math.PI * 2);

      pen.moveTo(p.x - 12, p.y);
      pen.lineTo(p.x + 12, p.y);

      pen.moveTo(p.x, p.y - 12);
      pen.lineTo(p.x, p.y + 12);

      pen.stroke();
    }
  }

  pen.restore();
}

// ==========================================
// COLORACIÓN DEL FRACTAL
// ==========================================

function color(t) {
  const c = colores[s.palette];

  const v =
    (((t % 1) + 1) % 1) *
    (c.length - 1);

  const i = Math.floor(v);
  const f = v - i;

  return [0, 1, 2].map(k =>
    Math.round(
      c[i][k] * (1 - f) +
      c[Math.min(i + 1, c.length - 1)][k] * f
    )
  );
}

// ==========================================
// BOTONES INICIAR, PAUSAR Y CONTINUAR
// ==========================================

function botones() {
  $("iniciar").textContent = "▶ Iniciar simulación";

  $("pausar").textContent = s.paused
    ? "▶ Continuar"
    : "⏸ Pausar";

  $("pausar").disabled = !s.running;
}

// ==========================================
// GENERAR EL CONJUNTO DE MANDELBROT
// ==========================================

function iniciar() {
  const token = ++s.job;

  s.running = true;
  s.paused = false;
  s.continueJob = null;

  ajustar();
  actualizar();
  dibujarMarcador();
  botones();

  const w = Math.max(
    80,
    Math.floor(fractal.width * s.quality)
  );

  const h = Math.max(
    80,
    Math.floor(fractal.height * s.quality)
  );

  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;

  const tmpCtx = tmp.getContext("2d");
  const imagen = tmpCtx.createImageData(w, h);
  const pixels = imagen.data;

  const q = limites();

  let fila = 0;

  const comienzo = performance.now();

  $("estado").textContent = "Calculando...";
  $("progreso").style.width = "0%";
  $("indicadorAvance").textContent = "0 %";

  // EL CÁLCULO SE DIVIDE EN BLOQUES
  // PARA PERMITIR PAUSAR LA SIMULACIÓN

  function bloque() {
    if (token !== s.job) return;

    if (s.paused) {
      s.continueJob = bloque;
      return;
    }

    const limite = Math.min(fila + 6, h);

    for (; fila < limite; fila++) {

      const b =
        q.top -
        (fila + 0.5) / h * q.height;

      for (let columna = 0; columna < w; columna++) {

        const a =
          q.left +
          (columna + 0.5) / w * q.width;

        // VALORES INICIALES z0 = 0

        let x = 0;
        let y = 0;

        let x2 = 0;
        let y2 = 0;

        let n = 0;

        // ECUACIÓN:
        // z(n+1) = z(n)^2 + c

        while (
          n < s.maxIter &&
          x2 + y2 <= 4
        ) {

          const ny = 2 * x * y + b;
          const nx = x2 - y2 + a;

          x = nx;
          y = ny;

          x2 = x * x;
          y2 = y * y;

          n++;
        }

        const p =
          (fila * w + columna) * 4;

        let rgb;

        // INTERIOR DEL CONJUNTO

        if (
          n === s.maxIter &&
          x2 + y2 <= 4
        ) {

          rgb = [5, 10, 21];

        } else {

          // COLORACIÓN SUAVE DE LA REGIÓN EXTERIOR

          const mag = Math.sqrt(x2 + y2);

          const suave =
            n + 1 -
            Math.log2(
              Math.max(
                0.000001,
                Math.log2(
                  Math.max(mag, 2.000001)
                )
              )
            );

          rgb = color(suave * 0.035);
        }

        pixels[p] = rgb[0];
        pixels[p + 1] = rgb[1];
        pixels[p + 2] = rgb[2];
        pixels[p + 3] = 255;
      }
    }

    // MOSTRAR EL AVANCE EN EL LIENZO

    tmpCtx.putImageData(imagen, 0, 0);

    ctx.fillStyle = "#050a15";

    ctx.fillRect(
      0,
      0,
      fractal.width,
      fractal.height
    );

    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
      tmp,
      0,
      0,
      fractal.width,
      fractal.height
    );

    const porcentaje =
      Math.round(fila / h * 100);

    $("progreso").style.width =
      porcentaje + "%";

    $("indicadorAvance").textContent =
      porcentaje + " %";

    if (fila < h) {

      requestAnimationFrame(bloque);

    } else {

      s.running = false;
      s.continueJob = null;

      $("estado").textContent =
        "Finalizada en " +
        Math.round(performance.now() - comienzo) +
        " ms";

      botones();
    }
  }

  requestAnimationFrame(bloque);
}

// ==========================================
// ZOOM DEL PLANO COMPLEJO
// ==========================================

function zoom(
  factor,
  x = fractal.width / 2,
  y = fractal.height / 2
) {

  const antes = aComplejo(x, y);

  s.span = Math.min(
    8,
    Math.max(
      1e-10,
      s.span / factor
    )
  );

  const despues = aComplejo(x, y);

  s.cx += antes.a - despues.a;
  s.cy += antes.b - despues.b;

  iniciar();
}

// ==========================================
// REINICIAR SIMULADOR
// ==========================================

function reiniciar() {
  Object.assign(s, inicial);

  s.job++;
  s.running = false;
  s.paused = false;
  s.continueJob = null;
  s.selection = null;

  $("iteraciones").value = s.maxIter;

  $("valorIteraciones").textContent = s.maxIter;

  $("calidad").value = s.quality;
  $("paleta").value = s.palette;

  $("estado").textContent = "Listo para iniciar";

  $("progreso").style.width = "0%";

  $("indicadorAvance").textContent = "0 %";

  ajustar();

  ctx.fillStyle = "#050a15";

  ctx.fillRect(
    0,
    0,
    fractal.width,
    fractal.height
  );

  actualizar();
  dibujarMarcador();
  botones();
}

// ==========================================
// CÁLCULO DE UNA ÓRBITA
// ==========================================

function orbita(a, b, max) {
  let x = 0;
  let y = 0;

  const filas = [{
    n: 0,
    x: 0,
    y: 0,
    m: 0
  }];

  let escape = null;

  for (let n = 1; n <= max; n++) {

    const nx = x * x - y * y + a;
    const ny = 2 * x * y + b;

    x = nx;
    y = ny;

    const m = Math.hypot(x, y);

    filas.push({ n, x, y, m });

    if (
      m > 2 ||
      !Number.isFinite(m)
    ) {
      escape = n;
      break;
    }
  }

  return {
    filas,
    escape
  };
}

// ==========================================
// ANALIZAR UN PUNTO COMPLEJO
// ==========================================

function analizar(a, b) {

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b)
  ) {

    $("resultado").textContent =
      "Ingresa números válidos para a y b.";

    return;
  }

  const r = orbita(a, b, s.maxIter);

  s.selection = { a, b };

  $("puntoReal").value = a;
  $("puntoImag").value = b;

  $("resultado").textContent =
    "c = " +
    numero(a) +
    (b < 0 ? " − " : " + ") +
    numero(Math.abs(b)) +
    "i. " +
    (
      r.escape !== null
        ? "Escapó en la iteración " +
          r.escape +
          "; no pertenece al conjunto."
        : "No escapó en " +
          s.maxIter +
          " iteraciones. No se puede asegurar pertenencia exacta."
    );

  const cuerpo = $("tabla");

  cuerpo.replaceChildren();

  const vista = r.filas.length > 31
    ? [
        ...r.filas.slice(0, 12),
        ...r.filas.slice(-15)
      ]
    : r.filas;

  for (const f of vista) {

    const tr = document.createElement("tr");

    const estado =
      f.m > 2
        ? "Escapó"
        : "No escapó";

    const valores = [
      f.n,
      numero(f.x),
      numero(f.y),
      numero(f.m),
      estado
    ];

    for (const value of valores) {

      const td = document.createElement("td");

      td.textContent = value;

      tr.appendChild(td);
    }

    cuerpo.appendChild(tr);
  }

  dibujarMarcador();
}

// ==========================================
// ACTIVIDAD EDUCATIVA PARA ESTUDIANTES
// ==========================================

const preguntas = [
  {
    a: -1,
    b: 0,
    texto: "¿Qué ocurrirá con c = −1 + 0i?",
    explicacion:
      "La sucesión alterna entre 0 y −1; permanece acotada."
  },
  {
    a: 1,
    b: 0,
    texto: "¿Qué ocurrirá con c = 1 + 0i?",
    explicacion:
      "La sucesión es 0, 1, 2, 5...; escapa en n = 3."
  },
  {
    a: 0,
    b: 0,
    texto: "¿Qué ocurrirá con c = 0 + 0i?",
    explicacion:
      "Todos los términos son cero; no escapa."
  }
];

let indice = 0;
let aciertos = 0;
let respondida = false;

// MOSTRAR PREGUNTA

function mostrarPregunta() {

  const p = preguntas[indice];

  $("numeroPregunta").textContent =
    "Pregunta " +
    (indice + 1) +
    " de " +
    preguntas.length;

  $("puntuacion").textContent =
    "Aciertos: " + aciertos;

  $("pregunta").textContent = p.texto;

  document.querySelectorAll(
    'input[name="respuesta"]'
  ).forEach(r => {

    r.checked = false;
    r.disabled = false;
  });

  respondida = false;

  $("comprobar").disabled = false;
  $("siguiente").disabled = true;

  $("retroalimentacion").textContent =
    "Selecciona una respuesta y compruébala.";
}

// COMPROBAR RESPUESTA

function comprobar() {

  if (respondida) return;

  const elegida = document.querySelector(
    'input[name="respuesta"]:checked'
  );

  if (!elegida) {

    $("retroalimentacion").textContent =
      "Primero selecciona una respuesta.";

    return;
  }

  const p = preguntas[indice];

  const calculo = orbita(
    p.a,
    p.b,
    Math.max(30, s.maxIter)
  );

  const esperada =
    calculo.escape === null
      ? "no"
      : "si";

  const correcto =
    elegida.value === esperada;

  if (correcto) {
    aciertos++;
  }

  $("retroalimentacion").textContent =
    (
      correcto
        ? "¡Correcto! "
        : "Respuesta incorrecta. "
    ) +
    p.explicacion;

  $("puntuacion").textContent =
    "Aciertos: " + aciertos;

  respondida = true;

  $("comprobar").disabled = true;

  document.querySelectorAll(
    'input[name="respuesta"]'
  ).forEach(r => {
    r.disabled = true;
  });

  $("siguiente").disabled = false;

  $("siguiente").textContent =
    indice === preguntas.length - 1
      ? "Ver resultado final"
      : "Siguiente pregunta →";
}

// ==========================================
// EVENTOS DE LOS BOTONES
// ==========================================

// INICIAR SIMULACIÓN

$("iniciar").addEventListener(
  "click",
  iniciar
);

// PAUSAR O CONTINUAR SIMULACIÓN

$("pausar").addEventListener(
  "click",
  () => {

    if (!s.running) return;

    s.paused = !s.paused;

    if (s.paused) {

      $("estado").textContent =
        "Simulación pausada";

    } else {

      $("estado").textContent =
        "Continuando...";

      if (s.continueJob) {

        const tarea = s.continueJob;

        s.continueJob = null;

        requestAnimationFrame(tarea);
      }
    }

    botones();
  }
);

// REINICIAR

$("reiniciar").addEventListener(
  "click",
  reiniciar
);

// ZOOM

$("acercar").addEventListener(
  "click",
  () => zoom(2)
);

$("alejar").addEventListener(
  "click",
  () => zoom(0.5)
);

// ITERACIONES

$("iteraciones").addEventListener(
  "input",
  e => {

    $("valorIteraciones").textContent =
      e.target.value;
  }
);

$("iteraciones").addEventListener(
  "change",
  e => {

    s.maxIter = Number(e.target.value);

    if (
      s.running ||
      $("indicadorAvance").textContent !== "0 %"
    ) {
      iniciar();
    }
  }
);

// CALIDAD

$("calidad").addEventListener(
  "change",
  e => {

    s.quality = Number(e.target.value);

    iniciar();
  }
);

// PALETA

$("paleta").addEventListener(
  "change",
  e => {

    s.palette = e.target.value;

    iniciar();
  }
);

// APLICAR COORDENADAS

$("aplicarCentro").addEventListener(
  "click",
  () => {

    const a = leer("centroReal");
    const b = leer("centroImag");

    if (
      !Number.isFinite(a) ||
      !Number.isFinite(b)
    ) {

      alert(
        "Escribe coordenadas numéricas válidas."
      );

      return;
    }

    s.cx = a;
    s.cy = b;

    iniciar();
  }
);

// ANALIZAR PUNTO

$("analizar").addEventListener(
  "click",
  () => {

    analizar(
      leer("puntoReal"),
      leer("puntoImag")
    );
  }
);

// ACTIVIDAD: COMPROBAR

$("comprobar").addEventListener(
  "click",
  comprobar
);

// ACTIVIDAD: SIGUIENTE PREGUNTA

$("siguiente").addEventListener(
  "click",
  () => {

    if (indice < preguntas.length - 1) {

      indice++;

      mostrarPregunta();

    } else {

      $("retroalimentacion").textContent =
        "Actividad terminada: " +
        aciertos +
        " de " +
        preguntas.length +
        " respuestas correctas.";

      $("siguiente").disabled = true;
    }
  }
);

// ACTIVIDAD: REPETIR

$("repetir").addEventListener(
  "click",
  () => {

    indice = 0;
    aciertos = 0;

    mostrarPregunta();
  }
);

// ==========================================
// DESCARGAR IMAGEN PNG
// ==========================================

$("png").addEventListener(
  "click",
  () => {

    const salida =
      document.createElement("canvas");

    salida.width = fractal.width;
    salida.height = fractal.height;

    const c = salida.getContext("2d");

    c.drawImage(fractal, 0, 0);
    c.drawImage(marcador, 0, 0);

    const enlace =
      document.createElement("a");

    enlace.href =
      salida.toDataURL("image/png");

    enlace.download =
      "mandelbrot-lab.png";

    enlace.click();
  }
);

// ==========================================
// ZOOM CON RUEDA DEL RATÓN
// ==========================================

marcador.addEventListener(
  "wheel",
  e => {

    e.preventDefault();

    const p = posicion(e);

    zoom(
      e.deltaY < 0 ? 1.5 : 1 / 1.5,
      p.x,
      p.y
    );
  },
  { passive: false }
);

// ==========================================
// ARRASTRAR EL FRACTAL
// ==========================================

marcador.addEventListener(
  "pointerdown",
  e => {

    marcador.setPointerCapture(
      e.pointerId
    );

    s.pointer = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      cx: s.cx,
      cy: s.cy,
      moved: false
    };
  }
);

marcador.addEventListener(
  "pointermove",
  e => {

    const p = s.pointer;

    if (
      !p ||
      p.id !== e.pointerId
    ) return;

    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;

    if (
      Math.abs(dx) + Math.abs(dy) > 5
    ) {
      p.moved = true;
    }

    if (!p.moved) return;

    const rect =
      marcador.getBoundingClientRect();

    s.cx =
      p.cx -
      dx / rect.width *
      s.span *
      fractal.width / fractal.height;

    s.cy =
      p.cy +
      dy / rect.height *
      s.span;

    actualizar();
    dibujarMarcador();
  }
);

// SOLTAR EL RATÓN

marcador.addEventListener(
  "pointerup",
  e => {

    const p = s.pointer;

    if (
      !p ||
      p.id !== e.pointerId
    ) return;

    s.pointer = null;

    if (p.moved) {

      iniciar();

    } else {

      const xy = posicion(e);

      const c = aComplejo(
        xy.x,
        xy.y
      );

      analizar(c.a, c.b);
    }
  }
);

marcador.addEventListener(
  "pointercancel",
  () => {
    s.pointer = null;
  }
);

// ==========================================
// ADAPTACIÓN AL CAMBIAR EL TAMAÑO
// ==========================================

let resizeTimer;

window.addEventListener(
  "resize",
  () => {

    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(
      () => {

        if (
          s.running ||
          $("indicadorAvance").textContent !== "0 %"
        ) {

          iniciar();

        } else {

          reiniciar();
        }
      },
      200
    );
  }
);

// ==========================================
// INICIALIZAR PROYECTO
// ==========================================

reiniciar();
mostrarPregunta();

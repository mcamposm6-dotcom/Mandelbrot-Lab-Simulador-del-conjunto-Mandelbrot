


"use strict";

// =======================================
// MANDELBROT LAB - SIMULADOR COMPLETO
// =======================================

const $ = id => document.getElementById(id);

const canvas = $("fractal");
const ctx = canvas.getContext("2d");
const chart = $("grafica");
const g = chart.getContext("2d");

const W = canvas.width;
const H = canvas.height;

const iniciales = {
  iteraciones: 180,
  zoom: 1,
  centroReal: -0.5,
  centroImag: 0,
  calidad: 2,
  paleta: "cosmica"
};

let fase = "listo";
let tarea = null;
let frameId = null;
let version = 0;
let ultimaOrbita = [];

const colores = {
  cosmica: [
    [18, 28, 76],
    [65, 71, 185],
    [148, 66, 226],
    [250, 105, 164],
    [255, 224, 145]
  ],
  oceano: [
    [5, 24, 60],
    [0, 90, 150],
    [20, 167, 202],
    [75, 229, 215],
    [239, 255, 236]
  ],
  fuego: [
    [29, 8, 22],
    [155, 37, 31],
    [247, 97, 25],
    [255, 190, 69],
    [255, 248, 197]
  ],
  grises: [
    [20, 30, 45],
    [70, 86, 109],
    [137, 155, 174],
    [204, 216, 230],
    [255, 255, 255]
  ]
};

const limitar = (x, min, max) =>
  Math.max(min, Math.min(x, max));

const fmt = x =>
  Number.isFinite(x)
    ? Number(x.toPrecision(6)).toString()
    : "∞";

// =======================================
// PARÁMETROS Y DESLIZADORES
// =======================================

function parametros() {
  return {
    maxIter: Number($("iteraciones").value),
    zoom: Number($("zoom").value),
    centroReal: Number($("centroReal").value),
    centroImag: Number($("centroImag").value),
    calidad: Number($("calidad").value),
    paleta: $("paleta").value
  };
}

function actualizarEtiquetas() {
  $("vIteraciones").textContent =
    $("iteraciones").value;

  $("vZoom").textContent =
    Number($("zoom").value).toFixed(2) + "×";

  $("vReal").textContent =
    Number($("centroReal").value).toFixed(2);

  $("vImag").textContent =
    Number($("centroImag").value).toFixed(2);

  $("vCalidad").textContent = [
    "",
    "Rápida",
    "Media",
    "Alta"
  ][Number($("calidad").value)];
}

// =======================================
// CONTROL DE BOTONES
// =======================================

function actualizarBotones() {
  $("iniciar").disabled = false;
  $("pausar").disabled = fase !== "corriendo";
  $("continuar").disabled = fase !== "pausado";

  $("iniciar").textContent =
    fase === "corriendo" || fase === "pausado"
      ? "↻ Iniciar de nuevo"
      : "▶ Iniciar simulación";
}

function actualizarProgreso(valor) {
  const porcentaje = Math.round(valor * 100);

  $("porcentaje").textContent =
    porcentaje + " %";

  $("barraProgreso").style.width =
    porcentaje + "%";
}

function cancelarCalculo() {
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
  }

  frameId = null;
  version++;
}

// =======================================
// LIMPIAR Y REINICIAR
// =======================================

function limpiarSimulador() {
  cancelarCalculo();

  tarea = null;
  fase = "listo";

  ctx.clearRect(0, 0, W, H);

  $("aviso").classList.remove("oculto");
  $("estado").textContent =
    "Preparado para iniciar";

  actualizarProgreso(0);
  actualizarBotones();
}

function restablecerVariables() {
  Object.entries(iniciales).forEach(([id, valor]) => {
    $(id).value = valor;
  });

  actualizarEtiquetas();
  limpiarSimulador();

  $("mensajeVariables").textContent =
    "Variables restablecidas. Pulsa Iniciar simulación.";
}

// =======================================
// PLANO COMPLEJO
// =======================================

function pixelComplejo(px, py, w, h, p) {
  const alto = 2.9 / p.zoom;
  const ancho = alto * W / H;

  return {
    a: p.centroReal + (px / w - 0.5) * ancho,
    b: p.centroImag + (0.5 - py / h) * alto
  };
}

// =======================================
// PALETAS Y COLORES
// =======================================

function colorFractal(n, modulo, paleta) {
  const escala = colores[paleta];

  const valor =
    n + 1 -
    Math.log2(
      Math.max(
        1e-12,
        Math.log2(Math.max(2.000001, modulo))
      )
    );

  const pos =
    (((valor * 0.03) % 1) + 1) % 1 *
    (escala.length - 1);

  const i = Math.floor(pos);
  const t = pos - i;

  return escala[i].map((v, k) => {
    const siguiente =
      escala[Math.min(i + 1, escala.length - 1)][k];

    return Math.round(v + (siguiente - v) * t);
  });
}

// =======================================
// INICIAR SIMULACIÓN
// =======================================

function iniciarSimulacion() {
  cancelarCalculo();

  const p = parametros();

  const factores = {
    1: 0.52,
    2: 0.75,
    3: 1
  };

  const factor = factores[p.calidad];
  const w = Math.round(W * factor);
  const h = Math.round(H * factor);

  const buffer = document.createElement("canvas");

  buffer.width = w;
  buffer.height = h;

  const bc = buffer.getContext("2d");

  tarea = {
    p,
    w,
    h,
    buffer,
    bc,
    imagen: bc.createImageData(w, h),
    fila: 0,
    id: version
  };

  ctx.clearRect(0, 0, W, H);

  $("aviso").classList.add("oculto");
  $("estado").textContent = "Generando fractal...";

  $("mensajeVariables").textContent =
    "Calculando con los parámetros seleccionados.";

  fase = "corriendo";

  actualizarProgreso(0);
  actualizarBotones();
  programarBloque();
}

// =======================================
// PROCESAMIENTO PROGRESIVO
// =======================================

function programarBloque() {
  if (
    fase !== "corriendo" ||
    !tarea ||
    frameId !== null
  ) {
    return;
  }

  const trabajoActual = tarea;

  frameId = requestAnimationFrame(() => {
    frameId = null;

    if (
      fase === "corriendo" &&
      tarea === trabajoActual &&
      tarea.id === version
    ) {
      procesarBloque();
    }
  });
}

function procesarBloque() {
  if (fase !== "corriendo" || !tarea) return;

  const t = tarea;
  const primeraFila = t.fila;
  const inicio = performance.now();

  while (
    t.fila < t.h &&
    t.fila - primeraFila < 2 &&
    performance.now() - inicio < 9
  ) {
    const py = t.fila;

    for (let px = 0; px < t.w; px++) {
      const { a, b } = pixelComplejo(
        px + 0.5,
        py + 0.5,
        t.w,
        t.h,
        t.p
      );

      let x = 0;
      let y = 0;
      let x2 = 0;
      let y2 = 0;
      let n = 0;

      while (
        n < t.p.maxIter &&
        x2 + y2 <= 4
      ) {
        const nx = x2 - y2 + a;
        const ny = 2 * x * y + b;

        x = nx;
        y = ny;
        x2 = x * x;
        y2 = y * y;

        n++;
      }

      const color =
        n === t.p.maxIter && x2 + y2 <= 4
          ? [4, 9, 22]
          : colorFractal(
              n,
              Math.hypot(x, y),
              t.p.paleta
            );

      const k = (py * t.w + px) * 4;

      t.imagen.data[k] = color[0];
      t.imagen.data[k + 1] = color[1];
      t.imagen.data[k + 2] = color[2];
      t.imagen.data[k + 3] = 255;
    }

    t.fila++;
  }

  // Mostrar solamente las filas ya calculadas.
  if (t.fila > primeraFila) {
    const cantidad = t.fila - primeraFila;

    t.bc.putImageData(
      t.imagen,
      0,
      0,
      0,
      primeraFila,
      t.w,
      cantidad
    );

    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
      t.buffer,
      0,
      primeraFila,
      t.w,
      cantidad,
      0,
      primeraFila / t.h * H,
      W,
      cantidad / t.h * H
    );
  }

  actualizarProgreso(t.fila / t.h);

  if (t.fila >= t.h) {
    fase = "terminado";
    tarea = null;

    $("estado").textContent =
      "Fractal terminado · 100 %";

    actualizarBotones();
  } else {
    $("estado").textContent =
      `Generando... fila ${t.fila} de ${t.h}`;

    programarBloque();
  }
}

// =======================================
// PAUSAR Y CONTINUAR
// =======================================

function pausarSimulacion() {
  if (fase !== "corriendo") return;

  fase = "pausado";

  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }

  $("estado").textContent =
    "⏸ Simulación pausada";

  actualizarBotones();
}

function continuarSimulacion() {
  if (fase !== "pausado" || !tarea) return;

  fase = "corriendo";

  $("estado").textContent =
    "▶ Continuando simulación";

  actualizarBotones();
  programarBloque();
}

// =======================================
// CONTROLES DEL SIMULADOR
// =======================================

$("iniciar").addEventListener(
  "click",
  iniciarSimulacion
);

$("pausar").addEventListener(
  "click",
  pausarSimulacion
);

$("continuar").addEventListener(
  "click",
  continuarSimulacion
);

$("reiniciar").addEventListener(
  "click",
  limpiarSimulador
);

$("restablecerVariables").addEventListener(
  "click",
  restablecerVariables
);

for (const id of [
  "iteraciones",
  "zoom",
  "centroReal",
  "centroImag",
  "calidad",
  "paleta"
]) {
  $(id).addEventListener("input", () => {
    actualizarEtiquetas();
    limpiarSimulador();

    $("mensajeVariables").textContent =
      "Variables modificadas. Pulsa Iniciar " +
      "para generar una nueva imagen.";
  });
}

// =======================================
// ÓRBITA DE UN NÚMERO COMPLEJO
// =======================================

function orbita(a, b, maxIter) {
  let x = 0;
  let y = 0;
  let escape = null;

  const filas = [{
    n: 0,
    x: 0,
    y: 0,
    m: 0
  }];

  for (let n = 1; n <= maxIter; n++) {
    const nx = x * x - y * y + a;
    const ny = 2 * x * y + b;

    x = nx;
    y = ny;

    const m = Math.hypot(x, y);

    filas.push({ n, x, y, m });

    if (m > 2 || !Number.isFinite(m)) {
      escape = n;
      break;
    }
  }

  return { filas, escape };
}

// =======================================
// ANÁLISIS Y TABLA
// =======================================

function analizarPunto(a, b) {
  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b)
  ) {
    $("resultado").textContent =
      "Introduce números válidos.";
    return;
  }

  $("puntoReal").value = a;
  $("puntoImag").value = b;

  const r = orbita(
    a,
    b,
    Number($("iteraciones").value)
  );

  ultimaOrbita = r.filas;

  $("resultado").textContent =
    r.escape === null
      ? `c = ${fmt(a)} ${
          b < 0 ? "−" : "+"
        } ${fmt(Math.abs(b))}i: no escapó durante ` +
        "las iteraciones calculadas."

      : `c = ${fmt(a)} ${
          b < 0 ? "−" : "+"
        } ${fmt(Math.abs(b))}i: escapó en ` +
        `la iteración ${r.escape}.`;

  const fragmento = document.createDocumentFragment();

  for (const fila of r.filas) {
    const tr = document.createElement("tr");

    for (const valor of [
      fila.n,
      fila.x,
      fila.y,
      fila.m
    ]) {
      const td = document.createElement("td");
      td.textContent = fmt(valor);
      tr.appendChild(td);
    }

    fragmento.appendChild(tr);
  }

  $("tabla").replaceChildren(fragmento);

  $("interpretacion").textContent =
    r.escape === null
      ? "El módulo no superó el radio 2 durante " +
        "las iteraciones calculadas."
      : `La órbita supera el radio 2 en n = ${r.escape}.`;

  dibujarGrafica();
}

// =======================================
// GRÁFICA DE |z_n| FRENTE A n
// =======================================

function dibujarGrafica() {
  const w = chart.width;
  const h = chart.height;

  const L = 55;
  const R = 22;
  const T = 25;
  const B = 44;

  g.fillStyle = "#071424";
  g.fillRect(0, 0, w, h);

  if (!ultimaOrbita.length) return;

  const maxN = Math.max(
    1,
    ultimaOrbita[ultimaOrbita.length - 1].n
  );

  const maxValor = Math.max(
    ...ultimaOrbita.map(f =>
      Number.isFinite(f.m) ? f.m : 20
    )
  );

  const maxY = Math.max(
    3,
    Math.min(20, Math.ceil(maxValor))
  );

  const X = n =>
    L + n / maxN * (w - L - R);

  const Y = m =>
    h - B -
    limitar(m, 0, maxY) / maxY * (h - T - B);

  g.font = "12px Arial";
  g.lineWidth = 1;

  // Cuadrícula y valores del eje vertical
  for (let i = 0; i <= 4; i++) {
    const valor = maxY * i / 4;
    const y = Y(valor);

    g.strokeStyle = "#29445e";
    g.beginPath();
    g.moveTo(L, y);
    g.lineTo(w - R, y);
    g.stroke();

    g.fillStyle = "#d8e8f7";
    g.fillText(fmt(valor), 5, y + 4);
  }

  // Etiquetas del eje horizontal
  g.fillStyle = "#d8e8f7";

  for (let i = 0; i <= 5; i++) {
    const n = Math.round(maxN * i / 5);

    g.fillText(
      String(n),
      X(n) - 8,
      h - 24
    );
  }

  g.fillText(
    "n (iteración)",
    w / 2 - 35,
    h - 7
  );

  g.fillText("|zₙ|", 8, 16);

  // Radio de escape |z| = 2
  g.strokeStyle = "#ff6c7d";
  g.setLineDash([7, 5]);

  g.beginPath();
  g.moveTo(L, Y(2));
  g.lineTo(w - R, Y(2));
  g.stroke();

  g.setLineDash([]);

  // Curva
  g.strokeStyle = "#55eada";
  g.lineWidth = 2.5;
  g.beginPath();

  ultimaOrbita.forEach((fila, i) => {
    const x = X(fila.n);

    const y = Y(
      Number.isFinite(fila.m)
        ? fila.m
        : maxY
    );

    if (i === 0) {
      g.moveTo(x, y);
    } else {
      g.lineTo(x, y);
    }
  });

  g.stroke();
}

// =======================================
// DESCARGAR PNG Y CSV
// =======================================

function descargar(elemento, nombre) {
  const enlace = document.createElement("a");

  enlace.download = nombre;
  enlace.href = elemento.toDataURL("image/png");
  enlace.click();
}

$("guardar").addEventListener("click", () => {
  descargar(canvas, "mandelbrot.png");
});

$("guardarGrafica").addEventListener("click", () => {
  descargar(chart, "grafica_mandelbrot.png");
});

$("csv").addEventListener("click", () => {
  if (!ultimaOrbita.length) return;

  const filas = [
    "n,Real,Imaginaria,Modulo",
    ...ultimaOrbita.map(f =>
      `${f.n},${f.x},${f.y},${f.m}`
    )
  ];

  const blob = new Blob(
    ["\uFEFF" + filas.join("\r\n")],
    { type: "text/csv;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = "mandelbrot_iteraciones.csv";
  enlace.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// =======================================
// SELECCIONAR PUNTOS
// =======================================

$("analizar").addEventListener("click", () => {
  const textoA = $("puntoReal").value.trim();
  const textoB = $("puntoImag").value.trim();

  analizarPunto(
    textoA === "" ? NaN : Number(textoA),
    textoB === "" ? NaN : Number(textoB)
  );
});

document.querySelectorAll(".caso").forEach(boton => {
  boton.addEventListener("click", () => {
    analizarPunto(Number(boton.dataset.real), 0);
  });
});

canvas.addEventListener("click", e => {
  if (fase !== "terminado") return;

  const rect = canvas.getBoundingClientRect();

  const px =
    (e.clientX - rect.left) / rect.width * W;

  const py =
    (e.clientY - rect.top) / rect.height * H;

  const c = pixelComplejo(
    px,
    py,
    W,
    H,
    parametros()
  );

  analizarPunto(c.a, c.b);
});

// =======================================
// ACTIVIDAD DIDÁCTICA FINAL
// =======================================

const bancoActividad = [
  {
    texto:
      "¿Qué ecuación genera el conjunto de Mandelbrot?",

    opciones: [
      "z(n+1) = z(n) + c",
      "z(n+1) = z(n)² + c",
      "z(n+1) = 2z(n) + c",
      "z(n+1) = c²"
    ],

    respuesta: 1,

    explicacion:
      "Se utiliza la relación z(n+1) = z(n)² + c, " +
      "comenzando en z(0) = 0."
  },
  {
    texto:
      "¿Qué significa que |zₙ| sea mayor que 2?",

    opciones: [
      "El punto pertenece al conjunto",
      "La órbita se hace cero",
      "La órbita escapa y el punto está fuera del conjunto",
      "La ecuación deja de funcionar"
    ],

    respuesta: 2,

    explicacion:
      "Cuando el módulo supera 2, el punto no " +
      "pertenece al conjunto de Mandelbrot."
  },
  {
    texto:
      "Si c = 0 y z₀ = 0, ¿qué ocurre?",

    opciones: [
      "La sucesión permanece en cero",
      "La órbita escapa en n = 3",
      "La sucesión crece sin límite",
      "Los valores alternan entre 1 y 2"
    ],

    respuesta: 0,

    explicacion:
      "Todos los términos permanecen iguales a cero."
  },
  {
    texto:
      "¿Para qué sirve aumentar las iteraciones máximas?",

    opciones: [
      "Para modificar la ecuación",
      "Para detectar puntos que escapan más tarde",
      "Para eliminar la parte imaginaria",
      "Para asegurar que todos los puntos pertenecen"
    ],

    respuesta: 1,

    explicacion:
      "Más iteraciones permiten reconocer escapes tardíos."
  },
  {
    texto:
      "¿Qué permite observar el deslizador de zoom?",

    opciones: [
      "Un cambio en la ecuación",
      "Un nuevo radio de escape",
      "La desaparición de los números complejos",
      "Detalles del fractal a escalas menores"
    ],

    respuesta: 3,

    explicacion:
      "El zoom permite explorar estructuras " +
      "del fractal a distintas escalas."
  }
];

let indiceActividad = 0;
let puntosActividad = 0;
let intentosActividad = 0;
let preguntaResuelta = false;

// MOSTRAR PREGUNTA

function mostrarPregunta() {
  const pregunta = bancoActividad[indiceActividad];

  intentosActividad = 0;
  preguntaResuelta = false;

  $("contadorActividad").textContent =
    `Pregunta ${indiceActividad + 1} de ` +
    bancoActividad.length;

  $("preguntaActividad").textContent =
    pregunta.texto;

  $("notaActividad").textContent =
    `${puntosActividad}/10`;

  $("avanceActividad").style.width =
    `${indiceActividad / bancoActividad.length * 100}%`;

  $("retroActividad").textContent =
    "Selecciona una respuesta y pulsa Comprobar.";

  $("resumenActividad").hidden = true;

  $("comprobarActividad").disabled = false;
  $("siguienteActividad").disabled = true;

  const contenedor = $("opcionesActividad");
  contenedor.replaceChildren();

  pregunta.opciones.forEach((opcion, i) => {
    const etiqueta = document.createElement("label");
    etiqueta.className = "opcion-actividad";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "respuestaActividad";
    radio.value = String(i);

    const texto = document.createElement("span");
    texto.textContent = opcion;

    etiqueta.append(radio, texto);
    contenedor.appendChild(etiqueta);
  });
}

// COMPROBAR RESPUESTA

function comprobarRespuesta() {
  if (preguntaResuelta) return;

  const seleccion = document.querySelector(
    'input[name="respuestaActividad"]:checked'
  );

  if (!seleccion) {
    $("retroActividad").textContent =
      "Debes seleccionar una respuesta.";
    return;
  }

  const pregunta = bancoActividad[indiceActividad];
  const respuesta = Number(seleccion.value);
  const etiqueta = seleccion.closest("label");

  if (respuesta === pregunta.respuesta) {
    preguntaResuelta = true;

    const premio =
      intentosActividad === 0 ? 2 : 1;

    puntosActividad += premio;

    etiqueta.classList.add("correcta");

    $("retroActividad").textContent =
      `¡Correcto! +${premio} punto(s). ` +
      pregunta.explicacion;

  } else {
    intentosActividad++;

    etiqueta.classList.add("incorrecta");
    seleccion.disabled = true;
    seleccion.checked = false;

    if (intentosActividad === 1) {
      $("retroActividad").textContent =
        "Respuesta incorrecta. Tienes una segunda " +
        "oportunidad por 1 punto.";
      return;
    }

    preguntaResuelta = true;

    $("retroActividad").textContent =
      "Respuesta correcta: " +
      pregunta.opciones[pregunta.respuesta] +
      ". " +
      pregunta.explicacion;

    $("opcionesActividad")
      .children[pregunta.respuesta]
      .classList.add("correcta");
  }

  $("notaActividad").textContent =
    `${puntosActividad}/10`;

  $("comprobarActividad").disabled = true;
  $("siguienteActividad").disabled = false;

  document.querySelectorAll(
    'input[name="respuestaActividad"]'
  ).forEach(radio => {
    radio.disabled = true;
  });
}

// SIGUIENTE PREGUNTA

function siguientePregunta() {
  if (!preguntaResuelta) return;

  if (indiceActividad < bancoActividad.length - 1) {
    indiceActividad++;
    mostrarPregunta();
    return;
  }

  finalizarActividad();
}

// RESULTADO FINAL

function finalizarActividad() {
  $("avanceActividad").style.width = "100%";

  $("contadorActividad").textContent =
    "Actividad finalizada";

  $("preguntaActividad").textContent =
    "¡Has completado el desafío Mandelbrot!";

  $("opcionesActividad").replaceChildren();

  $("comprobarActividad").disabled = true;
  $("siguienteActividad").disabled = true;

  const resumen = $("resumenActividad");
  resumen.hidden = false;

  resumen.textContent =
    `Calificación final: ${puntosActividad}/10. ` +
    (
      puntosActividad >= 7
        ? "Buen trabajo. Has comprendido " +
          "los conceptos principales."
        : "Vuelve a experimentar con los deslizadores, " +
          "analiza la gráfica y repite la actividad."
    );

  $("retroActividad").textContent =
    "Puedes repetir la actividad para mejorar tu nota.";
}

// REPETIR ACTIVIDAD

function repetirActividad() {
  indiceActividad = 0;
  puntosActividad = 0;
  intentosActividad = 0;
  preguntaResuelta = false;

  mostrarPregunta();
}

// BOTONES DEL CUESTIONARIO

$("comprobarActividad").addEventListener(
  "click",
  comprobarRespuesta
);

$("siguienteActividad").addEventListener(
  "click",
  siguientePregunta
);

$("repetirActividad").addEventListener(
  "click",
  repetirActividad
);

// =======================================
// ESTADO INICIAL
// =======================================

// La imagen NO se dibuja automáticamente.
actualizarEtiquetas();
limpiarSimulador();

// La gráfica espera a que se analice un punto.
g.fillStyle = "#071424";
g.fillRect(0, 0, chart.width, chart.height);

// Mostrar primera pregunta del cuestionario.
mostrarPregunta();

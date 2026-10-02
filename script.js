// ============================================
// CONFIGURACIÓN DE PDF.JS
// ============================================
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============================================
// VARIABLES GLOBALES
// ============================================
let listaPDFs = [];
let pdfDocActual = null;
let totalPaginas = 1;
let paginaActual = 1;
let bloqueado = false;

let zoomActual = 1;
let zoomMin = 1;
let zoomMax = 8;         // Subimos a 800% para máxima lectura
let zoomPaso = 0.25;

let arrastrando = false;
let startX = 0, startY = 0;
let scrollStartX = 0, scrollStartY = 0;

let anchoBaseActual = 0;
let altoBaseActual = 0;

// ============================================
// DETECCIÓN DE DISPOSITIVO
// ============================================
function esMovil() {
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) 
        || window.innerWidth <= 768;
}

function esPantallaRetina() {
    return (window.devicePixelRatio || 1) >= 2;
}

// ============================================
// CARGAR LISTA DE PDFs
// ============================================
async function cargarListaPDFs() {
    try {
        const respuesta = await fetch('lista.json?v=' + Date.now(), { cache: 'no-store' });
        if (!respuesta.ok) throw new Error('No se encontró lista.json');
        listaPDFs = await respuesta.json();
        
        document.getElementById('contador-docs').textContent = 
            `${listaPDFs.length} documento${listaPDFs.length !== 1 ? 's' : ''}`;
        
        cargarGaleria();
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('galeria').innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <h2 style="color:#e53e3e;">⚠️ No se encontró lista.json</h2>
            </div>
        `;
    }
}

// ============================================
// CARGAR GALERÍA
// ============================================
function cargarGaleria() {
    const galeria = document.getElementById('galeria');
    galeria.innerHTML = '';

    if (listaPDFs.length === 0) {
        galeria.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <h2 style="color:#718096;">📭 No hay documentos</h2>
            </div>
        `;
        return;
    }

    listaPDFs.forEach((pdf, index) => {
        const numero = String(index + 1).padStart(2, '0');
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta';
        tarjeta.innerHTML = `
            <div class="tarjeta-portada">
                <div class="numero">${numero}</div>
                <div class="placeholder">📕</div>
            </div>
            <div class="tarjeta-info">
                <h3>${pdf.titulo}</h3>
                <div class="categoria">Matriz IPERC</div>
            </div>
        `;
        tarjeta.onclick = () => abrirVisor(index);
        galeria.appendChild(tarjeta);
    });
}

// ============================================
// ABRIR VISOR
// ============================================
async function abrirVisor(index) {
    if (bloqueado) return;
    bloqueado = true;
    
    const pdf = listaPDFs[index];
    
    if (pdfDocActual) {
        try { await pdfDocActual.destroy(); } catch(e) {}
        pdfDocActual = null;
    }
    
    totalPaginas = 1;
    paginaActual = 1;
    zoomActual = 1;
    
    document.querySelector('.galeria-container').style.display = 'none';
    document.querySelector('.header').style.display = 'none';
    document.getElementById('visor').classList.remove('oculto');
    document.getElementById('titulo-libro').textContent = pdf.titulo;

    const container = document.getElementById('pdf-page-container');
    container.innerHTML = `
        <div class="loader">
            <div class="spinner"></div>
            <p>Cargando documento...</p>
        </div>
    `;

    try {
        const loadingTask = pdfjsLib.getDocument({
            url: pdf.archivo,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true
        });
        
        pdfDocActual = await loadingTask.promise;
        totalPaginas = pdfDocActual.numPages;
        paginaActual = 1;
        
        await mostrarPagina(paginaActual);
        actualizarIndicadores();
        actualizarBotones();
        actualizarZoom();

    } catch (error) {
        console.error('Error al cargar PDF:', error);
        container.innerHTML = `
            <div style="color:white; text-align:center; padding: 40px;">
                <h2>❌ No se pudo cargar el documento</h2>
                <p style="opacity:0.7; margin-top:10px;">
                    Ruta: <strong>${pdf.archivo}</strong>
                </p>
            </div>
        `;
    } finally {
        bloqueado = false;
    }
}

// ============================================
// MOSTRAR PÁGINA (RENDERIZADO A ALTA RESOLUCIÓN)
// ============================================
async function mostrarPagina(numeroPagina) {
    if (!pdfDocActual) return;

    const container = document.getElementById('pdf-page-container');
    const wrapper = document.getElementById('pdf-wrapper');
    
    container.style.opacity = '0';
    
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        const page = await pdfDocActual.getPage(numeroPagina);
        
        const viewportBase = page.getViewport({ scale: 1 });
        const ratio = viewportBase.width / viewportBase.height;
        
        // ===== ESPACIO DISPONIBLE =====
        // Reducimos el padding en móvil para que el PDF se vea MÁS GRANDE
        const padding = esMovil() ? 60 : 140;
        const anchoDisponible = wrapper.clientWidth - padding;
        const altoDisponible = wrapper.clientHeight - 30;
        
        // Calcular tamaño base para que quepa completo
        if (anchoDisponible / altoDisponible > ratio) {
            altoBaseActual = altoDisponible;
            anchoBaseActual = altoBaseActual * ratio;
        } else {
            anchoBaseActual = anchoDisponible;
            altoBaseActual = anchoBaseActual / ratio;
        }
        
        // ============================================================
        // FACTOR DE CALIDAD ADAPTATIVO AL MÁXIMO
        // ============================================================
        const dpr = window.devicePixelRatio || 1;
        let factorCalidad;
        
        if (esMovil()) {
            // Móvil: usar 6x para máxima nitidez
            factorCalidad = 6;
        } else if (esPantallaRetina()) {
            // PC/tablet retina
            factorCalidad = Math.max(dpr, 4);
        } else {
            // PC normal
            factorCalidad = 3;
        }
        
        // Limitar factor según el tamaño del canvas para evitar crash
        // Un canvas mayor a 16 millones de píxeles puede fallar en móviles
        const MAX_PIXELES = 16000000;
        const anchoEstimado = viewportBase.width * factorCalidad * (anchoBaseActual / viewportBase.width);
        const altoEstimado = viewportBase.height * factorCalidad * (anchoBaseActual / viewportBase.width);
        const pixelesEstimados = anchoEstimado * altoEstimado;
        
        if (pixelesEstimados > MAX_PIXELES) {
            factorCalidad = factorCalidad * Math.sqrt(MAX_PIXELES / pixelesEstimados);
        }
        
        // Asegurar mínimo de 3x
        factorCalidad = Math.max(factorCalidad, 3);
        
        const escalaRender = (anchoBaseActual / viewportBase.width) * factorCalidad;
        const viewportRender = page.getViewport({ scale: escalaRender });
        
        // ===== CREAR CANVAS =====
        const canvas = document.createElement('canvas');
        canvas.width = viewportRender.width;
        canvas.height = viewportRender.height;
        canvas.style.display = 'block';
        
        // Contexto sin alpha para mejor rendimiento
        const context = canvas.getContext('2d', { 
            alpha: false,
            willReadFrequently: false
        });
        
        // Máxima calidad de suavizado
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        // Fondo blanco
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // ===== RENDERIZAR PDF =====
        await page.render({
            canvasContext: context,
            viewport: viewportRender
        }).promise;
        
        // Segunda pasada de suavizado para mejor calidad visual
        // (Redibujamos el canvas sobre sí mismo con suavizado)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';
        tempCtx.drawImage(canvas, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(tempCanvas, 0, 0);
        
        // Limpiar temporal
        tempCanvas.width = 0;
        tempCanvas.height = 0;

        container.innerHTML = '';
        container.appendChild(canvas);
        container.style.opacity = '1';
        
        // Aplicar tamaño visual según el zoom actual
        aplicarTamañoVisual();
        
        // Actualizar comportamiento
        actualizarComportamiento();
        
        // Centrar después del renderizado
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                centrarDocumento();
            });
        });
        
    } catch (error) {
        console.error('Error al renderizar página:', error);
        container.style.opacity = '1';
    }
}

// ============================================
// APLICAR TAMAÑO VISUAL
// ============================================
function aplicarTamañoVisual() {
    const canvas = document.querySelector('#pdf-page-container canvas');
    const container = document.getElementById('pdf-page-container');
    const viewer = document.getElementById('pdf-viewer');
    const wrapper = document.getElementById('pdf-wrapper');
    
    if (!canvas || !container || !viewer || !wrapper) return;
    
    // Tamaño visual del canvas
    const anchoVisual = Math.round(anchoBaseActual * zoomActual);
    const altoVisual = Math.round(altoBaseActual * zoomActual);
    
    canvas.style.width = anchoVisual + 'px';
    canvas.style.height = altoVisual + 'px';
    
    // Contenedor del canvas: tamaño exacto
    container.style.width = anchoVisual + 'px';
    container.style.height = altoVisual + 'px';
    
    // El viewer debe ser AL MENOS del tamaño del wrapper para centrado
    const anchoViewer = Math.max(anchoVisual, wrapper.clientWidth);
    const altoViewer = Math.max(altoVisual, wrapper.clientHeight);
    
    viewer.style.width = anchoViewer + 'px';
    viewer.style.height = altoViewer + 'px';
    viewer.style.minWidth = anchoViewer + 'px';
    viewer.style.minHeight = altoViewer + 'px';
}

// ============================================
// ACTUALIZAR COMPORTAMIENTO DE SCROLL
// ============================================
function actualizarComportamiento() {
    const wrapper = document.getElementById('pdf-wrapper');
    if (!wrapper) return;
    
    if (zoomActual > 1) {
        wrapper.classList.add('zoom-activo');
    } else {
        wrapper.classList.remove('zoom-activo');
    }
}

// ============================================
// CENTRAR DOCUMENTO
// ============================================
function centrarDocumento() {
    const wrapper = document.getElementById('pdf-wrapper');
    if (!wrapper) return;
    
    const scrollX = (wrapper.scrollWidth - wrapper.clientWidth) / 2;
    const scrollY = (wrapper.scrollHeight - wrapper.clientHeight) / 2;
    
    wrapper.scrollLeft = Math.max(0, scrollX);
    wrapper.scrollTop = Math.max(0, scrollY);
}

// ============================================
// NAVEGACIÓN
// ============================================
async function paginaAnterior() {
    if (bloqueado || !pdfDocActual) return;
    if (paginaActual <= 1) return;
    
    bloqueado = true;
    paginaActual--;
    await mostrarPagina(paginaActual);
    actualizarIndicadores();
    actualizarBotones();
    bloqueado = false;
}

async function paginaSiguiente() {
    if (bloqueado || !pdfDocActual) return;
    if (paginaActual >= totalPaginas) return;
    
    bloqueado = true;
    paginaActual++;
    await mostrarPagina(paginaActual);
    actualizarIndicadores();
    actualizarBotones();
    bloqueado = false;
}

// ============================================
// ZOOM
// ============================================
function zoomIn() {
    if (zoomActual >= zoomMax) return;
    
    const wrapper = document.getElementById('pdf-wrapper');
    const centroX = (wrapper.scrollLeft + wrapper.clientWidth / 2) / Math.max(1, wrapper.scrollWidth);
    const centroY = (wrapper.scrollTop + wrapper.clientHeight / 2) / Math.max(1, wrapper.scrollHeight);
    
    zoomActual = Math.min(zoomActual + zoomPaso, zoomMax);
    actualizarZoom();
    aplicarTamañoVisual();
    actualizarComportamiento();
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (zoomActual === 1) {
                centrarDocumento();
            } else {
                wrapper.scrollLeft = centroX * wrapper.scrollWidth - wrapper.clientWidth / 2;
                wrapper.scrollTop = centroY * wrapper.scrollHeight - wrapper.clientHeight / 2;
            }
        });
    });
}

function zoomOut() {
    if (zoomActual <= zoomMin) return;
    
    const wrapper = document.getElementById('pdf-wrapper');
    const centroX = (wrapper.scrollLeft + wrapper.clientWidth / 2) / Math.max(1, wrapper.scrollWidth);
    const centroY = (wrapper.scrollTop + wrapper.clientHeight / 2) / Math.max(1, wrapper.scrollHeight);
    
    zoomActual = Math.max(zoomActual - zoomPaso, zoomMin);
    actualizarZoom();
    aplicarTamañoVisual();
    actualizarComportamiento();
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (zoomActual === 1) {
                centrarDocumento();
            } else {
                wrapper.scrollLeft = centroX * wrapper.scrollWidth - wrapper.clientWidth / 2;
                wrapper.scrollTop = centroY * wrapper.scrollHeight - wrapper.clientHeight / 2;
            }
        });
    });
}

function zoomReset() {
    zoomActual = 1;
    actualizarZoom();
    aplicarTamañoVisual();
    actualizarComportamiento();
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            centrarDocumento();
        });
    });
}

function actualizarZoom() {
    const nivel = document.getElementById('zoom-nivel');
    if (nivel) {
        nivel.textContent = Math.round(zoomActual * 100) + '%';
    }
}

// ============================================
// ACTUALIZAR INDICADORES
// ============================================
function actualizarIndicadores() {
    document.getElementById('indicador-pagina').textContent = 
        `${paginaActual} / ${totalPaginas}`;
    
    const progreso = (paginaActual / totalPaginas) * 100;
    document.getElementById('progreso-relleno').style.width = progreso + '%';
}

function actualizarBotones() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnAnt = document.getElementById('btn-ant');
    const btnSig = document.getElementById('btn-sig');
    
    const esPrimera = paginaActual <= 1;
    const esUltima = paginaActual >= totalPaginas;
    
    if (btnPrev) btnPrev.disabled = esPrimera;
    if (btnAnt) btnAnt.disabled = esPrimera;
    if (btnNext) btnNext.disabled = esUltima;
    if (btnSig) btnSig.disabled = esUltima;
}

// ============================================
// CERRAR VISOR
// ============================================
async function cerrarVisor() {
    if (pdfDocActual) {
        try { await pdfDocActual.destroy(); } catch(e) {}
        pdfDocActual = null;
    }
    
    paginaActual = 1;
    totalPaginas = 1;
    zoomActual = 1;
    bloqueado = false;
    arrastrando = false;
    
    document.getElementById('visor').classList.add('oculto');
    document.querySelector('.galeria-container').style.display = 'block';
    document.querySelector('.header').style.display = 'block';
    
    const container = document.getElementById('pdf-page-container');
    container.innerHTML = '';
    container.style.opacity = '1';
    container.style.width = '';
    container.style.height = '';
    
    const viewer = document.getElementById('pdf-viewer');
    if (viewer) {
        viewer.style.width = '';
        viewer.style.height = '';
        viewer.style.minWidth = '';
        viewer.style.minHeight = '';
    }
    
    const wrapper = document.getElementById('pdf-wrapper');
    if (wrapper) {
        wrapper.classList.remove('zoom-activo');
        wrapper.scrollLeft = 0;
        wrapper.scrollTop = 0;
    }
}

// ============================================
// DETECTAR ?doc=XX EN LA URL
// ============================================
function obtenerDocDesdeURL() {
    const hash = window.location.hash;
    if (hash && hash.includes('doc=')) {
        const match = hash.match(/doc=([^&]+)/);
        if (match && match[1]) return decodeURIComponent(match[1]);
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('doc');
}

// ============================================
// CONFIGURAR ARRASTRE (MOUSE + TÁCTIL)
// ============================================
function configurarArrastre() {
    const wrapper = document.getElementById('pdf-wrapper');
    if (!wrapper || wrapper.dataset.arrastreConfigurado === '1') return;
    wrapper.dataset.arrastreConfigurado = '1';
    
    // ===== MOUSE =====
    wrapper.addEventListener('mousedown', (e) => {
        if (zoomActual <= 1) return;
        if (e.target.closest('button')) return;
        
        arrastrando = true;
        startX = e.clientX;
        startY = e.clientY;
        scrollStartX = wrapper.scrollLeft;
        scrollStartY = wrapper.scrollTop;
        wrapper.classList.add('arrastrando');
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!arrastrando) return;
        e.preventDefault();
        const walkX = e.clientX - startX;
        const walkY = e.clientY - startY;
        wrapper.scrollLeft = scrollStartX - walkX;
        wrapper.scrollTop = scrollStartY - walkY;
    });
    
    document.addEventListener('mouseup', () => {
        if (arrastrando) {
            arrastrando = false;
            wrapper.classList.remove('arrastrando');
        }
    });
    
    // ===== TÁCTIL =====
    wrapper.addEventListener('touchstart', (e) => {
        if (zoomActual <= 1) return;
        if (e.touches.length !== 1) return;
        if (e.target.closest('button')) return;
        
        arrastrando = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        scrollStartX = wrapper.scrollLeft;
        scrollStartY = wrapper.scrollTop;
    }, { passive: true });
    
    wrapper.addEventListener('touchmove', (e) => {
        if (!arrastrando || e.touches.length !== 1) return;
        const walkX = e.touches[0].clientX - startX;
        const walkY = e.touches[0].clientY - startY;
        wrapper.scrollLeft = scrollStartX - walkX;
        wrapper.scrollTop = scrollStartY - walkY;
    }, { passive: true });
    
    wrapper.addEventListener('touchend', () => { arrastrando = false; });
    wrapper.addEventListener('touchcancel', () => { arrastrando = false; });
    
    // ===== DOBLE TAP =====
    let ultimoTap = 0;
    wrapper.addEventListener('touchend', (e) => {
        const ahora = Date.now();
        if (ahora - ultimoTap < 300) {
            if (zoomActual > 1) {
                zoomReset();
            } else {
                zoomActual = 2;
                actualizarZoom();
                aplicarTamañoVisual();
                actualizarComportamiento();
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        centrarDocumento();
                    });
                });
            }
            e.preventDefault();
        }
        ultimoTap = ahora;
    });
    
    // ===== DOBLE CLIC (PC) =====
    wrapper.addEventListener('dblclick', (e) => {
        if (e.target.closest('button')) return;
        if (zoomActual > 1) {
            zoomReset();
        } else {
            zoomActual = 2;
            actualizarZoom();
            aplicarTamañoVisual();
            actualizarComportamiento();
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    centrarDocumento();
                });
            });
        }
    });
}

// ============================================
// TECLADO
// ============================================
document.addEventListener('keydown', (e) => {
    if (document.getElementById('visor').classList.contains('oculto')) return;
    if (e.key === 'ArrowLeft') paginaAnterior();
    if (e.key === 'ArrowRight') paginaSiguiente();
    if (e.key === '+' || e.key === '=') zoomIn();
    if (e.key === '-') zoomOut();
    if (e.key === '0') zoomReset();
    if (e.key === 'Escape') cerrarVisor();
});

// ============================================
// RESIZE
// ============================================
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (pdfDocActual && !document.getElementById('visor').classList.contains('oculto')) {
            const zoomGuardado = zoomActual;
            mostrarPagina(paginaActual).then(() => {
                zoomActual = zoomGuardado;
                actualizarZoom();
                aplicarTamañoVisual();
                actualizarComportamiento();
                centrarDocumento();
            });
        }
    }, 300);
});

// ============================================
// INICIAR
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarListaPDFs();
    
    configurarArrastre();
    
    const docParam = obtenerDocDesdeURL();
    if (docParam) {
        const index = listaPDFs.findIndex((pdf, i) => {
            const num = String(i + 1).padStart(2, '0');
            return num === docParam || pdf.archivo.toLowerCase().includes(docParam.toLowerCase());
        });
        
        if (index !== -1) {
            setTimeout(() => abrirVisor(index), 500);
        }
    }
});

window.addEventListener('hashchange', () => {
    const docParam = obtenerDocDesdeURL();
    if (docParam) {
        const index = listaPDFs.findIndex((pdf, i) => {
            const num = String(i + 1).padStart(2, '0');
            return num === docParam;
        });
        if (index !== -1) abrirVisor(index);
    }
// ============================================
// DESCARGAR PDF (ENLACE DIRECTO COMPATIBLE)
// ============================================
function descargarPDF() {
    // Verificar que haya un documento abierto
    if (!pdfDocActual || !listaPDFs.length) {
        alert('No hay ningún documento abierto.');
        return;
    }
    
    // Obtener el documento actual
    const tituloActual = document.getElementById('titulo-libro').textContent;
    const pdfActual = listaPDFs.find(p => p.titulo === tituloActual);
    
    if (!pdfActual) {
        alert('No se pudo identificar el documento.');
        return;
    }
    
    // Feedback visual en el botón
    const btn = document.querySelector('.btn-descargar');
    const textoOriginal = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<span>📄</span> Abriendo...';
        btn.disabled = true;
        btn.style.opacity = '0.7';
    }
    
    // ✅ SOLUCIÓN: Usar un enlace directo (el navegador decide qué hacer)
    // Esto es lo más compatible que existe.
    const enlace = document.createElement('a');
    enlace.href = pdfActual.archivo;
    enlace.target = '_blank'; // Abre en nueva pestaña para no perder la app
    enlace.rel = 'noopener noreferrer';
    
    // Añadir al DOM, hacer clic y quitarlo (método estándar y seguro)
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    
    // Restaurar el botón después de un momento
    if (btn) {
        setTimeout(() => {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            btn.style.opacity = '1';
        }, 1500);
    }
}
});

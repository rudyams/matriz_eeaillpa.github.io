// ============================================
// CONFIGURACIÓN DE PDF.JS
// ============================================
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============================================
// VARIABLES GLOBALES
// ============================================
let listaPDFs = [];
let pageFlip = null;
let totalPaginas = 1;
let paginaActual = 1;

// ============================================
// CARGAR LISTA
// ============================================
async function cargarListaPDFs() {
    try {
        const respuesta = await fetch('lista.json');
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
                <div class="categoria">Documento PDF</div>
            </div>
        `;
        tarjeta.onclick = () => abrirFlipbook(index);
        galeria.appendChild(tarjeta);
    });
}

// ============================================
// ABRIR FLIPBOOK (EFECTO HOJA COMPLETA)
// ============================================
async function abrirFlipbook(index) {
    const pdf = listaPDFs[index];
    
    document.querySelector('.galeria-container').style.display = 'none';
    document.querySelector('.header').style.display = 'none';
    document.getElementById('visor').classList.remove('oculto');
    document.getElementById('titulo-libro').textContent = pdf.titulo;

    const flipbookDiv = document.getElementById('flipbook');
    flipbookDiv.innerHTML = '';

    try {
        const loadingTask = pdfjsLib.getDocument(pdf.archivo);
        const pdfDoc = await loadingTask.promise;
        totalPaginas = pdfDoc.numPages;

        // ============ CÁLCULO DE DIMENSIONES ============
        // Obtenemos el tamaño real de la primera página
        const primeraPagina = await pdfDoc.getPage(1);
        const viewportOriginal = primeraPagina.getViewport({ scale: 1 });
        const ratioOriginal = viewportOriginal.width / viewportOriginal.height;

        // Calcular espacio disponible en pantalla
        const wrapper = document.querySelector('.flipbook-wrapper');
        const anchoDisponible = wrapper.clientWidth - 40;
        const altoDisponible = wrapper.clientHeight - 40;

        // Ajustar respetando la relación de aspecto (SIN DISTORSIÓN)
        let anchoFinal, altoFinal;
        if (anchoDisponible / altoDisponible > ratioOriginal) {
            // Limitado por altura
            altoFinal = altoDisponible;
            anchoFinal = altoFinal * ratioOriginal;
        } else {
            // Limitado por ancho
            anchoFinal = anchoDisponible;
            altoFinal = anchoFinal / ratioOriginal;
        }

        // Limitar tamaño máximo para que no se vea gigante
        const maxAncho = 700;
        const maxAlto = 900;
        if (anchoFinal > maxAncho) {
            anchoFinal = maxAncho;
            altoFinal = anchoFinal / ratioOriginal;
        }
        if (altoFinal > maxAlto) {
            altoFinal = maxAlto;
            anchoFinal = altoFinal * ratioOriginal;
        }

        // Redondear para evitar problemas
        anchoFinal = Math.round(anchoFinal);
        altoFinal = Math.round(altoFinal);

        // Calcular escala para renderizar el PDF con alta calidad
        // Usamos 2x para pantallas retina, sin distorsión
        const escalaRender = (anchoFinal / viewportOriginal.width) * 2;

        // ============ CREAR PÁGINAS ============
        for (let i = 1; i <= totalPaginas; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: escalaRender });
            
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const context = canvas.getContext('2d');
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const divPagina = document.createElement('div');
            divPagina.className = 'pagina';
            divPagina.appendChild(canvas);
            flipbookDiv.appendChild(divPagina);
        }

        // ============ INICIALIZAR STPAGEFLIP ============
        // IMPORTANTE: usePortrait:true + showCover:true = efecto de hoja completa
        pageFlip = new St.PageFlip(flipbookDiv, {
            width: anchoFinal,
            height: altoFinal,
            size: 'fixed',          // Tamaño fijo, respeta dimensiones
            showCover: true,        // Trata la primera página como portada (hoja completa)
            usePortrait: true,      // MODO VERTICAL: una sola página a la vez
            maxShadowOpacity: 0.5,
            mobileScrollSupport: false,
            flippingTime: 800,
            drawShadow: true,
            startZIndex: 0,
            autoSize: false,
            clickEventForward: true,
            useMouseEvents: true,
            swipeDistance: 30,
            showPageCorners: true,
            disableFlipByClick: false
        });

        const paginas = flipbookDiv.querySelectorAll('.pagina');
        pageFlip.loadFromHTML(paginas);

        // Forzar tamaño de canvas dentro de las páginas
        paginas.forEach(p => {
            const canvas = p.querySelector('canvas');
            if (canvas) {
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                canvas.style.objectFit = 'contain';
            }
        });

        // ============ EVENTOS ============
        pageFlip.on('flip', (e) => {
            paginaActual = e.data + 1;
            actualizarIndicadores(paginaActual);
        });

        actualizarIndicadores(1);

    } catch (error) {
        console.error('Error al cargar PDF:', error);
        alert('No se pudo cargar el PDF. Verifica el nombre en lista.json.');
    }
}

// ============================================
// ACTUALIZAR INDICADORES
// ============================================
function actualizarIndicadores(pagina) {
    document.getElementById('indicador-pagina').textContent = 
        `${pagina} / ${totalPaginas}`;
    
    const progreso = (pagina / totalPaginas) * 100;
    document.getElementById('progreso-relleno').style.width = progreso + '%';
}

// ============================================
// CONTROLES
// ============================================
function paginaAnterior() {
    if (pageFlip) pageFlip.flipPrev();
}

function paginaSiguiente() {
    if (pageFlip) pageFlip.flipNext();
}

function cerrarVisor() {
    document.getElementById('visor').classList.add('oculto');
    document.querySelector('.galeria-container').style.display = 'block';
    document.querySelector('.header').style.display = 'block';
    
    if (pageFlip) {
        pageFlip.destroy();
        pageFlip = null;
    }
    document.getElementById('flipbook').innerHTML = '';
}

// ============================================
// TECLADO
// ============================================
document.addEventListener('keydown', (e) => {
    if (!pageFlip) return;
    if (e.key === 'ArrowLeft') paginaAnterior();
    if (e.key === 'ArrowRight') paginaSiguiente();
    if (e.key === 'Escape') cerrarVisor();
});

// ============================================
// REDIMENSIONAR
// ============================================
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (pageFlip && !document.getElementById('visor').classList.contains('oculto')) {
            // Reajustar si es necesario (recargar el PDF)
            // Por simplicidad, no recargamos automáticamente
        }
    }, 300);
});

// ============================================
// INICIAR
// ============================================
document.addEventListener('DOMContentLoaded', cargarListaPDFs);

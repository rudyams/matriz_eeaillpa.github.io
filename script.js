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
let renderizando = false;

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
        tarjeta.onclick = () => abrirVisor(index);
        galeria.appendChild(tarjeta);
    });
}

// ============================================
// ABRIR VISOR
// ============================================
async function abrirVisor(index) {
    const pdf = listaPDFs[index];
    
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
        // Cargar el PDF
        pdfDocActual = await pdfjsLib.getDocument(pdf.archivo).promise;
        totalPaginas = pdfDocActual.numPages;
        paginaActual = 1;

        // Renderizar la primera página
        await renderizarPagina(paginaActual);
        actualizarControles();

    } catch (error) {
        console.error('Error al cargar PDF:', error);
        container.innerHTML = `
            <div style="color:white; text-align:center; padding: 40px;">
                <h2>❌ No se pudo cargar el documento</h2>
                <p style="opacity:0.7; margin-top:10px;">
                    Verifica que el archivo <strong>${pdf.archivo}</strong> exista en GitHub.
                </p>
            </div>
        `;
    }
}

// ============================================
// RENDERIZAR PÁGINA ACTUAL
// ============================================
async function renderizarPagina(numeroPagina) {
    if (!pdfDocActual || renderizando) return;
    renderizando = true;

    const container = document.getElementById('pdf-page-container');
    
    // Animación de salida
    container.classList.add('saliendo');
    
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
        const page = await pdfDocActual.getPage(numeroPagina);
        
        // Calcular dimensiones para que quepa en pantalla SIN reducir el PDF
        const wrapper = document.querySelector('.pdf-wrapper');
        const anchoDisponible = wrapper.clientWidth - 20;
        const altoDisponible = wrapper.clientHeight - 20;
        
        // Viewport a escala 1 para obtener tamaño real
        const viewportBase = page.getViewport({ scale: 1 });
        const ratio = viewportBase.width / viewportBase.height;
        
        // Calcular escala para llenar el espacio disponible respetando el ratio
        let escala;
        if (anchoDisponible / altoDisponible > ratio) {
            // Limitado por altura
            escala = altoDisponible / viewportBase.height;
        } else {
            // Limitado por ancho
            escala = anchoDisponible / viewportBase.width;
        }
        
        // Multiplicar por 2 para alta calidad (retina display)
        const escalaFinal = escala * 2;
        
        const viewport = page.getViewport({ scale: escalaFinal });
        
        // Crear canvas
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Ajustar tamaño visual del canvas al tamaño disponible
        canvas.style.width = (viewport.width / 2) + 'px';
        canvas.style.height = (viewport.height / 2) + 'px';
        
        const context = canvas.getContext('2d');
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // Reemplazar contenido
        container.innerHTML = '';
        container.appendChild(canvas);
        
        // Animación de entrada
        container.classList.remove('saliendo');
        container.classList.add('entrando');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        container.classList.remove('entrando');

        actualizarIndicadores();

    } catch (error) {
        console.error('Error al renderizar página:', error);
    } finally {
        renderizando = false;
    }
}

// ============================================
// NAVEGACIÓN
// ============================================
async function paginaAnterior() {
    if (paginaActual > 1 && !renderizando) {
        paginaActual--;
        await renderizarPagina(paginaActual);
        actualizarControles();
    }
}

async function paginaSiguiente() {
    if (paginaActual < totalPaginas && !renderizando) {
        paginaActual++;
        await renderizarPagina(paginaActual);
        actualizarControles();
    }
}

// ============================================
// ACTUALIZAR INDICADORES Y BOTONES
// ============================================
function actualizarIndicadores() {
    document.getElementById('indicador-pagina').textContent = 
        `${paginaActual} / ${totalPaginas}`;
    
    const progreso = (paginaActual / totalPaginas) * 100;
    document.getElementById('progreso-relleno').style.width = progreso + '%';
}

function actualizarControles() {
    const btnPrev = document.querySelectorAll('.nav-prev, .btn-control')[0];
    const btnNext = document.querySelectorAll('.nav-next, .btn-control')[1];
    
    // Deshabilitar si estamos en los extremos
    const btnPrevLateral = document.getElementById('btn-prev');
    const btnNextLateral = document.getElementById('btn-next');
    
    if (paginaActual <= 1) {
        if (btnPrevLateral) btnPrevLateral.disabled = true;
    } else {
        if (btnPrevLateral) btnPrevLateral.disabled = false;
    }
    
    if (paginaActual >= totalPaginas) {
        if (btnNextLateral) btnNextLateral.disabled = true;
    } else {
        if (btnNextLateral) btnNextLateral.disabled = false;
    }
}

// ============================================
// CERRAR VISOR
// ============================================
function cerrarVisor() {
    document.getElementById('visor').classList.add('oculto');
    document.querySelector('.galeria-container').style.display = 'block';
    document.querySelector('.header').style.display = 'block';
    
    pdfDocActual = null;
    paginaActual = 1;
    totalPaginas = 1;
    document.getElementById('pdf-page-container').innerHTML = '';
}

// ============================================
// TECLADO
// ============================================
document.addEventListener('keydown', (e) => {
    if (document.getElementById('visor').classList.contains('oculto')) return;
    if (e.key === 'ArrowLeft') paginaAnterior();
    if (e.key === 'ArrowRight') paginaSiguiente();
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
            renderizarPagina(paginaActual);
        }
    }, 300);
});

// ============================================
// INICIAR
// ============================================
document.addEventListener('DOMContentLoaded', cargarListaPDFs);

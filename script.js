// ============================================
// CONFIGURACIÓN DE PDF.JS
// ============================================
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============================================
// VARIABLES GLOBALES
// ============================================
let listaPDFs = [];
let turnInstance = null;
let totalPaginas = 1;
let paginaActual = 1;

// ============================================
// CARGAR LISTA DE PDFs
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
                <p style="color:#718096; margin-top:10px;">Crea el archivo lista.json con tus documentos.</p>
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
                <p>Agrega tus PDFs al archivo lista.json</p>
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
// ABRIR FLIPBOOK CON VOLTEO VERTICAL
// ============================================
async function abrirFlipbook(index) {
    const pdf = listaPDFs[index];
    
    // Mostrar visor
    document.getElementById('galeria').closest('.galeria-container').style.display = 'none';
    document.querySelector('.header').style.display = 'none';
    document.getElementById('visor').classList.remove('oculto');
    document.getElementById('titulo-libro').textContent = pdf.titulo;

    const flipbookDiv = document.getElementById('flipbook');
    flipbookDiv.innerHTML = '';

    try {
        const loadingTask = pdfjsLib.getDocument(pdf.archivo);
        const pdfDoc = await loadingTask.promise;
        totalPaginas = pdfDoc.numPages;

        // Determinar dimensiones basadas en la primera página
        const primeraPagina = await pdfDoc.getPage(1);
        const viewportBase = primeraPagina.getViewport({ scale: 1 });
        
        // Calcular escala para que quepa en pantalla
        const maxWidth = Math.min(window.innerWidth * 0.5, 500);
        const maxHeight = window.innerHeight * 0.7;
        const escalaW = maxWidth / viewportBase.width;
        const escalaH = maxHeight / viewportBase.height;
        const escala = Math.min(escalaW, escalaH, 2);

        // Crear todas las páginas como canvas
        for (let i = 1; i <= totalPaginas; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: escala });
            
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
            divPagina.style.width = viewport.width + 'px';
            divPagina.style.height = viewport.height + 'px';
            divPagina.appendChild(canvas);
            flipbookDiv.appendChild(divPagina);
        }

        // Inicializar Turn.js con efecto VERTICAL
        turnInstance = $(flipbookDiv).turn({
            width: parseInt(flipbookDiv.children[0].style.width),
            height: parseInt(flipbookDiv.children[0].style.height),
            autoCenter: true,
            display: 'single',      // Una página a la vez
            duration: 800,          // Duración de animación
            gradients: true,        // Degradados en el pliegue
            elevation: 50,
            acceleration: true,
            when: {
                turned: function(e, page) {
                    paginaActual = page;
                    actualizarIndicadores(page);
                }
            }
        });

        // Aplicar dirección vertical (Turn.js no lo tiene nativo)
        aplicarVolteoVertical();

        actualizarIndicadores(1);

    } catch (error) {
        console.error('Error al cargar PDF:', error);
        alert('No se pudo cargar el PDF. Verifica el nombre en lista.json.');
    }
}

// ============================================
// APLICAR EFECTO VERTICAL CON CSS
// ============================================
function aplicarVolteoVertical() {
    // Rotar el contenedor 90 grados para simular volteo vertical
    const wrapper = document.querySelector('.flipbook-wrapper');
    const flipbook = document.getElementById('flipbook');
    
    if (!flipbook) return;
    
    // Aplicar rotación al flipbook
    flipbook.style.transform = 'rotate(-90deg)';
    flipbook.style.transformOrigin = 'center center';
    
    // Ajustar el wrapper
    wrapper.style.padding = '80px 20px';
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
    if (turnInstance) {
        const actual = turnInstance.turn('page');
        if (actual > 1) {
            turnInstance.turn('previous');
        }
    }
}

function paginaSiguiente() {
    if (turnInstance) {
        const actual = turnInstance.turn('page');
        if (actual < totalPaginas) {
            turnInstance.turn('next');
        }
    }
}

function cerrarVisor() {
    document.getElementById('visor').classList.add('oculto');
    document.getElementById('galeria').closest('.galeria-container').style.display = 'block';
    document.querySelector('.header').style.display = 'block';
    
    if (turnInstance) {
        try { turnInstance.turn('destroy'); } catch(e) {}
        turnInstance = null;
    }
    document.getElementById('flipbook').innerHTML = '';
}

// ============================================
// NAVEGACIÓN CON TECLADO
// ============================================
document.addEventListener('keydown', (e) => {
    if (!turnInstance) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') paginaAnterior();
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') paginaSiguiente();
    if (e.key === 'Escape') cerrarVisor();
});

// ============================================
// INICIAR
// ============================================
document.addEventListener('DOMContentLoaded', cargarListaPDFs);

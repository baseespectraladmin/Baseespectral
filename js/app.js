// 1. CONFIGURACIÓN DE CONEXIÓN A SUPABASE
const SUPABASE_URL = "https://nxktvjduooqfgzzrdfot.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a3R2amR1b29xZmd6enJkZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTg1ODgsImV4cCI6MjA4NjY5NDU4OH0.4hYin09mna34MYg3cGdjtzIyvmZOntE5Xceofa9yTAs";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables de estado administrativo
let adminLogueado = false; 
let editandoId = null; 

// --- NUEVA FUNCIÓN: Intercambia entre campo PDF y campo URL ---
function ajustarTipoEntrada() {
    const categoria = document.getElementById('categoria').value;
    const contenedorPdf = document.getElementById('contenedor-pdf');
    const contenedorUrl = document.getElementById('contenedor-url');

    if (categoria === 'art-difusion') {
        if(contenedorPdf) contenedorPdf.style.display = 'none';
        if(contenedorUrl) contenedorUrl.style.display = 'block';
    } else {
        if(contenedorPdf) contenedorPdf.style.display = 'block';
        if(contenedorUrl) contenedorUrl.style.display = 'none';
    }
}

// 2. MANEJO DE NAVEGACIÓN Y CARGA DE DATOS
let graficaCargada = false;

function mostrarSeccion(id) {
    const secciones = document.querySelectorAll('.seccion-contenido');
    secciones.forEach(s => s.classList.remove('seccion-activa'));

    const seccionSeleccionada = document.getElementById(id);
    if (seccionSeleccionada) {
        seccionSeleccionada.classList.add('seccion-activa');
        window.scrollTo(0, 0);

        const listaContenedor = document.getElementById('lista-' + id);
        if (listaContenedor) {
            cargarArticulosDesdeNube(id);
        }
    }

    if (id === 'espectros-reflexion' && !graficaCargada) {
        inicializarGrafica();
    }
}

async function cargarArticulosDesdeNube(categoria) {
    const contenedor = document.getElementById('lista-' + categoria);
    if (!contenedor) return;

    contenedor.innerHTML = '<p style="color: var(--gris); padding: 20px;">Consultando Base de Datos Espectral...</p>';

    try {
        const { data, error } = await _supabase
            .from('articulos') 
            .select('*')
            .eq('categoria', categoria)
            .order('anio', { ascending: true }); 

        if (error) throw error;

        if (data.length === 0) {
            contenedor.innerHTML = '<p style="color: var(--gris); padding: 20px;">No hay registros en esta categoría.</p>';
            return;
        }

        contenedor.innerHTML = '';
        data.forEach(art => {
            const item = document.createElement('div');
            item.className = 'articulo-item';
            
            // Ajuste visual: Si es difusión, mostramos icono de Link
            const esDifusion = art.categoria === 'art-difusion';
            const etiquetaEnlace = esDifusion ? '🔗 Ver Artículo Externo' : '📄 Ver Documento PDF';

            const controlAdmin = adminLogueado 
                ? `<div style="margin-top: 10px; display: flex; gap: 15px;">
                    <button onclick='prepararEdicion(${JSON.stringify(art).replace(/'/g, "&apos;")})' style="background:none; border:none; color: var(--azul-medio); cursor:pointer; font-size: 13px; font-weight:bold;">✏️ Editar</button>
                    <button onclick="borrarArticulo('${art.id}', '${categoria}')" style="background:none; border:none; color: #e74c3c; cursor:pointer; font-size: 13px; font-weight:bold;">🗑️ Eliminar</button>
                   </div>` 
                : '';

            item.innerHTML = `
                <h3>${art.titulo}</h3>
                <p><strong>Autores:</strong> ${art.autores} | <strong>Año:</strong> ${art.anio}</p>
                <div style="margin-top: 10px; display: flex; gap: 20px; align-items: center;">
                    <a href="${art.pdf_url}" target="_blank" style="color: var(--azul-medio); font-weight: bold; text-decoration: none;">${etiquetaEnlace}</a>
                    ${controlAdmin}
                </div>
            `;
            contenedor.appendChild(item);
        });
    } catch (err) {
        console.error("Error de lectura:", err);
        contenedor.innerHTML = '<p style="color: red; padding: 20px;">Error de conexión con el servidor.</p>';
    }
}

function prepararEdicion(art) {
    editandoId = art.id;
    document.getElementById('titulo').value = art.titulo;
    document.getElementById('autores').value = art.autores;
    document.getElementById('anio').value = art.anio;
    document.getElementById('categoria').value = art.categoria;
    
    // Si estamos editando un artículo de difusión, llenamos el campo de URL
    ajustarTipoEntrada(); 
    if (art.categoria === 'art-difusion') {
        document.getElementById('enlace_externo').value = art.pdf_url;
    }

    const btnSubir = document.querySelector('#formArticulo .btn-subir');
    if(btnSubir) {
        btnSubir.innerText = "Actualizar Registro";
        btnSubir.style.background = "var(--azul-medio)";
    }
    
    mostrarSeccion('seccion-subir');
}

// 3. LÓGICA DEL FORMULARIO DE SUBIDA / EDICIÓN
const formArticulo = document.getElementById('formArticulo');
if (formArticulo) {
    formArticulo.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const categoriaSeleccionada = document.getElementById('categoria').value;
        const archivoPDF = document.getElementById('archivo').files[0];
        const urlExterna = document.getElementById('enlace_externo').value;
        let urlFinal = null;

        try {
            // Caso 1: Es un artículo de difusión (usa Link)
            if (categoriaSeleccionada === 'art-difusion') {
                if (!urlExterna && !editandoId) throw new Error("Ingresa la URL del artículo.");
                urlFinal = urlExterna;
            } 
            // Caso 2: Es un PDF (se sube a Storage)
            else if (archivoPDF) {
                const regexInvalido = /[^a-zA-Z0-9.\-_ ]/g; 
                if (regexInvalido.test(archivoPDF.name)) throw new Error("Nombre de archivo inválido.");
                
                const nombreArchivo = `${Date.now()}_${archivoPDF.name.replace(/\s+/g, '_')}`;
                const { error: uploadError } = await _supabase.storage.from('pdfs').upload(nombreArchivo, archivoPDF);
                if (uploadError) throw uploadError;
                
                const { data: { publicUrl } } = _supabase.storage.from('pdfs').getPublicUrl(nombreArchivo);
                urlFinal = publicUrl;
            }

            const datosArticulo = {
                titulo: document.getElementById('titulo').value,
                autores: document.getElementById('autores').value,
                anio: parseInt(document.getElementById('anio').value),
                categoria: categoriaSeleccionada
            };

            if (urlFinal) datosArticulo.pdf_url = urlFinal;

            if (editandoId) {
                const { error: dbError } = await _supabase.from('articulos').update(datosArticulo).eq('id', editandoId);
                if (dbError) throw dbError;
                alert("Registro actualizado.");
            } else {
                if (!urlFinal) throw new Error("Falta el archivo o la URL.");
                const { error: dbError } = await _supabase.from('articulos').insert([datosArticulo]);
                if (dbError) throw dbError;
                alert("Guardado correctamente.");
            }

            // Limpieza y refresco sin salir de la vista
            this.reset();
            editandoId = null;
            const btnSubir = document.querySelector('#formArticulo .btn-subir');
            if(btnSubir) {
                btnSubir.innerText = "Guardar";
                btnSubir.style.background = "var(--verde-acento)";
            }
            ajustarTipoEntrada();
            cargarArticulosDesdeNube(categoriaSeleccionada);
            mostrarSeccion(categoriaSeleccionada);

        } catch (err) { alert("Error: " + err.message); }
    });
}

// 4. ACCESO, BORRAR, GRÁFICA Y MENÚ (Mantenidos igual)
const CREDENCIALES_ADMIN = { usuario: "missas", pass: "123" };

function verificarAdmin() {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    if (user === CREDENCIALES_ADMIN.usuario && pass === CREDENCIALES_ADMIN.pass) {
        adminLogueado = true; 
        document.getElementById('nav-subir').style.display = 'block';
        document.getElementById('nav-login').style.display = 'none';
        alert("Acceso administrativo concedido.");
        mostrarSeccion('home');
    } else {
        const errLog = document.getElementById('error-login');
        if (errLog) {
            errLog.style.display = 'block';
            errLog.innerText = "Credenciales incorrectas.";
        }
    }
}

async function borrarArticulo(id, categoria) {
    if (!confirm("¿Eliminar permanentemente?")) return;
    try {
        const { error } = await _supabase.from('articulos').delete().eq('id', id);
        if (error) throw error;
        alert("Registro eliminado.");
        cargarArticulosDesdeNube(categoria);
    } catch (err) { alert("Error: " + err.message); }
}

async function inicializarGrafica() {
    const gd = document.getElementById('grafica-reflexion');
    const tooltip = document.getElementById('custom-tooltip');
    const lambdaSpan = document.getElementById('lambda-value');
    const reflSpan = document.getElementById('refl-value');
    if (!gd) return;

    try {
        const resp = await fetch('css/data/reflexion.csv');
        const texto = await resp.text();
        const filas = texto.trim().split('\n').filter(l => l.trim() !== '');
        const wavelength = [], reflectancia = [];
        filas.slice(1).forEach(l => {
            const cols = l.split(/,|\t|;/).map(s => s.trim());
            const w = parseFloat(cols[0]);
            const r = parseFloat(cols[1]);
            if (!isNaN(w) && !isNaN(r)) {
                wavelength.push(w);
                reflectancia.push(r);
            }
        });

        const trace = { x: wavelength, y: reflectancia, mode: 'lines', line: { color: '#3282b8', width: 2.5, shape: 'spline' }, hoverinfo: 'none' };
        const hoverTrace = { x: [0], y: [0], mode: 'markers', marker: { size: 12, color: '#006847', line: { width: 3, color: '#ffffff' } }, hoverinfo: 'none' };
        const layout = {
            title: { text: '<b>Espectro de Reflexión Difusa</b>', font: { family: 'Segoe UI', size: 20, color: '#081f2d' } },
            xaxis: { title: 'Longitud de onda (nm)', gridcolor: '#e2e8f0', zeroline: false, range: [400, 800] },
            yaxis: { title: 'Reflexión (%)', gridcolor: '#e2e8f0', zeroline: false, range: [0, 100] },
            paper_bgcolor: '#fcfdfe', plot_bgcolor: '#ffffff', hovermode: false, showlegend: false, margin: { l: 60, r: 30, t: 80, b: 60 }
        };

        await Plotly.newPlot(gd, [trace, hoverTrace], layout, { responsive: true, displayModeBar: false });
        graficaCargada = true;

        function interpY(x) {
            if (x <= wavelength[0]) return reflectancia[0];
            if (x >= wavelength[wavelength.length - 1]) return reflectancia[reflectancia.length - 1];
            let i = 1; while (i < wavelength.length && x > wavelength[i]) i++;
            const x1 = wavelength[i - 1], x2 = wavelength[i], y1 = reflectancia[i - 1], y2 = reflectancia[i];
            return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
        }

        gd.addEventListener('mousemove', (ev) => {
            const rect = gd.getBoundingClientRect();
            const fullLayout = gd._fullLayout;
            const l = fullLayout.margin.l, t = fullLayout.margin.t;
            const plotW = rect.width - (l + fullLayout.margin.r), plotH = rect.height - (t + fullLayout.margin.b);
            const dataX = 400 + ((ev.clientX - rect.left - l) / plotW) * 400;

            if (dataX >= 400 && dataX <= 800) {
                const yInterp = interpY(dataX);
                Plotly.restyle(gd, { x: [[dataX]], y: [[yInterp]] }, [1]);
                if(lambdaSpan) lambdaSpan.textContent = dataX.toFixed(2);
                if(reflSpan) reflSpan.textContent = yInterp.toFixed(2);
                if(tooltip) {
                    tooltip.style.left = (l + ((dataX - 400) / 400) * plotW) + 'px';
                    tooltip.style.top = (t + (1 - (yInterp / 100)) * plotH - 25) + 'px';
                    tooltip.style.display = 'block';
                }
            }
        });
    } catch (e) { console.error("Error datos espectrales:", e); }
}

function toggleMenu() {
    const nav = document.getElementById('nav-menu');
    if (window.innerWidth <= 768) {
        nav.classList.toggle('nav-active');
    }
}
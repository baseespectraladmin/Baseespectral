// 1. CONFIGURACIÓN DE CONEXIÓN A SUPABASE
const SUPABASE_URL = "https://nxktvjduooqfgzzrdfot.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a3R2amR1b29xZmd6enJkZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTg1ODgsImV4cCI6MjA4NjY5NDU4OH0.4hYin09mna34MYg3cGdjtzIyvmZOntE5Xceofa9yTAs";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variable de estado para controlar funciones administrativas en la interfaz
let adminLogueado = false; 

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
            
            // Botón de eliminar: Solo se genera si el estado de administrador es activo
            const controlAdmin = adminLogueado 
                ? `<button onclick="borrarArticulo('${art.id}')" style="background:none; border:none; color: #e74c3c; cursor:pointer; font-size: 13px; font-weight:bold;">🗑️ Eliminar</button>` 
                : '';

            item.innerHTML = `
                <h3>${art.titulo}</h3>
                <p><strong>Autores:</strong> ${art.autores} | <strong>Año:</strong> ${art.anio}</p>
                <div style="margin-top: 10px; display: flex; gap: 20px; align-items: center;">
                    <a href="${art.pdf_url}" target="_blank" style="color: var(--azul-medio); font-weight: bold; text-decoration: none;">📄 Ver PDF</a>
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

// 3. LÓGICA DEL FORMULARIO DE SUBIDA (ADMIN)
const formArticulo = document.getElementById('formArticulo');
if (formArticulo) {
    formArticulo.addEventListener('submit', async function(e) {
        e.preventDefault();
        const archivoPDF = document.getElementById('archivo').files[0];
        if (!archivoPDF) return alert("Selecciona un archivo PDF");

        const regexInvalido = /[^a-zA-Z0-9.\-_ ]/g; 
        if (regexInvalido.test(archivoPDF.name)) {
            return alert("Error: El nombre del archivo contiene caracteres no permitidos.");
        }

        const nombreArchivo = `${Date.now()}_${archivoPDF.name.replace(/\s+/g, '_')}`;

        try {
            const { error: uploadError } = await _supabase.storage.from('pdfs').upload(nombreArchivo, archivoPDF);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = _supabase.storage.from('pdfs').getPublicUrl(nombreArchivo);

            const { error: dbError } = await _supabase.from('articulos').insert([{
                titulo: document.getElementById('titulo').value,
                autores: document.getElementById('autores').value,
                anio: parseInt(document.getElementById('anio').value),
                categoria: document.getElementById('categoria').value,
                pdf_url: publicUrl
            }]);

            if (dbError) throw dbError;
            alert("Artículo guardado correctamente.");
            this.reset();
            mostrarSeccion('home');
        } catch (err) { alert("Error: " + err.message); }
    });
}

// 4. SISTEMA DE ACCESO ADMINISTRATIVO
const CREDENCIALES_ADMIN = { usuario: "missas", pass: "123" };

function verificarAdmin() {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    if (user === CREDENCIALES_ADMIN.usuario && pass === CREDENCIALES_ADMIN.pass) {
        adminLogueado = true; // Activa permisos de edición en la sesión actual
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

// FUNCIÓN PARA ELIMINAR REGISTROS
async function borrarArticulo(id) {
    if (!confirm("¿Confirmas la eliminación permanente de este registro?")) return;

    try {
        const { error } = await _supabase
            .from('articulos')
            .delete()
            .eq('id', id);

        if (error) throw error;
        alert("Registro eliminado.");
        location.reload(); 
    } catch (err) {
        alert("Error al intentar eliminar: " + err.message);
    }
}

// 5. LÓGICA DEL GRAFICADOR
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
// ==========================================
// 1. CONFIGURACIÓN DE CONEXIÓN A SUPABASE
// ==========================================
const SUPABASE_URL = "https://nxktvjduooqfgzzrdfot.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a3R2amR1b29xZmd6enJkZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTg1ODgsImV4cCI6MjA4NjY5NDU4OH0.4hYin09mna34MYg3cGdjtzIyvmZOntE5Xceofa9yTAs";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. MANEJO DE NAVEGACIÓN Y CARGA DE DATOS
// ==========================================
let graficaCargada = false;

function mostrarSeccion(id) {
    // Ocultar todas las secciones
    const secciones = document.querySelectorAll('.seccion-contenido');
    secciones.forEach(s => s.classList.remove('seccion-activa'));

    // Activar la sección seleccionada
    const seccionSeleccionada = document.getElementById(id);
    if (seccionSeleccionada) {
        seccionSeleccionada.classList.add('seccion-activa');
        window.scrollTo(0, 0);

        // Intentar cargar artículos si la sección tiene un contenedor de lista
        const listaContenedor = document.getElementById('lista-' + id);
        if (listaContenedor) {
            cargarArticulosDesdeNube(id);
        }
    }

    // Inicializar la gráfica si entramos a reflexión
    if (id === 'espectros-reflexion' && !graficaCargada) {
        inicializarGrafica();
    }
}

// Función para traer datos de Supabase y llenar las listas automáticamente
async function cargarArticulosDesdeNube(categoria) {
    const contenedor = document.getElementById('lista-' + categoria);
    if (!contenedor) return;

    contenedor.innerHTML = '<p style="color: var(--gris); padding: 20px;">Consultando Base de Datos Espectral...</p>';

    try {
        const { data, error } = await _supabase
            .from('base_espectral')
            .select('*')
            .eq('categoria', categoria);

        if (error) throw error;

        if (data.length === 0) {
            contenedor.innerHTML = '<p style="color: var(--gris); padding: 20px;">Aún no hay archivos registrados en esta categoría.</p>';
            return;
        }

        contenedor.innerHTML = ''; // Limpiar mensaje de carga
        data.forEach(art => {
            const item = document.createElement('div');
            item.className = 'articulo-item';
            item.innerHTML = `
                <h3>${art.titulo}</h3>
                <p><strong>Autores:</strong> ${art.autores} | <strong>Año:</strong> ${art.anio}</p>
                <a href="${art.pdf_url}" target="_blank" style="color: var(--azul-medio); font-weight: bold; text-decoration: none; display: inline-block; margin-top: 10px;">
                    📄 Ver Documento PDF
                </a>
            `;
            contenedor.appendChild(item);
        });
    } catch (err) {
        console.error("Error de lectura:", err);
        contenedor.innerHTML = '<p style="color: red; padding: 20px;">Error al conectar con la nube de Supabase.</p>';
    }
}

// ==========================================
// 3. LÓGICA DEL FORMULARIO DE SUBIDA (ADMIN)
// ==========================================
const formArticulo = document.getElementById('formArticulo');
if (formArticulo) {
    formArticulo.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const archivoPDF = document.getElementById('archivo').files[0];
        if (!archivoPDF) return alert("Por favor selecciona un archivo PDF");

        const nombreArchivo = `${Date.now()}_${archivoPDF.name}`;

        try {
            // A. Subir el PDF a la cubeta 'pdfs'
            const { data: uploadData, error: uploadError } = await _supabase.storage
                .from('pdfs')
                .upload(nombreArchivo, archivoPDF);

            if (uploadError) throw uploadError;

            // B. Obtener el link público del archivo subido
            const { data: { publicUrl } } = _supabase.storage
                .from('pdfs')
                .getPublicUrl(nombreArchivo);

            // C. Guardar metadatos en la tabla 'base_espectral'
            const { error: dbError } = await _supabase
                .from('base_espectral')
                .insert([{
                    titulo: document.getElementById('titulo').value,
                    autores: document.getElementById('autores').value,
                    anio: parseInt(document.getElementById('anio').value),
                    categoria: document.getElementById('categoria').value,
                    pdf_url: publicUrl
                }]);

            if (dbError) throw dbError;

            alert("¡Éxito! El artículo se ha guardado permanentemente en la nube.");
            this.reset();
            mostrarSeccion('home');
            
        } catch (err) {
            console.error("Error de subida:", err);
            alert("Error: " + err.message);
        }
    });
}

// ==========================================
// 4. SISTEMA DE ACCESO ADMINISTRATIVO
// ==========================================
const CREDENCIALES_ADMIN = { usuario: "isai_admin", pass: "UPT2026" };

function verificarAdmin() {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    if (user === CREDENCIALES_ADMIN.usuario && pass === CREDENCIALES_ADMIN.pass) {
        document.getElementById('nav-subir').style.display = 'block';
        document.getElementById('nav-login').style.display = 'none';
        alert("¡Acceso concedido, Isai!");
        mostrarSeccion('home');
    } else {
        const errLog = document.getElementById('error-login');
        errLog.style.display = 'block';
        errLog.innerText = "Credenciales incorrectas para la Base Espectral.";
    }
}
// ==========================================
// 5. LÓGICA DEL GRAFICADOR PROFESIONAL
// ==========================================
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

        const trace = {
            x: wavelength,
            y: reflectancia,
            mode: 'lines',
            line: { color: '#3282b8', width: 2.5, shape: 'spline' },
            hoverinfo: 'none'
        };

        // Marcador verde (el punto que sigue la línea)
        const hoverTrace = {
            x: [0], y: [0],
            mode: 'markers',
            marker: { size: 12, color: '#006847', line: { width: 3, color: '#ffffff' } },
            hoverinfo: 'none'
        };

        const layout = {
            title: {
                text: '<b>Espectro de Reflexión Difusa - UPT</b>',
                font: { family: 'Segoe UI', size: 20, color: '#081f2d' }
            },
            xaxis: { 
                title: 'Longitud de onda (nm)', 
                gridcolor: '#e2e8f0', 
                zeroline: false,
                range: [400, 800] 
            },
            yaxis: { 
                title: 'Reflexión (%)', 
                gridcolor: '#e2e8f0', 
                zeroline: false,
                range: [0, 100] 
            },
            paper_bgcolor: '#fcfdfe', // Fondo exterior
            plot_bgcolor: '#ffffff',  // Fondo área de gráfica
            hovermode: false,
            showlegend: false,
            margin: { l: 60, r: 30, t: 80, b: 60 },
            bordercolor: '#dfe6e9',
            borderwidth: 1
        };

        await Plotly.newPlot(gd, [trace, hoverTrace], layout, { responsive: true, displayModeBar: false });
        graficaCargada = true;

        // --- FUNCIONES DE CÁLCULO PARA EL "RADAR" ---

        // Interpolación lineal para hallar Y exacta en cualquier X
        function interpY(x) {
            if (x <= wavelength[0]) return reflectancia[0];
            if (x >= wavelength[wavelength.length - 1]) return reflectancia[reflectancia.length - 1];
            let i = 1;
            while (i < wavelength.length && x > wavelength[i]) i++;
            const x1 = wavelength[i - 1], x2 = wavelength[i];
            const y1 = reflectancia[i - 1], y2 = reflectancia[i];
            const t = (x - x1) / (x2 - x1);
            return y1 + t * (y2 - y1);
        }

        // Traducir posición del mouse a datos de la gráfica
        function pixelToData(clientX, clientY) {
            const rect = gd.getBoundingClientRect();
            const fullLayout = gd._fullLayout;
            const l = fullLayout.margin.l;
            const t = fullLayout.margin.t;
            const plotWidth = rect.width - (l + fullLayout.margin.r);
            const plotHeight = rect.height - (t + fullLayout.margin.b);

            const relX = (clientX - rect.left - l) / plotWidth;
            const xRange = fullLayout.xaxis.range;
            const yRange = fullLayout.yaxis.range;

            const dataX = xRange[0] + relX * (xRange[1] - xRange[0]);
            return { dataX, xRange, yRange, plotWidth, plotHeight, l, t };
        }

        // Evento de seguimiento total
        gd.addEventListener('mousemove', (ev) => {
            const { dataX, xRange, yRange, plotWidth, plotHeight, l, t } = pixelToData(ev.clientX, ev.clientY);

            // Si el mouse está dentro del rango horizontal de la gráfica
            if (dataX >= xRange[0] && dataX <= xRange[1]) {
                const yInterp = interpY(dataX);

                // Mover el punto verde sobre la línea
                Plotly.restyle(gd, { x: [[dataX]], y: [[yInterp]] }, [1]);

                // Actualizar textos del tooltip
                lambdaSpan.textContent = dataX.toFixed(2);
                reflSpan.textContent = yInterp.toFixed(2);

                // Calcular posición visual (píxeles) para el tooltip
                const pxX = l + ((dataX - xRange[0]) / (xRange[1] - xRange[0])) * plotWidth;
                const pxY = t + (1 - ((yInterp - yRange[0]) / (yRange[1] - yRange[0]))) * plotHeight;

                tooltip.style.left = pxX + 'px';
                tooltip.style.top = (pxY - 25) + 'px';
                tooltip.style.display = 'block';
            } else {
                tooltip.style.display = 'none';
                Plotly.restyle(gd, { x: [[]], y: [[]] }, [1]);
            }
        });

        gd.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
            Plotly.restyle(gd, { x: [[]], y: [[]] }, [1]);
        });

    } catch (e) {
        console.error("Error al cargar datos espectrales:", e);
    }
}
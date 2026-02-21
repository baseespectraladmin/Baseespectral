/* ============================================================
   1. CONFIGURACIÓN DE CONEXIÓN Y ESTADO GLOBAL
   ============================================================ */
// Credenciales de conexión con Supabase (Base de Datos y Almacenamiento)
const SUPABASE_URL = "https://nxktvjduooqfgzzrdfot.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a3R2amR1b29xZmd6enJkZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTg1ODgsImV4cCI6MjA4NjY5NDU4OH0.4hYin09mna34MYg3cGdjtzIyvmZOntE5Xceofa9yTAs";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Credenciales para el acceso administrativo local
const CREDENCIALES_ADMIN = { usuario: "missas", pass: "123" };

// Variables de estado: controlan la sesión, el modo edición y la carga de la gráfica
let adminLogueado = false; 
let editandoId = null; 
let graficaCargada = false;

/* ============================================================
   2. NAVEGACIÓN Y CONTROL DE VISTA
   ============================================================ */

/**
 * Gestiona el cambio entre secciones de la página.
 * @param {string} id - El ID del elemento HTML de la sección a mostrar.
 */
function mostrarSeccion(id) {
    // Ocultamos todas las secciones quitando la clase activa
    const secciones = document.querySelectorAll('.seccion-contenido');
    secciones.forEach(s => s.classList.remove('seccion-activa'));

    // Mostramos la sección seleccionada
    const seccionSeleccionada = document.getElementById(id);
    if (seccionSeleccionada) {
        seccionSeleccionada.classList.add('seccion-activa');
        window.scrollTo(0, 0); // Regresamos al inicio de la página

        // Si la sección tiene un contenedor de lista, cargamos los datos automáticamente
        const listaContenedor = document.getElementById('lista-' + id);
        if (listaContenedor) cargarArticulosDesdeNube(id);
    }

    // Inicializamos la gráfica solo si entramos a su sección y no ha sido cargada antes
    if (id === 'espectros-reflexion' && !graficaCargada) inicializarGrafica();
}

/**
 * Controla la visibilidad de campos dinámicos en el formulario (PDF vs URL y fechas detalladas).
 */
function ajustarTipoEntrada() {
    const cat = document.getElementById('categoria').value;
    const esDifusion = (cat === 'art-difusion');

    // Mostramos/Ocultamos campos adicionales si es un artículo de difusión
    document.getElementById('contenedor-fecha-difusion').style.display = esDifusion ? 'block' : 'none';
    document.getElementById('contenedor-pdf').style.display = esDifusion ? 'none' : 'block';
    document.getElementById('contenedor-url').style.display = esDifusion ? 'block' : 'none';

    // Si no es difusión, limpiamos los valores de día y mes para evitar errores de datos
    if (!esDifusion) {
        document.getElementById('dia').value = "";
        document.getElementById('mes').value = "";
    }
}

/* ============================================================
   3. GESTIÓN DE DATOS (LECTURA - READ)
   ============================================================ */

/**
 * Consulta los registros en Supabase filtrando por categoría y ordenándolos cronológicamente.
 * @param {string} categoria - Categoría de los artículos a consultar.
 */
async function cargarArticulosDesdeNube(categoria) {
    const contenedor = document.getElementById('lista-' + categoria);
    if (!contenedor) return;

    contenedor.innerHTML = '<p style="padding: 20px; color: var(--gris);">Consultando base de datos espectral...</p>';

    try {
        // Consultamos y ordenamos: Año (DESC), Mes (DESC) y Día (DESC) -> Del más nuevo al más viejo
        const { data, error } = await _supabase
            .from('articulos') 
            .select('*')
            .eq('categoria', categoria)
            .order('anio', { ascending: false })
            .order('mes', { ascending: false })
            .order('dia', { ascending: false }); 

        if (error) throw error;

        contenedor.innerHTML = data.length === 0 ? '<p style="padding: 20px;">Sin registros en esta categoría.</p>' : '';

        // Construcción dinámica de las tarjetas de contenido
        data.forEach(art => {
            const item = document.createElement('div');
            item.className = 'articulo-item';
            
            // Lógica de visualización de fecha: construye el formato Día/Mes/Año según disponibilidad
            let fechaTexto = `${art.anio}`;
            if (art.mes) fechaTexto = `${art.mes}/${fechaTexto}`;
            if (art.dia && art.mes) fechaTexto = `${art.dia}/${fechaTexto}`;

            const icono = art.categoria === 'art-difusion' ? '🔗' : '📄';

            item.innerHTML = `
                <h3>${art.titulo}</h3>
                <p><strong>Autores:</strong> ${art.autores} | <strong>Publicado en:</strong> ${fechaTexto}</p>
                <div style="margin-top: 10px; display: flex; gap: 20px; align-items: center;">
                    <a href="${art.pdf_url}" target="_blank" style="color: var(--azul-medio); font-weight: bold; text-decoration: none;">${icono} Ver contenido</a>
                    ${adminLogueado ? `
                        <button onclick='prepararEdicion(${JSON.stringify(art).replace(/'/g, "&apos;")})' style="border:none; background:none; color: var(--azul-medio); cursor:pointer; font-weight:bold;">✏️ Editar</button>
                        <button onclick="borrarArticulo('${art.id}', '${categoria}')" style="border:none; background:none; color: #e74c3c; cursor:pointer; font-weight:bold;">🗑️ Borrar</button>
                    ` : ''}
                </div>
            `;
            contenedor.appendChild(item);
        });
    } catch (err) { 
        console.error("Error de lectura:", err);
        contenedor.innerHTML = '<p style="color:red; padding: 20px;">Error de servidor.</p>'; 
    }
}

/* ============================================================
   4. GESTIÓN DE DATOS (ESCRITURA - CUD)
   ============================================================ */

/**
 * Escucha el envío del formulario para Crear o Actualizar registros.
 */
document.getElementById('formArticulo').addEventListener('submit', async function(e) {
    e.preventDefault();
    const cat = document.getElementById('categoria').value;
    const file = document.getElementById('archivo').files[0];
    const urlExt = document.getElementById('enlace_externo').value;
    let urlPublica = null;

    try {
        // Gestión de archivos: Subida a storage si no es difusión
        if (cat !== 'art-difusion' && file) {
            const path = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const { error: upErr } = await _supabase.storage.from('pdfs').upload(path, file);
            if (upErr) throw upErr;
            urlPublica = _supabase.storage.from('pdfs').getPublicUrl(path).data.publicUrl;
        } else if (cat === 'art-difusion') {
            urlPublica = urlExt; // Si es difusión, usamos el link directo
        }

        // Construcción del objeto de datos
        const payload = {
            titulo: document.getElementById('titulo').value,
            autores: document.getElementById('autores').value,
            anio: parseInt(document.getElementById('anio').value),
            dia: document.getElementById('dia').value ? parseInt(document.getElementById('dia').value) : null,
            mes: document.getElementById('mes').value ? parseInt(document.getElementById('mes').value) : null,
            categoria: cat
        };
        if (urlPublica) payload.pdf_url = urlPublica;

        if (editandoId) {
            // Acción de ACTUALIZAR
            const { error } = await _supabase.from('articulos').update(payload).eq('id', editandoId);
            if (error) throw error;
            alert("Registro actualizado.");
        } else {
            // Acción de INSERTAR NUEVO
            const { error } = await _supabase.from('articulos').insert([payload]);
            if (error) throw error;
            alert("Guardado con éxito.");
        }

        // Reseteo de interfaz sin salir de la vista actual
        this.reset();
        editandoId = null;
        document.querySelector('.btn-subir').innerText = "Guardar en Base espectral";
        ajustarTipoEntrada();
        mostrarSeccion(cat); 
    } catch (err) { alert("Error: " + err.message); }
});

/**
 * Carga los datos de un registro existente en el formulario para su edición.
 */
function prepararEdicion(art) {
    editandoId = art.id;
    document.getElementById('titulo').value = art.titulo;
    document.getElementById('autores').value = art.autores;
    document.getElementById('anio').value = art.anio;
    document.getElementById('dia').value = art.dia || "";
    document.getElementById('mes').value = art.mes || "";
    document.getElementById('categoria').value = art.categoria;
    
    ajustarTipoEntrada();
    if (art.categoria === 'art-difusion') document.getElementById('enlace_externo').value = art.pdf_url;
    
    document.querySelector('.btn-subir').innerText = "Actualizar Registro";
    mostrarSeccion('seccion-subir');
}

/**
 * Elimina un registro de la base de datos tras confirmación.
 */
async function borrarArticulo(id, cat) {
    if (confirm("¿Confirmas la eliminación permanente de este registro?")) {
        try {
            const { error } = await _supabase.from('articulos').delete().eq('id', id);
            if (error) throw error;
            cargarArticulosDesdeNube(cat); // Refrescamos la lista actual
        } catch (err) { alert(err.message); }
    }
}

/* ============================================================
   5. GRÁFICA CON RADAR MATEMÁTICO (PLOTLY)
   ============================================================ */

/**
 * Inicializa la gráfica de reflexión difusa con funcionalidad de radar de seguimiento.
 */
async function inicializarGrafica() {
    const gd = document.getElementById('grafica-reflexion');
    const tooltip = document.getElementById('custom-tooltip');
    const lambdaSpan = document.getElementById('lambda-value');
    const reflSpan = document.getElementById('refl-value');
    if (!gd) return;

    try {
        // Obtención y procesamiento del archivo CSV
        const resp = await fetch('css/data/reflexion.csv');
        const texto = await resp.text();
        const filas = texto.trim().split('\n').filter(l => l.trim() !== '');
        const wavelength = [], reflectancia = [];
        
        filas.slice(1).forEach(l => {
            const cols = l.split(/,|\t|;/).map(s => s.trim());
            const w = parseFloat(cols[0]), r = parseFloat(cols[1]);
            if (!isNaN(w) && !isNaN(r)) { wavelength.push(w); reflectancia.push(r); }
        });

        // Configuración visual de la gráfica (Línea Spline + Marcador Radar)
        const trace = { x: wavelength, y: reflectancia, mode: 'lines', line: { color: '#3282b8', width: 2.5, shape: 'spline' }, hoverinfo: 'none' };
        const hoverTrace = { x: [0], y: [0], mode: 'markers', marker: { size: 12, color: '#006847', line: { width: 3, color: '#ffffff' } }, hoverinfo: 'none' };
        const layout = {
            title: '<b>Espectro de Reflexión Difusa - UPT</b>',
            xaxis: { title: 'Longitud de onda (nm)', gridcolor: '#e2e8f0', range: [400, 800] },
            yaxis: { title: 'Reflexión (%)', gridcolor: '#e2e8f0', range: [0, 100] },
            paper_bgcolor: '#fcfdfe', plot_bgcolor: '#ffffff', hovermode: false, showlegend: false, margin: { l: 60, r: 30, t: 80, b: 60 }
        };

        await Plotly.newPlot(gd, [trace, hoverTrace], layout, { responsive: true, displayModeBar: false });
        graficaCargada = true;

        // Función de interpolación: calcula el punto exacto en Y para cualquier X en la curva
        function interpY(x) {
            if (x <= wavelength[0]) return reflectancia[0];
            if (x >= wavelength[wavelength.length - 1]) return reflectancia[reflectancia.length - 1];
            let i = 1; while (i < wavelength.length && x > wavelength[i]) i++;
            const x1 = wavelength[i - 1], x2 = wavelength[i], y1 = reflectancia[i - 1], y2 = reflectancia[i];
            return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
        }

        // Lógica de seguimiento del Radar al mover el mouse
        gd.addEventListener('mousemove', (ev) => {
            const rect = gd.getBoundingClientRect();
            const fl = gd._fullLayout;
            const l = fl.margin.l, t = fl.margin.t;
            const plotW = rect.width - (l + fl.margin.r), plotH = rect.height - (t + fl.margin.b);
            const dataX = 400 + ((ev.clientX - rect.left - l) / plotW) * 400;

            if (dataX >= 400 && dataX <= 800) {
                const yInterp = interpY(dataX);
                // Movemos el punto del radar sobre la línea
                Plotly.restyle(gd, { x: [[dataX]], y: [[yInterp]] }, [1]);
                // Actualizamos los valores y posición del tooltip tricolor
                if(lambdaSpan) lambdaSpan.textContent = dataX.toFixed(2);
                if(reflSpan) reflSpan.textContent = yInterp.toFixed(2);
                if(tooltip) {
                    tooltip.style.left = (l + ((dataX - 400) / 400) * plotW) + 'px';
                    tooltip.style.top = (t + (1 - (yInterp / 100)) * plotH - 25) + 'px';
                    tooltip.style.display = 'block';
                }
            }
        });
    } catch (e) { console.error("Error en motor de gráfica:", e); }
}

/* ============================================================
   6. APOYO ADMINISTRATIVO Y MENÚ
   ============================================================ */

/**
 * Verifica las credenciales para habilitar las funciones de gestión.
 */
function verificarAdmin() {
    const u = document.getElementById('admin-user').value;
    const p = document.getElementById('admin-pass').value;
    if (u === CREDENCIALES_ADMIN.usuario && p === CREDENCIALES_ADMIN.pass) {
        adminLogueado = true;
        document.getElementById('nav-subir').style.display = 'block';
        document.getElementById('nav-login').style.display = 'none';
        alert("Acceso administrativo activo.");
        mostrarSeccion('home');
    } else { alert("Credenciales incorrectas."); }
}

/**
 * Controla la apertura/cierre del menú hamburguesa en dispositivos móviles.
 */
function toggleMenu() {
    const nav = document.getElementById('nav-menu');
    if (window.innerWidth <= 768) nav.classList.toggle('nav-active');
}
/* =========================================
   1. CONFIGURACIÓN Y CONEXIÓN
   ========================================= */
const SUPABASE_URL = "https://nxktvjduooqfgzzrdfot.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a3R2amR1b29xZmd6enJkZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTg1ODgsImV4cCI6MjA4NjY5NDU4OH0.4hYin09mna34MYg3cGdjtzIyvmZOntE5Xceofa9yTAs";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CREDENCIALES_ADMIN = { usuario: "missas", pass: "123" };
let adminLogueado = false; 
let editandoId = null; 
let graficaCargada = false;

/* =========================================
   2. NAVEGACIÓN Y CONTROL DE VISTA
   ========================================= */

function mostrarSeccion(id) {
    const secciones = document.querySelectorAll('.seccion-contenido');
    secciones.forEach(s => s.classList.remove('seccion-activa'));

    const seccionSeleccionada = document.getElementById(id);
    if (seccionSeleccionada) {
        seccionSeleccionada.classList.add('seccion-activa');
        window.scrollTo(0, 0);

        const listaContenedor = document.getElementById('lista-' + id);
        if (listaContenedor) cargarArticulosDesdeNube(id);
    }

    if (id === 'espectros-reflexion' && !graficaCargada) inicializarGrafica();
}

function ajustarTipoEntrada() {
    const cat = document.getElementById('categoria').value;
    const esDifusion = (cat === 'art-difusion');

    // Visibilidad de fecha y origen (PDF/URL)
    document.getElementById('contenedor-fecha-difusion').style.display = esDifusion ? 'block' : 'none';
    document.getElementById('contenedor-pdf').style.display = esDifusion ? 'none' : 'block';
    document.getElementById('contenedor-url').style.display = esDifusion ? 'block' : 'none';

    if (!esDifusion) {
        document.getElementById('dia').value = "";
        document.getElementById('mes').value = "";
    }
}

/* =========================================
   3. GESTIÓN DE DATOS (READ)
   ========================================= */

async function cargarArticulosDesdeNube(categoria) {
    const contenedor = document.getElementById('lista-' + categoria);
    if (!contenedor) return;

    contenedor.innerHTML = '<p style="padding: 20px; color: var(--gris);">Consultando base de datos...</p>';

    try {
        const { data, error } = await _supabase
            .from('articulos') 
            .select('*')
            .eq('categoria', categoria)
            .order('anio', { ascending: true }); 

        if (error) throw error;

        contenedor.innerHTML = data.length === 0 ? '<p style="padding: 20px;">Sin registros.</p>' : '';

        data.forEach(art => {
            const item = document.createElement('div');
            item.className = 'articulo-item';
            
            // Lógica de visualización de fecha (D/M/A)
            let fechaTexto = `${art.anio}`;
            if (art.mes) fechaTexto = `${art.mes}/${fechaTexto}`;
            if (art.dia && art.mes) fechaTexto = `${art.dia}/${fechaTexto}`;

            const icono = art.categoria === 'art-difusion' ? '🔗' : '📄';

            item.innerHTML = `
                <h3>${art.titulo}</h3>
                <p><strong>Autores:</strong> ${art.autores} | <strong>Fecha:</strong> ${fechaTexto}</p>
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
    } catch (err) { contenedor.innerHTML = '<p style="color:red; padding: 20px;">Error de servidor.</p>'; }
}

/* =========================================
   4. GESTIÓN DE DATOS (CUD)
   ========================================= */

// Guardar o Actualizar
document.getElementById('formArticulo').addEventListener('submit', async function(e) {
    e.preventDefault();
    const cat = document.getElementById('categoria').value;
    const file = document.getElementById('archivo').files[0];
    const urlExt = document.getElementById('enlace_externo').value;
    let urlPublica = null;

    try {
        // Subida de archivo (solo si hay archivo nuevo y no es difusión)
        if (cat !== 'art-difusion' && file) {
            const path = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const { error: upErr } = await _supabase.storage.from('pdfs').upload(path, file);
            if (upErr) throw upErr;
            urlPublica = _supabase.storage.from('pdfs').getPublicUrl(path).data.publicUrl;
        } else if (cat === 'art-difusion') {
            urlPublica = urlExt;
        }

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
            const { error } = await _supabase.from('articulos').update(payload).eq('id', editandoId);
            if (error) throw error;
            alert("Registro actualizado.");
        } else {
            const { error } = await _supabase.from('articulos').insert([payload]);
            if (error) throw error;
            alert("Guardado con éxito.");
        }

        this.reset();
        editandoId = null;
        document.querySelector('.btn-subir').innerText = "Guardar en Base espectral";
        ajustarTipoEntrada();
        mostrarSeccion(cat); // Permanecer en la sección
    } catch (err) { alert("Error: " + err.message); }
});

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

async function borrarArticulo(id, cat) {
    if (confirm("¿Confirmas la eliminación permanente?")) {
        await _supabase.from('articulos').delete().eq('id', id);
        cargarArticulosDesdeNube(cat);
    }
}

/* =========================================
   5. GRÁFICA CON RADAR MATEMÁTICO
   ========================================= */

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
            const w = parseFloat(cols[0]), r = parseFloat(cols[1]);
            if (!isNaN(w) && !isNaN(r)) { wavelength.push(w); reflectancia.push(r); }
        });

        const trace = { x: wavelength, y: reflectancia, mode: 'lines', line: { color: '#3282b8', width: 2.5, shape: 'spline' }, hoverinfo: 'none' };
        const hoverTrace = { x: [0], y: [0], mode: 'markers', marker: { size: 12, color: '#006847', line: { width: 3, color: '#ffffff' } }, hoverinfo: 'none' };
        const layout = {
            title: '<b>Espectro de Reflexión Difusa - UPT</b>',
            xaxis: { title: 'Longitud de onda (nm)', gridcolor: '#e2e8f0', range: [400, 800] },
            yaxis: { title: 'Reflexión (%)', gridcolor: '#e2e8f0', range: [0, 100] },
            paper_bgcolor: '#fcfdfe', plot_bgcolor: '#ffffff', hovermode: false, showlegend: false, margin: { l: 60, r: 30, t: 80, b: 60 }
        };

        Plotly.newPlot(gd, [trace, hoverTrace], layout, { responsive: true, displayModeBar: false });
        graficaCargada = true;

        // Interpolación lineal para el radar
        function interpY(x) {
            if (x <= wavelength[0]) return reflectancia[0];
            if (x >= wavelength[wavelength.length - 1]) return reflectancia[reflectancia.length - 1];
            let i = 1; while (i < wavelength.length && x > wavelength[i]) i++;
            const x1 = wavelength[i - 1], x2 = wavelength[i], y1 = reflectancia[i - 1], y2 = reflectancia[i];
            return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
        }

        gd.addEventListener('mousemove', (ev) => {
            const rect = gd.getBoundingClientRect();
            const fl = gd._fullLayout;
            const l = fl.margin.l, t = fl.margin.t;
            const plotW = rect.width - (l + fl.margin.r), plotH = rect.height - (t + fl.margin.b);
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

/* =========================================
   6. APOYO (ADMIN Y MENÚ)
   ========================================= */

function verificarAdmin() {
    const u = document.getElementById('admin-user').value;
    const p = document.getElementById('admin-pass').value;
    if (u === CREDENCIALES_ADMIN.usuario && p === CREDENCIALES_ADMIN.pass) {
        adminLogueado = true;
        document.getElementById('nav-subir').style.display = 'block';
        document.getElementById('nav-login').style.display = 'none';
        alert("Modo administrador activo.");
        mostrarSeccion('home');
    } else { alert("Error de acceso."); }
}

function toggleMenu() {
    const nav = document.getElementById('nav-menu');
    if (window.innerWidth <= 768) nav.classList.toggle('nav-active');
}
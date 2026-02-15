// ==========================================
// 1. CONEXIÓN A SUPABASE
// ==========================================
const SUPABASE_URL = "https://nxktvjduooqfgzzrdfot.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a3R2amR1b29xZmd6enJkZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTg1ODgsImV4cCI6MjA4NjY5NDU4OH0.4hYin09mna34MYg3cGdjtzIyvmZOntE5Xceofa9yTAs";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. NAVEGACIÓN Y CARGA DINÁMICA
// ==========================================
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

    contenedor.innerHTML = '<p style="color: var(--gris); padding: 20px;">Consultando Base UPT...</p>';

    try {
        const { data, error } = await _supabase
            .from('articulos') 
            .select('*')
            .eq('categoria', categoria);

        if (error) throw error;

        if (data.length === 0) {
            contenedor.innerHTML = '<p style="color: var(--gris); padding: 20px;">Sin archivos registrados aquí.</p>';
            return;
        }

        contenedor.innerHTML = '';
        data.forEach(art => {
            const item = document.createElement('div');
            item.className = 'articulo-item';
            item.innerHTML = `
                <h3>${art.titulo}</h3>
                <p><strong>Autores:</strong> ${art.autores} | <strong>Año:</strong> ${art.anio}</p>
                <a href="${art.pdf_url}" target="_blank" class="btn-ver-pdf">📄 Ver Documento PDF</a>
            `;
            contenedor.appendChild(item);
        });
    } catch (err) {
        console.error("Error Supabase:", err);
        contenedor.innerHTML = '<p style="color: red; padding: 20px;">Error de conexión con la nube.</p>';
    }
}

// ==========================================
// 3. SUBIDA DE ARCHIVOS (ADMIN)
// ==========================================
const formArticulo = document.getElementById('formArticulo');
if (formArticulo) {
    formArticulo.addEventListener('submit', async function(e) {
        e.preventDefault();
        const archivoPDF = document.getElementById('archivo').files[0];
        if (!archivoPDF) return alert("Selecciona un PDF");

        const nombreArchivo = `${Date.now()}_${archivoPDF.name}`;

        try {
            const { error: upErr } = await _supabase.storage.from('pdfs').upload(nombreArchivo, archivoPDF);
            if (upErr) throw upErr;

            const { data: { publicUrl } } = _supabase.storage.from('pdfs').getPublicUrl(nombreArchivo);

            const { error: dbErr } = await _supabase.from('articulos').insert([{
                titulo: document.getElementById('titulo').value,
                autores: document.getElementById('autores').value,
                anio: parseInt(document.getElementById('anio').value),
                categoria: document.getElementById('categoria').value,
                pdf_url: publicUrl
            }]);

            if (dbErr) throw dbErr;
            alert("¡Artículo guardado en la nube!");
            this.reset();
            mostrarSeccion('home');
        } catch (err) {
            alert("Error al subir: " + err.message);
        }
    });
}

// ==========================================
// 4. ACCESO Y GRÁFICA PROFESIONAL (CON RADAR)
// ==========================================
const CREDENCIALES_ADMIN = { usuario: "isai_admin", pass: "UPT2026" };

function verificarAdmin() {
    const u = document.getElementById('admin-user').value;
    const p = document.getElementById('admin-pass').value;
    if (u === CREDENCIALES_ADMIN.usuario && p === CREDENCIALES_ADMIN.pass) {
        document.getElementById('nav-subir').style.display = 'block';
        document.getElementById('nav-login').style.display = 'none';
        alert("Acceso concedido");
        mostrarSeccion('home');
    } else {
        alert("Credenciales incorrectas");
    }
}

async function inicializarGrafica() {
    const gd = document.getElementById('grafica-reflexion');
    const tooltip = document.getElementById('custom-tooltip');
    if (!gd) return;

    try {
        const resp = await fetch('css/data/reflexion.csv');
        const texto = await resp.text();
        const filas = texto.trim().split('\n').slice(1);
        const wavelength = [], reflectancia = [];
        
        filas.forEach(l => {
            const c = l.split(/,|\t|;/);
            wavelength.push(parseFloat(c[0]));
            reflectancia.push(parseFloat(c[1]));
        });

        const trace = { x: wavelength, y: reflectancia, mode: 'lines', line: { color: '#3282b8', width: 2.5, shape: 'spline' }, hoverinfo: 'none' };
        const hoverTrace = { x: [0], y: [0], mode: 'markers', marker: { size: 12, color: '#006847', line: { width: 3, color: '#fff' } }, hoverinfo: 'none' };

        const layout = {
            title: '<b>Espectro de Reflexión - UPT</b>',
            xaxis: { title: 'Longitud de onda (nm)', gridcolor: '#e2e8f0', range: [400, 800] },
            yaxis: { title: 'Reflexión (%)', gridcolor: '#e2e8f0', range: [0, 100] },
            hovermode: false, showlegend: false, margin: { l: 60, r: 30, t: 50, b: 50 }
        };

        await Plotly.newPlot(gd, [trace, hoverTrace], layout, { responsive: true, displayModeBar: false });
        graficaCargada = true;

        // Lógica de Radar
        gd.addEventListener('mousemove', (ev) => {
            const rect = gd.getBoundingClientRect();
            const fullLayout = gd._fullLayout;
            const l = fullLayout.margin.l, t = fullLayout.margin.t;
            const plotW = rect.width - (l + fullLayout.margin.r);
            const plotH = rect.height - (t + fullLayout.margin.b);
            const relX = (ev.clientX - rect.left - l) / plotW;
            const dataX = 400 + relX * (800 - 400);

            if (dataX >= 400 && dataX <= 800) {
                let i = 1; while (i < wavelength.length && dataX > wavelength[i]) i++;
                const y1 = reflectancia[i-1], y2 = reflectancia[i], x1 = wavelength[i-1], x2 = wavelength[i];
                const yInterp = y1 + (dataX - x1) * (y2 - y1) / (x2 - x1);

                Plotly.restyle(gd, { x: [[dataX]], y: [[yInterp]] }, [1]);
                document.getElementById('lambda-value').textContent = dataX.toFixed(2);
                document.getElementById('refl-value').textContent = yInterp.toFixed(2);
                
                tooltip.style.left = (l + relX * plotW) + 'px';
                tooltip.style.top = (t + (1 - (yInterp/100)) * plotH - 25) + 'px';
                tooltip.style.display = 'block';
            }
        });
    } catch (e) { console.error("Error CSV:", e); }
}
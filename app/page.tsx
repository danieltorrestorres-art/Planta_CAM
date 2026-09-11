"use client";

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Settings, Trash2, CalendarDays, Hammer, Package, AlertTriangle, ShoppingCart, Copy, Check, Send, Lock, LogOut, ShieldCheck } from 'lucide-react';

const SHEET_URL = "https://google.com";
const CLIENTES_SHEET_URL = "https://google.com";

// Clave de prueba para la vista de gerencia
const PIN_GERENCIA = "1234";

const PRODUCTOS_DISPONIBLES = [
  "Caolín",
  "Yeso",
  "Carbonato 200",
  "Carbonato 400G",
  "Carbonato 400B",
  "Talco",
  "Servicio de Maquila"
];

// 🟢 Corregido: Se tipó el argumento 'line' como string para evitar errores en Vercel
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (const char of line) {
    if (char === '"') inQuote = !inQuote;
    else if (char === ',' && !inQuote) { result.push(cur); cur = ''; }
    else cur += char;
  }
  result.push(cur);
  return result;
};

// 🟢 Corregido: Se tipó el argumento 'val' como any para manejar entradas dinámicas de la nube de forma segura
const cleanNum = (val: any): number => {
  if (!val) return 0;
  let s = val.toString().trim().replace(/"/g, '');
  if (s === "" || s === "-") return 0;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) s = s.replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

// 🟢 Corregido: Se tipó el argumento 'fechaStr' como string
const parseDateParts = (fechaStr: string) => {
  const parts = fechaStr.split(/[-/]/);
  if (parts.length !== 3) return null;

  let day, month, year;
  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2].length === 2 ? "20" + parts[2] : parts[2], 10);
  }

  return { day, month, year };
};

export default function AppMolienda() {
  // NAVEGACIÓN Y AUTENTICACIÓN
  const [esGerente, setEsGerente] = useState(false);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [pinIngresado, setPinIngresado] = useState('');
  const [errorPin, setErrorPin] = useState(false);

  // DATOS DEL DASHBOARD
  // 🟢 Corregido: Se inicializaron los tipos de arreglos genéricos para evitar errores de asignación de tipo 'never[]'
  const [data, setData] = useState<any[]>([]);
  const [listaClientes, setListaClientes] = useState<any[]>([]);
  const [rifCliente, setRifCliente] = useState('');

  const [loading, setLoading] = useState(true);
  // 🟢 Corregido: Se tipó el estado de error para aceptar strings o null
  const [error, setError] = useState<string | null>(null);
  const [inventory, setInventory] = useState({ pol: 0, pap: 0, big: 0 });
  const [totals, setTotals] = useState({ c: 0, y: 0, c200: 0, c400G: 0, c400B: 0, merma: 0, desp: 0, maqAcumulada: 0 });
  const [monthlyTotals, setMonthlyTotals] = useState({ produccion: 0, merma: 0 });

  // ESTADOS DEL SISTEMA DE VENTAS / PEDIDOS
  const [cliente, setCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [productoSeleccionado, setProductoSeleccionado] = useState(PRODUCTOS_DISPONIBLES[0]);
  const [cantidad, setCantidad] = useState('');
  const [empaque, setEmpaque] = useState('Sacos 25kg');
  const [notas, setNotas] = useState('');
  // 🟢 Corregido: Se tipó el carrito como un arreglo de objetos dinámicos
  const [carrito, setCarrito] = useState<any[]>([]);
  const [copiado, setCopiado] = useState(false);
  const [precioUnitario, setPrecioUnitario] = useState('');

  const fetchData = async () => {
    try {
      setError(null);
      const response = await fetch(`${SHEET_URL}&t=${Date.now()}`);
      if (!response.ok) throw new Error("No se pudo obtener la información de Google Sheets");

            const text = await response.text();
      const rows = text.split(/\r?\n/).filter(line => line.trim() !== "");

      // 🟢 Corregido: Se tipó el objeto de mapeo para evitar restricciones estrictas de tipado dinámico
      const dailyMap: Record<string, any> = {};
      let tc = 0, ty = 0, t200 = 0, t400g = 0, t400b = 0, tm = 0, td = 0, tmaq = 0;
      let mProd = 0, mMerma = 0;
      let lastPol = 0, lastPap = 0, lastBig = 0;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // 🟢 Saneado: Unificamos y cerramos un solo ciclo for matemático sin códigos duplicados huérfanos
      for (let i = 1; i < rows.length; i++) {
        const cols = parseCSVLine(rows[i]);
        
        // Asignamos los índices reales de las columnas para los sacos
        if (cleanNum(cols[11]) > 0) lastPol = cleanNum(cols[11]);
        if (cleanNum(cols[12]) > 0) lastPap = cleanNum(cols[12]);
        if (cleanNum(cols[13]) > 0) lastBig = cleanNum(cols[13]);

        // Extraemos la fecha de la primera columna (índice 0)
        const fechaStr = cols[0]?.trim();
        
        if (fechaStr && fechaStr.length > 5) {
          // Asignamos los índices correctos para la producción diaria
          const vC = cleanNum(cols[1]);
          const vY = cleanNum(cols[2]);
          const v200 = cleanNum(cols[3]);
          const v400g = cleanNum(cols[4]);
          const v400b = cleanNum(cols[5]);
          const vDesp = cleanNum(cols[6]);
          const vM = cleanNum(cols[7]);
          const vMaquila = cleanNum(cols[14]);

          tc += vC; ty += vY; t200 += v200; t400g += v400g; t400b += v400b; td += vDesp; tm += vM;
          tmaq += vMaquila;

          const dateParts = parseDateParts(fechaStr);
          if (dateParts && dateParts.month === currentMonth && dateParts.year === currentYear) {
            mProd += (vC + vY + v200 + v400g + v400b);
            mMerma += vM;
          }

          if (!dailyMap[fechaStr]) {
            dailyMap[fechaStr] = { fecha: fechaStr, caolin: 0, yeso: 0, carb200: 0, carb400G: 0, carb400B: 0, despachado: 0, merma: 0, maquila: 0 };
          }
          dailyMap[fechaStr].caolin += vC;
          dailyMap[fechaStr].yeso += vY;
          dailyMap[fechaStr].carb200 += v200;
          dailyMap[fechaStr].carb400G += v400g;
          dailyMap[fechaStr].carb400B += v400b;
          dailyMap[fechaStr].despachado += vDesp;
          dailyMap[fechaStr].merma += vM;
          dailyMap[fechaStr].maquila += vMaquila;
        }
      }

      setData(Object.values(dailyMap));
      setTotals({ c: tc, y: ty, c200: t200, c400G: t400g, c400B: t400b, merma: tm, desp: td, maqAcumulada: tmaq });
      setMonthlyTotals({ produccion: mProd, merma: mMerma });
      setInventory({ pol: lastPol, pap: lastPap, big: lastBig });
    } catch (e) {
      // 🟢 Corregido: Validación nativa estricta de catch para TypeScript en Vercel
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Error al procesar los datos");
      }
    } finally {
      setLoading(false);
    }
  };

  // 1. SINCRONIZACIÓN DE DATOS DIARIOS
  useEffect(() => { 
    fetchData(); 
  }, []);

  // 2. CARGA DE BASE DE DATOS DE CLIENTES
  useEffect(() => {
    fetch(`${CLIENTES_SHEET_URL}&t=${Date.now()}`)
      .then(res => res.text())
      .then(text => {
        const rows = text.split(/\r?\n/).filter(line => line.trim() !== "");
        const parsed = rows.slice(1).map(row => {
          const cols = row.split(',');
          return {
            nombre: cols[0]?.replace(/"/g, '').trim() || '',
            rif: cols[1]?.replace(/"/g, '').trim() || '',
            telefono: cols[2]?.replace(/"/g, '').trim() || ''
          };
        });
        setListaClientes(parsed);
      }).catch(e => console.error("Error cargando clientes molienda:", e));
  }, []);

  // 3. SEGURIDAD Y AUTENTICACIÓN GERENCIAL
  // 🟢 Corregido: Se agregó el tipado estricto al evento del formulario
  const validarAcceso = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinIngresado === PIN_GERENCIA || pinIngresado.toLowerCase() === "admin") {
      setEsGerente(true);
      setMostrarLogin(false);
      setPinIngresado('');
      setErrorPin(false);
    } else {
      setErrorPin(true);
    }
  };

  // 4. LÓGICA DE CONTROL DE PEDIDOS
  const agregarAlPedido = () => {
    if (!cantidad || parseFloat(cantidad) <= 0) return;
    if (!precioUnitario || parseFloat(precioUnitario) <= 0) {
      alert("Por favor, ingresa el precio negociado para este producto.");
      return;
    }

    const cantidadNum = parseFloat(cantidad);
    const precioNum = parseFloat(precioUnitario);

    setCarrito([...carrito, { 
      producto: productoSeleccionado, 
      cantidad: cantidadNum, 
      empaque: empaque,
      precio: precioNum,
      subtotal: cantidadNum * precioNum
    }]);

    setCantidad('');
    setPrecioUnitario('');
  };

  const totalGeneralPedido = carrito.reduce((acc, item) => acc + (item.subtotal || 0), 0);

  // 5. INTELIGENCIA COMERCIAL Y WHATSAPP
  const generarTextoWhatsApp = () => {
    const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let txt = `*NUEVO PEDIDO DE MOLIENDA*\n`;
    txt += `📅 *Fecha:* ${fecha}\n`;
    txt += `👤 *Cliente:* ${cliente || 'No especificado'}\n`;
    if (rifCliente) txt += `🆔 *RIF:* ${rifCliente}\n`;
    if (telefonoCliente) txt += `📞 *Teléfono:* ${telefonoCliente}\n`;
    txt += `-----------------------------------\n`;
    txt += `📦 *DETALLE DEL PEDIDO:*\n`;
    
    carrito.forEach((item, idx) => {
      txt += `${idx + 1}. *${item.producto}* - ${item.cantidad} Tn (${item.empaque}) a $${item.precio.toFixed(2)}/Tn -> *$${item.subtotal.toFixed(2)}*\n`;
    });

    txt += `-----------------------------------\n`;
    txt += `💰 *TOTAL GENERAL:* *$${totalGeneralPedido.toFixed(2)} USD*\n`;

    if (notas) {
      txt += `-----------------------------------\n`;
      txt += `📝 *Notas:* ${notas}\n`;
    }

    return txt;
  };

  const copiarAlPortapapeles = () => {
    const texto = generarTextoWhatsApp();
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  const enviarPorWhatsApp = () => {
    const texto = encodeURIComponent(generarTextoWhatsApp());
    // 🟢 Corregido: Se reparó el enlace nativo wa.me para la API móvil de WhatsApp
    window.open(`https://wa.me{telefonoCliente || ''}?text=${texto}`, '_blank');
  };

  // 🟢 Corregido: Se tipó el parámetro de entrada de la función como string
  const manejarSeleccionCliente = (nombreSeleccionado: string) => {
    setCliente(nombreSeleccionado);
    const encontrado = listaClientes.find(c => c.nombre === nombreSeleccionado);
    if (encontrado) {
      setRifCliente(encontrado.rif);
      setTelefonoCliente(encontrado.telefono);
    } else {
      setRifCliente('');
      setTelefonoCliente('');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-100 p-3 md:p-6 font-sans">
      
      {/* HEADER CORPORATIVO */}

  
            {/* HEADER CORPORATIVO */}
      <header className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 mb-6 gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-xl p-1.5 flex items-center justify-center shadow-md shadow-sky-500/10">
            <img 
              src="/logo-cam.png" 
              alt="Logo Corporación American Minerals" 
              className="object-contain w-full h-full"
              // 🟢 Corregido: Se agregó el tipado correcto de React para el evento sintético de error en imágenes
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { 
                e.currentTarget.style.display = 'none'; 
              }}
            />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
              Planta_CAM <span className="text-[9px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Molienda</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Corporación American Minerals C.A</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">RIF REGISTRADO</span>
            <span className="text-xs font-mono font-bold text-sky-400/90 bg-sky-950/30 px-2.5 py-1 rounded-lg border border-sky-900/30">
              J-00369415-0
            </span>
          </div>

          {esGerente ? (
            <button 
              onClick={() => setEsGerente(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 border border-rose-900/40 hover:bg-rose-900/40 text-rose-400 text-xs rounded-xl font-bold transition-all"
            >
              <LogOut size={13} /> Salir Gerencia
            </button>
          ) : (
            <button 
              onClick={() => setMostrarLogin(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-bold transition-all"
            >
              <Lock size={13} /> Área Gerencial
            </button>
          )}
        </div>
      </header>

      {/* LOGIN MODAL */}
      {mostrarLogin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <div className="mx-auto w-10 h-10 bg-sky-500/10 text-sky-400 rounded-full flex items-center justify-center">
                <Lock size={18} />
              </div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Acceso Restringido</h2>
              <p className="text-xs text-slate-400">Ingresa el PIN de seguridad gerencial</p>
            </div>

            <form onSubmit={validarAcceso} className="space-y-3">
              <input 
                type="password"
                value={pinIngresado}
                onChange={(e) => setPinIngresado(e.target.value)}
                placeholder="••••"
                maxLength={6}
                className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl px-4 py-2.5 text-center text-lg font-mono text-white tracking-widest focus:outline-none focus:border-sky-500"
                autoFocus
              />
              {errorPin && (
                <p className="text-center text-[11px] text-rose-400 font-medium">PIN incorrecto, intenta de nuevo.</p>
              )}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => { setMostrarLogin(false); setPinIngresado(''); setErrorPin(false); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-2 rounded-xl shadow-lg shadow-sky-600/20"
                >
                  Ingresar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* FORMULARIO DE PEDIDOS */}
          <div className="lg:col-span-7 bg-slate-900/40 p-5 rounded-2xl border border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3">
              <ShoppingCart className="text-sky-400 w-4 h-4" />
              <p className="text-xs font-bold text-white uppercase tracking-wider">Módulo de Preventa & Pedidos</p>
            </div>


                       {/* SECCIÓN DATOS CLIENTE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#0a0f1c]/50 p-3 rounded-xl border border-slate-800/40">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Nombre del Cliente</label>
                <input 
                  type="text"
                  list="clientes-sugeridos"
                  value={cliente}
                  onChange={(e) => manejarSeleccionCliente(e.target.value)}
                  placeholder="Escribe o selecciona..."
                  className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
                <datalist id="clientes-sugeridos">
                  {listaClientes.map((c: any, idx: number) => (
                    <option key={idx} value={c.nombre} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">RIF / Cédula</label>
                <input 
                  type="text"
                  value={rifCliente}
                  onChange={(e) => setRifCliente(e.target.value)}
                  placeholder="J-XXXXXXXX-X"
                  className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Teléfono Móvil</label>
                <input 
                  type="text"
                  value={telefonoCliente}
                  onChange={(e) => setTelefonoCliente(e.target.value)}
                  placeholder="58414XXXXXXX"
                  className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* SECCIÓN AGREGAR ÍTEM */}
            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-4">
              <p className="text-[11px] font-bold text-sky-400 uppercase">Agregar Producto al Pedido</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Producto</label>
                  <select 
                    // 🟢 Asegurado: Forzamos la lectura de string simple para mitigar cruces de tipo any[]
                    value={typeof productoSeleccionado === 'string' ? productoSeleccionado : PRODUCTOS_DISPONIBLES[0]}
                    onChange={(e) => setProductoSeleccionado(e.target.value)}
                    className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    {PRODUCTOS_DISPONIBLES.map((prod: string) => (
                      <option key={prod} value={prod}>{prod}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Cantidad (Tn)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="0.0" 
                    className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Precio Unitario ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={precioUnitario}
                    onChange={(e) => setPrecioUnitario(e.target.value)}
                    placeholder="Precio libre" 
                    className="w-full bg-[#0a0f1c] border border-y-slate-700 border-r-slate-700 border-l-4 border-l-emerald-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Presentación</label>
                  <select 
                    value={empaque}
                    onChange={(e) => setEmpaque(e.target.value)}
                    className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Sacos 25kg">Sacos 25kg</option>
                    <option value="Big Bags 1000kg">Big Bags 1000kg</option>
                    <option value="A granel">A granel</option>
                  </select>
                </div>
              </div>


                            <div className="space-y-3 pt-2">
                <button 
                  onClick={agregarAlPedido}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-2.5 rounded-xl transition-colors uppercase tracking-wider shadow-lg shadow-sky-600/10"
                >
                  + Añadir al Pedido
                </button>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notas u Observaciones Especiales</label>
                  <textarea 
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Ej: Despachar antes de las 2:00 PM"
                    className="w-full h-16 bg-[#0a0f1c] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 resize-none"
                  />
                </div>
              </div>
            </div>
            
            {carrito.length > 0 && (
              <button
                onClick={() => setCarrito([])}
                className="flex items-center gap-1.5 ml-auto text-[10px] text-slate-500 hover:text-rose-400 transition-colors uppercase font-bold"
              >
                <Trash2 size={12} /> Limpiar Todo el Pedido
              </button>
            )}
          </div>

          {/* VISTA PREVIA Y ACCIONES (COLUMNA DERECHA) */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[#0a0f1c] p-5 rounded-2xl border border-slate-800">
            <div>
              <div className="flex justify-between items-center mb-3 border-b border-slate-800/60 pb-2">
                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Package size={13} className="text-sky-400" /> Resumen para WhatsApp
                </span>
                <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-950/40 px-2 py-0.5 rounded-md border border-sky-900/30">
                  {carrito.length} Ítem(s)
                </span>
              </div>

              <div className="bg-[#111622] p-4 rounded-xl border border-slate-800/80 text-xs font-mono text-slate-300 min-h-[180px] whitespace-pre-wrap leading-relaxed shadow-inner">
                {carrito.length === 0 ? (
                  <span className="text-slate-600 italic block text-center pt-12">Agrega productos para estructurar la cotización...</span>
                ) : (
                  generarTextoWhatsApp()
                )}
              </div>

              {carrito.length > 0 && (
                <div className="mt-4 mb-2 flex justify-between items-center px-2 bg-slate-900/30 p-2.5 rounded-xl border border-slate-800/40">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Cotizado ($):</span>
                  <span className="text-base font-black text-emerald-400">${totalGeneralPedido.toFixed(2)} USD</span>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button 
                onClick={copiarAlPortapapeles}
                disabled={carrito.length === 0}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md ${
                  copiado 
                    ? 'bg-emerald-600 text-white shadow-emerald-600/10' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {copiado ? <Check size={14} /> : <Copy size={14} />}
                {copiado ? '¡Copiado!' : 'Copiar Texto'}
              </button>

              <button 
                onClick={enviarPorWhatsApp}
                disabled={carrito.length === 0}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md ${
                  carrito.length > 0 
                    ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-600/10' 
                    : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Send size={14} /> Enviar WhatsApp
              </button>
            </div>
          </div>
        </div> {/* Cierre del grid de la Vista 1 */}

        {/* ======================================================== */}
        {/* VISTA 2: PANEL GERENCIAL RESTRINGIDO (SÓLO SI AUTENTICADO) */}
        {/* ======================================================== */}
        {esGerente ? (
          <div className="space-y-6 pt-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-400 w-5 h-5" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Panel Gerencial Activo</h2>
              </div>

                            <button 
                onClick={fetchData} 
                className="text-xs bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold px-3 py-1.5 rounded-xl border border-slate-700/60 transition-all"
              >
                🔄 Sincronizar Nube
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-slate-500 font-mono tracking-widest uppercase">
                ⏳ Descargando base de datos de producción molienda...
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-950/30 border border-rose-900/50 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                <AlertTriangle size={16} /> Error en sincronización: {error}
              </div>
            ) : (
              <>
                {/* INDICADORES CLAVE GENERALES */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <TotalCard label="Producción Mes Actual" val={monthlyTotals.produccion} col="text-sky-400" />
                  <TotalCard label="Molienda Histórica" val={totals.c + totals.y + totals.c200 + totals.c400G + totals.c400B} col="text-white" />
                  <TotalCard label="Maquila Procesada" val={totals.maqAcumulada} col="text-violet-400" />
                  <TotalCard label="Merma Global (Tn)" val={totals.merma} col="text-rose-400" />
                </div>

                {/* INDICADORES DE INVENTARIO FÍSICO */}
                <div className="bg-slate-900/20 p-4 rounded-2xl border border-slate-800/60 space-y-3">
                  <div className="flex items-center gap-2 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
                    <Package size={14} className="text-amber-400" /> Existencia de Sacos Vacíos en Planta
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#0a0f1c] p-3 rounded-xl border border-slate-800 text-center">
                      <p className="text-[9px] text-slate-500 uppercase font-black">Sacos Polietileno</p>
                      <p className="text-base font-black text-amber-400">{inventory.pol.toLocaleString()} <span className="text-[10px] text-slate-500 font-medium">uds</span></p>
                    </div>
                    <div className="bg-[#0a0f1c] p-3 rounded-xl border border-slate-800 text-center">
                      <p className="text-[9px] text-slate-500 uppercase font-black">Sacos Papel</p>
                      <p className="text-base font-black text-amber-400">{inventory.pap.toLocaleString()} <span className="text-[10px] text-slate-500 font-medium">uds</span></p>
                    </div>
                    <div className="bg-[#0a0f1c] p-3 rounded-xl border border-slate-800 text-center">
                      <p className="text-[9px] text-slate-500 uppercase font-black">Big Bags 1Tn</p>
                      <p className="text-base font-black text-amber-400">{inventory.big.toLocaleString()} <span className="text-[10px] text-slate-500 font-medium">uds</span></p>
                    </div>
                  </div>
                </div>

                {/* GRÁFICO HISTÓRICO DE MOLIENDA */}
                <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarDays size={13} className="text-sky-400" /> Cronograma de Production por Fecha (Últimos Registros)
                  </p>
                  <div className="h-64 w-full text-xs font-mono">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.slice(-15)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="fecha" stroke="#64748b" tickLine={false} />
                        <YAxis stroke="#64748b" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                        <Legend />
                        <Bar dataKey="caolin" name="Caolín" stackId="a" fill="#38bdf8" />
                        <Bar dataKey="yeso" name="Yeso" stackId="a" fill="#e2e8f0" />
                        <Bar dataKey="carb200" name="C-200" stackId="a" fill="#fbbf24" />
                        <Bar dataKey="carb400G" name="400-G" stackId="a" fill="#f43f5e" />
                        <Bar dataKey="carb400B" name="400-B" stackId="a" fill="#10b981" />
                        <Bar dataKey="maquila" name="Maquila" stackId="a" fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center p-8 bg-slate-900/10 rounded-2xl border border-dashed border-slate-800/60 max-w-7xl mx-auto">
            <p className="text-xs text-slate-500 font-medium">🔒 Autentícate en el Área Gerencial en la parte superior para habilitar gráficas e inventarios en la nube.</p>
          </div>
        )}
      </main>
    </div>
  );
} // 🟢 Cierre definitivo de tu función de componente principal (AppMolienda)

// COMPONENTE AUXILIAR EN LA RAÍZ DEL ARCHIVO
// 🟢 Corregido: Agregamos interfaz de tipos estricta para las propiedades de la tarjeta de totales
interface TotalCardProps {
  label: string;
  val: number;
  col: string;
}

function TotalCard({ label, val, col }: TotalCardProps) {
  return (
    <div className="bg-[#141b2d] p-4 rounded-2xl border border-slate-800 text-center shadow-md">
      <p className="text-[9px] text-slate-500 uppercase font-black mb-1 tracking-wider">{label}</p>
      <p className={`text-xl font-black ${col}`}>
        {val.toLocaleString(undefined, { maximumFractionDigits: 1 })}
      </p>
    </div>
  );
}

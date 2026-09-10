"use client";

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Settings, Trash2, CalendarDays, Hammer, Package, AlertTriangle, ShoppingCart, Copy, Check, Send, Lock, LogOut, ShieldCheck } from 'lucide-react';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRdLg6sfZnJtnHR9slWfBCPJYOg4qU6HqGLEtTuuKWecWVasxqjOwqDaUUqc0jXqQ9Ap3JxYV4leTQG/pub?gid=2047349943&single=true&output=csv";
const CLIENTES_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRdLg6sfZnJtnHR9slWfBCPJYOg4qU6HqGLEtTuuKWecWVasxqjOwqDaUUqc0jXqQ9Ap3JxYV4leTQG/pub?gid=209700947&single=true&output=csv";

// Clave de prueba para la vista de gerencia
const PIN_GERENCIA = "1234";

const PRODUCTOS_DISPONIBLES = [
  "Caolín",
  "Yeso",
  "Carbonato 200",
  "Carbonato 400G",
  "Carbonato 400B",
  "Servicio de Maquila"
];

const parseCSVLine = (line) => {
  const result = [];
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

const cleanNum = (val) => {
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

const parseDateParts = (fechaStr) => {
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
  const [data, setData] = useState([]);
    const [listaClientes, setListaClientes] = useState([]);
    const [rifCliente, setRifCliente] = useState('');


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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
  const [carrito, setCarrito] = useState([]);
  const [copiado, setCopiado] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      const response = await fetch(`${SHEET_URL}&t=${Date.now()}`);
      if (!response.ok) throw new Error("No se pudo obtener la información de Google Sheets");
      
      const text = await response.text();
      const rows = text.split(/\r?\n/).filter(line => line.trim() !== "");

      const dailyMap = {};
      let tc = 0, ty = 0, t200 = 0, t400g = 0, t400b = 0, tm = 0, td = 0, tmaq = 0;
      let mProd = 0, mMerma = 0;
      let lastPol = 0, lastPap = 0, lastBig = 0;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      for (let i = 1; i < rows.length; i++) {
        const cols = parseCSVLine(rows[i]);
        if (cleanNum(cols[11]) > 0) lastPol = cleanNum(cols[11]);
        if (cleanNum(cols[12]) > 0) lastPap = cleanNum(cols[12]);
        if (cleanNum(cols[13]) > 0) lastBig = cleanNum(cols[13]);

        const fechaStr = cols[0]?.trim();
        if (fechaStr && fechaStr.length > 5) {
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
      setError(e.message || "Error al procesar los datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // AUTENTICACIÓN
  const validarAcceso = (e) => {
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

  // LÓGICA DE PEDIDOS
  const agregarAlPedido = () => {
    if (!cantidad || parseFloat(cantidad) <= 0) return;
    setCarrito([...carrito, { producto: productoSeleccionado, cantidad: parseFloat(cantidad), empaque }]);
    setCantidad('');
  };

  const generarTextoWhatsApp = () => {
    const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let txt = `*NUEVO PEDIDO DE MOLIENDA*\n`;
    txt += `📅 *Fecha:* ${fecha}\n`;
    txt += `👤 *Cliente:* ${cliente || 'No especificado'}\n`;
    if (telefonoCliente) txt += `📞 *Teléfono:* ${telefonoCliente}\n`;
    txt += `-----------------------------------\n`;
    txt += `📦 *DETALLE DEL PEDIDO:*\n`;
    
    carrito.forEach((item, idx) => {
      txt += `${idx + 1}. *${item.producto}* - ${item.cantidad} Tn (${item.empaque})\n`;
    });

    if (notas) {
      txt += `-----------------------------------\n`;
      txt += `📝 *Notas:* ${notas}\n`;
    }

    return txt;
  };

  const copiarAlPortapapeles = () => {
    if (carrito.length === 0) return;
    const texto = generarTextoWhatsApp();
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const enviarPorWhatsApp = () => {
    if (carrito.length === 0) return;
    const texto = encodeURIComponent(generarTextoWhatsApp());
    const url = telefonoCliente 
      ? `https://api.whatsapp.com/send?phone=${telefonoCliente.replace(/\D/g, '')}&text=${texto}`
      : `https://api.whatsapp.com/send?text=${texto}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center text-blue-400 font-mono italic tracking-widest">
        CARGANDO MOLIENDA INTELLIGENCE...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex flex-col items-center justify-center text-red-400 p-4 font-mono">
        <AlertTriangle size={48} className="mb-4" />
        <p className="text-lg font-bold mb-2">ERROR DE CARGA</p>
        <p className="text-sm text-slate-400 mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-200 p-4 md:p-8 font-sans">
      
      {/* CABECERA CON NAVEGACIÓN Y ACCESO */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#141b2d] p-5 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
            <Settings className="text-blue-500 animate-spin-slow" /> Molienda Intelligence
          </h1>
          <p className="text-slate-400 text-[10px] font-mono mt-1 uppercase tracking-widest italic">
            {esGerente ? "Modo: Gerencia & Métricas" : "Modo: Sistema de Ventas & Pedidos"}
          </p>
        </div>

        <div>
          {esGerente ? (
            <div className="flex items-center gap-3">
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                <ShieldCheck size={14} /> Gerente Activo
              </span>
              <button 
                onClick={() => setEsGerente(false)}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <LogOut size={14} /> Salir
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setMostrarLogin(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <Lock size={14} /> Acceso Gerencial
            </button>
          )}
        </div>
      </div>

      {/* MODAL DE LOGIN DE GERENCIA */}
      {mostrarLogin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141b2d] border border-slate-700 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-blue-600/10 text-blue-400 p-3 rounded-2xl w-fit mx-auto mb-3 border border-blue-500/20">
                <Lock size={28} />
              </div>
              <h3 className="text-lg font-black text-white uppercase">Acceso Restringido</h3>
              <p className="text-slate-400 text-xs mt-1">Ingresa el PIN de Gerencia para visualizar métricas y analíticas.</p>
            </div>

            <form onSubmit={validarAcceso} className="space-y-4">
              <div>
                <input 
                  type="password"
                  value={pinIngresado}
                  onChange={(e) => setPinIngresado(e.target.value)}
                  placeholder="PIN de Acceso (Prueba: 1234)"
                  className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl px-4 py-3 text-center text-lg tracking-widest text-white focus:outline-none focus:border-blue-500 font-mono"
                  autoFocus
                />
                {errorPin && <p className="text-red-400 text-xs mt-2 text-center">PIN incorrecto. Intenta de nuevo.</p>}
              </div>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => { setMostrarLogin(false); setErrorPin(false); setPinIngresado(''); }}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-bold uppercase"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  Ingresar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VISTA 1: MÓDULO DE VENTAS Y PEDIDOS (PÚBLICO Y GERENTE) */}
      {/* ======================================================== */}
      <div className="mb-10 bg-[#141b2d] p-6 md:p-8 rounded-3xl border border-blue-500/30 shadow-2xl">
        <h2 className="text-lg font-black text-white flex items-center gap-3 uppercase tracking-wider mb-6">
          <ShoppingCart className="text-emerald-400" size={22} /> Sistema de Pedidos y Ventas
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
         {/* FORMULARIO */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nombre del Cliente</label>
                <select 
                  value={cliente}
                  onChange={(e) => {
                    const nombreSeleccionado = e.target.value;
                    setCliente(nombreSeleccionado);
                    const encontrado = listaClientes.find(c => c.nombre === nombreSeleccionado);
                    if (encontrado) {
                      setRifCliente(encontrado.rif);
                      setTelefonoCliente(encontrado.telefono);
                    } else {
                      setRifCliente('');
                      setTelefonoCliente('');
                    }
                  }}
                  className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none"
                >
                  <option value="" className="bg-[#0a0f1c] text-slate-500">-- Selecciona un Cliente --</option>
                  {listaClientes.map((c, index) => (
                    <option key={index} value={c.nombre} className="bg-[#0a0f1c]">
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">RIF del Cliente</label>
                <input 
                  type="text" 
                  value={rifCliente}
                  readOnly
                  placeholder="Se llena automático" 
                  className="w-full bg-[#0a0f1c]/50 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Teléfono</label>
                <input 
                  type="text" 
                  value={telefonoCliente}
                  onChange={(e) => setTelefonoCliente(e.target.value)}
                  placeholder="Ej: +584121234567" 
                  className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>



            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-4">
              <p className="text-[11px] font-bold text-blue-400 uppercase">Agregar Producto al Pedido</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Producto</label>
                  <select 
                    value={productoSeleccionado}
                    onChange={(e) => setProductoSeleccionado(e.target.value)}
                    className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    {PRODUCTOS_DISPONIBLES.map((prod) => (
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

              <button 
                onClick={agregarAlPedido}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2.5 rounded-xl transition-colors uppercase tracking-wider"
              >
                + Añadir al Pedido
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notas u Observaciones Especiales</label>
              <textarea 
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej: Despachar antes de las 2:00 PM"
                className="w-full bg-[#0a0f1c] border border-slate-700 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* VISTA PREVIA Y ACCIONES */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[#0a0f1c] p-5 rounded-2xl border border-slate-800">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold uppercase text-slate-400">Mensaje para WhatsApp</span>
                <span className="text-[10px] font-mono text-emerald-400">{carrito.length} ítem(s)</span>
              </div>

              <div className="bg-[#141b2d] p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 min-h-[160px] whitespace-pre-wrap leading-relaxed">
                {carrito.length === 0 ? (
                  <span className="text-slate-600 italic">Agrega productos para generar el mensaje...</span>
                ) : (
                  generarTextoWhatsApp()
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button 
                onClick={copiarAlPortapapeles}
                disabled={carrito.length === 0}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                  copiado 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40'
                }`}
              >
                {copiado ? <Check size={16} /> : <Copy size={16} />}
                {copiado ? '¡Copiado!' : 'Copiar Texto'}
              </button>

              <button 
                onClick={enviarPorWhatsApp}
                disabled={carrito.length === 0}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
              >
                <Send size={16} /> Enviar WhatsApp
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ======================================================== */}
      {/* VISTA 2: PANEL GERENCIAL RESTRINGIDO (SÓLO SI AUTENTICADO) */}
      {/* ======================================================== */}
      {esGerente ? (
        <div className="space-y-8 animate-fade-in">
          
          <div className="border-t border-slate-800 pt-6">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ShieldCheck className="text-blue-500" size={18} /> Resumen Ejecutivo de Producción
            </h2>

            {/* TARJETAS PRINCIPALES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-2xl">
                <div className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-2 mb-1">
                  <CalendarDays size={14}/> Producción Mes
                </div>
                <div className="text-2xl font-black text-white">
                  {monthlyTotals.produccion.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  <span className="text-xs font-normal opacity-50 ml-1">Tn</span>
                </div>
              </div>

              <div className="bg-purple-600/10 border border-purple-500/30 p-4 rounded-2xl">
                <div className="text-[10px] font-bold text-purple-400 uppercase flex items-center gap-2 mb-1">
                  <Hammer size={14}/> Maquila Total
                </div>
                <div className="text-2xl font-black text-purple-400">
                  {totals.maqAcumulada.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  <span className="text-xs font-normal opacity-50 ml-1">Tn</span>
                </div>
              </div>

              <div className="bg-red-600/10 border border-red-500/30 p-4 rounded-2xl sm:col-span-2 lg:col-span-1">
                <div className="text-[10px] font-bold text-red-400 uppercase flex items-center gap-2 mb-1">
                  <Trash2 size={14}/> Merma Mes
                </div>
                <div className="text-2xl font-black text-red-500">
                  {monthlyTotals.merma.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  <span className="text-xs font-normal opacity-50 ml-1">Tn</span>
                </div>
              </div>
            </div>

            {/* TOTALES POR PRODUCTO */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
              <TotalCard label="Caolín" val={totals.c} col="text-blue-400" />
              <TotalCard label="Yeso" val={totals.y} col="text-emerald-400" />
              <TotalCard label="C. 200" val={totals.c200} col="text-orange-400" />
              <TotalCard label="C. 400G" val={totals.c400G} col="text-slate-400" />
              <TotalCard label="C. 400B" val={totals.c400B} col="text-amber-600" />
              <TotalCard label="Despacho" val={totals.desp} col="text-white" />
            </div>

            {/* GRÁFICO Y STOCK */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-[#141b2d] p-4 md:p-8 rounded-3xl border border-slate-800 shadow-2xl">
                <div className="h-[300px] md:h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="fecha" stroke="#475569" fontSize={10} tickMargin={10} />
                      <YAxis stroke="#475569" fontSize={10} />
                      <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px'}} formatter={(val) => [val.toFixed(2), ""]} />
                      <Legend />
                      <Bar dataKey="caolin" name="Caolín" fill="#1d4ed8" stackId="a" />
                      <Bar dataKey="yeso" name="Yeso" fill="#059669" stackId="a" />
                      <Bar dataKey="carb200" name="C. 200" fill="#d97706" stackId="a" />
                      <Bar dataKey="carb400G" name="C. 400G" fill="#64748b" stackId="a" />
                      <Bar dataKey="carb400B" name="C. 400B" fill="#92400e" stackId="a" />
                      <Bar dataKey="maquila" name="Maquila" fill="#a855f7" stackId="a" />
                      <Bar dataKey="despachado" name="Despacho" fill="#0ea5e9" barSize={12} />
                      <Bar dataKey="merma" name="Merma" fill="#ef4444" barSize={8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#141b2d] p-8 rounded-3xl border border-slate-800 shadow-2xl">
                <h3 className="text-[10px] font-bold mb-10 text-slate-500 uppercase tracking-widest flex items-center gap-3">
                  <Package size={16} className="text-blue-500" /> Insumos en Planta
                </h3>
                <div className="space-y-12">
                  <StockItem label="POL-25 (Sacos)" val={inventory.pol} max={5000} color="bg-blue-500" />
                  <StockItem label="PAP-25 (Sacos)" val={inventory.pap} max={5000} color="bg-emerald-500" />
                  <StockItem label="BIG-1000 (Tn)" val={inventory.big} max={5000} color="bg-orange-500" isWeight={true} />
                </div>
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="bg-[#141b2d]/50 border border-slate-800/80 rounded-2xl p-6 text-center text-slate-500">
          <Lock size={20} className="mx-auto mb-2 text-slate-600" />
          <p className="text-xs uppercase tracking-wider font-bold">Métricas y Gráficas Restringidas</p>
          <p className="text-[11px] mt-1 text-slate-600">Presiona "Acceso Gerencial" e ingresa la clave para desbloquear los paneles de análisis.</p>
        </div>
      )}

    </div>
  );
}

function TotalCard({ label, val, col }) {
  return (
    <div className="bg-[#141b2d] p-4 rounded-2xl border border-slate-800 text-center">
      <p className="text-[9px] text-slate-500 uppercase font-black mb-1">{label}</p>
      <p className={`text-xl font-black ${col}`}>{val.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
    </div>
  );
}

function StockItem({ label, val, max, color, isWeight = false }) {
  const pct = Math.min((val / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-3 font-mono">
        <span className="text-slate-400 font-bold uppercase tracking-wider">{label}</span>
        <span className="text-white font-black">{val.toLocaleString()} {isWeight ? 'Tn' : 'u.'}</span>
      </div>
      <div className="w-full bg-slate-900 h-2.5 rounded-full p-[1px] border border-slate-800/50">
        <div className={`${color} h-full rounded-full transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
}
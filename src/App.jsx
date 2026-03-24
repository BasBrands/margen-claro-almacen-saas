import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  Download,
  Plus,
  Trash2,
  Smartphone,
  Monitor,
  AlertTriangle,
  TrendingUp,
  Package,
  DollarSign,
  Search,
  Printer,
  Cloud,
  ShieldCheck,
  Wifi,
  WifiOff,
  LogOut,
  Building2,
  History,
  Users,
  UserCircle2,
  FolderOpen,
  AppWindowMac,
  CheckCircle2,
  Database,
} from 'lucide-react';
import { supabase, supabaseConfigured } from './lib/supabase';

const APP_STATE_KEY = 'mca-phase4-app-state';
const DEMO_DB_KEY = 'mca-phase4-demo-db';
const DEMO_SESSION_KEY = 'mca-phase4-demo-session';

const DEFAULT_PARAMS = {
  minAlertMargin: 0.15,
  defaultTargetMargin: 0.25,
  vat: 0.19,
  priceRounding: 10,
  okTolerance: 30,
  categoryMargins: {
    Abarrotes: 0.22,
    Bebidas: 0.18,
    'Lácteos': 0.2,
    Congelados: 0.22,
    'Panadería': 0.35,
    Snacks: 0.28,
    Limpieza: 0.25,
    'Cuidado personal': 0.28,
    Mascotas: 0.3,
    Botillería: 0.2,
    Otros: 0.25,
  },
};

const EMPTY_PRODUCT = {
  sku: '',
  category: 'Abarrotes',
  product: '',
  unit: '',
  supplier: '',
  purchaseCost: '',
  otherCosts: '',
  manualTargetMargin: '',
  currentPvp: '',
  unitsPerMonth: '',
};

const DEMO_DB = {
  companies: [{ id: 'demo-company', name: 'Margen Claro Almacén', plan: 'Pro', created_at: new Date().toISOString() }],
  users: [
    { id: 'demo-user-admin', company_id: 'demo-company', full_name: 'Juan Antonio', email: 'admin@mca.local', password: '1234', role: 'admin' },
    { id: 'demo-user-analyst', company_id: 'demo-company', full_name: 'Ejecutivo MCA', email: 'ejecutivo@mca.local', password: '1234', role: 'analyst' },
  ],
  clients: [{ id: 'demo-client', company_id: 'demo-company', name: 'Cliente Demo', segment: 'Almacén de barrio', owner_name: 'Juan Antonio', created_at: new Date().toISOString() }],
  analyses: [],
};

const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('es-CL', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value)
    .trim()
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercentMaybe(value) {
  const n = toNumber(value);
  if (n === null) return null;
  return n > 1 ? n / 100 : n;
}

function roundUpToMultiple(value, multiple) {
  if (!multiple || multiple <= 0) return Math.ceil(value || 0);
  return Math.ceil((value || 0) / multiple) * multiple;
}

function calculateProduct(product, params) {
  const purchaseCost = toNumber(product.purchaseCost);
  const otherCosts = toNumber(product.otherCosts) ?? 0;
  const currentPvp = toNumber(product.currentPvp);
  const unitsPerMonth = toNumber(product.unitsPerMonth);
  const manualTargetMargin = parsePercentMaybe(product.manualTargetMargin);
  const categoryTarget = params.categoryMargins[product.category] ?? params.defaultTargetMargin;
  const appliedMargin = manualTargetMargin ?? categoryTarget;

  const totalCost = purchaseCost === null && otherCosts === 0 ? null : (purchaseCost ?? 0) + otherCosts;
  const suggestedPvp = totalCost === null ? null : roundUpToMultiple(totalCost / (1 - appliedMargin), params.priceRounding);
  const pvpDiff = suggestedPvp !== null && currentPvp !== null ? suggestedPvp - currentPvp : null;
  const currentMargin = currentPvp !== null && totalCost !== null && currentPvp !== 0 ? (currentPvp - totalCost) / currentPvp : null;
  const currentProfitPerUnit = currentPvp !== null && totalCost !== null ? currentPvp - totalCost : null;
  const suggestedProfitPerUnit = suggestedPvp !== null && totalCost !== null ? suggestedPvp - totalCost : null;
  const currentSalesMonth = currentPvp !== null && unitsPerMonth !== null ? currentPvp * unitsPerMonth : null;
  const suggestedSalesMonth = suggestedPvp !== null && unitsPerMonth !== null ? suggestedPvp * unitsPerMonth : null;
  const currentProfitMonth = currentProfitPerUnit !== null && unitsPerMonth !== null ? currentProfitPerUnit * unitsPerMonth : null;
  const suggestedProfitMonth = suggestedProfitPerUnit !== null && unitsPerMonth !== null ? suggestedProfitPerUnit * unitsPerMonth : null;
  const profitGapMonth = currentProfitMonth !== null && suggestedProfitMonth !== null ? suggestedProfitMonth - currentProfitMonth : null;

  let priceStatus = '';
  if (product.product || currentPvp !== null || totalCost !== null) {
    if (currentPvp === null) priceStatus = 'SIN PVP';
    else if (pvpDiff !== null && Math.abs(pvpDiff) <= params.okTolerance) priceStatus = 'OK';
    else if (pvpDiff !== null && pvpDiff > 0) priceStatus = 'SUBIR';
    else if (pvpDiff !== null && pvpDiff < 0) priceStatus = 'REVISAR BAJA';
  }

  let marginAlert = '';
  if (product.product || currentPvp !== null || totalCost !== null) {
    if (currentMargin !== null) marginAlert = currentMargin < params.minAlertMargin ? 'BAJO' : 'OK';
  }

  return {
    ...product,
    totalCost,
    appliedMargin,
    suggestedPvp,
    pvpDiff,
    currentMargin,
    currentProfitPerUnit,
    suggestedProfitPerUnit,
    currentSalesMonth,
    suggestedSalesMonth,
    currentProfitMonth,
    suggestedProfitMonth,
    profitGapMonth,
    priceStatus,
    marginAlert,
  };
}

function buildSummary(products) {
  const validProducts = products.filter((p) => p.product || toNumber(p.currentPvp) !== null || toNumber(p.purchaseCost) !== null);
  const currentSales = validProducts.reduce((acc, p) => acc + (p.currentSalesMonth ?? 0), 0);
  const suggestedSales = validProducts.reduce((acc, p) => acc + (p.suggestedSalesMonth ?? 0), 0);
  const currentProfit = validProducts.reduce((acc, p) => acc + (p.currentProfitMonth ?? 0), 0);
  const suggestedProfit = validProducts.reduce((acc, p) => acc + (p.suggestedProfitMonth ?? 0), 0);

  return {
    productsLoaded: validProducts.length,
    productsWithCurrentPvp: validProducts.filter((p) => toNumber(p.currentPvp) !== null && toNumber(p.currentPvp) > 0).length,
    productsLowMargin: validProducts.filter((p) => p.marginAlert === 'BAJO').length,
    avgCurrentMargin: currentSales > 0 ? currentProfit / currentSales : 0,
    avgSuggestedMargin: suggestedSales > 0 ? suggestedProfit / suggestedSales : 0,
    currentProfitMonth: currentProfit,
    suggestedProfitMonth: suggestedProfit,
    profitGapMonth: suggestedProfit - currentProfit,
  };
}

function groupByCategory(products) {
  const map = new Map();
  for (const p of products) {
    if (!p.category) continue;
    if (!map.has(p.category)) {
      map.set(p.category, { category: p.category, products: 0, currentSales: 0, currentProfit: 0, suggestedSales: 0, suggestedProfit: 0, gap: 0 });
    }
    const row = map.get(p.category);
    row.products += p.product || toNumber(p.currentPvp) !== null || toNumber(p.purchaseCost) !== null ? 1 : 0;
    row.currentSales += p.currentSalesMonth ?? 0;
    row.currentProfit += p.currentProfitMonth ?? 0;
    row.suggestedSales += p.suggestedSalesMonth ?? 0;
    row.suggestedProfit += p.suggestedProfitMonth ?? 0;
    row.gap += p.profitGapMonth ?? 0;
  }
  return Array.from(map.values()).map((row) => ({
    ...row,
    currentMargin: row.currentSales > 0 ? row.currentProfit / row.currentSales : 0,
    suggestedMargin: row.suggestedSales > 0 ? row.suggestedProfit / row.suggestedSales : 0,
  }));
}

function getOpportunities(products) {
  return [...products]
    .filter((p) => (p.profitGapMonth ?? 0) > 0 && (p.product || p.sku))
    .sort((a, b) => (b.profitGapMonth ?? 0) - (a.profitGapMonth ?? 0))
    .slice(0, 10);
}

function parseWorkbook(workbook) {
  const params = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
  const paramSheet = workbook.Sheets.Parametros;
  const productSheet = workbook.Sheets.Carga_Productos;
  const products = [];

  if (paramSheet) {
    const rows = XLSX.utils.sheet_to_json(paramSheet, { header: 1, defval: '' });
    params.minAlertMargin = parsePercentMaybe(rows?.[3]?.[1]) ?? params.minAlertMargin;
    params.defaultTargetMargin = parsePercentMaybe(rows?.[4]?.[1]) ?? params.defaultTargetMargin;
    params.vat = parsePercentMaybe(rows?.[5]?.[1]) ?? params.vat;
    params.priceRounding = toNumber(rows?.[6]?.[1]) ?? params.priceRounding;
    params.okTolerance = toNumber(rows?.[7]?.[1]) ?? params.okTolerance;

    const nextCategoryMargins = { ...params.categoryMargins };
    for (let i = 9; i < rows.length; i += 1) {
      const category = rows[i]?.[0];
      const margin = parsePercentMaybe(rows[i]?.[1]);
      if (category) nextCategoryMargins[category] = margin ?? params.defaultTargetMargin;
    }
    params.categoryMargins = nextCategoryMargins;
  }

  if (productSheet) {
    const rows = XLSX.utils.sheet_to_json(productSheet, { header: 1, defval: '' });
    for (let i = 1; i < rows.length; i += 1) {
      const r = rows[i];
      const hasContent = r.slice(0, 12).some((cell) => cell !== '' && cell !== null && cell !== undefined);
      if (!hasContent) continue;
      products.push({
        sku: r[0] ?? '',
        category: r[1] || 'Abarrotes',
        product: r[2] ?? '',
        unit: r[3] ?? '',
        supplier: r[4] ?? '',
        purchaseCost: r[5] ?? '',
        otherCosts: r[6] ?? '',
        manualTargetMargin: r[8] ?? '',
        currentPvp: r[10] ?? '',
        unitsPerMonth: r[11] ?? '',
      });
    }
  }

  return { params, products: products.length ? products : [{ ...EMPTY_PRODUCT }] };
}

function exportWorkbook(params, calculatedProducts) {
  const wb = XLSX.utils.book_new();
  const summary = buildSummary(calculatedProducts);

  const paramsRows = [
    ['PARAMETROS EDITABLES'],
    [],
    ['Parámetro', 'Valor'],
    ['Margen mínimo de alerta', params.minAlertMargin],
    ['Margen objetivo por defecto', params.defaultTargetMargin],
    ['IVA referencial', params.vat],
    ['Redondeo PVP (múltiplo $)', params.priceRounding],
    ['Tolerancia para estado OK ($)', params.okTolerance],
    ['Margen objetivo por categoría', 'Margen'],
    ...Object.entries(params.categoryMargins).map(([category, margin]) => [category, margin]),
  ];

  const productRows = [
    ['SKU', 'Categoría', 'Producto', 'Formato', 'Proveedor', 'Costo compra', 'Otros costos', 'Costo total', 'Margen manual', 'Margen aplicado', 'PVP actual', 'Unid/mes', 'PVP sugerido', 'Brecha / mes', 'Estado', 'Alerta'],
    ...calculatedProducts.map((p) => [
      p.sku,
      p.category,
      p.product,
      p.unit,
      p.supplier,
      toNumber(p.purchaseCost),
      toNumber(p.otherCosts),
      p.totalCost,
      p.manualTargetMargin,
      p.appliedMargin,
      toNumber(p.currentPvp),
      toNumber(p.unitsPerMonth),
      p.suggestedPvp,
      p.profitGapMonth,
      p.priceStatus,
      p.marginAlert,
    ]),
  ];

  const summaryRows = [
    ['RESUMEN EJECUTIVO'],
    [],
    ['Indicador', 'Valor'],
    ['Productos cargados', summary.productsLoaded],
    ['Productos con PVP actual', summary.productsWithCurrentPvp],
    ['Margen promedio actual', summary.avgCurrentMargin],
    ['Margen promedio sugerido', summary.avgSuggestedMargin],
    ['Brecha utilidad mensual', summary.profitGapMonth],
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(paramsRows), 'Parametros');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(productRows), 'Carga_Productos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Resumen');
  XLSX.writeFile(wb, 'Sistema_MCA_SaaS_Fase4_Export.xlsx');
}

function openPrintReport({ companyName, clientName, summary, opportunities }) {
  const html = `
    <html>
      <head>
        <title>Reporte MCA</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
          h1, h2 { margin: 0 0 12px 0; }
          .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
          th { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>${companyName} · Reporte Ejecutivo</h1>
        <p>Cliente: ${clientName || 'Sin cliente'}</p>
        <div class="card"><strong>Productos:</strong> ${summary.productsLoaded}</div>
        <div class="card"><strong>Margen actual:</strong> ${percent.format(summary.avgCurrentMargin || 0)}</div>
        <div class="card"><strong>Margen sugerido:</strong> ${percent.format(summary.avgSuggestedMargin || 0)}</div>
        <div class="card"><strong>Brecha mensual:</strong> ${money.format(summary.profitGapMonth || 0)}</div>
        <h2>Top oportunidades</h2>
        <table>
          <thead><tr><th>Producto</th><th>PVP actual</th><th>PVP sugerido</th><th>Brecha</th></tr></thead>
          <tbody>
            ${opportunities.map((row) => `
              <tr>
                <td>${row.product || '-'}</td>
                <td>${money.format(toNumber(row.currentPvp) || 0)}</td>
                <td>${money.format(row.suggestedPvp || 0)}</td>
                <td>${money.format(row.profitGapMonth || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const w = window.open('', '_blank', 'width=1200,height=900');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

function KpiCard({ title, value, subtitle, icon: Icon, warning = false }) {
  return (
    <div className={`kpi-card${warning ? ' warning' : ''}`}>
      <div>
        <div className="kpi-label">{title}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-subtitle">{subtitle}</div>
      </div>
      <div className="kpi-icon"><Icon size={18} /></div>
    </div>
  );
}

function LoginView({ backendMode, onSubmit }) {
  const [email, setEmail] = useState(backendMode === 'demo' ? 'admin@mca.local' : '');
  const [password, setPassword] = useState(backendMode === 'demo' ? '1234' : '');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const result = await onSubmit(email, password);
    if (!result.ok) setError(result.message || 'No se pudo iniciar sesión.');
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-hero">
          <img src="/logo-mca-v2.png" alt="Margen Claro Almacén" className="login-logo" />
          <div>
            <div className="login-kicker">Margen Claro Almacén</div>
            <h1>Sistema MCA · SaaS Operativo</h1>
            <p>Acceso seguro a clientes, análisis, historial y gestión comercial en la nube con Supabase.</p>
          </div>
          <div className="hero-badges">
            <span className="mini-badge"><Users size={14} /> Usuarios</span>
            <span className="mini-badge"><Building2 size={14} /> Clientes</span>
            <span className="mini-badge"><History size={14} /> Historial</span>
            <span className="mini-badge"><Database size={14} /> {backendMode === 'supabase' ? 'Supabase' : 'Demo local'}</span>
          </div>
        </div>
        <div className="login-panel">
          <div className="status-title">Iniciar sesión</div>
          <div className="login-note">
            {backendMode === 'supabase'
              ? 'Modo real activo. Usa un usuario creado en Supabase Auth y con perfil asociado.'
              : 'Modo demo activo. Flujo SaaS validable sin backend externo.'}
          </div>
          <label className="field-label">Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="field-label">Contraseña</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <div className="error-box">{error}</div> : null}
          <button className="btn btn-primary full" onClick={handleSubmit}>Entrar al panel</button>
          {backendMode === 'demo' ? (
            <div className="info-box">
              <strong>Demo:</strong> admin@mca.local / 1234
            </div>
          ) : (
            <div className="info-box">
              Accede con tu usuario autorizado para gestionar clientes, análisis y reportes en la nube.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const backendMode = supabaseConfigured ? 'supabase' : 'demo';
  const fileRef = useRef(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [session, setSession] = useState(null);
  const [workspace, setWorkspace] = useState({ company: null, user: null, clients: [], analyses: [] });
  const [demoDb, setDemoDb] = useState(DEMO_DB);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [products, setProducts] = useState([{ ...EMPTY_PRODUCT }]);
  const [clientId, setClientId] = useState('');
  const [analysisName, setAnalysisName] = useState('Análisis General MCA');
  const [newClientName, setNewClientName] = useState('');
  const [message, setMessage] = useState('Base SaaS cargada.');
  const [saveNotice, setSaveNotice] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('productos');

  useEffect(() => {
    try {
      const savedApp = localStorage.getItem(APP_STATE_KEY);
      if (savedApp) {
        const parsed = JSON.parse(savedApp);
        if (parsed.params) setParams(parsed.params);
        if (parsed.products?.length) setProducts(parsed.products);
        if (parsed.clientId) setClientId(parsed.clientId);
        if (parsed.analysisName) setAnalysisName(parsed.analysisName);
      }
      if (backendMode === 'demo') {
        const savedDb = localStorage.getItem(DEMO_DB_KEY);
        const savedSession = localStorage.getItem(DEMO_SESSION_KEY);
        if (savedDb) setDemoDb(JSON.parse(savedDb));
        if (savedSession) setSession(JSON.parse(savedSession));
      }
    } catch {}
  }, [backendMode]);

  useEffect(() => {
    localStorage.setItem(APP_STATE_KEY, JSON.stringify({ params, products, clientId, analysisName }));
  }, [params, products, clientId, analysisName]);

  useEffect(() => {
    if (backendMode === 'demo') localStorage.setItem(DEMO_DB_KEY, JSON.stringify(demoDb));
  }, [backendMode, demoDb]);

  useEffect(() => {
    if (backendMode === 'demo') {
      if (session) localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(DEMO_SESSION_KEY);
    }
  }, [backendMode, session]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (backendMode === 'supabase' && supabase) {
      supabase.auth.getSession().then(async ({ data }) => {
        if (data.session?.user) {
          await hydrateWorkspaceFromSupabase(data.session.user);
        }
      });
      const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        if (nextSession?.user) await hydrateWorkspaceFromSupabase(nextSession.user);
        else {
          setSession(null);
          setWorkspace({ company: null, user: null, clients: [], analyses: [] });
        }
      });
      return () => listener.subscription.unsubscribe();
    }
    return undefined;
  }, [backendMode]);

  useEffect(() => {
    if (backendMode === 'demo' && session) {
      const user = demoDb.users.find((item) => item.id === session.userId) || null;
      const company = demoDb.companies.find((item) => item.id === user?.company_id) || null;
      const clients = demoDb.clients.filter((item) => item.company_id === company?.id);
      const analyses = demoDb.analyses.filter((item) => item.company_id === company?.id).sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));
      setWorkspace({ user, company, clients, analyses });
      if (!clientId && clients[0]) setClientId(clients[0].id);
    }
    if (backendMode === 'demo' && !session) {
      setWorkspace({ company: null, user: null, clients: [], analyses: [] });
    }
  }, [backendMode, demoDb, session, clientId]);

  const selectedClient = useMemo(() => workspace.clients.find((item) => item.id === clientId) || workspace.clients[0] || null, [workspace.clients, clientId]);
  const calculatedProducts = useMemo(() => products.map((p) => calculateProduct(p, params)), [products, params]);
  const summary = useMemo(() => buildSummary(calculatedProducts), [calculatedProducts]);
  const categorySummary = useMemo(() => groupByCategory(calculatedProducts).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0)), [calculatedProducts]);
  const opportunities = useMemo(() => getOpportunities(calculatedProducts), [calculatedProducts]);
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return calculatedProducts;
    return calculatedProducts.filter((p) => [p.sku, p.category, p.product, p.unit, p.supplier, p.priceStatus, p.marginAlert].join(' ').toLowerCase().includes(q));
  }, [calculatedProducts, search]);

  const categoryOptions = useMemo(() => Object.keys(params.categoryMargins), [params]);

  async function hydrateWorkspaceFromSupabase(user) {
    try {
      const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        setSession(null);
        setWorkspace({ company: null, user: null, clients: [], analyses: [] });
        setMessage('Existe usuario Auth, pero falta fila en profiles. Revisa supabase/schema.sql.');
        return;
      }
      const { data: company, error: companyError } = await supabase.from('companies').select('*').eq('id', profile.company_id).single();
      if (companyError) throw companyError;
      const { data: clients, error: clientsError } = await supabase.from('clients').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: false });
      if (clientsError) throw clientsError;
      const { data: analyses, error: analysesError } = await supabase.from('analyses').select('*').eq('company_id', profile.company_id).order('saved_at', { ascending: false });
      if (analysesError) throw analysesError;
      setSession({ userId: user.id, companyId: profile.company_id, backendMode: 'supabase' });
      setWorkspace({ user: { id: user.id, full_name: profile.full_name || user.email, email: user.email, role: profile.role }, company, clients: clients || [], analyses: analyses || [] });
      if (!clientId && clients?.[0]) setClientId(clients[0].id);
    } catch (error) {
      setMessage(error.message || 'No se pudo hidratar la cuenta desde Supabase.');
    }
  }

  async function handleLogin(email, password) {
    if (backendMode === 'demo') {
      const user = demoDb.users.find((item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password);
      if (!user) return { ok: false, message: 'Credenciales incorrectas. Usa admin@mca.local / 1234.' };
      setSession({ userId: user.id, companyId: user.company_id, backendMode: 'demo' });
      setMessage(`Sesión iniciada como ${user.full_name}.`);
      return { ok: true };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) await hydrateWorkspaceFromSupabase(data.user);
      setMessage('Sesión iniciada correctamente.');
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message || 'No se pudo iniciar sesión.' };
    }
  }

  async function handleLogout() {
  try {
    if (backendMode === 'supabase' && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
  } catch (error) {
    console.error('LOGOUT_ERROR', error);
  } finally {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-') || key.toLowerCase().includes('supabase')) {
          localStorage.removeItem(key);
        }
      });

      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('sb-') || key.toLowerCase().includes('supabase')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {}

    localStorage.removeItem(APP_STATE_KEY);
    localStorage.removeItem(DEMO_SESSION_KEY);

    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    setSession(null);
    setWorkspace({ company: null, user: null, clients: [], analyses: [] });
    setClientId('');
    setAnalysisName('Análisis General MCA');
    setProducts([{ ...EMPTY_PRODUCT }]);
    setParams(DEFAULT_PARAMS);
    setMessage('Sesión cerrada.');
  }
}
 
async function handleCreateClient() {
  const clean = newClientName.trim();
  if (!clean) return;

  if (backendMode === 'demo') {
    const record = {
      id: `client-${Date.now()}`,
      company_id: workspace.company.id,
      name: clean,
      segment: 'Cliente creado en app',
      owner_name: workspace.user?.full_name || '',
      created_at: new Date().toISOString(),
    };
    setDemoDb((prev) => ({ ...prev, clients: [record, ...prev.clients] }));
    setClientId(record.id);
    setNewClientName('');
    setMessage(`Cliente creado: ${clean}.`);
    return;
  }

  try {
    const payload = {
      company_id: workspace.company.id,
      name: clean,
      segment: 'Cliente creado en app',
      owner_name: workspace.user?.full_name || '',
    };

    

    const { data, error } = await supabase
      .from('clients')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    

    await hydrateWorkspaceFromSupabase({
      id: session.userId,
      email: workspace.user?.email,
    });

    setClientId(data.id);
    setNewClientName('');
    setMessage(`Cliente creado: ${clean}.`);
  } catch (error) {
    console.error('CLIENT_INSERT_ERROR', error);
    setMessage(error.message || 'No se pudo crear el cliente.');
  }
}
  async function handleSaveAnalysis() {
  if (!selectedClient) {
    setMessage('Crea o selecciona un cliente antes de guardar.');
    return;
  }

  const record = {
    company_id: workspace.company.id,
    client_id: selectedClient.id,
    client_name: selectedClient.name,
    analysis_name: analysisName,
    params_json: params,
    products_json: products,
    summary_json: summary,
    saved_by: session?.userId || null,
  };

  if (backendMode === 'demo') {
    setDemoDb((prev) => ({
      ...prev,
      analyses: [
        {
          id: `analysis-${Date.now()}`,
          ...record,
          saved_at: new Date().toISOString(),
        },
        ...prev.analyses,
      ],
    }));
    setSaveNotice('Guardado correctamente en la nube.');
setTimeout(() => setSaveNotice(''), 3000);
    return;
  }

  try {
    

    const { data, error } = await supabase
      .from('analyses')
      .insert([record])
      .select()
      .single();

    if (error) throw error;

    

    await hydrateWorkspaceFromSupabase({
      id: session.userId,
      email: workspace.user?.email,
    });

    setSaveNotice('Guardado correctamente en la nube.');
setTimeout(() => setSaveNotice(''), 3000);
  } catch (error) {
    console.error('ANALYSIS_INSERT_ERROR', error);
    setMessage(error.message || 'No se pudo guardar el análisis.');
  }
}

     function handleLoadAnalysis(record) {
    setClientId(record.client_id || '');
    setAnalysisName(record.analysis_name || 'Análisis');
    setParams(record.params_json || DEFAULT_PARAMS);
    setProducts(record.products_json?.length ? record.products_json : [{ ...EMPTY_PRODUCT }]);
    setActiveTab('productos');
    setMessage(`Historial cargado: ${record.analysis_name}.`);
  }

  function updateProduct(index, key, value) {
    setProducts((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function addRow() {
    setProducts((prev) => [...prev, { ...EMPTY_PRODUCT, category: categoryOptions[0] || 'Abarrotes' }]);
  }

  function deleteRow(index) {
    setProducts((prev) => (prev.length === 1 ? [{ ...EMPTY_PRODUCT }] : prev.filter((_, i) => i !== index)));
  }

  function updateParam(key, value) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  function updateCategoryMargin(category, value) {
    setParams((prev) => ({ ...prev, categoryMargins: { ...prev.categoryMargins, [category]: value } }));
  }

  async function onUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const parsed = parseWorkbook(workbook);
    setParams(parsed.params);
    setProducts(parsed.products);
    setMessage(`Excel cargado correctamente: ${file.name}.`);
  }

  async function installApp() {
    if (!installPrompt) {
      setMessage('La instalación depende del navegador. En esta sesión puede no estar disponible.');
      return;
    }
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  if (!session) {
    return <LoginView backendMode={backendMode} onSubmit={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <div className="container">
        <div className="hero-grid">
          <section className="hero-card">
            <img className="hero-logo" src="/logo-mca-v2.png" alt="Margen Claro Almacén" />
            <div className="hero-copy">
              <div className="hero-badges">
                <span className="mini-badge"><Smartphone size={13} /> Móvil</span>
                <span className="mini-badge"><Monitor size={13} /> Escritorio</span>
                <span className="mini-badge"><ShieldCheck size={13} /> SaaS Operativo</span>
                <span className="mini-badge"><AppWindowMac size={13} /> PWA</span>
                <span className="mini-badge">{online ? <><Wifi size={13} /> En línea</> : <><WifiOff size={13} /> Offline</>}</span>
              </div>
              <h1>Sistema MCA · SaaS Operativo</h1>
              <p>
                Fase 4 realista: Login, clientes, historial, guardado centralizado y conexión opcional a Supabase.
                Además, ajusté el logo usando una versión recortada y más ancha para que se vea realmente como marca principal.
              </p>
              <div className="login-form-row">
                <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  {workspace.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
                <input className="input" value={analysisName} onChange={(e) => setAnalysisName(e.target.value)} placeholder="Nombre del análisis" />
              </div>
              <div className="status-actions">
                <button className="btn btn-light" onClick={() => fileRef.current?.click()}><Upload size={16} /> Cargar Excel</button>
                <button
  className="btn btn-outline-light"
  onClick={handleSaveAnalysis}
>
  <Cloud size={16} /> Guardar en nube
</button>
                <button className="btn btn-outline-light" onClick={installApp}><CheckCircle2 size={16} /> Instalar</button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={onUpload} />
              </div>
            </div>
          </section>

          <aside className="status-card">
            <div className="status-title">Cuenta y Empresa</div>
            <div className="account-box">
              <div className="account-row">
                <div className="account-pill"><Building2 size={16} /> {workspace.company?.name || 'Sin empresa'}</div>
                <div className="account-pill secondary">{backendMode === 'supabase' ? 'Supabase real' : 'Demo local'}</div>
              </div>
              <div className="account-user">
                <UserCircle2 size={28} />
                <div>
                  <div className="saved-title">{workspace.user?.full_name || 'Usuario'}</div>
                  <div className="saved-meta">{workspace.user?.email}</div>
                </div>
              </div>
            </div>
            {message ? (
  <div
    className={`status-message-box ${
      message.toLowerCase().includes('no se pudo') || message.toLowerCase().includes('error')
        ? 'error'
        : 'success'
    }`}
  >
    {message.toLowerCase().includes('no se pudo') || message.toLowerCase().includes('error') ? (
      <AlertTriangle size={16} />
    ) : (
      <CheckCircle2 size={16} />
    )}
    <span>{message}</span>
  </div>
) : null}
            {saveNotice ? (
  <div className="status-message-box success">
    <CheckCircle2 size={16} />
    <span>{saveNotice}</span>
  </div>
) : null}
            <div className="top-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => exportWorkbook(params, calculatedProducts)}><Download size={16} /> Exportar Excel</button>
              <button className="btn btn-secondary" onClick={() => openPrintReport({ companyName: workspace.company?.name || 'MCA', clientName: selectedClient?.name, summary, opportunities })}><Printer size={16} /> Reporte PDF</button>
              <button className="btn btn-secondary" onClick={handleLogout}><LogOut size={16} /> Cerrar sesión</button>
            </div>
            <div className="status-list">
              <div>1. Crea clientes para separar análisis.</div>
              <div>2. Guarda en nube demo o en Supabase.</div>
              <div>3. Reabre historial por cliente.</div>
              <div>4. Usa PWA para escritorio o celular.</div>
            </div>
          </aside>
        </div>

        <div className="kpi-grid">
          <KpiCard title="Productos cargados" value={summary.productsLoaded} subtitle="Base activa del análisis" icon={Package} />
          <KpiCard title="Margen promedio actual" value={percent.format(summary.avgCurrentMargin || 0)} subtitle="Rentabilidad real hoy" icon={TrendingUp} />
          <KpiCard title="Margen promedio sugerido" value={percent.format(summary.avgSuggestedMargin || 0)} subtitle="Con precio recomendado" icon={DollarSign} />
          <KpiCard title="Brecha utilidad mensual" value={money.format(summary.profitGapMonth || 0)} subtitle="Dinero no capturado" icon={AlertTriangle} warning />
        </div>

        <div className="two-col-grid">
          <section className="panel">
            <div className="panel-header"><FolderOpen size={20} /> Clientes e historial</div>
            <div className="panel-body">
              <div className="saved-actions">
                <input className="input" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Nuevo cliente" />
                <button className="btn btn-primary" onClick={handleCreateClient}>Crear</button>
              </div>
              <div className="client-box">
                <div className="saved-title">Cliente seleccionado: {selectedClient?.name || 'Sin cliente'}</div>
                <div className="saved-meta">{selectedClient?.segment || 'Sin segmento'}</div>
              </div>
              <div className="list-stack">
                {workspace.analyses.length === 0 ? (
                  <div className="empty-note">Todavía no guardas análisis centralizados.</div>
                ) : (
                  workspace.analyses.map((item) => (
                    <div className="saved-item" key={item.id}>
                      <div>
                        <div className="saved-title">{item.analysis_name}</div>
                        <div className="saved-meta">Cliente: {item.client_name || 'Sin cliente'}</div>
                        <div className="saved-meta">{new Date(item.saved_at).toLocaleString('es-CL')}</div>
                        <div className="saved-meta">Brecha: {money.format(item.summary_json?.profitGapMonth || item.summary_json?.profit_gap_month || 0)}</div>
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleLoadAnalysis(item)}>Abrir</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header"><History size={20} /> Top oportunidades de captura</div>
            <div className="panel-body list-stack">
              {opportunities.length === 0 ? (
                <div className="empty-note">Todavía no hay datos suficientes para detectar oportunidades claras.</div>
              ) : (
                opportunities.map((row, idx) => (
                  <div className="opportunity-item" key={`${row.sku}-${idx}`}>
                    <div>
                      <div className="saved-title">{row.product || 'Producto'}</div>
                      <div className="saved-meta">SKU: {row.sku || '-'} · Estado: {row.priceStatus || '-'}</div>
                    </div>
                    <div className="opportunity-right">
                      <div className="saved-title">{money.format(row.profitGapMonth || 0)}</div>
                      <div className="saved-meta">Actual {money.format(toNumber(row.currentPvp) || 0)} → sugerido {money.format(row.suggestedPvp || 0)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="tabs">
          <button className={`tab ${activeTab === 'productos' ? 'active' : ''}`} onClick={() => setActiveTab('productos')}>Productos</button>
          <button className={`tab ${activeTab === 'resumen' ? 'active' : ''}`} onClick={() => setActiveTab('resumen')}>Resumen</button>
          <button className={`tab ${activeTab === 'parametros' ? 'active' : ''}`} onClick={() => setActiveTab('parametros')}>Parámetros</button>
        </div>

        {activeTab === 'productos' && (
          <section className="panel">
            <div className="panel-toolbar">
              <div className="panel-title">Carga de productos</div>
              <div className="toolbar-actions">
                <div className="search-wrap">
                  <Search size={16} color="#64748b" />
                  <input className="input search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto, proveedor o estado" />
                </div>
                <button className="btn btn-primary" onClick={addRow}><Plus size={16} /> Agregar fila</button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Categoría</th>
                    <th>Producto</th>
                    <th>Formato</th>
                    <th>Proveedor</th>
                    <th>Costo</th>
                    <th>Otros</th>
                    <th>Margen manual</th>
                    <th>PVP actual</th>
                    <th>Unid/mes</th>
                    <th>PVP sugerido</th>
                    <th>Brecha/mes</th>
                    <th>Estado</th>
                    <th>Alerta</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, index) => (
                    <tr key={index}>
                      <td><input className="input small" value={p.sku} onChange={(e) => updateProduct(index, 'sku', e.target.value)} /></td>
                      <td>
                        <select className="input small" value={p.category} onChange={(e) => updateProduct(index, 'category', e.target.value)}>
                          {categoryOptions.map((option) => <option key={option}>{option}</option>)}
                        </select>
                      </td>
                      <td><input className="input small wide" value={p.product} onChange={(e) => updateProduct(index, 'product', e.target.value)} /></td>
                      <td><input className="input small" value={p.unit} onChange={(e) => updateProduct(index, 'unit', e.target.value)} /></td>
                      <td><input className="input small" value={p.supplier} onChange={(e) => updateProduct(index, 'supplier', e.target.value)} /></td>
                      <td><input className="input small" value={p.purchaseCost} onChange={(e) => updateProduct(index, 'purchaseCost', e.target.value)} /></td>
                      <td><input className="input small" value={p.otherCosts} onChange={(e) => updateProduct(index, 'otherCosts', e.target.value)} /></td>
                      <td><input className="input small" value={p.manualTargetMargin} onChange={(e) => updateProduct(index, 'manualTargetMargin', e.target.value)} /></td>
                      <td><input className="input small" value={p.currentPvp} onChange={(e) => updateProduct(index, 'currentPvp', e.target.value)} /></td>
                      <td><input className="input small" value={p.unitsPerMonth} onChange={(e) => updateProduct(index, 'unitsPerMonth', e.target.value)} /></td>
                      <td className="strong">{p.suggestedPvp !== null ? money.format(p.suggestedPvp) : '-'}</td>
                      <td className="strong">{p.profitGapMonth !== null ? money.format(p.profitGapMonth) : '-'}</td>
                      <td><span className={`badge ${p.priceStatus === 'SUBIR' ? 'danger' : p.priceStatus ? 'neutral' : 'neutral'}`}>{p.priceStatus || '-'}</span></td>
                      <td><span className={`badge ${p.marginAlert === 'BAJO' ? 'danger' : p.marginAlert ? 'success' : 'neutral'}`}>{p.marginAlert || '-'}</span></td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => deleteRow(index)}><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-cards">
              {filteredProducts.map((p, index) => (
                <div className="mobile-card" key={index}>
                  <div className="mobile-grid">
                    <div><label>SKU</label><input className="input" value={p.sku} onChange={(e) => updateProduct(index, 'sku', e.target.value)} /></div>
                    <div>
                      <label>Categoría</label>
                      <select className="input" value={p.category} onChange={(e) => updateProduct(index, 'category', e.target.value)}>
                        {categoryOptions.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </div>
                    <div className="span-2"><label>Producto</label><input className="input" value={p.product} onChange={(e) => updateProduct(index, 'product', e.target.value)} /></div>
                    <div><label>Costo</label><input className="input" value={p.purchaseCost} onChange={(e) => updateProduct(index, 'purchaseCost', e.target.value)} /></div>
                    <div><label>PVP actual</label><input className="input" value={p.currentPvp} onChange={(e) => updateProduct(index, 'currentPvp', e.target.value)} /></div>
                  </div>
                  <div className="mobile-meta-grid">
                    <div><span>PVP sugerido</span><strong>{p.suggestedPvp !== null ? money.format(p.suggestedPvp) : '-'}</strong></div>
                    <div><span>Brecha / mes</span><strong>{p.profitGapMonth !== null ? money.format(p.profitGapMonth) : '-'}</strong></div>
                    <div><span>Estado</span><span className={`badge ${p.priceStatus === 'SUBIR' ? 'danger' : 'neutral'}`}>{p.priceStatus || '-'}</span></div>
                    <div><span>Alerta</span><span className={`badge ${p.marginAlert === 'BAJO' ? 'danger' : 'success'}`}>{p.marginAlert || '-'}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'resumen' && (
          <div className="summary-grid">
            <section className="panel">
              <div className="panel-header">Resumen ejecutivo</div>
              <div className="panel-body summary-list">
                <div><span>Productos con PVP actual</span><strong>{summary.productsWithCurrentPvp}</strong></div>
                <div><span>Productos con margen bajo</span><strong>{summary.productsLowMargin}</strong></div>
                <div><span>Utilidad mensual actual</span><strong>{money.format(summary.currentProfitMonth || 0)}</strong></div>
                <div><span>Utilidad mensual sugerida</span><strong>{money.format(summary.suggestedProfitMonth || 0)}</strong></div>
                <div><span>Brecha mensual capturable</span><strong>{money.format(summary.profitGapMonth || 0)}</strong></div>
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">Brecha por categoría</div>
              <div className="panel-body">
                <div className="list-stack">
                  {categorySummary.map((row) => {
                    const maxGap = Math.max(...categorySummary.map((x) => x.gap), 1);
                    const width = `${Math.max(((row.gap || 0) / maxGap) * 100, 3)}%`;
                    return (
                      <div key={row.category}>
                        <div className="category-top">
                          <div>
                            <div className="saved-title">{row.category}</div>
                            <div className="saved-meta">{row.products} productos · Margen actual {percent.format(row.currentMargin || 0)}</div>
                          </div>
                          <strong>{money.format(row.gap || 0)}</strong>
                        </div>
                        <div className="progress-bar"><div className="progress-fill" style={{ width }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'parametros' && (
          <section className="panel">
            <div className="panel-header">Parámetros del sistema</div>
            <div className="panel-body">
              <div className="params-grid">
                <div>
                  <label className="field-label">Margen mínimo alerta</label>
                  <input className="input" value={params.minAlertMargin} onChange={(e) => updateParam('minAlertMargin', parsePercentMaybe(e.target.value) ?? '')} />
                </div>
                <div>
                  <label className="field-label">Margen objetivo por defecto</label>
                  <input className="input" value={params.defaultTargetMargin} onChange={(e) => updateParam('defaultTargetMargin', parsePercentMaybe(e.target.value) ?? '')} />
                </div>
                <div>
                  <label className="field-label">IVA referencial</label>
                  <input className="input" value={params.vat} onChange={(e) => updateParam('vat', parsePercentMaybe(e.target.value) ?? '')} />
                </div>
                <div>
                  <label className="field-label">Redondeo PVP</label>
                  <input className="input" value={params.priceRounding} onChange={(e) => updateParam('priceRounding', toNumber(e.target.value) ?? '')} />
                </div>
                <div>
                  <label className="field-label">Tolerancia OK ($)</label>
                  <input className="input" value={params.okTolerance} onChange={(e) => updateParam('okTolerance', toNumber(e.target.value) ?? '')} />
                </div>
              </div>
              <div className="category-grid">
                {Object.entries(params.categoryMargins).map(([category, margin]) => (
                  <div className="category-card" key={category}>
                    <label>{category}</label>
                    <input className="input" value={margin} onChange={(e) => updateCategoryMargin(category, parsePercentMaybe(e.target.value) ?? '')} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

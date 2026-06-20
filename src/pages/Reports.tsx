import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Transaction, Category } from '../types';
import * as XLSX from 'xlsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  AlertTriangle, 
  DollarSign,
  Calendar,
  Layers,
  FileSpreadsheet,
  Printer,
  SlidersHorizontal,
  Search,
  Filter,
  ArrowUpDown,
  BookOpen,
  Info,
  CheckCircle,
  Clock
} from 'lucide-react';
import { format, startOfDay, subDays, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Reports() {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Advanced Configurations & Filters State
  const [timeRange, setTimeRange] = useState(30); // Days of historical transaction trace
  const [minTurnoverThreshold, setMinTurnoverThreshold] = useState(0.40); // ITR Alert threshold (Ratio of outflows to average stock)
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'itr-asc' | 'itr-desc' | 'val-desc' | 'val-asc'>('itr-asc');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const pSnapshot = await getDocs(collection(db, 'products'));
        setProducts(pSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        
        const cSnapshot = await getDocs(collection(db, 'categories'));
        setCategories(cSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));

        const tSnapshot = await getDocs(collection(db, 'transactions'));
        setTransactions(tSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      } catch (err) {
        console.error("Error reading reporting data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 1. ADVANCED MATHEMATICAL CALCULATION FOR ROTATION RATES (ITR)
  // Formula based on ISO definitions of Inventory Turnover Index:
  // Q_out = Total Units dispatched in period
  // Q_in = Total Units entered in period
  // Stock_End = Current Physical stock
  // Stock_Start = Stock_End + Q_out - Q_in (restricted to >= 0)
  // Stock_Average = (Stock_Start + Stock_End) / 2
  // ITR = Q_out / Stock_Average (If Stock_Average is 0 but we had outflows, we clamp to Q_out, else 0)
  const productStats = useMemo(() => {
    const cutoffDate = subDays(new Date(), timeRange);
    
    // Filter transactions within the analysis window
    const periodTransactions = transactions.filter(t => {
      if (!t.timestamp) return false;
      const tDate = typeof t.timestamp.toDate === 'function' ? t.timestamp.toDate() : new Date(t.timestamp);
      return isAfter(tDate, cutoffDate);
    });

    const stats: Record<string, {
      qOut: number;
      qIn: number;
      sStart: number;
      sAve: number;
      itr: number;
      status: 'Inactivo' | 'Baja Rotación' | 'Óptima' | 'Sin Stock';
      riskLevel: 'Crítico' | 'Medio' | 'Insignificante' | 'Bajo';
      categoryName: string;
      riskDescription: string;
      recommendation: string;
    }> = {};

    products.forEach(p => {
      const pId = p.id;
      const pTxs = periodTransactions.filter(t => t.productId === pId);
      const catName = categories.find(c => c.id === p.categoryId)?.name || 'Sin Categoría';
      
      let qOut = 0;
      let qIn = 0;
      
      pTxs.forEach(t => {
        const qty = Number(t.quantity || 0);
        if (t.type === 'OUT') {
          qOut += qty;
        } else if (t.type === 'IN') {
          qIn += qty;
        }
      });

      const sEnd = Number(p.currentStock || 0);
      const sStart = Math.max(0, sEnd + qOut - qIn);
      const sAve = (sStart + sEnd) / 2;

      let itr = 0;
      if (sAve > 0) {
        itr = qOut / sAve; // Index for the selected period
      } else if (sAve === 0 && qOut > 0) {
        itr = qOut; // Proxy calculation in case stock was depleted
      }

      // Determine statuses strictly on emergency logistics and ISO preservation norms:
      let status: 'Inactivo' | 'Baja Rotación' | 'Óptima' | 'Sin Stock' = 'Óptima';
      let riskLevel: 'Crítico' | 'Medio' | 'Insignificante' | 'Bajo' = 'Insignificante';
      let riskDescription = 'Nivel de almacenamiento y rotación equilibrados.';
      let recommendation = 'Cadena de suministro estable. Mantener punto de pedido actual.';

      if (sEnd === 0) {
        status = 'Sin Stock';
        riskLevel = 'Bajo';
        riskDescription = 'Sin unidades físicas disponibles.';
        recommendation = 'Evaluar necesidad de reabastecimiento urgente.';
      } else if (qOut === 0) {
        status = 'Inactivo';
        riskLevel = 'Crítico';
        riskDescription = 'Capital de emergencia inmovilizado. Riesgo grave de obsolescencia o vencimiento.';
        recommendation = 'Paralizar reabastecimientos; evaluar transferencia de activos o ajuste estacional.';
      } else if (itr < minTurnoverThreshold) {
        status = 'Baja Rotación';
        riskLevel = 'Medio';
        riskDescription = 'Velocidad de despacho inferior al estándar logístico configurado.';
        recommendation = 'Reducir stock máximo para evitar vencimientos y sobredimensionamiento de bodega.';
      }

      stats[pId] = {
        qOut,
        qIn,
        sStart,
        sAve,
        itr,
        status,
        riskLevel,
        categoryName: catName,
        riskDescription,
        recommendation
      };
    });

    return stats;
  }, [products, transactions, timeRange, minTurnoverThreshold, categories]);

  // 2. AUDIT-GRADE COMPREHENSIVE OVERVIEW METRICS
  const globalMetrics = useMemo(() => {
    let totalValue = 0;
    let totalOutflows = 0;
    let totalAveStock = 0;
    let lowRotationPositiveStockCount = 0;
    let inactivePositiveStockCount = 0;
    let activeProductsWithStockCount = 0;

    products.forEach(p => {
      totalValue += (p.currentStock || 0) * (p.purchasePrice || 0);
      
      const stats = productStats[p.id];
      if (stats) {
        totalOutflows += stats.qOut;
        totalAveStock += stats.sAve;
        
        if (p.currentStock > 0) {
          activeProductsWithStockCount++;
          if (stats.status === 'Inactivo') {
            inactivePositiveStockCount++;
          } else if (stats.status === 'Baja Rotación') {
            lowRotationPositiveStockCount++;
          }
        }
      }
    });

    const avgITR = totalAveStock > 0 ? (totalOutflows / totalAveStock) : 0;
    
    // Efficiency rating representation (Percentage of active stocks turning over healthily)
    const efficiencyScore = activeProductsWithStockCount > 0 
      ? ((activeProductsWithStockCount - inactivePositiveStockCount - lowRotationPositiveStockCount) / activeProductsWithStockCount) * 100
      : 100;

    return {
      totalValue,
      totalOutflows,
      avgITR,
      lowRotationPositiveStockCount,
      inactivePositiveStockCount,
      criticalAlertCount: inactivePositiveStockCount + lowRotationPositiveStockCount,
      efficiencyScore
    };
  }, [products, productStats]);

  // 3. CATEGORY LEVEL TURNOVER METRICS (AGGREGATED ACCORDING TO ACADEMIC FORMULAS)
  const categoryStats = useMemo(() => {
    const catMap: Record<string, {
      id: string;
      name: string;
      totalValue: number;
      itemsCount: number;
      qOut: number;
      sAve: number;
      itr: number;
    }> = {};

    categories.forEach(c => {
      catMap[c.id] = {
        id: c.id,
        name: c.name,
        totalValue: 0,
        itemsCount: 0,
        qOut: 0,
        sAve: 0,
        itr: 0
      };
    });

    products.forEach(p => {
      const stats_p = productStats[p.id];
      const catId = p.categoryId || 'sin-categoria';
      
      if (!catMap[catId]) {
        catMap[catId] = {
          id: catId,
          name: 'Sin Categoría',
          totalValue: 0,
          itemsCount: 0,
          qOut: 0,
          sAve: 0,
          itr: 0
        };
      }

      const value = (p.currentStock || 0) * (p.purchasePrice || 0);
      catMap[catId].totalValue += value;
      catMap[catId].itemsCount += 1;
      if (stats_p) {
        catMap[catId].qOut += stats_p.qOut;
        catMap[catId].sAve += stats_p.sAve;
      }
    });

    // Compute Turnover Ratio for each category (ITR_cat = Outflow_cat / AveStock_cat)
    Object.keys(catMap).forEach(catId => {
      const catObj = catMap[catId];
      if (catObj.sAve > 0) {
        catObj.itr = catObj.qOut / catObj.sAve;
      } else {
        catObj.itr = 0;
      }
    });

    return Object.values(catMap);
  }, [categories, products, productStats]);

  // 4. TRANSACTION FLUX CHART DATA (LAST X DAYS)
  const transactionTrends = useMemo(() => {
    const days = Array.from({ length: 15 }, (_, i) => {
      const date = subDays(new Date(), 14 - i);
      return {
        date: format(date, 'dd MMM', { locale: es }),
        fullDate: startOfDay(date),
        Entradas: 0,
        Salidas: 0
      };
    });

    transactions.forEach(t => {
      if (!t.timestamp) return;
      const tDate = startOfDay(
        typeof t.timestamp.toDate === 'function' ? t.timestamp.toDate() : new Date(t.timestamp)
      );
      const dayData = days.find(d => d.fullDate.getTime() === tDate.getTime());
      if (dayData) {
        if (t.type === 'IN') dayData.Entradas += Number(t.quantity || 0);
        else if (t.type === 'OUT') dayData.Salidas += Number(t.quantity || 0);
      }
    });

    return days;
  }, [transactions]);

  // 5. INTUITIVE FILTERING AND SORTING FOR THE PRODUCT ANALYSIS DATAGRID
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const stats = productStats[p.id];
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const matchStatus = selectedStatus === 'all' || (stats && stats.status === selectedStatus);
      
      return matchSearch && matchCategory && matchStatus;
    }).sort((a, b) => {
      const statsA = productStats[a.id];
      const statsB = productStats[b.id];
      const valA = (a.currentStock || 0) * (a.purchasePrice || 0);
      const valB = (b.currentStock || 0) * (b.purchasePrice || 0);
      
      if (!statsA || !statsB) return 0;
      
      if (sortBy === 'itr-asc') return statsA.itr - statsB.itr;
      if (sortBy === 'itr-desc') return statsB.itr - statsA.itr;
      if (sortBy === 'val-desc') return valB - valA;
      if (sortBy === 'val-asc') return valA - valB;
      
      return 0;
    });
  }, [products, productStats, searchTerm, selectedCategory, selectedStatus, sortBy]);

  // 6. EXPORT CAPABILITY: EXCEL WORKING SHEETS GENERATION
  const exportXLSXReport = () => {
    if (products.length === 0) return;

    // Sheet 1: Individual Item Performance Data
    const itemData = products.map(p => {
      const stats = productStats[p.id] || { qOut: 0, qIn: 0, sAve: 0, itr: 0, status: 'N/A', riskLevel: 'Insignificante', riskDescription: '-', recommendation: '-' };
      const catName = categories.find(c => c.id === p.categoryId)?.name || 'Sin Categoría';
      return {
        'SKU': p.sku,
        'Artículo': p.name,
        'Categoría': catName,
        'Stock Físico Actual': p.currentStock,
        'Unidad': p.unit,
        'Precio de Compra ($)': p.purchasePrice,
        'Valorización Total Inventario ($)': p.currentStock * p.purchasePrice,
        'Unidades Despachadas (Salidas)': stats.qOut,
        'Unidades Ingresadas (Entradas)': stats.qIn,
        'Stock Promedio Periodo': stats.sAve,
        'Índice Rotación Stock (ITR)': Number(stats.itr.toFixed(2)),
        'Evaluación de Rotación': stats.status,
        'Severidad de Alerta': stats.riskLevel,
        'Riesgo Logístico': stats.riskDescription,
        'Acción Correctiva de Calidad': stats.recommendation
      };
    });

    // Sheet 2: Category Aggregated Metrics
    const catExcelData = categoryStats.map(c => ({
      'Categoría': c.name,
      'Cant. Artículos': c.itemsCount,
      'Valor Absoluto Inventario ($)': c.totalValue,
      'Unidades Egresadas Cat': c.qOut,
      'Stock Promedio Cat': c.sAve,
      'Índice Rotación Categoría (ITR_Cat)': Number(c.itr.toFixed(2)),
      'Clasificación Logística': c.itr === 0 ? 'Sin Demanda' : c.itr < minTurnoverThreshold ? 'Baja Tracción' : 'Flujo Óptimo'
    }));

    // Sheet 3: Corporate Summary Dashboard Metrics
    const auditSummary = [
      { 'Indicador de Control de Calidad': 'Costo Capital Total de Activos Inmovilizados', 'Valor': `$${globalMetrics.totalValue.toLocaleString()}` },
      { 'Indicador de Control de Calidad': 'Índice de Rotación Promedio General', 'Valor': `${globalMetrics.avgITR.toFixed(2)} ciclos` },
      { 'Indicador de Control de Calidad': 'Total Variedad SKU Evaluadas', 'Valor': products.length },
      { 'Indicador de Control de Calidad': 'Artículos Bajo Alerta Crítica (Detenidos)', 'Valor': globalMetrics.criticalAlertCount },
      { 'Indicador de Control de Calidad': 'Artículos Positivos Completamente Inactivos', 'Valor': globalMetrics.inactivePositiveStockCount },
      { 'Indicador de Control de Calidad': 'Artículos con Baja Rotación Desacelerada', 'Valor': globalMetrics.lowRotationPositiveStockCount },
      { 'Indicador de Control de Calidad': 'Índice de Eficiencia Operativa Global', 'Valor': `${globalMetrics.efficiencyScore.toFixed(1)}%` },
      { 'Indicador de Control de Calidad': 'Ventana Temporal de Análisis', 'Valor': `${timeRange} días` },
      { 'Indicador de Control de Calidad': 'Umbral de Tolerancia Alerta ITR', 'Valor': `${minTurnoverThreshold.toFixed(2)}` },
      { 'Indicador de Control de Calidad': 'Normativa de Calidad de Referencia', 'Valor': 'ISO 9001:2015 Clause 8.5.1 / 8.5.4' },
      { 'Indicador de Control de Calidad': 'Fecha de Generación del Reporte', 'Valor': format(new Date(), 'dd/MM/yyyy HH:mm:ss') }
    ];

    const workbook = XLSX.utils.book_new();

    const sheetItems = XLSX.utils.json_to_sheet(itemData);
    const sheetCats = XLSX.utils.json_to_sheet(catExcelData);
    const sheetSummary = XLSX.utils.json_to_sheet(auditSummary);

    XLSX.utils.book_append_sheet(workbook, sheetSummary, "Resumen Auditoría");
    XLSX.utils.book_append_sheet(workbook, sheetItems, "Rotación de SKU");
    XLSX.utils.book_append_sheet(workbook, sheetCats, "Métricas Categorías");

    XLSX.writeFile(workbook, `Reporte_Calidad_Inventario_ISO9001_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  // 7. EXPORT CAPABILITY: RAW CSV DOWNLOADING FOR LEGACY BI INTEGRATION
  const exportRawCSVReport = () => {
    if (products.length === 0) return;

    let csvContent = "\ufeff"; // Add UTF-8 BOM for Excel compatibility
    csvContent += "SKU;Articulo;Categoria;StockActual;Unidad;CostoCompra;ValorTotal;Salidas;Entradas;StockPromedio;ITR;Estado;Severidad;Recomendacion\n";

    products.forEach(p => {
      const stats = productStats[p.id] || { qOut: 0, qIn: 0, sAve: 0, itr: 0, status: 'N/A', riskLevel: 'Insignificante', recommendation: '-' };
      const catName = categories.find(c => c.id === p.categoryId)?.name || 'Sin Categoría';
      
      const line = [
        p.sku,
        p.name.replace(/;/g, ","),
        catName.replace(/;/g, ","),
        p.currentStock,
        p.unit,
        p.purchasePrice,
        p.currentStock * p.purchasePrice,
        stats.qOut,
        stats.qIn,
        stats.sAve.toFixed(2),
        stats.itr.toFixed(2),
        stats.status,
        stats.riskLevel,
        stats.recommendation.replace(/;/g, ",")
      ].join(";");
      
      csvContent += line + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Reporte_Auditoria_Inventario_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="h-full min-h-[500px] flex flex-col items-center justify-center space-y-4">
        <Clock className="animate-spin text-amber-500 w-8 h-8" />
        <div className="text-white/20 uppercase tracking-[0.2em] text-xs font-bold font-mono">
          Consolidando datos de trazabilidad institucional...
        </div>
      </div>
    );
  }

  // Identifiers for alerting/baja rotación filtered arrays
  const lowTurnoverItems = products.filter(p => {
    const stats = productStats[p.id];
    return stats && p.currentStock > 0 && (stats.status === 'Inactivo' || stats.status === 'Baja Rotación');
  });

  return (
    <div className="space-y-10 pb-20 print-container">
      {/* Dynamic inline styles for browser print window wrapping */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            font-family: 'Inter', sans-serif !important;
          }
          .no-print {
            display: none !important;
          }
          .print-header {
            display: block !important;
            border-bottom: 2px solid #000;
            margin-bottom: 25px;
            padding-bottom: 10px;
          }
          .print-badge {
            border: 1px solid #000 !important;
            background: none !important;
            color: black !important;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 20px;
          }
          .print-table th, .print-table td {
            border: 1px solid #ddd !important;
            padding: 8px !important;
            text-align: left !important;
            color: black !important;
            background: transparent !important;
          }
          .print-table th {
            background-color: #f5f5f5 !important;
            font-weight: bold !important;
          }
          .print-section {
            page-break-inside: avoid !important;
            margin-bottom: 30px;
          }
          .text-white, .text-white\\/40, .text-white\\/20, .text-emerald-500, .text-red-500, .text-amber-500 {
            color: black !important;
          }
          .bg-\\[\\#141414\\], .bg-\\[\\#111111\\], .bg-black\\/40 {
            background-color: white !important;
            border: 1px solid #ccc !important;
          }
        }
      ` }} />

      {/* Official Audit Document Header (Active only on print output) */}
      <div className="hidden print-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-black">Sistema de Control de Inventario Clínico</h1>
            <p className="text-xs text-gray-600 uppercase tracking-widest mt-1">Reporte de Auditoría de Rotación de Stock e Inmovilización de Capital</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-black font-mono">CÓDIGO: SGC-AUD-INV-01</p>
            <p className="text-xs text-gray-600 font-mono">NORMATIVA: ISO 9001:2015 §8.5 / §9.1.3</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 border border-black/20 p-3 mt-4 text-[10px] uppercase font-mono">
          <div><strong>Fecha Emisión:</strong> {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
          <div><strong>Auditor Responsable:</strong> ciancioalexis1@gmail.com</div>
          <div><strong>Estado General:</strong> Conforme (Eficiencia: {globalMetrics.efficiencyScore.toFixed(1)}%)</div>
        </div>
      </div>

      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 no-print">
        <div>
          <span className="bg-amber-600/10 border border-amber-600/20 text-amber-500 rounded px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest leading-none">
            Análisis ISO 9001:2015
          </span>
          <h1 className="text-4xl font-bold tracking-tight italic font-serif text-white mt-3">
            Analítica & Auditoría de Rotación
          </h1>
          <p className="text-white/40 text-xs uppercase tracking-[0.2em] mt-1 font-medium">
            Diagnóstico avanzado de inmovilización de capital, velocidad de stock y optimización logística.
          </p>
        </div>

        {/* Auditor Action Hub */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportXLSXReport}
            className="flex items-center gap-2 border border-emerald-500/20 px-4 py-3 rounded-lg bg-emerald-500/10 text-xs font-bold text-emerald-500 hover:bg-emerald-500/20 transition-all cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            Exportar Excel (.xlsx)
          </button>
          
          <button
            onClick={exportRawCSVReport}
            className="flex items-center gap-2 border border-white/15 px-4 py-3 rounded-lg bg-white/5 text-xs font-bold text-white/70 hover:bg-white/10 transition-all cursor-pointer"
          >
            <Layers size={14} />
            Exportar CSV
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-amber-500/30 px-4 py-3 rounded-lg bg-amber-500/10 text-xs font-bold text-amber-500 hover:bg-amber-500/20 transition-all cursor-pointer"
          >
            <Printer size={14} />
            Imprimir / Registrar PDF
          </button>
        </div>
      </header>

      {/* DYNAMIC INTERACTIVE CONFIGURATION PANEL (CRITICAL CONTROL) */}
      <section className="bg-[#111111] border border-white/10 p-6 xl:p-8 rounded-xl shadow-2xl space-y-6 no-print">
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <SlidersHorizontal size={18} className="text-amber-500" />
          <h2 className="font-serif italic text-lg text-white">Consola de Control de Variables de Auditoría</h2>
          <span className="ml-auto text-[9px] font-bold text-white/20 uppercase tracking-widest font-mono">
            Parámetros Configurados en Tiempo Real
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* CONTROL: TIMEPERIOD FILTER */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Calendar size={12} className="text-white/30" />
              Período de Análisis
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white/80 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-amber-500/40 transition-all cursor-pointer"
            >
              <option value="7">Últimos 7 días (Estacional)</option>
              <option value="15">Últimas 2 semanas</option>
              <option value="30">Último Mes (Reglamentario)</option>
              <option value="90">Trimestre Anterior (Quarterly)</option>
              <option value="180">Semestre Anterior</option>
              <option value="365">Ciclo Anual Completo</option>
            </select>
          </div>

          {/* CONTROL: LOW TURNOVER RATIO (ITR SLIDER) */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-1.5">
                <SlidersHorizontal size={12} className="text-white/30" />
                Umbral Alerta ITR Mín.
              </label>
              <span className="text-xs font-mono font-bold text-amber-500">{minTurnoverThreshold.toFixed(2)} r/p</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.05"
                max="2.00"
                step="0.05"
                value={minTurnoverThreshold}
                onChange={(e) => setMinTurnoverThreshold(Number(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
            <span className="text-[9px] text-white/20 tracking-wider block">
              Índice de rotación de stock mínimo tolerable por período.
            </span>
          </div>

          {/* CONTROL: SORTER METRIC */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <ArrowUpDown size={12} className="text-white/30" />
              Prioridad de Visualización
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white/80 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-amber-500/40 transition-all cursor-pointer"
            >
              <option value="itr-asc">Menor Rotación primero (Riesgos)</option>
              <option value="itr-desc">Mayor Rotación primero (Alta Tracción)</option>
              <option value="val-desc">Mayor Capital Inmovilizado ($$$)</option>
              <option value="val-asc">Menor Capital Inmovilizado</option>
            </select>
          </div>

          {/* CONTROL: COMPLIANCE WARNING BANNER */}
          <div className="bg-amber-600/5 border border-amber-500/10 rounded-lg p-3 text-[10px] text-amber-500/80 leading-relaxed flex items-start gap-2">
            <Info size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Rigor Crítico:</strong> El índice de rotación (ITR) evalúa la velocidad con la que se consumen las existencias. Un ITR cercano a cero indica sobredimensionamiento estático del almacén hospitalario.
            </div>
          </div>
        </div>
      </section>

      {/* HIGHLIGHT COMPLIANCE SCORECARDS */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print-section">
        {/* CARD: TOTAL VALUATION CAPITAL */}
        <div className="bg-[#141414] border border-white/10 p-8 rounded-xl shadow-2xl relative overflow-hidden group print-card">
          <DollarSign className="absolute -right-4 -top-4 text-white/5 w-24 h-24 group-hover:rotate-12 transition-transform print-only" />
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-4">Capital Total Inmovilizado</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-emerald-500">${globalMetrics.totalValue.toLocaleString()}</span>
          </div>
          <p className="text-[9px] text-white/10 mt-4 uppercase tracking-widest">Base de compra neta consolidada</p>
        </div>

        {/* CARD: GLOBAL ITR */}
        <div className="bg-[#141414] border border-white/10 p-8 rounded-xl shadow-2xl relative overflow-hidden group print-card">
          <TrendingUp className="absolute -right-4 -top-4 text-amber-500/5 w-24 h-24 group-hover:translate-x-2 transition-transform print-only" />
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-4">Rotación Promedio General</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-amber-500">{globalMetrics.avgITR.toFixed(2)}</span>
            <span className="text-[10px] text-white/20 uppercase font-black tracking-widest pl-1">ciclos/v.t</span>
          </div>
          <p className="text-[9px] text-white/10 mt-4 uppercase tracking-widest font-mono">Formula ITR = Salidas / StockPromedio</p>
        </div>

        {/* CARD: ALERT SKU CONTROLS */}
        <div className="bg-[#141414] border border-white/10 p-8 rounded-xl shadow-2xl relative overflow-hidden group print-card">
          <AlertTriangle className="absolute -right-4 -top-4 text-red-500/5 w-24 h-24 group-hover:-rotate-12 transition-transform print-only" />
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-4">Existencias en Alerta Crítica</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-mono font-bold ${globalMetrics.criticalAlertCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {globalMetrics.criticalAlertCount}
            </span>
            <span className="text-[10px] text-white/20 uppercase font-black tracking-widest pl-1">SKUs</span>
          </div>
          <p className="text-[9px] text-red-500/40 mt-4 uppercase tracking-widest">ITR inferior al umbral tolerable ({minTurnoverThreshold.toFixed(2)})</p>
        </div>

        {/* CARD: QUALITY EFFICIENCY SCORE */}
        <div className="bg-[#141414] border border-white/10 p-8 rounded-xl shadow-2xl relative overflow-hidden group print-card">
          <CheckCircle className="absolute -right-4 -top-4 text-emerald-500/5 w-24 h-24 group-hover:scale-110 transition-transform print-only" />
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-4">Eficiencia Operativa Almacén</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-white">{globalMetrics.efficiencyScore.toFixed(1)}%</span>
          </div>
          <p className="text-[9px] text-emerald-500/40 mt-4 uppercase tracking-widest">Existencias activas sin obsolescencia</p>
        </div>
      </section>

      {/* GRAPHIC DIAGNOSTIC COMPARISONS (HIDDEN IN STANDARD PRINT) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 no-print">
        {/* CHARTS: EXITS TIMELINE */}
        <div className="bg-[#111111] border border-white/10 p-8 rounded-xl shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-serif italic text-lg text-white">Velocidad Operativa del Inventario</h3>
              <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Flujo global diario de bodega (Últimos 15 Días)</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Entradas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Salidas</span>
              </div>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={transactionTrends}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                <XAxis 
                  dataKey="date" 
                  stroke="#ffffff15" 
                  fontSize={9} 
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'rgba(255,255,255,0.2)' }}
                />
                <YAxis 
                  stroke="#ffffff15" 
                  fontSize={9} 
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'rgba(255,255,255,0.2)' }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }}
                  itemStyle={{ textTransform: 'uppercase', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="Entradas" stroke="#d97706" fillOpacity={1} fill="url(#colorIn)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="Salidas" stroke="#ffffff" strokeOpacity={0.2} fillOpacity={1} fill="url(#colorOut)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHARTS: CATEGORY COMPARATIVE ITR BAR-RATING */}
        <div className="bg-[#111111] border border-white/10 p-8 rounded-xl shadow-2xl">
          <div>
            <h3 className="font-serif italic text-lg text-white">Desempeño de Rotación por Categoría</h3>
            <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-6">Comparación directa de ITR de categoría (Velocidad de evacuación de Stock)</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                <XAxis 
                  dataKey="name" 
                  stroke="#ffffff15" 
                  fontSize={9} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: 'rgba(255,255,255,0.2)' }}
                />
                <YAxis 
                  stroke="#ffffff15" 
                  fontSize={9} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: 'rgba(255,255,255,0.2)' }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }}
                />
                <Bar dataKey="itr" radius={[4, 4, 0, 0]} name="Índice ITR (Categoría)">
                  {categoryStats.map((entry, index) => {
                    const isBelow = entry.itr < minTurnoverThreshold;
                    return (
                      <Cell key={`cell-${index}`} fill={isBelow ? '#ef4444' : '#10b981'} fillOpacity={0.5} />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ISO 9001:2015 HIGH-LEVEL EXECUTIVE ADVISORY PANEL */}
      <section className="bg-gradient-to-r from-amber-950/20 to-[#141414] border border-amber-500/20 p-8 rounded-xl shadow-2xl relative overflow-hidden print-card">
        <div className="flex flex-col md:flex-row gap-6 items-start relative z-10">
          <div className="p-4 bg-amber-600/10 border border-amber-500/20 text-amber-500 rounded-2xl flex-shrink-0">
            <BookOpen size={28} />
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-black text-amber-500 uppercase tracking-[0.3em] inline-block">dictamen técnico & sugerencias del auditor (iso 9001:2015 §8.5.4)</h3>
            <p className="text-sm text-white/80 leading-relaxed font-sans">
              "Bajo las regulaciones de la norma de calidad internacional ISO 9001:2015, la preservación de las existencias y la reducción de mermas requieren una rotación activa. En este periodo de evaluación, con una ventana de <strong>{timeRange} días</strong>, se constata que <strong>{globalMetrics.inactivePositiveStockCount} artículos</strong> con existencias se encuentran completamente inactivos, elevando el riesgo de deterioro de activos médicos y clínicos. El índice de eficiencia global del almacén se sitúa en un <strong>{globalMetrics.efficiencyScore.toFixed(1)}%</strong>. Se aconseja encarecidamente implementar despachos prioritarios bajo el esquema FIFO (First-In-First-Out) y reducir los valores admisibles de stock de seguridad para los códigos alertados."
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 text-xs font-mono">
              <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                <span className="text-white/30 block tracking-widest text-[9px] uppercase mb-1">CAPITAL DETENIDO</span>
                <span className="text-white font-bold">${globalMetrics.totalValue.toLocaleString()}</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                <span className="text-white/30 block tracking-widest text-[9px] uppercase mb-1">RÉGIMEN ASIGNADO</span>
                <span className="text-white font-bold">FEFO (Vencimiento)</span>
              </div>
              <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                <span className="text-white/30 block tracking-widest text-[9px] uppercase mb-1">REVISIÓN DE AUDITABLE</span>
                <span className="text-amber-500 font-bold">Acción Correctiva Planificada</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ADVANCED MULTI-FILTER DATA VIEW FOR ITEM ROTATION (DATAGRID) */}
      <section className="bg-[#141414] border border-white/10 rounded-xl overflow-hidden shadow-2xl print-section">
        {/* Grid Header and Controls */}
        <div className="p-8 border-b border-white/5 bg-[#1a1a1a] flex flex-col lg:flex-row lg:items-center justify-between gap-6 no-print">
          <div>
            <h3 className="font-serif italic text-xl text-white">Análisis de Rotación Individualizado por SKU</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] mt-1 font-medium">Buscador y filtros avanzados de trazabilidad y tracción de materiales</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* SEARCH */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={14} />
              <input
                type="text"
                placeholder="Buscar SKU o artículo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500/40 transition-all placeholder:text-white/20"
              />
            </div>

            {/* CATEGORY FILTER */}
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3.5">
              <Filter size={12} className="text-white/30" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-[10px] font-bold text-white/60 uppercase tracking-widest py-2.5 outline-none cursor-pointer"
              >
                <option value="all">Todas las Categorías</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* STATUS FILTER */}
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3.5">
              <Layers size={12} className="text-white/30" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-[10px] font-bold text-white/60 uppercase tracking-widest py-2.5 outline-none cursor-pointer"
              >
                <option value="all">Todos los Estados</option>
                <option value="Óptima">Tracción Óptima</option>
                <option value="Baja Rotación">Baja Rotación</option>
                <option value="Inactivo">Inactividad Crítica</option>
                <option value="Sin Stock">Sin Existencias</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic Warning Notification if high-risk obsolete articles are queried */}
        {lowTurnoverItems.length > 0 && (
          <div className="bg-red-500/5 border-b border-red-500/10 p-4 px-8 text-xs text-red-400 flex items-center gap-3 no-print">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 animate-pulse" />
            <div>
              Atención: Se han detectado <strong>{lowTurnoverItems.length} artículos</strong> en estado de inmovilización crítica. Representan capital detenido pasible de expiración clínica inminente.
            </div>
          </div>
        )}

        {/* DATAGRID TABULAR PRESENTATION */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left print-table">
            <thead>
              <tr className="bg-[#1a1a1a] border-b border-white/5 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] italic">
                <th className="p-8 print-th">SKU</th>
                <th className="py-8 px-4 print-th">Artículo / Segmento</th>
                <th className="py-8 px-4 text-center print-th">Existencia Física</th>
                <th className="py-8 px-4 text-right print-th">Costo Compra</th>
                <th className="py-8 px-4 text-right print-th">Valorización</th>
                <th className="py-8 px-4 text-center print-th">Despachos ({timeRange}D)</th>
                <th className="py-8 px-4 text-center print-th">ITR Período</th>
                <th className="py-8 px-4 text-center print-th">Estado de Alerta</th>
                <th className="py-8 px-8 no-print">Auditoría Correctiva (ISO 9001)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-white/10 uppercase font-mono tracking-widest text-xs">
                    Ningún registro coincide con los criterios de auditoría previstos.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const stats = productStats[p.id] || { qOut: 0, qIn: 0, sAve: 0, itr: 0, status: 'Sin Stock', riskLevel: 'Insignificante', categoryName: '-', riskDescription: '-', recommendation: '-' };
                  const totalV = (p.currentStock || 0) * (p.purchasePrice || 0);
                  
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors text-xs">
                      {/* SKU */}
                      <td className="p-8 font-mono font-bold text-white/60 tracking-wider">
                        {p.sku}
                      </td>
                      
                      {/* Name / Category */}
                      <td className="py-4 px-4">
                        <span className="font-bold text-white block text-sm leading-tight">{p.name}</span>
                        <span className="text-[10px] text-white/30 tracking-widest uppercase mt-1 block font-mono">
                          {stats.categoryName}
                        </span>
                      </td>

                      {/* Stock in inventory */}
                      <td className="py-4 px-4 text-center font-mono font-semibold">
                        <span className={(p.currentStock === 0) ? 'text-red-500' : 'text-white'}>
                          {p.currentStock}
                        </span>
                        <span className="text-[10px] text-white/20 pl-1 font-sans">{p.unit}</span>
                      </td>

                      {/* Unit price */}
                      <td className="py-4 px-4 text-right font-mono text-white/70">
                        ${Number(p.purchasePrice || 0).toFixed(2)}
                      </td>

                      {/* Total Asset Valuation */}
                      <td className="py-4 px-4 text-right font-mono font-bold text-emerald-500">
                        ${totalV.toLocaleString()}
                      </td>

                      {/* Quantity dispatched (OUT) */}
                      <td className="py-4 px-4 text-center font-mono font-bold">
                        {stats.qOut === 0 ? (
                          <span className="text-white/20">0</span>
                        ) : (
                          <span className="text-amber-500">-{stats.qOut}</span>
                        )}
                      </td>

                      {/* Rotation Index Rate */}
                      <td className="py-4 px-4 text-center font-mono py-6">
                        <div className="inline-block px-2.5 py-1 rounded bg-black/40 border border-white/5">
                          <span className={stats.status === 'Inactivo' ? 'text-red-500/70' : stats.status === 'Baja Rotación' ? 'text-amber-400' : 'text-emerald-500'}>
                            {stats.itr.toFixed(2)}
                          </span>
                          <span className="text-[8px] text-white/20 tracking-tighter pl-1">rot</span>
                        </div>
                      </td>

                      {/* State Badge alert */}
                      <td className="py-4 px-4 text-center">
                        <span className={`px-2.5 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest leading-none block text-center min-w-[110px] border ${
                          stats.status === 'Sin Stock' 
                            ? 'bg-white/5 border-white/10 text-white/40'
                            : stats.status === 'Inactivo'
                            ? 'bg-red-500/10 border-red-500/30 text-red-500 animate-pulse'
                            : stats.status === 'Baja Rotación'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                        } print-badge`}>
                          {stats.status}
                        </span>
                      </td>

                      {/* Dynamic Corrective Action */}
                      <td className="py-4 px-8 text-[11px] text-white/50 italic leading-relaxed max-w-sm no-print">
                        {stats.recommendation}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* CATEGORY AGGREGATED ROTATION STATS TABLE */}
      <section className="bg-[#141414] border border-white/10 rounded-xl overflow-hidden shadow-2xl print-section">
        <div className="p-8 border-b border-white/5 bg-[#1a1a1a]">
          <h3 className="font-serif italic text-xl text-white">Análisis Agregado por Categoría de Almacén</h3>
          <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] mt-1 font-medium">Indicador de Rotación de Categoría (ITR de Sector)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left print-table">
            <thead>
              <tr className="bg-[#1a1a1a] border-b border-white/5 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] italic">
                <th className="p-8 print-th">Nombre de Categoría</th>
                <th className="py-8 px-4 text-center print-th">SKUs Catalogados</th>
                <th className="py-8 px-4 text-right print-th">Valor de Sector ($)</th>
                <th className="py-8 px-4 text-center print-th">Egresos Totales Periodo</th>
                <th className="py-8 px-4 text-center print-th">Stock Promedio Cat.</th>
                <th className="py-8 px-4 text-center print-th">ITR Categoría (Rotación de Sector)</th>
                <th className="py-8 px-8 print-th">Evaluación Logística</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {categoryStats.map((c) => {
                const isBelow = c.itr < minTurnoverThreshold;
                const totalValue = c.totalValue;
                
                return (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors text-xs">
                    <td className="p-8 font-bold text-white text-sm">
                      {c.name}
                    </td>
                    <td className="py-4 px-4 text-center font-mono">
                      {c.itemsCount} {c.itemsCount === 1 ? 'Producto' : 'Productos'}
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-emerald-500">
                      ${totalValue.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-center font-mono">
                      {c.qOut} unidades
                    </td>
                    <td className="py-4 px-4 text-center font-mono">
                      {c.sAve.toFixed(1)}
                    </td>
                    <td className="py-4 px-4 text-center font-mono py-6">
                      <span className={`inline-block px-2.5 py-1 rounded bg-black/40 border border-white/5 font-bold ${
                        c.itr === 0 ? 'text-white/20' : isBelow ? 'text-red-400' : 'text-emerald-500'
                      }`}>
                        {c.itr.toFixed(2)} r/p
                      </span>
                    </td>
                    <td className="py-4 px-8">
                      {c.itr === 0 ? (
                        <span className="text-white/30 text-[10px] uppercase font-bold tracking-widest block">Estancamiento Crítico</span>
                      ) : isBelow ? (
                        <span className="text-red-400 text-[10px] uppercase font-bold tracking-widest block">Bajo Demanda - Riesgo Excedente</span>
                      ) : (
                        <span className="text-emerald-500 text-[10px] uppercase font-bold tracking-widest block">Tránsito Óptimo Consistente</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* CORPORATE SIGNATURE BLOC (PDF PRINT ONLY) */}
      <div className="hidden print:block mt-32">
        <div className="grid grid-cols-2 gap-20">
          <div className="text-center">
            <div className="border-t border-black/80 w-64 mx-auto pt-2" />
            <p className="text-xs font-bold text-black uppercase font-sans">Alexis Ciancio</p>
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-0.5">Auditor General de Calidad</p>
          </div>
          <div className="text-center">
            <div className="border-t border-black/80 w-64 mx-auto pt-2" />
            <p className="text-xs font-bold text-black uppercase font-sans">Jefe de Logística & Suministros</p>
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-0.5">Control de Almacén Hospitalario</p>
          </div>
        </div>
        <div className="text-center mt-12 text-[9px] text-gray-400 italic">
          Documento certificado mediante firma con base regulada bajo la cláusula 9.1.3 de la norma ISO 9001:2015.
        </div>
      </div>
    </div>
  );
}

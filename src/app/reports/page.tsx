
"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Loader2, 
  BarChart4,
  Download,
  IndianRupee,
  ChevronRight,
  FileDown,
  Milk,
  CalendarDays,
  PieChart,
  TrendingUp,
  AlertCircle,
  Calendar,
  ClipboardList,
  ShoppingCart,
  Printer,
  Sun,
  Moon
} from "lucide-react";
import { format, endOfMonth, subMonths, startOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function ReportsPage() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const now = new Date();
    setSelectedMonth(format(now, 'yyyy-MM'));
    setSelectedDailyDate(format(now, 'yyyy-MM-dd'));
  }, []);

  const monthOptions = useMemo(() => {
    if (!isClient) return [];
    const now = new Date();
    return Array.from({ length: 12 }).map((_, i) => {
      const d = subMonths(now, i);
      return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
    });
  }, [isClient]);

  const cycles = useMemo(() => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthEnd = endOfMonth(new Date(year, month - 1));
    const lastDay = monthEnd.getDate();
    return [
      { id: 0, label: "Cycle 1", range: "1st - 10th", start: 1, end: 10 },
      { id: 1, label: "Cycle 2", range: "11th - 20th", start: 11, end: 20 },
      { id: 2, label: "Cycle 3", range: `21st - ${lastDay}`, start: 21, end: lastDay }
    ];
  }, [selectedMonth]);

  const entriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'entries');
  }, [firestore]);

  const farmersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'farmers');
  }, [firestore]);

  const salesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'sales');
  }, [firestore]);

  const buyersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'buyers');
  }, [firestore]);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: allEntries } = useCollection(entriesQuery);
  const { data: farmers } = useCollection(farmersQuery);
  const { data: allSales } = useCollection(salesQuery);
  const { data: buyers } = useCollection(buyersQuery);
  const { data: ratesConfig } = useDoc(settingsRef);

  const currentCycle = cycles[activeCycle];

  /**
   * UNIFIED FINANCIAL RESOLUTION ENGINE
   * Strictly 0.96 Conversion Standard
   */
  const resolveEntryFinancials = (entry: any, farmersList: any[], config: any) => {
    const kg = Number(entry.kgWeight) || 0;
    // Strictly follow user's 0.96 conversion setting
    const quantity = Number(entry.quantity) || parseFloat((kg * 0.96).toFixed(2));
    
    const farmer = farmersList?.find(f => f.id === entry.farmerId);
    let rate = Number(entry.rate) || 0;
    
    if (rate === 0 && farmer) {
      if (farmer.milkType === 'BUFFALO') {
        rate = Number(farmer.customRate) > 0 ? Number(farmer.customRate) : (Number(config?.buffaloRate) || 0);
      } else {
        rate = Number(config?.cowRate) || 0;
      }
    }

    const amount = Number(entry.totalAmount) || parseFloat((quantity * rate).toFixed(2));
    
    return { 
      qtyLitre: parseFloat(quantity.toFixed(2)), 
      cost: parseFloat(amount.toFixed(2)), 
      appliedRate: rate,
      farmerName: farmer?.name || "Unknown",
      canNumber: farmer?.canNumber || "???",
      session: entry.session || "Morning"
    };
  };

  const resolveSaleFinancials = (sale: any, buyersList: any[], config: any) => {
    const qty = Number(sale.quantity) || 0;
    let rate = Number(sale.rate) || 0;
    if (rate === 0) {
      rate = sale.milkType === 'BUFFALO' ? (Number(config?.buffaloSellingRate) || 0) : (Number(config?.cowSellingRate) || 0);
    }
    const amount = Number(sale.totalAmount) || parseFloat((qty * rate).toFixed(2));
    const buyer = buyersList?.find(b => b.id === sale.buyerId);
    
    return { 
      qty: parseFloat(qty.toFixed(2)), 
      cost: parseFloat(amount.toFixed(2)), 
      appliedRate: rate,
      buyerName: buyer?.name || "Unknown Buyer",
      milkType: sale.milkType,
      session: sale.session || "Morning"
    };
  };

  // --- Daily Report Logic ---
  const dailyData = useMemo(() => {
    if (!allEntries || !allSales || !farmers || !buyers || !ratesConfig || !selectedDailyDate) {
      return { procurement: [], sales: [], totalProc: 0, totalSale: 0 };
    }

    const dProc = allEntries
      .filter(e => e.date === selectedDailyDate)
      .map(e => resolveEntryFinancials(e, farmers, ratesConfig))
      .sort((a, b) => parseInt(a.canNumber) - parseInt(b.canNumber) || a.session.localeCompare(b.session));

    const dSale = allSales
      .filter(s => s.date === selectedDailyDate)
      .map(s => resolveSaleFinancials(s, buyers, ratesConfig))
      .sort((a, b) => a.buyerName.localeCompare(b.buyerName) || a.session.localeCompare(b.session));

    return {
      procurement: dProc,
      sales: dSale,
      totalProc: dProc.reduce((acc, c) => acc + c.cost, 0),
      totalSale: dSale.reduce((acc, c) => acc + c.cost, 0)
    };
  }, [allEntries, allSales, farmers, buyers, ratesConfig, selectedDailyDate]);

  // --- Master Summary Roster Logic ---
  const masterRoster = useMemo(() => {
    if (!allEntries || !farmers || !ratesConfig || !selectedMonth || !currentCycle) return [];
    
    const cycleEntries = allEntries.filter(e => {
      if (!e.date.startsWith(selectedMonth)) return false;
      const day = parseInt(e.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    });

    const farmerMap: Record<string, any> = {};

    cycleEntries.forEach(entry => {
      const fId = entry.farmerId;
      if (!farmerMap[fId]) {
        const info = farmers.find(f => f.id === fId);
        farmerMap[fId] = {
          id: fId,
          name: info?.name || "Deleted Supplier",
          canNumber: info?.canNumber || "???",
          bankAccountNumber: info?.bankAccountNumber || "",
          milkType: info?.milkType || "COW",
          customRate: info?.customRate || 0,
          morningQty: 0, eveningQty: 0, totalQty: 0, totalAmount: 0
        };
      }

      const res = resolveEntryFinancials(entry, farmers, ratesConfig);
      if (entry.session === 'Morning') farmerMap[fId].morningQty += res.qtyLitre;
      else farmerMap[fId].eveningQty += res.qtyLitre;
      farmerMap[fId].totalAmount += res.cost;
    });

    return Object.values(farmerMap).map(f => ({
      ...f,
      morningQty: parseFloat(f.morningQty.toFixed(2)),
      eveningQty: parseFloat(f.eveningQty.toFixed(2)),
      totalQty: parseFloat((f.morningQty + f.eveningQty).toFixed(2)),
      totalAmount: parseFloat(f.totalAmount.toFixed(2))
    })).sort((a, b) => parseInt(a.canNumber) - parseInt(b.canNumber));
  }, [allEntries, farmers, ratesConfig, selectedMonth, currentCycle]);

  const cycleStats = useMemo(() => {
    const totalProcurementAmt = masterRoster.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const totalProcurementQty = masterRoster.reduce((acc, curr) => acc + curr.totalQty, 0);

    let totalSaleAmt = 0;
    let totalSaleQty = 0;

    const cycleSales = allSales?.filter(s => {
      if (!s.date.startsWith(selectedMonth)) return false;
      const day = parseInt(s.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    }) || [];

    cycleSales.forEach(s => {
      const res = resolveSaleFinancials(s, buyers || [], ratesConfig);
      totalSaleAmt += res.cost;
      totalSaleQty += res.qty;
    });

    return {
      totalEntryQty: parseFloat(totalProcurementQty.toFixed(2)),
      totalSaleQty: parseFloat(totalSaleQty.toFixed(2)),
      totalEntryAmt: parseFloat(totalProcurementAmt.toFixed(2)),
      totalSaleAmt: parseFloat(totalSaleAmt.toFixed(2)),
      profit: parseFloat((totalSaleAmt - totalProcurementAmt).toFixed(2))
    };
  }, [masterRoster, allSales, selectedMonth, currentCycle, ratesConfig, buyers]);

  // --- PDF Generation Functions ---
  const generateDailyReportPDF = () => {
    const pdf = new jsPDF();
    const company = (ratesConfig?.companyName || "SRI GOPALA KRISHNA MILK DISTRIBUTIONS").toUpperCase();
    const dateStr = format(new Date(selectedDailyDate), 'dd/MM/yyyy');

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(company, 105, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text("DAILY COLLECTION & SALES REPORT", 105, 28, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text(`REPORT DATE: ${dateStr}`, 105, 35, { align: 'center' });

    // Procurement Section
    pdf.setFontSize(11);
    pdf.text("I. PROCUREMENT SUMMARY", 14, 45);
    const procRows = dailyData.procurement.map(p => [
      p.canNumber,
      p.farmerName.toUpperCase(),
      p.session.toUpperCase(),
      p.qtyLitre.toFixed(2),
      p.appliedRate.toFixed(2),
      p.cost.toFixed(2)
    ]);

    (pdf as any).autoTable({
      startY: 48,
      head: [['CAN', 'FARMER NAME', 'SESSION', 'QTY (L)', 'RATE (Rs)', 'AMOUNT (Rs)']],
      body: procRows,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
      margin: { left: 14, right: 14 }
    });

    let nextY = (pdf as any).lastAutoTable.finalY + 15;

    // Sales Section
    pdf.setFontSize(11);
    pdf.text("II. DISTRIBUTION / SALES SUMMARY", 14, nextY);
    const saleRows = dailyData.sales.map(s => [
      s.buyerName.toUpperCase(),
      s.session.toUpperCase(),
      s.milkType,
      s.qty.toFixed(2),
      s.appliedRate.toFixed(2),
      s.cost.toFixed(2)
    ]);

    (pdf as any).autoTable({
      startY: nextY + 3,
      head: [['BUYER NAME', 'SESSION', 'MILK TYPE', 'QTY (L)', 'RATE (Rs)', 'AMOUNT (Rs)']],
      body: saleRows,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
      margin: { left: 14, right: 14 }
    });

    nextY = (pdf as any).lastAutoTable.finalY + 15;

    // Final Summary Box
    pdf.setDrawColor(200);
    pdf.rect(14, nextY, 182, 35);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("III. CONSOLIDATED DAILY BALANCE", 20, nextY + 8);
    
    pdf.setFont("helvetica", "normal");
    pdf.text(`Total procurement cost for today:`, 20, nextY + 16);
    pdf.text(`Rs. ${dailyData.totalProc.toFixed(2)}`, 180, nextY + 16, { align: 'right' });
    
    pdf.text(`Total sales revenue for today:`, 20, nextY + 23);
    pdf.text(`Rs. ${dailyData.totalSale.toFixed(2)}`, 180, nextY + 23, { align: 'right' });
    
    pdf.setFont("helvetica", "bold");
    pdf.text(`Estimated Daily Profit:`, 20, nextY + 30);
    pdf.text(`Rs. ${(dailyData.totalSale - dailyData.totalProc).toFixed(2)}`, 180, nextY + 30, { align: 'right' });

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    pdf.text(`Generated by Dairy Management System on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 285);

    pdf.save(`Daily_Report_${selectedDailyDate}.pdf`);
  };

  const generateSingleInvoice = (pdf: jsPDF, f: any) => {
    const company = (ratesConfig?.companyName || "SRI GOPALA KRISHNA MILK DISTRIBUTIONS").toUpperCase();
    const [y_part, m_part] = selectedMonth.split('-').map(Number);
    const range = `${currentCycle.start.toString().padStart(2, '0')}/${m_part.toString().padStart(2, '0')}/${y_part.toString().slice(-2)} to ${currentCycle.end.toString().padStart(2, '0')}/${m_part.toString().padStart(2, '0')}/${y_part.toString().slice(-2)}`;
    const todayStr = format(new Date(), 'dd/MM/yyyy');

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(company, 105, 20, { align: 'center' });
    pdf.setFontSize(13);
    pdf.text("MILK INVOICE", 105, 28, { align: 'center' });
    pdf.setLineWidth(0.1);
    pdf.line(90, 30, 120, 30); 

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    const labelX1 = 20;
    const valueX1 = 45;
    const labelX2 = 110;
    const valueX2 = 135;
    const lineW = 60;

    let y = 45;
    
    pdf.text("NAME:", labelX1, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(f.name.toUpperCase(), valueX1, y);
    pdf.line(valueX1, y+1, valueX1 + lineW, y+1);
    
    pdf.setFont("helvetica", "normal");
    pdf.text("DATE:", labelX2, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(todayStr, valueX2, y);
    pdf.line(valueX2, y+1, valueX2 + lineW, y+1);

    y += 10;
    pdf.setFont("helvetica", "normal");
    pdf.text("A/C NO:", labelX1, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(f.bankAccountNumber || "—", valueX1, y);
    pdf.line(valueX1, y+1, valueX1 + lineW, y+1);

    pdf.setFont("helvetica", "normal");
    pdf.text("PERIOD:", labelX2, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(range, valueX2, y);
    pdf.line(valueX2, y+1, valueX2 + lineW, y+1);

    y += 10;
    pdf.setFont("helvetica", "normal");
    pdf.text("CAN NO:", labelX1, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(f.canNumber, valueX1, y);
    pdf.line(valueX1, y+1, valueX1 + lineW, y+1);

    pdf.setFont("helvetica", "normal");
    pdf.text("RATE (Rs):", labelX2, y);
    pdf.setFont("helvetica", "bold");
    const effectiveRate = f.customRate > 0 ? f.customRate : (f.milkType === 'BUFFALO' ? ratesConfig?.buffaloRate : ratesConfig?.cowRate);
    pdf.text(Number(effectiveRate || 0).toFixed(2), valueX2, y);
    pdf.line(valueX2, y+1, valueX2 + lineW, y+1);

    const fEntries = allEntries!.filter(e => e.farmerId === f.id && e.date.startsWith(selectedMonth) && parseInt(e.date.split('-')[2]) >= currentCycle.start && parseInt(e.date.split('-')[2]) <= currentCycle.end);
    
    const rows = fEntries.sort((a, b) => a.date.localeCompare(b.date) || a.session.localeCompare(b.session)).map(e => {
      const res = resolveEntryFinancials(e, farmers!, ratesConfig!);
      return [
        format(new Date(e.date), 'dd/MM/yy'),
        e.session === 'Morning' ? res.qtyLitre.toFixed(2) : "0.00",
        e.session === 'Evening' ? res.qtyLitre.toFixed(2) : "0.00",
        res.qtyLitre.toFixed(2),
        res.appliedRate.toFixed(2),
        res.cost.toFixed(2)
      ];
    });

    (pdf as any).autoTable({
      startY: y + 10,
      head: [['DATE', 'MORNING (L)', 'EVENING (L)', 'TOTAL LITRES', 'RATE (Rs)', 'AMOUNT (Rs)']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineWidth: 0.1, lineColor: [0, 0, 0] },
      bodyStyles: { textColor: [0, 0, 0], halign: 'center', lineWidth: 0.1, lineColor: [0, 0, 0] },
      margin: { left: 20, right: 20 }
    });

    const finalY = (pdf as any).lastAutoTable.finalY;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("TOTAL", 20, finalY + 10);
    pdf.text(f.totalQty.toFixed(2), 118, finalY + 10, { align: 'center' }); 
    pdf.text(f.totalAmount.toFixed(2), 190, finalY + 10, { align: 'right' });

    pdf.setFontSize(8);
    pdf.line(140, 280, 190, 280);
    pdf.text("AUTHORIZED SIGNATURE", 165, 284, { align: 'center' });
  };

  if (!isClient) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Reports & Audit</h1>
              <p className="text-muted-foreground font-medium">Standard 0.96 Payouts • {monthOptions.find(o => o.value === selectedMonth)?.label}</p>
            </div>
            <div className="flex gap-4">
               <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px] rounded-full font-bold h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
              <TabsList className="bg-muted p-1 rounded-full h-auto">
                <TabsTrigger value="overview" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Overview</TabsTrigger>
                <TabsTrigger value="daily" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Daily Report</TabsTrigger>
                <TabsTrigger value="cycle" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Farmer Bills</TabsTrigger>
                <TabsTrigger value="master" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Master Summary</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Internal Audit</TabsTrigger>
              </TabsList>

              {["overview", "cycle", "master"].includes(activeTab) && (
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-full border">
                  {cycles.map((c, i) => (
                    <button 
                      key={i} 
                      onClick={() => setActiveCycle(i)} 
                      className={cn(
                        "rounded-full text-[10px] font-black px-4 h-8 transition-all", 
                        activeCycle === i ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <TabsContent value="overview" className="space-y-12">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-xs">
                  <CalendarDays className="w-4 h-4" /> Cycle Performance ({currentCycle?.label})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card className="rounded-[2rem] bg-primary text-white p-8 shadow-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cycle Volume</p>
                    <p className="text-4xl font-black mt-2">{cycleStats.totalEntryQty.toFixed(2)} L</p>
                  </Card>
                  <Card className="rounded-[2rem] bg-accent text-white p-8 shadow-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cycle Revenue</p>
                    <p className="text-4xl font-black mt-2">Rs. {cycleStats.totalSaleAmt.toFixed(2)}</p>
                  </Card>
                  <Card className="rounded-[2rem] p-8 border-none bg-destructive/10 text-destructive">
                    <p className="text-[10px] font-black uppercase opacity-70">Cycle Payout</p>
                    <p className="text-3xl font-black mt-2">Rs. {cycleStats.totalEntryAmt.toFixed(2)}</p>
                  </Card>
                  <Card className="rounded-[2rem] p-8 border-none bg-green-500/10 text-green-600">
                    <p className="text-[10px] font-black uppercase opacity-70">Cycle Profit</p>
                    <p className="text-3xl font-black mt-2">Rs. {cycleStats.profit.toFixed(2)}</p>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="daily" className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4 w-full sm:w-auto bg-card p-3 rounded-2xl border shadow-sm">
                  <Calendar className="w-5 h-5 text-primary" />
                  <Input 
                    type="date" 
                    value={selectedDailyDate} 
                    onChange={(e) => setSelectedDailyDate(e.target.value)} 
                    className="border-none focus-visible:ring-0 font-bold"
                  />
                </div>
                <Button onClick={generateDailyReportPDF} className="rounded-full h-12 px-10 font-black uppercase bg-primary hover:bg-primary/90">
                  <Printer className="w-4 h-4 mr-2" /> Download Daily Report
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="rounded-3xl border-none shadow-xl overflow-hidden">
                  <div className="p-6 bg-primary/5 border-b flex items-center justify-between">
                    <h3 className="font-black text-primary uppercase text-xs tracking-widest flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" /> Daily Procurement
                    </h3>
                    <Badge className="rounded-full font-black">Rs. {dailyData.totalProc.toFixed(2)}</Badge>
                  </div>
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-bold text-[10px] uppercase">CAN</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase">Farmer</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase">Session</TableHead>
                        <TableHead className="text-right font-bold text-[10px] uppercase">Litre</TableHead>
                        <TableHead className="text-right font-bold text-[10px] uppercase">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyData.procurement.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">No collections recorded.</TableCell></TableRow>
                      ) : (
                        dailyData.procurement.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-black text-primary">{p.canNumber}</TableCell>
                            <TableCell className="font-medium truncate max-w-[120px]">{p.farmerName}</TableCell>
                            <TableCell>
                              {p.session === 'Morning' ? <Sun className="w-3 h-3 text-orange-500" /> : <Moon className="w-3 h-3 text-blue-500" />}
                            </TableCell>
                            <TableCell className="text-right font-bold">{p.qtyLitre.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">Rs. {p.cost.toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>

                <Card className="rounded-3xl border-none shadow-xl overflow-hidden">
                  <div className="p-6 bg-accent/5 border-b flex items-center justify-between">
                    <h3 className="font-black text-accent uppercase text-xs tracking-widest flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" /> Daily Distribution
                    </h3>
                    <Badge variant="secondary" className="rounded-full font-black">Rs. {dailyData.totalSale.toFixed(2)}</Badge>
                  </div>
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-bold text-[10px] uppercase">Buyer</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase">Session</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase">Type</TableHead>
                        <TableHead className="text-right font-bold text-[10px] uppercase">Litre</TableHead>
                        <TableHead className="text-right font-bold text-[10px] uppercase">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyData.sales.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">No sales recorded.</TableCell></TableRow>
                      ) : (
                        dailyData.sales.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-bold truncate max-w-[120px]">{s.buyerName}</TableCell>
                            <TableCell>
                              {s.session === 'Morning' ? <Sun className="w-3 h-3 text-orange-500" /> : <Moon className="w-3 h-3 text-blue-500" />}
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-[8px] font-black">{s.milkType}</Badge></TableCell>
                            <TableCell className="text-right font-bold">{s.qty.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">Rs. {s.cost.toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="cycle" className="space-y-6">
              <div className="flex justify-end">
                <Button onClick={() => {
                  const pdf = new jsPDF();
                  const activeInvoices = masterRoster.filter(f => f.totalQty > 0);
                  activeInvoices.forEach((f, i) => { if (i > 0) pdf.addPage(); generateSingleInvoice(pdf, f); });
                  pdf.save(`Bulk_Bills_${selectedMonth}_${currentCycle.label}.pdf`);
                }} disabled={masterRoster.filter(f => f.totalQty > 0).length === 0} className="rounded-full bg-red-600 hover:bg-red-700 h-12 px-8">
                  <Download className="w-4 h-4 mr-2" /> Download All Bills
                </Button>
              </div>
              <Card className="rounded-3xl overflow-hidden border-none shadow-xl">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase py-5">CAN</TableHead>
                      <TableHead className="font-black text-[10px] uppercase py-5">Farmer Name</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase py-5">Total L</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase py-5">Total Rs</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase py-5">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masterRoster.filter(f => f.totalQty > 0).map(f => (
                      <TableRow key={f.id} className="hover:bg-primary/5">
                        <TableCell className="pl-10 font-black text-primary text-lg">{f.canNumber}</TableCell>
                        <TableCell className="font-bold uppercase text-sm">{f.name}</TableCell>
                        <TableCell className="text-right font-black">{f.totalQty.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-primary font-bold">Rs. {f.totalAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10">
                          <Button variant="ghost" size="sm" onClick={() => {
                            const pdf = new jsPDF();
                            generateSingleInvoice(pdf, f);
                            pdf.save(`Bill_${f.canNumber}_${f.name}.pdf`);
                          }} className="text-red-600 font-black uppercase text-[10px]">
                            <Download className="w-3 h-3 mr-2" /> PDF Bill
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="master" className="space-y-10">
              <div className="flex justify-between items-center">
                <div className="bg-primary/5 border border-primary/20 px-8 py-4 rounded-[2rem]">
                  <p className="text-[10px] font-black uppercase text-primary opacity-60">Cycle Grand Total</p>
                  <p className="text-3xl font-black text-primary">Rs. {cycleStats.totalEntryAmt.toFixed(2)}</p>
                </div>
                <Button onClick={() => {
                   const pdf = new jsPDF('l', 'mm', 'a4');
                   pdf.setFontSize(16);
                   pdf.text("MASTER PROCUREMENT ROSTER", 14, 20);
                   (pdf as any).autoTable({
                     startY: 25,
                     head: [['CAN', 'FARMER NAME', 'MORNING', 'EVENING', 'TOTAL L', 'PAYOUT (Rs)']],
                     body: masterRoster.map(f => [f.canNumber, f.name, f.morningQty.toFixed(2), f.eveningQty.toFixed(2), f.totalQty.toFixed(2), f.totalAmount.toFixed(2)]),
                     theme: 'grid',
                     headStyles: { fillColor: [240, 240, 240], textColor: 0 },
                   });
                   pdf.save(`Master_Roster_${selectedMonth}_${currentCycle.label}.pdf`);
                }} className="rounded-full h-12 px-10 font-black uppercase">
                  <FileDown className="w-4 h-4 mr-2" /> Export Roster PDF
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="audit" className="space-y-8">
              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase py-5">Month</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase py-5">Volume (L)</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase py-5">Cost (Rs)</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase py-5">Revenue (Rs)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase py-5">Profit (Rs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthOptions.map((opt, i) => {
                       const mEntries = allEntries?.filter(e => e.date.startsWith(opt.value)) || [];
                       const mSales = allSales?.filter(s => s.date.startsWith(opt.value)) || [];
                       
                       let tCost = 0, tRev = 0, tQty = 0;
                       mEntries.forEach(e => {
                         const res = resolveEntryFinancials(e, farmers || [], ratesConfig);
                         tCost += res.cost;
                         tQty += res.qtyLitre;
                       });
                       mSales.forEach(s => {
                         const res = resolveSaleFinancials(s, buyers || [], ratesConfig);
                         tRev += res.cost;
                       });

                       return (
                        <TableRow key={i} className="hover:bg-muted/10 transition-colors">
                          <TableCell className="pl-10 font-black text-primary uppercase text-sm">{opt.label}</TableCell>
                          <TableCell className="text-center font-bold">{tQty.toFixed(2)}</TableCell>
                          <TableCell className="text-center text-destructive font-bold">Rs. {tCost.toFixed(2)}</TableCell>
                          <TableCell className="text-center text-green-600 font-bold">Rs. {tRev.toFixed(2)}</TableCell>
                          <TableCell className="text-right pr-10 font-black text-lg">
                            <span className={(tRev - tCost) >= 0 ? "text-green-600" : "text-destructive"}>Rs. {(tRev - tCost).toFixed(2)}</span>
                          </TableCell>
                        </TableRow>
                       );
                    })}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}

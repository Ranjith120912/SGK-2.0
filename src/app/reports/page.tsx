
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
  Moon,
  Scale,
  FileSpreadsheet,
  Users
} from "lucide-react";
import { format, endOfMonth, subMonths, startOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { utils, writeFile } from "xlsx";

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

  const { data: allEntries, isLoading: entriesLoading } = useCollection(entriesQuery);
  const { data: farmers, isLoading: farmersLoading } = useCollection(farmersQuery);
  const { data: allSales, isLoading: salesLoading } = useCollection(salesQuery);
  const { data: buyers } = useCollection(buyersQuery);
  const { data: ratesConfig } = useDoc(settingsRef);

  const currentCycle = cycles[activeCycle];

  /**
   * UNIFIED FINANCIAL RESOLUTION ENGINE
   * Strictly 0.96 Conversion Standard
   * Prioritizes Live Directory, falls back to saved transaction metadata.
   */
  const resolveEntryFinancials = (entry: any, farmersList: any[], config: any) => {
    const farmerInDirectory = farmersList?.find(f => f.id === entry.farmerId);
    
    // Identity Priority: Directory > Saved Metadata
    const farmerName = farmerInDirectory?.name || entry.farmerName || "Supplier " + (entry.canNumber || "???");
    const canNumber = farmerInDirectory?.canNumber || entry.canNumber || "???";

    // Volume Calculation: Strictly 0.96 (Prefer saved quantity if available)
    const kg = Number(entry.kgWeight) || 0;
    const quantity = entry.quantity !== undefined ? Number(entry.quantity) : parseFloat((kg * 0.96).toFixed(2));
    
    // Rate Priority: Saved Rate > Buffalo Custom > Buffalo Global > Cow Global
    let rate = Number(entry.rate) || 0;
    if (rate === 0 && farmerInDirectory) {
      if (farmerInDirectory.milkType === 'BUFFALO') {
        rate = Number(farmerInDirectory.customRate) > 0 
          ? Number(farmerInDirectory.customRate) 
          : (Number(config?.buffaloRate) || 0);
      } else {
        rate = Number(config?.cowRate) || 0;
      }
    }

    // Amount Priority: Saved Total > Calculated
    const amount = entry.totalAmount !== undefined ? Number(entry.totalAmount) : parseFloat((quantity * rate).toFixed(2));
    
    return { 
      kgWeight: kg,
      qtyLitre: quantity, 
      cost: amount, 
      appliedRate: rate,
      farmerName: farmerName,
      canNumber: canNumber,
      session: entry.session || "Morning",
      milkType: farmerInDirectory?.milkType || entry.milkType || 'COW'
    };
  };

  const resolveSaleFinancials = (sale: any, buyersList: any[], config: any) => {
    const qty = Number(sale.quantity) || 0;
    let rate = Number(sale.rate) || 0;
    if (rate === 0) {
      rate = sale.milkType === 'BUFFALO' ? (Number(config?.buffaloSellingRate) || 0) : (Number(config?.cowSellingRate) || 0);
    }
    const amount = sale.totalAmount !== undefined ? Number(sale.totalAmount) : parseFloat((qty * rate).toFixed(2));
    const buyer = buyersList?.find(b => b.id === sale.buyerId);
    
    return { 
      qty: qty, 
      cost: amount, 
      appliedRate: rate,
      buyerName: sale.buyerName || buyer?.name || "Unknown Buyer",
      milkType: sale.milkType,
      session: sale.session || "Morning"
    };
  };

  // --- Daily Report Logic (Horizontal AM/PM) ---
  const dailyData = useMemo(() => {
    if (!allEntries || !allSales || !farmers || !ratesConfig || !selectedDailyDate) {
      return { procurement: [], sales: [], totalProc: 0, totalSale: 0 };
    }

    const procMap: Record<string, any> = {};
    const filteredEntries = allEntries.filter(e => e.date === selectedDailyDate);
    
    filteredEntries.forEach(e => {
      const res = resolveEntryFinancials(e, farmers, ratesConfig);
      const key = e.farmerId;
      
      if (!procMap[key]) {
        procMap[key] = {
          can: res.canNumber,
          name: res.farmerName,
          amKg: 0, amLtr: 0,
          pmKg: 0, pmLtr: 0,
          totalLtr: 0,
          totalAmt: 0
        };
      }
      
      if (e.session === 'Morning') {
        procMap[key].amKg += res.kgWeight;
        procMap[key].amLtr += res.qtyLitre;
      } else {
        procMap[key].pmKg += res.kgWeight;
        procMap[key].pmLtr += res.qtyLitre;
      }
      
      // Precision sum
      procMap[key].totalLtr = parseFloat((procMap[key].amLtr + procMap[key].pmLtr).toFixed(2));
      procMap[key].totalAmt = parseFloat((procMap[key].totalAmt + res.cost).toFixed(2));
    });

    const dProc = Object.values(procMap).sort((a, b) => {
      const aNum = parseInt(a.can);
      const bNum = parseInt(b.can);
      if (isNaN(aNum) || isNaN(bNum)) return a.can.localeCompare(b.can);
      return aNum - bNum;
    });

    const dSale = allSales
      .filter(s => s.date === selectedDailyDate)
      .map(s => resolveSaleFinancials(s, buyers || [], ratesConfig))
      .sort((a, b) => a.buyerName.localeCompare(b.buyerName));

    return {
      procurement: dProc,
      sales: dSale,
      totalProc: dProc.reduce((acc, c: any) => acc + c.totalAmt, 0),
      totalSale: dSale.reduce((acc, c: any) => acc + c.cost, 0)
    };
  }, [allEntries, allSales, farmers, buyers, ratesConfig, selectedDailyDate]);

  // --- Master Summary & Cycle Stats ---
  const masterRoster = useMemo(() => {
    if (!allEntries || !farmers || !ratesConfig || !selectedMonth || !currentCycle) return [];
    
    const cycleEntries = allEntries.filter(e => {
      if (!e.date.startsWith(selectedMonth)) return false;
      const day = parseInt(e.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    });

    const farmerMap: Record<string, any> = {};

    cycleEntries.forEach(entry => {
      const res = resolveEntryFinancials(entry, farmers, ratesConfig);
      const key = entry.farmerId;
      
      if (!farmerMap[key]) {
        farmerMap[key] = {
          id: key,
          name: res.farmerName,
          canNumber: res.canNumber,
          morningQty: 0, eveningQty: 0, totalQty: 0, totalAmount: 0
        };
      }

      if (entry.session === 'Morning') farmerMap[key].morningQty += res.qtyLitre;
      else farmerMap[key].eveningQty += res.qtyLitre;
      farmerMap[key].totalAmount += res.cost;
    });

    return Object.values(farmerMap).map(f => ({
      ...f,
      morningQty: parseFloat(f.morningQty.toFixed(2)),
      eveningQty: parseFloat(f.eveningQty.toFixed(2)),
      totalQty: parseFloat((f.morningQty + f.eveningQty).toFixed(2)),
      totalAmount: parseFloat(f.totalAmount.toFixed(2))
    })).sort((a, b) => {
      const aNum = parseInt(a.canNumber);
      const bNum = parseInt(b.canNumber);
      if (isNaN(aNum) || isNaN(bNum)) return a.canNumber.localeCompare(b.canNumber);
      return aNum - bNum;
    });
  }, [allEntries, farmers, ratesConfig, selectedMonth, currentCycle]);

  const cycleStats = useMemo(() => {
    const totalProcurementAmt = masterRoster.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const totalProcurementQty = masterRoster.reduce((acc, curr) => acc + curr.totalQty, 0);

    const cycleSales = allSales?.filter(s => {
      if (!s.date.startsWith(selectedMonth)) return false;
      const day = parseInt(s.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    }) || [];

    let totalSaleAmt = 0;
    let totalSaleQty = 0;

    cycleSales.forEach(s => {
      const res = resolveSaleFinancials(s, buyers || [], ratesConfig);
      totalSaleAmt += res.cost;
      totalSaleQty += res.qty;
    });

    return {
      totalEntryQty: totalProcurementQty,
      totalSaleQty: totalSaleQty,
      totalEntryAmt: totalProcurementAmt,
      totalSaleAmt: totalSaleAmt,
      profit: totalSaleAmt - totalProcurementAmt
    };
  }, [masterRoster, allSales, selectedMonth, currentCycle, ratesConfig, buyers]);

  // --- Exports ---
  const generateDailyPDF = () => {
    const pdf = new jsPDF('l', 'mm', 'a4');
    const company = (ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS").toUpperCase();
    const dateStr = format(new Date(selectedDailyDate), 'dd/MM/yyyy');

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(company, 148, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text(`DAILY PROCUREMENT & SALES REPORT - ${dateStr}`, 148, 28, { align: 'center' });

    pdf.setFontSize(10);
    pdf.text("I. DAILY PROCUREMENT (HORIZONTAL AM/PM)", 14, 40);
    const procRows = dailyData.procurement.map((p: any) => [
      p.can, p.name, p.amKg.toFixed(2), p.amLtr.toFixed(2), p.pmKg.toFixed(2), p.pmLtr.toFixed(2), p.totalLtr.toFixed(2), p.totalAmt.toFixed(2)
    ]);

    (pdf as any).autoTable({
      startY: 43,
      head: [['CAN', 'FARMER NAME', 'AM-KG', 'AM-LTR', 'PM-KG', 'PM-LTR', 'TOT-LTR', 'AMOUNT (Rs)']],
      body: procRows,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
      margin: { left: 14, right: 14 }
    });

    let nextY = (pdf as any).lastAutoTable.finalY + 15;
    pdf.text("II. DAILY SALES / DISTRIBUTION", 14, nextY);
    const saleRows = dailyData.sales.map(s => [s.buyerName, s.session, s.milkType, s.qty.toFixed(2), s.appliedRate.toFixed(2), s.cost.toFixed(2)]);

    (pdf as any).autoTable({
      startY: nextY + 3,
      head: [['BUYER NAME', 'SESSION', 'MILK TYPE', 'QTY (L)', 'RATE (Rs)', 'AMOUNT (Rs)']],
      body: saleRows,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: 0 },
      margin: { left: 14, right: 14 }
    });

    pdf.save(`Daily_Report_${selectedDailyDate}.pdf`);
  };

  const generateDailyExcel = () => {
    const procData = dailyData.procurement.map((p: any) => ({
      "CAN": p.can,
      "FARMER NAME": p.name,
      "AM-KG": p.amKg, "AM-LITRE": p.amLtr,
      "PM-KG": p.pmKg, "PM-LITRE": p.pmLtr,
      "TOTAL LITRES": p.totalLtr,
      "TOTAL AMOUNT (Rs)": p.totalAmt
    }));

    const saleData = dailyData.sales.map(s => ({
      "BUYER NAME": s.buyerName,
      "SESSION": s.session,
      "MILK TYPE": s.milkType,
      "QUANTITY (L)": s.qty,
      "RATE (Rs)": s.appliedRate,
      "TOTAL AMOUNT (Rs)": s.cost
    }));

    const wb = utils.book_new();
    const ws1 = utils.json_to_sheet(procData);
    utils.book_append_sheet(wb, ws1, "Procurement");
    const ws2 = utils.json_to_sheet(saleData);
    utils.book_append_sheet(wb, ws2, "Sales");

    writeFile(wb, `Daily_Report_${selectedDailyDate}.xlsx`);
  };

  const generateSingleInvoice = (pdf: jsPDF, f: any) => {
    const company = (ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS").toUpperCase();
    const [y_part, m_part] = selectedMonth.split('-').map(Number);
    const range = `${currentCycle.start.toString().padStart(2, '0')}/${m_part.toString().padStart(2, '0')}/${y_part.toString().slice(-2)} to ${currentCycle.end.toString().padStart(2, '0')}/${m_part.toString().padStart(2, '0')}/${y_part.toString().slice(-2)}`;
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(company, 105, 20, { align: 'center' });
    pdf.setFontSize(13);
    pdf.text("MILK INVOICE", 105, 28, { align: 'center' });
    pdf.line(85, 30, 125, 30); 

    const drawField = (label: string, value: string, x: number, y: number) => {
      pdf.setFont("helvetica", "normal");
      pdf.text(label, x, y);
      const labelW = pdf.getTextWidth(label);
      pdf.setFont("helvetica", "bold");
      pdf.text(value, x + labelW + 5, y);
      pdf.line(x + labelW + 4, y + 1, x + labelW + 65, y + 1);
    };

    let y = 45;
    drawField("NAME:", f.name.toUpperCase(), 20, y);
    drawField("DATE:", format(new Date(), 'dd/MM/yyyy'), 110, y);
    y += 10;
    const farmerInDir = farmers?.find(item => item.id === f.id);
    drawField("A/C NO:", farmerInDir?.bankAccountNumber || "—", 20, y);
    drawField("PERIOD:", range, 110, y);
    y += 10;
    drawField("CAN NO:", f.canNumber, 20, y);
    const effectiveRate = farmerInDir?.customRate > 0 ? farmerInDir.customRate : (farmerInDir?.milkType === 'BUFFALO' ? ratesConfig?.buffaloRate : ratesConfig?.cowRate);
    drawField("RATE (Rs):", Number(effectiveRate || 0).toFixed(2), 110, y);

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
      head: [['DATE', 'MORNING (L)', 'EVENING (L)', 'TOTAL L', 'RATE (Rs)', 'AMOUNT (Rs)']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: 0, halign: 'center' },
      bodyStyles: { halign: 'center' },
      margin: { left: 20, right: 20 }
    });

    const finalY = (pdf as any).lastAutoTable.finalY;
    pdf.setFont("helvetica", "bold");
    pdf.text("TOTAL", 20, finalY + 10);
    pdf.text(f.totalQty.toFixed(2), 115, finalY + 10, { align: 'center' }); 
    pdf.text(f.totalAmount.toFixed(2), 190, finalY + 10, { align: 'right' });

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    pdf.text("Precision Locked to 0.96 Standard", 105, 275, { align: 'center' });
    pdf.line(140, 285, 190, 285);
    pdf.text("AUTHORIZED SIGNATURE", 165, 289, { align: 'center' });
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Reports & Audit</h1>
              <div className="flex items-center gap-4 mt-1">
                <Badge variant="outline" className="rounded-full flex items-center gap-2 border-primary/20 text-primary">
                  <Users className="w-3 h-3" /> {farmers?.length || 0} Suppliers Registered
                </Badge>
                <Badge variant="outline" className="rounded-full flex items-center gap-2 border-accent/20 text-accent">
                  <Scale className="w-3 h-3" /> Standard 0.96 Payouts
                </Badge>
              </div>
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px] rounded-full font-bold h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
            </Select>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b pb-4">
              <TabsList className="bg-muted p-1 rounded-full h-auto overflow-x-auto max-w-full no-scrollbar">
                <TabsTrigger value="overview" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Overview</TabsTrigger>
                <TabsTrigger value="daily" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Daily Report</TabsTrigger>
                <TabsTrigger value="cycle" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Farmer Bills</TabsTrigger>
                <TabsTrigger value="master" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Master Roster</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Audit Log</TabsTrigger>
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
            </TabsContent>

            <TabsContent value="daily" className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card p-6 rounded-3xl border shadow-sm">
                <div className="flex items-center gap-4">
                  <Calendar className="text-primary" />
                  <Input type="date" value={selectedDailyDate} onChange={(e) => setSelectedDailyDate(e.target.value)} className="w-[200px] font-bold" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={generateDailyExcel} variant="outline" className="rounded-full h-11 px-6"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
                  <Button onClick={generateDailyPDF} className="rounded-full h-11 px-8"><Printer className="mr-2 h-4 w-4" /> PDF Report</Button>
                </div>
              </div>

              <Card className="rounded-3xl border-none shadow-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead rowSpan={2} className="text-center font-black text-[10px] border-r">CAN</TableHead>
                      <TableHead rowSpan={2} className="font-black text-[10px] border-r">Supplier Name</TableHead>
                      <TableHead colSpan={2} className="text-center font-black text-[10px] border-r bg-orange-500/5">AM (Morning)</TableHead>
                      <TableHead colSpan={2} className="text-center font-black text-[10px] border-r bg-blue-500/5">PM (Evening)</TableHead>
                      <TableHead rowSpan={2} className="text-center font-black text-[10px] border-r">Total L</TableHead>
                      <TableHead rowSpan={2} className="text-right font-black text-[10px] pr-6">Amount (Rs)</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead className="text-center text-[9px] border-r">KG</TableHead>
                      <TableHead className="text-center text-[9px] border-r">LTR</TableHead>
                      <TableHead className="text-center text-[9px] border-r">KG</TableHead>
                      <TableHead className="text-center text-[9px] border-r">LTR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyData.procurement.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-20 italic text-muted-foreground">No collections for this date.</TableCell></TableRow>
                    ) : (
                      dailyData.procurement.map((p: any, i) => (
                        <TableRow key={i} className="hover:bg-primary/5">
                          <TableCell className="text-center font-black border-r text-primary">{p.can}</TableCell>
                          <TableCell className="font-bold border-r">{p.name}</TableCell>
                          <TableCell className="text-center border-r font-medium">{p.amKg.toFixed(2)}</TableCell>
                          <TableCell className="text-center border-r font-bold text-orange-600">{p.amLtr.toFixed(2)}</TableCell>
                          <TableCell className="text-center border-r font-medium">{p.pmKg.toFixed(2)}</TableCell>
                          <TableCell className="text-center border-r font-bold text-blue-600">{p.pmLtr.toFixed(2)}</TableCell>
                          <TableCell className="text-center border-r font-black text-primary">{p.totalLtr.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-black pr-6">₹ {p.totalAmt.toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="cycle" className="space-y-6">
              <div className="flex justify-end">
                <Button onClick={() => {
                  const pdf = new jsPDF();
                  const valid = masterRoster.filter(f => f.totalQty > 0);
                  valid.forEach((f, i) => { if (i > 0) pdf.addPage(); generateSingleInvoice(pdf, f); });
                  pdf.save(`Bills_${selectedMonth}_${currentCycle.label}.pdf`);
                }} className="rounded-full bg-red-600 hover:bg-red-700 h-12 px-10">
                  <Download className="mr-2 h-4 w-4" /> Download All Bills
                </Button>
              </div>
              <Card className="rounded-3xl border-none shadow-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px]">CAN</TableHead>
                      <TableHead className="font-black text-[10px]">Supplier Name</TableHead>
                      <TableHead className="text-right font-black text-[10px]">Volume (L)</TableHead>
                      <TableHead className="text-right font-black text-[10px]">Payout (Rs)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masterRoster.filter(f => f.totalQty > 0).map(f => (
                      <TableRow key={f.id} className="hover:bg-primary/5">
                        <TableCell className="pl-10 font-black text-primary text-lg">{f.canNumber}</TableCell>
                        <TableCell className="font-bold uppercase">{f.name}</TableCell>
                        <TableCell className="text-right font-bold">{f.totalQty.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-black text-primary">₹ {f.totalAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10">
                          <Button variant="ghost" size="sm" onClick={() => {
                            const pdf = new jsPDF();
                            generateSingleInvoice(pdf, f);
                            pdf.save(`Bill_${f.canNumber}_${f.name}.pdf`);
                          }} className="text-red-600 font-bold uppercase text-[10px]">
                            PDF Bill
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="master" className="space-y-6">
              <div className="flex justify-between items-center bg-primary p-8 rounded-[2rem] text-white shadow-xl">
                <div>
                  <p className="text-xs font-black uppercase opacity-60">Cycle Grand Total</p>
                  <p className="text-4xl font-black mt-1">₹ {cycleStats.totalEntryAmt.toFixed(2)}</p>
                </div>
                <Button onClick={() => {
                  const pdf = new jsPDF('l', 'mm', 'a4');
                  pdf.text("MASTER PROCUREMENT ROSTER", 14, 20);
                  (pdf as any).autoTable({
                    startY: 25,
                    head: [['CAN', 'SUPPLIER NAME', 'MORNING', 'EVENING', 'TOTAL L', 'PAYOUT (Rs)']],
                    body: masterRoster.map(f => [f.canNumber, f.name, f.morningQty.toFixed(2), f.eveningQty.toFixed(2), f.totalQty.toFixed(2), f.totalAmount.toFixed(2)]),
                    theme: 'grid',
                    headStyles: { fillColor: [240, 240, 240], textColor: 0 }
                  });
                  pdf.save(`Master_Roster_${selectedMonth}_${currentCycle.label}.pdf`);
                }} className="rounded-full bg-white text-primary hover:bg-white/90 h-12 px-8">
                  <FileDown className="mr-2 h-4 w-4" /> Export Roster PDF
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="audit" className="space-y-6">
              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] py-5">Month</TableHead>
                      <TableHead className="text-center font-black text-[10px]">Volume (L)</TableHead>
                      <TableHead className="text-center font-black text-[10px]">Procurement (Rs)</TableHead>
                      <TableHead className="text-center font-black text-[10px]">Revenue (Rs)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px]">Profit (Rs)</TableHead>
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
                        <TableRow key={i} className="hover:bg-muted/10">
                          <TableCell className="pl-10 font-black text-primary uppercase text-sm">{opt.label}</TableCell>
                          <TableCell className="text-center font-bold">{tQty.toFixed(2)}</TableCell>
                          <TableCell className="text-center text-destructive font-bold">₹ {tCost.toFixed(2)}</TableCell>
                          <TableCell className="text-center text-green-600 font-bold">₹ {tRev.toFixed(2)}</TableCell>
                          <TableCell className="text-right pr-10 font-black text-lg">
                            <span className={(tRev - tCost) >= 0 ? "text-green-600" : "text-destructive"}>₹ {(tRev - tCost).toFixed(2)}</span>
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

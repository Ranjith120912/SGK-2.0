
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
  ShieldCheck,
  TrendingUp,
  IndianRupee,
  ChevronRight,
  FileDown,
  Milk,
  ArrowRight,
  CalendarDays,
  PieChart
} from "lucide-react";
import { format, endOfMonth, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import jspdf from "jspdf";
import "jspdf-autotable";

export default function ReportsPage() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const now = new Date();
    setSelectedMonth(format(now, 'yyyy-MM'));
  }, []);

  const monthOptions = useMemo(() => {
    if (!isClient) return [];
    const now = new Date();
    return Array.from({ length: 12 }).map((_, i) => {
      const d = subMonths(now, i);
      return {
        value: format(d, 'yyyy-MM'),
        label: format(d, 'MMMM yyyy')
      };
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

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: allEntries } = useCollection(entriesQuery);
  const { data: farmers } = useCollection(farmersQuery);
  const { data: allSales } = useCollection(salesQuery);
  const { data: ratesConfig } = useDoc(settingsRef);

  const currentCycle = cycles[activeCycle];

  /**
   * Centralized Rate & Cost Resolution Engine
   */
  const resolveEntryCost = (entry: any, farmersList: any[], config: any) => {
    const qtyLitre = Number(entry.quantity) || 0;
    if (qtyLitre === 0) return 0;

    const farmer = farmersList?.find(f => f.id === entry.farmerId);
    let resolvedRate = 0;
    
    if (farmer) {
      if (farmer.milkType === 'BUFFALO') {
        resolvedRate = Number(farmer.customRate) > 0 
          ? Number(farmer.customRate) 
          : (Number(config?.buffaloRate) || 0);
      } else {
        resolvedRate = Number(config?.cowRate) || 0;
      }
    } else {
      resolvedRate = Number(entry.rate) || 0;
    }

    return parseFloat((qtyLitre * resolvedRate).toFixed(2));
  };

  const filteredCycleEntries = useMemo(() => {
    if (!allEntries || !selectedMonth || !currentCycle) return [];
    return allEntries.filter(entry => {
      if (!entry.date.startsWith(selectedMonth)) return false;
      const day = parseInt(entry.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    });
  }, [allEntries, selectedMonth, currentCycle]);

  const filteredCycleSales = useMemo(() => {
    if (!allSales || !selectedMonth || !currentCycle) return [];
    return allSales.filter(sale => {
      if (!sale.date.startsWith(selectedMonth)) return false;
      const day = parseInt(sale.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    });
  }, [allSales, selectedMonth, currentCycle]);

  const masterRoster = useMemo(() => {
    if (!farmers || !currentCycle) return [];
    return farmers.map(farmer => {
      const fEntries = filteredCycleEntries.filter(e => e.farmerId === farmer.id);
      
      const mQty = fEntries.filter(e => e.session === 'Morning').reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
      const eQty = fEntries.filter(e => e.session === 'Evening').reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
      const totalQty = mQty + eQty;

      const totalAmount = fEntries.reduce((acc, curr) => {
        return acc + resolveEntryCost(curr, farmers, ratesConfig);
      }, 0);

      return {
        ...farmer,
        morningQty: mQty,
        eveningQty: eQty,
        totalQty: totalQty,
        totalAmount: totalAmount
      };
    }).sort((a, b) => {
      const aNum = parseInt(a.canNumber);
      const bNum = parseInt(b.canNumber);
      return (isNaN(aNum) || isNaN(bNum)) ? a.canNumber.localeCompare(b.canNumber) : aNum - bNum;
    });
  }, [farmers, filteredCycleEntries, ratesConfig, currentCycle]);

  const cowRoster = masterRoster.filter(f => f.milkType === 'COW' || !f.milkType);
  const buffaloRoster = masterRoster.filter(f => f.milkType === 'BUFFALO');

  const activeInvoices = masterRoster.filter(f => f.totalQty > 0);

  const cycleStats = useMemo(() => {
    if (!filteredCycleEntries || !filteredCycleSales || !farmers) return {
      totalEntryQty: 0,
      totalSaleQty: 0,
      totalEntryAmt: 0,
      totalSaleAmt: 0,
      profit: 0
    };
    
    const totalEntryQty = filteredCycleEntries.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
    const totalSaleQty = filteredCycleSales.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
    
    const totalEntryAmt = filteredCycleEntries.reduce((acc, curr) => {
      return acc + resolveEntryCost(curr, farmers, ratesConfig);
    }, 0);

    const totalSaleAmt = filteredCycleSales.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);

    return {
      totalEntryQty,
      totalSaleQty,
      totalEntryAmt,
      totalSaleAmt,
      profit: totalSaleAmt - totalEntryAmt
    };
  }, [filteredCycleEntries, filteredCycleSales, farmers, ratesConfig]);

  const monthStats = useMemo(() => {
    if (!allEntries || !allSales || !selectedMonth || !farmers) return {
      totalEntryQty: 0,
      totalSaleQty: 0,
      totalEntryAmt: 0,
      totalSaleAmt: 0,
      profit: 0
    };
    
    const mEntries = allEntries.filter(e => e.date.startsWith(selectedMonth));
    const mSales = allSales.filter(s => s.date.startsWith(selectedMonth));

    const totalEntryQty = mEntries.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
    const totalSaleQty = mSales.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
    
    const totalEntryAmt = mEntries.reduce((acc, curr) => {
      return acc + resolveEntryCost(curr, farmers, ratesConfig);
    }, 0);

    const totalSaleAmt = mSales.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);

    return {
      totalEntryQty,
      totalSaleQty,
      totalEntryAmt,
      totalSaleAmt,
      profit: totalSaleAmt - totalEntryAmt
    };
  }, [allEntries, allSales, selectedMonth, farmers, ratesConfig]);

  const monthlyAuditSummary = useMemo(() => {
    if (!allEntries || !allSales || !isClient || !farmers) return [];
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const fiscalYearStart = currentMonth < 3 ? currentYear - 1 : currentYear;
    
    return Array.from({ length: 12 }).map((_, i) => {
      const monthIdx = (3 + i) % 12; 
      const year = fiscalYearStart + (3 + i >= 12 ? 1 : 0);
      const d = new Date(year, monthIdx, 1);
      const monthStr = format(d, 'yyyy-MM');
      const monthName = format(d, 'MMMM yyyy');
      
      const mEntries = allEntries.filter(e => e.date.startsWith(monthStr));
      const mSales = allSales.filter(s => s.date.startsWith(monthStr));
      
      const collectionL = mEntries.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
      const cost = mEntries.reduce((acc, curr) => acc + resolveEntryCost(curr, farmers, ratesConfig), 0);
      const revenue = mSales.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
      const profit = revenue - cost;
      
      return { monthName, collectionL, cost, revenue, profit };
    });
  }, [allEntries, allSales, isClient, farmers, ratesConfig]);

  const grandTotalAmt = masterRoster.reduce((acc, curr) => acc + curr.totalAmount, 0);

  const calculateRosterTotals = (roster: any[]) => {
    return {
      morning: roster.reduce((acc, curr) => acc + curr.morningQty, 0),
      evening: roster.reduce((acc, curr) => acc + curr.eveningQty, 0),
      total: roster.reduce((acc, curr) => acc + curr.totalQty, 0),
      amount: roster.reduce((acc, curr) => acc + curr.totalAmount, 0)
    };
  };

  const cowTotals = calculateRosterTotals(cowRoster);
  const buffaloTotals = calculateRosterTotals(buffaloRoster);

  const generateSingleInvoice = (doc: jspdf, farmer: any) => {
    const companyName = (ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS").toUpperCase();
    const [year, month] = selectedMonth.split('-').map(Number);
    const cycleStart = currentCycle.start;
    const cycleEnd = currentCycle.end;
    const startDateFormatted = `${cycleStart.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
    const endDateFormatted = `${cycleEnd.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
    const periodString = `${startDateFormatted} to ${endDateFormatted}`;

    let resolvedRate = 0;
    if (farmer.milkType === 'BUFFALO') {
      resolvedRate = Number(farmer.customRate) > 0 
        ? Number(farmer.customRate) 
        : (Number(ratesConfig?.buffaloRate) || 0);
    } else {
      resolvedRate = Number(ratesConfig?.cowRate) || 0;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(companyName, 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text("MILK INVOICE", 105, 28, { align: 'center' });
    doc.line(88, 30, 122, 30);

    doc.setFontSize(10);
    let y = 45;

    doc.setFont("helvetica", "normal");
    doc.text("NAME:", 20, y);
    doc.setFont("helvetica", "bold");
    doc.text(farmer.name.toUpperCase(), 45, y);
    doc.line(45, y+1, 100, y+1);

    doc.setFont("helvetica", "normal");
    doc.text("DATE:", 110, y);
    doc.setFont("helvetica", "bold");
    doc.text(format(new Date(), 'dd/MM/yyyy'), 135, y);
    doc.line(135, y+1, 190, y+1);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.text("A/C NO:", 20, y);
    doc.setFont("helvetica", "bold");
    doc.text(farmer.bankAccountNumber || "—", 45, y);
    doc.line(45, y+1, 100, y+1);

    doc.setFont("helvetica", "normal");
    doc.text("PERIOD:", 110, y);
    doc.setFont("helvetica", "bold");
    doc.text(periodString, 135, y);
    doc.line(135, y+1, 190, y+1);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.text("CAN NO:", 20, y);
    doc.setFont("helvetica", "bold");
    doc.text(farmer.canNumber, 45, y);
    doc.line(45, y+1, 100, y+1);

    doc.setFont("helvetica", "normal");
    doc.text("RATE (Rs):", 110, y);
    doc.setFont("helvetica", "bold");
    doc.text(resolvedRate.toFixed(2), 135, y);
    doc.line(135, y+1, 190, y+1);

    const cycleEntries = filteredCycleEntries.filter(e => e.farmerId === farmer.id);
    const dateMap: Record<string, { morning: number, evening: number }> = {};
    for (let d = cycleStart; d <= cycleEnd; d++) {
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      dateMap[dateStr] = { morning: 0, evening: 0 };
    }
    
    cycleEntries.forEach(e => {
      if (dateMap[e.date]) {
        if (e.session === 'Morning') dateMap[e.date].morning += Number(e.quantity);
        else dateMap[e.date].evening += Number(e.quantity);
      }
    });

    const tableRows = Object.keys(dateMap).sort().map(date => {
      const d = dateMap[date];
      const totalL = d.morning + d.evening;
      const amt = parseFloat((totalL * resolvedRate).toFixed(2));
      return [
        format(new Date(date), 'dd/MM/yy'), 
        d.morning.toFixed(2), 
        d.evening.toFixed(2), 
        totalL.toFixed(2), 
        resolvedRate.toFixed(2), 
        amt.toFixed(2)
      ];
    });

    (doc as any).autoTable({
      startY: y + 15,
      head: [['DATE', 'MORNING (L)', 'EVENING (L)', 'TOTAL LITRES', 'RATE (Rs)', 'AMOUNT (Rs)']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0], halign: 'center' },
      bodyStyles: { textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], halign: 'center' },
      margin: { left: 20, right: 20 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFont("helvetica", "bold");
    doc.line(20, finalY, 190, finalY);
    doc.text("TOTAL", 25, finalY + 5);
    doc.text(farmer.totalQty.toFixed(2), 125, finalY + 5, { align: 'center' });
    doc.text(farmer.totalAmount.toFixed(2), 185, finalY + 5, { align: 'right' });
    doc.line(20, finalY + 8, 190, finalY + 8);

    doc.text("Total Amount (Rs):", 155, finalY + 25, { align: 'right' });
    doc.text(farmer.totalAmount.toFixed(2), 185, finalY + 25, { align: 'right' });
    doc.setFontSize(9);
    doc.text("AUTHORIZED SIGNATURE", 140, 275);
  };

  const handleDownloadRosterPDF = () => {
    const doc = new jspdf('l', 'mm', 'a4');
    const companyName = ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS";
    const cycleLabel = currentCycle?.label || "";
    const monthLabel = monthOptions.find(o => o.value === selectedMonth)?.label || "";

    const addRosterSection = (title: string, roster: any[], startY: number, totals: any) => {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, startY);

      const tableData = roster.map(f => [
        f.canNumber,
        f.name,
        f.bankAccountNumber || "—",
        f.morningQty.toFixed(2),
        f.eveningQty.toFixed(2),
        f.totalQty.toFixed(2),
        `Rs. ${f.totalAmount.toFixed(2)}`
      ]);

      (doc as any).autoTable({
        startY: startY + 5,
        head: [['CAN', 'FARMER NAME', 'BANK A/C', 'MORNING (L)', 'EVENING (L)', 'TOTAL L', 'PAYOUT (Rs.)']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        foot: [['', 'Totals', '', totals.morning.toFixed(2), totals.evening.toFixed(2), totals.total.toFixed(2), `Rs. ${totals.amount.toFixed(2)}`]],
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        margin: { bottom: 20 }
      });

      return (doc as any).lastAutoTable.finalY + 15;
    };

    doc.setFontSize(18);
    doc.text(companyName.toUpperCase(), 14, 20);
    doc.setFontSize(12);
    doc.text(`Master Roster: ${cycleLabel} - ${monthLabel}`, 14, 28);

    let currentY = 35;
    if (cowRoster.length > 0) {
      currentY = addRosterSection("COW MILK ROSTER", cowRoster, currentY, cowTotals);
    }
    
    if (buffaloRoster.length > 0) {
      if (currentY > 160) { doc.addPage('l', 'mm', 'a4'); currentY = 20; }
      addRosterSection("BUFFALO MILK ROSTER", buffaloRoster, currentY, buffaloTotals);
    }

    doc.save(`Master_Roster_${selectedMonth}_${cycleLabel}.pdf`);
  };

  const handleDownloadFarmerBillPDF = (farmerId: string) => {
    const f = masterRoster.find(m => m.id === farmerId);
    if (!f) return;
    const doc = new jspdf();
    generateSingleInvoice(doc, f);
    doc.save(`Invoice_${f.canNumber}_${f.name}_${selectedMonth}.pdf`);
  };

  const handleDownloadBulkInvoicesPDF = () => {
    if (activeInvoices.length === 0) return;
    const doc = new jspdf();
    activeInvoices.forEach((f, idx) => {
      if (idx > 0) doc.addPage();
      generateSingleInvoice(doc, f);
    });
    doc.save(`Bulk_Invoices_${selectedMonth}_${currentCycle?.label}.pdf`);
  };

  const renderRosterTable = (title: string, roster: any[], totals: any, colorClass: string) => {
    if (roster.length === 0) return null;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl", colorClass.replace('text-', 'bg-').replace('600', '50'))}>
            <Milk className={cn("w-5 h-5", colorClass)} />
          </div>
          <h2 className={cn("text-xl font-black uppercase tracking-tight", colorClass)}>{title}</h2>
        </div>
        <div className="border rounded-2xl overflow-hidden border-black/10 bg-white">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-b border-black/10">
                <TableHead className="font-black text-[10px] text-primary uppercase tracking-widest py-5 pl-8 border-r border-black/5">CAN</TableHead>
                <TableHead className="font-black text-[10px] text-primary uppercase tracking-widest py-5 border-r border-black/5">FARMER NAME</TableHead>
                <TableHead className="font-black text-[10px] text-primary uppercase tracking-widest py-5 border-r border-black/5">BANK A/C</TableHead>
                <TableHead className="text-center font-black text-[10px] text-primary uppercase tracking-widest py-5 border-r border-black/5">MORNING (L)</TableHead>
                <TableHead className="text-center font-black text-[10px] text-primary uppercase tracking-widest py-5 border-r border-black/5">EVENING (L)</TableHead>
                <TableHead className="text-center font-black text-[10px] text-primary uppercase tracking-widest py-5 border-r border-black/5">TOTAL L</TableHead>
                <TableHead className="text-right font-black text-[10px] text-primary uppercase tracking-widest py-5 pr-8">PAYOUT (Rs)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roster.map((f) => (
                <TableRow key={f.id} className="hover:bg-primary/5 border-b border-black/5 transition-colors">
                  <TableCell className="font-black text-primary text-lg pl-8 py-4 border-r border-black/5">{f.canNumber}</TableCell>
                  <TableCell className="font-bold uppercase text-sm border-r border-black/5">{f.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground border-r border-black/5">{f.bankAccountNumber || "—"}</TableCell>
                  <TableCell className="text-center font-medium border-r border-black/5">{f.morningQty.toFixed(2)}</TableCell>
                  <TableCell className="text-center font-medium border-r border-black/5">{f.eveningQty.toFixed(2)}</TableCell>
                  <TableCell className="text-center font-bold border-r border-black/5">{f.totalQty.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-black text-primary pr-8">Rs. {f.totalAmount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot className="bg-muted/50 border-t border-black/10">
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="pl-8 py-5 font-black text-primary uppercase text-xs border-r border-black/5">{title} Totals</TableCell>
                <TableCell className="text-center font-black border-r border-black/5">{totals.morning.toFixed(2)}</TableCell>
                <TableCell className="text-center font-black border-r border-black/5">{totals.evening.toFixed(2)}</TableCell>
                <TableCell className="text-center font-black border-r border-black/5">{totals.total.toFixed(2)} L</TableCell>
                <TableCell className="text-right font-black text-primary text-lg pr-8">Rs. {totals.amount.toFixed(2)}</TableCell>
              </TableRow>
            </tfoot>
          </Table>
        </div>
      </div>
    );
  };

  if (!isClient || !selectedMonth) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">{ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS"} Reports</h1>
              <p className="text-muted-foreground font-medium">Financial Summary • April - March Cycle</p>
            </div>
            <div className="flex gap-4">
               <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px] rounded-full font-bold h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </header>

          <Tabs defaultValue="overview" className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
              <TabsList className="bg-muted p-1 rounded-full h-auto">
                <TabsTrigger value="overview" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Overview</TabsTrigger>
                <TabsTrigger value="cycle" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Cycle Bill</TabsTrigger>
                <TabsTrigger value="master" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Master Summary</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Audit</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-full border">
                {cycles.map((c, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveCycle(i)} 
                    className={cn(
                      "rounded-full text-[10px] font-black px-4 h-8 transition-all", 
                      activeCycle === i ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <TabsContent value="overview" className="animate-in fade-in duration-500 space-y-12">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <CalendarDays className="w-5 h-5" />
                  <h2 className="font-black uppercase tracking-widest text-sm">Selected Cycle Statistics ({currentCycle.label})</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="rounded-[2rem] bg-primary text-white p-8 shadow-xl shadow-primary/20">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cycle Volume</p>
                    <p className="text-4xl font-black mt-4">{cycleStats.totalEntryQty.toFixed(2)} L</p>
                  </Card>
                  <Card className="rounded-[2rem] bg-accent text-white p-8 shadow-xl shadow-accent/20">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cycle Sales</p>
                    <p className="text-4xl font-black mt-4">Rs. {cycleStats.totalSaleAmt.toFixed(2)}</p>
                  </Card>
                  <Card className="rounded-[2rem] p-8 border-none shadow-xl bg-card border-l-4 border-destructive">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Cycle Payout</p>
                    <p className="text-3xl font-black mt-4 text-destructive">Rs. {cycleStats.totalEntryAmt.toFixed(2)}</p>
                  </Card>
                  <Card className="rounded-[2rem] p-8 border-none shadow-xl bg-card border-l-4 border-green-500">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Cycle Profit</p>
                    <p className={cn("text-3xl font-black mt-4", cycleStats.profit >= 0 ? "text-green-600" : "text-destructive")}>
                      Rs. {cycleStats.profit.toFixed(2)}
                    </p>
                  </Card>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <PieChart className="w-5 h-5" />
                  <h2 className="font-black uppercase tracking-widest text-sm">Full Month Summary ({monthOptions.find(o => o.value === selectedMonth)?.label})</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center justify-between p-6 bg-muted/30 rounded-3xl border">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Monthly Volume</span>
                    <span className="text-2xl font-black text-primary">{monthStats.totalEntryQty.toFixed(2)} L</span>
                  </div>
                  <div className="flex items-center justify-between p-6 bg-muted/30 rounded-3xl border">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Monthly Procurement</span>
                    <span className="text-2xl font-black text-destructive">Rs. {monthStats.totalEntryAmt.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-6 bg-muted/30 rounded-3xl border">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Monthly Profit</span>
                    <span className={cn("text-2xl font-black", monthStats.profit >= 0 ? "text-green-600" : "text-destructive")}>
                      Rs. {monthStats.profit.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="cycle" className="space-y-6 animate-in fade-in">
              <div className="flex justify-end items-center">
                <Button onClick={handleDownloadBulkInvoicesPDF} disabled={activeInvoices.length === 0} className="rounded-full bg-red-600 shadow-lg shadow-red-200 hover:bg-red-700">
                  <Download className="w-4 h-4 mr-2" /> Download Bulk Invoices
                </Button>
              </div>
              <Card className="rounded-3xl overflow-hidden border-none shadow-lg bg-card/50 backdrop-blur-sm">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-10 font-black text-[10px] text-primary uppercase tracking-widest py-5">CAN</TableHead>
                      <TableHead className="font-black text-[10px] text-primary uppercase tracking-widest py-5">Farmer Name</TableHead>
                      <TableHead className="text-right font-black text-[10px] text-primary uppercase tracking-widest py-5">Qty (L)</TableHead>
                      <TableHead className="text-right font-black text-[10px] text-primary uppercase tracking-widest py-5">Amount (Rs)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] text-primary uppercase tracking-widest py-5">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeInvoices.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-medium">No active collections in this cycle.</TableCell></TableRow>
                    ) : (
                      activeInvoices.map(f => (
                        <TableRow key={f.id} className="hover:bg-primary/5 transition-colors">
                          <TableCell className="pl-10 font-black text-primary text-lg">{f.canNumber}</TableCell>
                          <TableCell className="font-bold uppercase text-sm">{f.name}</TableCell>
                          <TableCell className="text-right font-black">{f.totalQty.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-primary">Rs. {f.totalAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-right pr-10">
                            <Button variant="ghost" onClick={() => handleDownloadFarmerBillPDF(f.id)} className="text-red-600 font-black uppercase text-[10px] hover:bg-red-50">
                              <Download className="w-3 h-3 mr-2" /> Download Bill
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="master" className="space-y-10 animate-in fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-primary px-8 py-4 rounded-[2rem] text-white shadow-xl shadow-primary/10 border-b-4 border-black/10">
                    <p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Grand Total Payout ({currentCycle.label})</p>
                    <p className="text-3xl font-black mt-1">Rs. {grandTotalAmt.toFixed(2)}</p>
                  </div>
                </div>
                <Button onClick={handleDownloadRosterPDF} className="rounded-full h-12 px-10 font-black uppercase text-[10px] shadow-lg hover:shadow-primary/20 transition-all">
                  <FileDown className="w-4 h-4 mr-2" /> Export PDF Roster
                </Button>
              </div>

              {renderRosterTable("Cow Milk Roster", cowRoster, cowTotals, "text-blue-600")}
              {renderRosterTable("Buffalo Milk Roster", buffaloRoster, buffaloTotals, "text-indigo-600")}
            </TabsContent>

            <TabsContent value="audit" className="animate-in fade-in">
              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card/50 backdrop-blur-sm">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-10 font-black text-[10px] text-primary uppercase tracking-widest py-5">Month</TableHead>
                      <TableHead className="text-center font-black text-[10px] text-primary uppercase tracking-widest py-5">Collection (L)</TableHead>
                      <TableHead className="text-center font-black text-[10px] text-primary uppercase tracking-widest py-5">Procurement Cost (Rs)</TableHead>
                      <TableHead className="text-center font-black text-[10px] text-primary uppercase tracking-widest py-5">Sales Revenue (Rs)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] text-primary uppercase tracking-widest py-5">Net Profit (Rs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyAuditSummary.map((m, i) => (
                      <TableRow key={i} className="border-b last:border-0 hover:bg-muted/5 transition-colors">
                        <TableCell className="pl-10 font-black text-primary uppercase text-sm">{m.monthName}</TableCell>
                        <TableCell className="text-center font-bold">{m.collectionL.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-destructive font-mono">Rs. {m.cost.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-green-600 font-mono">Rs. {m.revenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10 font-black text-lg">
                          <span className={cn(m.profit >= 0 ? "text-green-600" : "text-destructive")}>
                            Rs. {m.profit.toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
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

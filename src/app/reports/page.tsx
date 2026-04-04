
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
  FileDown
} from "lucide-react";
import { format, endOfMonth, subMonths, startOfMonth, isSameMonth, lastDayOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
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
  
  const filteredCycleEntries = useMemo(() => {
    if (!allEntries || !selectedMonth || !currentCycle) return [];
    return allEntries.filter(entry => {
      if (!entry.date.startsWith(selectedMonth)) return false;
      const day = parseInt(entry.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    });
  }, [allEntries, selectedMonth, currentCycle]);

  const masterRoster = useMemo(() => {
    if (!farmers) return [];
    return farmers.map(farmer => {
      const fEntries = filteredCycleEntries.filter(e => e.farmerId === farmer.id);
      return {
        ...farmer,
        morningQty: fEntries.filter(e => e.session === 'Morning').reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0),
        eveningQty: fEntries.filter(e => e.session === 'Evening').reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0),
        totalQty: fEntries.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0),
        totalAmount: fEntries.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0)
      };
    }).sort((a, b) => {
      const aNum = parseInt(a.canNumber);
      const bNum = parseInt(b.canNumber);
      return (isNaN(aNum) || isNaN(bNum)) ? a.canNumber.localeCompare(b.canNumber) : aNum - bNum;
    });
  }, [farmers, filteredCycleEntries]);

  const activeInvoices = masterRoster.filter(f => f.totalQty > 0);

  const monthStats = useMemo(() => {
    if (!allEntries || !allSales || !selectedMonth) return {
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
    const totalEntryAmt = mEntries.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
    const totalSaleAmt = mSales.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);

    return {
      totalEntryQty,
      totalSaleQty,
      totalEntryAmt,
      totalSaleAmt,
      profit: totalSaleAmt - totalEntryAmt
    };
  }, [allEntries, allSales, selectedMonth]);

  const monthlyAuditSummary = useMemo(() => {
    if (!allEntries || !allSales || !isClient) return [];
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const fiscalStartYear = currentMonth < 3 ? currentYear - 1 : currentYear;
    
    return Array.from({ length: 12 }).map((_, i) => {
      const monthIndex = (3 + i) % 12;
      const year = fiscalStartYear + (3 + i >= 12 ? 1 : 0);
      const d = new Date(year, monthIndex, 1);
      const monthStr = format(d, 'yyyy-MM');
      const monthName = format(d, 'MMMM yyyy');
      
      const mEntries = allEntries.filter(e => e.date.startsWith(monthStr));
      const mSales = allSales.filter(s => s.date.startsWith(monthStr));
      
      const collectionL = mEntries.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
      const cost = mEntries.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
      const revenue = mSales.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
      const profit = revenue - cost;
      
      return { monthName, collectionL, cost, revenue, profit };
    });
  }, [allEntries, allSales, isClient]);

  const grandTotalMorning = masterRoster.reduce((acc, curr) => acc + curr.morningQty, 0);
  const grandTotalEvening = masterRoster.reduce((acc, curr) => acc + curr.eveningQty, 0);
  const grandTotalQty = masterRoster.reduce((acc, curr) => acc + curr.totalQty, 0);
  const grandTotalAmt = masterRoster.reduce((acc, curr) => acc + curr.totalAmount, 0);

  const handleDownloadRosterPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const companyName = ratesConfig?.companyName || "SRI GOPALA KRISHNA MILK DISTRIBUTIONS";
    const cycleLabel = currentCycle?.label || "";
    const monthLabel = monthOptions.find(o => o.value === selectedMonth)?.label || "";

    doc.setFontSize(18);
    doc.text(companyName, 14, 20);
    doc.setFontSize(14);
    doc.text(`Master Roster: ${cycleLabel} - ${monthLabel}`, 14, 28);

    const tableData = masterRoster.map(f => [
      f.canNumber,
      f.name,
      f.bankAccountNumber || "—",
      f.morningQty.toFixed(2),
      f.eveningQty.toFixed(2),
      f.totalQty.toFixed(2),
      `Rs. ${f.totalAmount.toFixed(2)}`
    ]);

    (doc as any).autoTable({
      startY: 35,
      head: [['CAN', 'FARMER NAME', 'BANK A/C', 'MORNING (L)', 'EVENING (L)', 'TOTAL L', 'PAYOUT (Rs.)']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      foot: [['', 'Grand Totals', '', grandTotalMorning.toFixed(2), grandTotalEvening.toFixed(2), grandTotalQty.toFixed(2), `Rs. ${grandTotalAmt.toFixed(2)}`]],
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
    });

    doc.save(`Master_Roster_${selectedMonth}_${cycleLabel}.pdf`);
  };

  const generateSingleInvoice = (doc: jsPDF, farmer: any) => {
    const companyName = (ratesConfig?.companyName || "SRI GOPALA KRISHNA MILK DISTRIBUTIONS").toUpperCase();
    const [year, month] = selectedMonth.split('-').map(Number);
    
    // Cycle Date Range Calculation
    const cycleStart = currentCycle.start;
    const cycleEnd = currentCycle.end;
    const startDateFormatted = `${cycleStart}/${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
    const endDateFormatted = `${cycleEnd}/${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
    const periodString = `${startDateFormatted} to ${endDateFormatted}`;

    // Header Branding
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(companyName, 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text("MILK INVOICE", 105, 28, { align: 'center' });
    doc.line(88, 30, 122, 30); // Subtitle underline

    // Farmer Info Section (Grid Style)
    doc.setFontSize(10);
    const labelX1 = 20;
    const valueX1 = 45;
    const labelX2 = 110;
    const valueX2 = 135;
    let y = 45;

    const currentRate = farmer.milkType === 'BUFFALO' ? (ratesConfig?.buffaloRate || 0) : (ratesConfig?.cowRate || 0);

    // Row 1
    doc.setFont("helvetica", "normal");
    doc.text("NAME:", labelX1, y);
    doc.setFont("helvetica", "bold");
    doc.text(farmer.name.toUpperCase(), valueX1, y);
    doc.line(valueX1, y+1, valueX1+55, y+1);

    doc.setFont("helvetica", "normal");
    doc.text("DATE:", labelX2, y);
    doc.setFont("helvetica", "bold");
    doc.text(format(new Date(), 'dd/MM/yyyy'), valueX2, y);
    doc.line(valueX2, y+1, valueX2+55, y+1);

    y += 10;
    // Row 2
    doc.setFont("helvetica", "normal");
    doc.text("A/C NO:", labelX1, y);
    doc.setFont("helvetica", "bold");
    doc.text(farmer.bankAccountNumber || "—", valueX1, y);
    doc.line(valueX1, y+1, valueX1+55, y+1);

    doc.setFont("helvetica", "normal");
    doc.text("PERIOD:", labelX2, y);
    doc.setFont("helvetica", "bold");
    doc.text(periodString, valueX2, y);
    doc.line(valueX2, y+1, valueX2+55, y+1);

    y += 10;
    // Row 3
    doc.setFont("helvetica", "normal");
    doc.text("CAN NO:", labelX1, y);
    doc.setFont("helvetica", "bold");
    doc.text(farmer.canNumber, valueX1, y);
    doc.line(valueX1, y+1, valueX1+55, y+1);

    doc.setFont("helvetica", "normal");
    doc.text("RATE (Rs):", labelX2, y);
    doc.setFont("helvetica", "bold");
    doc.text(currentRate.toFixed(2), valueX2, y);
    doc.line(valueX2, y+1, valueX2+55, y+1);

    // Prepare Table Data (Fill all cycle dates)
    const cycleEntries = filteredCycleEntries.filter(e => e.farmerId === farmer.id);
    const dateMap: Record<string, { morning: number, evening: number, rate: number }> = {};
    
    // Initialize all dates in cycle
    for (let d = cycleStart; d <= cycleEnd; d++) {
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      dateMap[dateStr] = { morning: 0, evening: 0, rate: currentRate };
    }

    cycleEntries.forEach(e => {
      if (dateMap[e.date]) {
        if (e.session === 'Morning') dateMap[e.date].morning = Number(e.quantity);
        else dateMap[e.date].evening = Number(e.quantity);
        dateMap[e.date].rate = e.rate;
      }
    });

    const tableRows = Object.keys(dateMap).sort().map(date => {
      const d = dateMap[date];
      const total = d.morning + d.evening;
      const amount = total * d.rate;
      return [
        format(new Date(date), 'dd/MM/yy'),
        d.morning.toFixed(2),
        d.evening.toFixed(2),
        total.toFixed(2),
        d.rate.toFixed(2),
        amount.toFixed(2)
      ];
    });

    const totalQty = farmer.totalQty;
    const totalAmt = farmer.totalAmount;

    // Main Table
    (doc as any).autoTable({
      startY: y + 10,
      head: [['DATE', 'MORNING (L)', 'EVENING (L)', 'TOTAL LITRES', 'RATE (Rs)', 'AMOUNT (Rs)']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0], halign: 'center' },
      bodyStyles: { textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], halign: 'center' },
      columnStyles: {
        0: { halign: 'center' },
        3: { fontStyle: 'bold' }
      },
      margin: { left: 20, right: 20 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 5;

    // Total Row (Bold inside/under table)
    doc.setFont("helvetica", "bold");
    doc.line(20, finalY, 190, finalY);
    doc.text("TOTAL", 25, finalY + 5);
    doc.text(totalQty.toFixed(2), 125, finalY + 5, { align: 'center' });
    doc.text(totalAmt.toFixed(2), 185, finalY + 5, { align: 'right' });
    doc.line(20, finalY + 8, 190, finalY + 8);

    // Summary Block (Right Aligned)
    let summaryY = finalY + 25;
    doc.setFont("helvetica", "normal");
    doc.text("Total Litres:", 155, summaryY, { align: 'right' });
    doc.setFont("helvetica", "bold");
    doc.text(totalQty.toFixed(2), 185, summaryY, { align: 'right' });

    summaryY += 8;
    doc.setFont("helvetica", "normal");
    doc.text("Total Amount (Rs):", 155, summaryY, { align: 'right' });
    doc.setFont("helvetica", "bold");
    doc.text(totalAmt.toFixed(2), 185, summaryY, { align: 'right' });

    // Footer & Signature
    const footerY = 275;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(`Generated by ${companyName} Management System`, 20, footerY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.line(140, footerY - 5, 190, footerY - 5);
    doc.text("AUTHORIZED SIGNATURE", 140, footerY);

    // Optional Stamp
    if (ratesConfig?.stampUrl) {
      try {
        doc.addImage(ratesConfig.stampUrl, 'PNG', 155, footerY - 30, 25, 25);
      } catch (e) {
        console.warn("Could not add stamp to PDF", e);
      }
    }
  };

  const handleDownloadFarmerBillPDF = (farmerId: string) => {
    const f = masterRoster.find(m => m.id === farmerId);
    if (!f) return;
    const doc = new jsPDF();
    generateSingleInvoice(doc, f);
    doc.save(`Invoice_${f.canNumber}_${f.name}_${selectedMonth}.pdf`);
  };

  const handleDownloadBulkInvoicesPDF = () => {
    if (activeInvoices.length === 0) return;
    const doc = new jsPDF();
    activeInvoices.forEach((f, idx) => {
      if (idx > 0) doc.addPage();
      generateSingleInvoice(doc, f);
    });
    doc.save(`Bulk_Invoices_${selectedMonth}_${currentCycle?.label}.pdf`);
  };

  if (!isClient || !selectedMonth) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-grow pt-24 pb-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">
                {ratesConfig?.companyName || "SRI GOPALA KRISHNA MILK DISTRIBUTIONS"} Reports
              </h1>
              <p className="text-muted-foreground font-medium">Fiscal Year: April - March</p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px] rounded-full font-bold h-11 border-primary/20"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl">{monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value} className="rounded-xl">{opt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </header>

          <Tabs defaultValue="overview" className="space-y-8">
            <TabsList className="flex flex-wrap h-auto gap-2 p-1.5 bg-muted rounded-[1.5rem] w-full border border-primary/5 max-w-2xl">
              <TabsTrigger value="overview" className="flex-1 rounded-full font-black gap-2 uppercase text-[10px] tracking-widest px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-white">
                <BarChart4 className="w-3.5 h-3.5" /> Overview
              </TabsTrigger>
              <TabsTrigger value="cycle" className="flex-1 rounded-full font-black gap-2 uppercase text-[10px] tracking-widest px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-white">
                <FileText className="w-3.5 h-3.5" /> Cycle Bill
              </TabsTrigger>
              <TabsTrigger value="master" className="flex-1 rounded-full font-black gap-2 uppercase text-[10px] tracking-widest px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-white">
                <TrendingUp className="w-3.5 h-3.5" /> Master Summary
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex-1 rounded-full font-black gap-2 uppercase text-[10px] tracking-widest px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-white">
                <ShieldCheck className="w-3.5 h-3.5" /> Internal Audit
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="rounded-[2rem] border-none shadow-xl bg-primary text-primary-foreground p-8 flex flex-col justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Collection Volume</p>
                  <div className="mt-4">
                    <p className="text-4xl font-black">{monthStats.totalEntryQty.toFixed(2)}</p>
                    <p className="text-xs font-bold uppercase tracking-widest">Litres</p>
                  </div>
                </Card>
                <Card className="rounded-[2rem] border-none shadow-xl bg-accent text-accent-foreground p-8 flex flex-col justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Sales Volume</p>
                  <div className="mt-4">
                    <p className="text-4xl font-black">{monthStats.totalSaleQty.toFixed(2)}</p>
                    <p className="text-xs font-bold uppercase tracking-widest">Litres</p>
                  </div>
                </Card>
                <Card className="rounded-[2rem] border-none shadow-xl bg-card p-8 flex flex-col justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Net Profit</p>
                  <div className="mt-4">
                    <p className={cn("text-4xl font-black", monthStats.profit >= 0 ? "text-green-600" : "text-destructive")}>
                      Rs. {monthStats.profit.toFixed(2)}
                    </p>
                    <Badge variant={monthStats.profit >= 0 ? "default" : "destructive"} className="mt-2 rounded-full font-black text-[9px] uppercase">
                      {monthStats.profit >= 0 ? "+ Profit" : "- Loss"}
                    </Badge>
                  </div>
                </Card>
                <Card className="rounded-[2rem] border-none shadow-xl bg-card p-8 flex flex-col justify-between border-2 border-primary/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Farmer Payouts</p>
                  <div className="mt-4">
                    <p className="text-3xl font-black text-primary">Rs. {monthStats.totalEntryAmt.toFixed(2)}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Monthly Procurement</p>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="cycle" className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex gap-2 bg-muted p-1.5 rounded-full border">
                  {cycles.map((cycle, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => setActiveCycle(idx)} 
                      className={cn(
                        "rounded-full text-[10px] font-black uppercase h-9 px-6 transition-all",
                        activeCycle === idx ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-muted-foreground/10"
                      )}
                    >
                      {cycle.label}
                    </button>
                  ))}
                </div>
                <Button 
                  onClick={handleDownloadBulkInvoicesPDF} 
                  disabled={activeInvoices.length === 0}
                  className="rounded-full shadow-lg h-11 px-8 font-black uppercase text-[10px] tracking-widest bg-red-600 hover:bg-red-700 text-white"
                >
                  <FileDown className="w-4 h-4 mr-2" /> Download Bulk PDFs ({activeInvoices.length})
                </Button>
              </div>

              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow>
                      <TableHead className="w-[120px] font-black text-primary pl-10 py-8 uppercase text-[10px] tracking-widest">CAN</TableHead>
                      <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Farmer Name</TableHead>
                      <TableHead className="text-right font-black text-primary uppercase text-[10px] tracking-widest">Qty (L)</TableHead>
                      <TableHead className="text-right font-black text-primary uppercase text-[10px] tracking-widest">Amount (Rs)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-primary uppercase text-[10px] tracking-widest">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeInvoices.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-bold uppercase tracking-widest opacity-50">No collections for this period.</TableCell></TableRow>
                    ) : (
                      activeInvoices.map((f) => (
                        <TableRow key={f.id} className="hover:bg-primary/5 transition-colors border-b last:border-0 group">
                          <TableCell className="font-black text-primary pl-10 text-2xl tracking-tighter">{f.canNumber}</TableCell>
                          <TableCell className="font-bold text-lg">{f.name}</TableCell>
                          <TableCell className="text-right font-black text-primary text-2xl">{f.totalQty.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-lg">Rs. {f.totalAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-right pr-10">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleDownloadFarmerBillPDF(f.id)} 
                              className="rounded-full h-10 px-6 font-bold text-red-600 hover:bg-red-50 transition-all flex items-center gap-2"
                            >
                              Download PDF <ChevronRight className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="master" className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex gap-2 bg-muted p-1.5 rounded-full border">
                  {cycles.map((cycle, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => setActiveCycle(idx)} 
                      className={cn(
                        "rounded-full text-[10px] font-black uppercase h-9 px-6 transition-all",
                        activeCycle === idx ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-muted-foreground/10"
                      )}
                    >
                      {cycle.label}
                    </button>
                  ))}
                </div>
                <Button onClick={handleDownloadRosterPDF} className="rounded-full shadow-xl h-11 px-8 font-black uppercase text-[10px] tracking-widest bg-primary text-white">
                  <Download className="w-4 h-4 mr-2" /> Download PDF Roster
                </Button>
              </div>

              <div className="bg-white p-8 sm:p-12 border shadow-none rounded-[2rem] text-black">
                <div className="flex justify-between items-start mb-12">
                  <div>
                    <h1 className="text-3xl font-black text-primary tracking-tighter uppercase leading-none mb-1">Master Summary Roster</h1>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Cycle Breakdown • {currentCycle?.label} • {monthOptions.find(o => o.value === selectedMonth)?.label}
                    </p>
                  </div>
                  <div className="bg-primary p-6 rounded-2xl flex items-center gap-6 shadow-xl shadow-primary/20">
                    <div className="p-3 bg-white/20 rounded-xl">
                      <IndianRupee className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-white">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cycle Payout</p>
                      <p className="text-3xl font-black leading-none mt-1">Rs. {grandTotalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden border-black">
                  <Table className="border-collapse">
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent border-b border-black">
                        <TableHead className="font-black text-[10px] text-primary uppercase tracking-widest py-5 pl-8 border-r border-black">CAN</TableHead>
                        <TableHead className="font-black text-[10px] text-primary uppercase tracking-widest py-5 border-r border-black">FARMER NAME</TableHead>
                        <TableHead className="font-black text-[10px] text-primary uppercase tracking-widest py-5 border-r border-black">BANK A/C</TableHead>
                        <TableHead className="text-center font-black text-[10px] text-primary uppercase tracking-widest py-5 border-r border-black">MORNING (L)</TableHead>
                        <TableHead className="text-center font-black text-[10px] text-primary uppercase tracking-widest py-5 border-r border-black">EVENING (L)</TableHead>
                        <TableHead className="text-center font-black text-[10px] text-primary uppercase tracking-widest py-5 border-r border-black">TOTAL L</TableHead>
                        <TableHead className="text-right font-black text-[10px] text-primary uppercase tracking-widest py-5 pr-8">PAYOUT (Rs)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {masterRoster.map((f) => (
                        <TableRow key={f.id} className="hover:bg-transparent border-b border-black">
                          <TableCell className="font-black text-primary text-lg pl-8 py-4 border-r border-black">{f.canNumber}</TableCell>
                          <TableCell className="font-bold uppercase text-sm text-foreground/80 border-r border-black">{f.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground border-r border-black">{f.bankAccountNumber || "—"}</TableCell>
                          <TableCell className="text-center font-medium text-base border-r border-black">{f.morningQty.toFixed(2)}</TableCell>
                          <TableCell className="text-center font-medium text-base border-r border-black">{f.eveningQty.toFixed(2)}</TableCell>
                          <TableCell className="text-center font-bold text-base border-r border-black">{f.totalQty.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-black text-primary text-lg pr-8">Rs. {f.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <tfoot className="bg-muted/50 border-t-2 border-black">
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={3} className="pl-8 py-6 font-black text-primary uppercase tracking-widest text-base border-r border-black">Grand Totals</TableCell>
                        <TableCell className="text-center font-black text-base border-r border-black">{grandTotalMorning.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-black text-base border-r border-black">{grandTotalEvening.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-black text-xl border-r border-black">{grandTotalQty.toFixed(2)} L</TableCell>
                        <TableCell className="text-right font-black text-primary text-2xl pr-8">Rs. {grandTotalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    </tfoot>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="audit" className="space-y-8 animate-in fade-in duration-500">
              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest pl-10 py-6">Month (Fiscal Year: April-March)</TableHead>
                      <TableHead className="text-center font-black text-primary uppercase text-[10px] tracking-widest py-6">Collection (L)</TableHead>
                      <TableHead className="text-center font-black text-primary uppercase text-[10px] tracking-widest py-6">Farmer Cost (Rs)</TableHead>
                      <TableHead className="text-center font-black text-primary uppercase text-[10px] tracking-widest py-6">Sales Revenue (Rs)</TableHead>
                      <TableHead className="text-right font-black text-primary uppercase text-[10px] tracking-widest pr-10 py-6">Net Profit (Rs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyAuditSummary.map((m, idx) => (
                      <TableRow key={idx} className="hover:bg-primary/5 transition-colors border-b last:border-0">
                        <TableCell className="pl-10 py-6">
                          <span className="text-xl font-black text-primary tracking-tight">{m.monthName}</span>
                        </TableCell>
                        <TableCell className="text-center font-bold text-lg">{m.collectionL.toFixed(2)} L</TableCell>
                        <TableCell className="text-center font-mono font-medium text-destructive">Rs. {m.cost.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-mono font-medium text-green-600">Rs. {m.revenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10">
                          <span className={cn("text-2xl font-black tracking-tighter", m.profit >= 0 ? "text-primary" : "text-destructive")}>
                            {m.profit >= 0 ? "+" : ""} Rs. {m.profit.toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-6 bg-muted/20 border-t">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">
                    Fiscal Summary based on April - March Year Cycle
                  </p>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}

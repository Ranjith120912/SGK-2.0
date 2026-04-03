
"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Loader2, 
  ArrowLeft,
  BarChart4,
  Printer,
  ShieldCheck,
  TrendingUp,
  IndianRupee,
  FileStack,
  ChevronRight
} from "lucide-react";
import { format, endOfMonth, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function ReportsPage() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);
  const [viewingInvoiceFarmerId, setViewingInvoiceFarmerId] = useState<string | null>(null);
  const [isPrintingBulk, setIsPrintingBulk] = useState(false);

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

  const renderInvoice = (farmerId: string) => {
    const invFarmer = farmers?.find(f => f.id === farmerId);
    const invEntries = filteredCycleEntries.filter(e => e.farmerId === farmerId).sort((a, b) => a.date.localeCompare(b.date));
    
    if (!invFarmer || invEntries.length === 0) return null;

    const grouped: Record<string, { date: string, morning: number, evening: number, total: number }> = {};
    invEntries.forEach(entry => {
      if (!grouped[entry.date]) {
        grouped[entry.date] = { date: entry.date, morning: 0, evening: 0, total: 0 };
      }
      if (entry.session === 'Morning') grouped[entry.date].morning += Number(entry.quantity) || 0;
      if (entry.session === 'Evening') grouped[entry.date].evening += Number(entry.quantity) || 0;
      grouped[entry.date].total = grouped[entry.date].morning + grouped[entry.date].evening;
    });

    const consolidated = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    const invRate = invFarmer.milkType === 'BUFFALO' ? (Number(ratesConfig?.buffaloRate) || 0) : (Number(ratesConfig?.cowRate) || 0);
    const totalL = consolidated.reduce((acc, curr) => acc + curr.total, 0);
    const totalA = totalL * invRate;

    return (
      <div key={farmerId} className="invoice-content bg-white p-12 border shadow-none mb-8 invoice-page-break text-black print-container">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold tracking-tight mb-1 uppercase">
            {ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS"}
          </h1>
          {ratesConfig?.address && (
            <p className="text-sm text-muted-foreground uppercase font-medium mb-2">{ratesConfig.address}</p>
          )}
          <h2 className="text-xl font-semibold uppercase tracking-widest border-t border-b border-black/10 py-1 inline-block px-4">MILK INVOICE</h2>
        </div>

        <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-8 text-sm font-medium">
          <div className="flex gap-4">
            <span className="w-24 text-muted-foreground uppercase">Name:</span>
            <span className="font-bold border-b border-black flex-grow uppercase">{invFarmer.name}</span>
          </div>
          <div className="flex gap-4">
            <span className="w-24 text-muted-foreground uppercase">Date:</span>
            <span className="font-bold border-b border-black flex-grow">{format(new Date(), 'dd/MM/yyyy')}</span>
          </div>
          <div className="flex gap-4">
            <span className="w-24 text-muted-foreground uppercase">A/C No:</span>
            <span className="font-bold border-b border-black flex-grow font-mono">{invFarmer.bankAccountNumber || "—"}</span>
          </div>
          <div className="flex gap-4">
            <span className="w-24 text-muted-foreground uppercase">Period:</span>
            <span className="font-bold border-b border-black flex-grow">
              {currentCycle ? `${currentCycle.start}/${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0].slice(2)} to ${currentCycle.end}/${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0].slice(2)}` : "—"}
            </span>
          </div>
          <div className="flex gap-4">
            <span className="w-24 text-muted-foreground uppercase">Can No:</span>
            <span className="font-bold border-b border-black flex-grow">{invFarmer.canNumber}</span>
          </div>
          <div className="flex gap-4">
            <span className="w-24 text-muted-foreground uppercase">Rate (₹):</span>
            <span className="font-bold border-b border-black flex-grow">{invRate.toFixed(2)}</span>
          </div>
        </div>

        <div className="border border-black">
          <Table className="border-collapse">
            <TableHeader className="bg-white">
              <TableRow className="hover:bg-transparent border-b border-black">
                <TableHead className="text-center border-r border-black font-bold text-black uppercase h-10 px-2">Date</TableHead>
                <TableHead className="text-center border-r border-black font-bold text-black uppercase h-10 px-2">Morning (L)</TableHead>
                <TableHead className="text-center border-r border-black font-bold text-black uppercase h-10 px-2">Evening (L)</TableHead>
                <TableHead className="text-center border-r border-black font-bold text-black uppercase h-10 px-2">Total (L)</TableHead>
                <TableHead className="text-right font-bold text-black uppercase h-10 px-4">Amount (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consolidated.map((row) => (
                <TableRow key={row.date} className="hover:bg-transparent border-b border-black last:border-b-0">
                  <TableCell className="text-center border-r border-black py-1.5 font-medium">{format(new Date(row.date), 'dd/MM/yy')}</TableCell>
                  <TableCell className="text-center border-r border-black py-1.5">{row.morning.toFixed(2)}</TableCell>
                  <TableCell className="text-center border-r border-black py-1.5">{row.evening.toFixed(2)}</TableCell>
                  <TableCell className="text-center border-r border-black py-1.5 font-bold">{row.total.toFixed(2)}</TableCell>
                  <TableCell className="text-right py-1.5 pr-4 font-mono">{ (row.total * invRate).toFixed(2) }</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-8">
          <div className="flex justify-between items-center text-lg font-bold border-t-2 border-black pt-4">
            <span className="uppercase tracking-widest">Total Payout</span>
            <div className="flex gap-12">
              <span className="w-32 text-center">{totalL.toFixed(2)} L</span>
              <span className="w-40 text-right font-mono">₹ {totalA.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-16 flex justify-between items-end italic text-xs text-muted-foreground">
          <p>Generated by {ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS"} System</p>
          <div className="flex flex-col items-center gap-2">
            {ratesConfig?.stampUrl && (
              <img src={ratesConfig.stampUrl} alt="Stamp" className="max-w-[120px] mix-blend-multiply opacity-80" />
            )}
            <p className="border-t border-black w-48 text-center pt-2 font-bold text-black uppercase">Authorized Signature</p>
          </div>
        </div>
      </div>
    );
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

  // Handle Printing Views (Single and Bulk)
  if (viewingInvoiceFarmerId || isPrintingBulk) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <main className="flex-grow pt-24 pb-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8 no-print">
              <Button variant="outline" onClick={() => { setViewingInvoiceFarmerId(null); setIsPrintingBulk(false); }} className="rounded-full">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Bill
              </Button>
              <Button onClick={() => window.print()} className="rounded-full shadow-lg">
                <Printer className="w-4 h-4 mr-2" /> {isPrintingBulk ? "Print All" : "Print Invoice"}
              </Button>
            </div>
            {isPrintingBulk ? (
              activeInvoices.map(f => (
                <div key={f.id} className="invoice-page-break">
                  {renderInvoice(f.id)}
                </div>
              ))
            ) : (
              viewingInvoiceFarmerId && renderInvoice(viewingInvoiceFarmerId)
            )}
          </div>
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
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">
                {ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS"} Reports
              </h1>
              <p className="text-muted-foreground font-medium">Fiscal Analytics & Cycle Rosters.</p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px] rounded-full font-bold h-11 border-primary/20"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl">{monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value} className="rounded-xl">{opt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </header>

          <Tabs defaultValue="overview" className="space-y-8 no-print">
            <TabsList className="flex flex-wrap h-auto gap-2 p-1.5 bg-muted rounded-[1.5rem] w-full border border-primary/5 max-w-2xl no-print">
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
                      ₹ {monthStats.profit.toFixed(2)}
                    </p>
                    <Badge variant={monthStats.profit >= 0 ? "default" : "destructive"} className="mt-2 rounded-full font-black text-[9px] uppercase">
                      {monthStats.profit >= 0 ? "+ Profit" : "- Loss"}
                    </Badge>
                  </div>
                </Card>
                <Card className="rounded-[2rem] border-none shadow-xl bg-card p-8 flex flex-col justify-between border-2 border-primary/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Farmer Payouts</p>
                  <div className="mt-4">
                    <p className="text-3xl font-black text-primary">₹ {monthStats.totalEntryAmt.toFixed(2)}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Pending Settlement</p>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="cycle" className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 no-print">
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
                  onClick={() => setIsPrintingBulk(true)} 
                  disabled={activeInvoices.length === 0}
                  className="rounded-full shadow-lg h-11 px-8 font-black uppercase text-[10px] tracking-widest"
                >
                  <FileStack className="w-4 h-4 mr-2" /> Bulk Invoices ({activeInvoices.length})
                </Button>
              </div>

              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow>
                      <TableHead className="w-[120px] font-black text-primary pl-10 py-8 uppercase text-[10px] tracking-widest">CAN</TableHead>
                      <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Farmer Name</TableHead>
                      <TableHead className="text-right font-black text-primary uppercase text-[10px] tracking-widest">Qty (L)</TableHead>
                      <TableHead className="text-right font-black text-primary uppercase text-[10px] tracking-widest">Amount (₹)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-primary uppercase text-[10px] tracking-widest no-print">Actions</TableHead>
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
                          <TableCell className="text-right font-mono font-bold text-lg">₹ {f.totalAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-right pr-10 no-print">
                            <Button 
                              variant="ghost" 
                              onClick={() => setViewingInvoiceFarmerId(f.id)} 
                              className="rounded-full h-10 px-6 font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2"
                            >
                              Print Bill <ChevronRight className="w-4 h-4" />
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 no-print">
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
                <Button onClick={() => window.print()} className="rounded-full shadow-xl h-11 px-8 font-black uppercase text-[10px] tracking-widest">
                  <Printer className="w-4 h-4 mr-2" /> Print Roster
                </Button>
              </div>

              <div className="master-summary-print bg-white p-8 sm:p-12 border shadow-none rounded-[2rem] text-black print-container">
                <div className="flex justify-between items-start mb-12">
                  <div>
                    <h1 className="text-3xl font-black text-primary tracking-tighter uppercase leading-none mb-1">Master Summary Roster</h1>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Cycle Breakdown • {currentCycle?.label} • {monthOptions.find(o => o.value === selectedMonth)?.label}
                    </p>
                  </div>
                  <div className="bg-primary p-6 rounded-2xl flex items-center gap-6 shadow-xl shadow-primary/20 no-print-background">
                    <div className="p-3 bg-white/20 rounded-xl">
                      <IndianRupee className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-white">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cycle Payout</p>
                      <p className="text-3xl font-black leading-none mt-1">₹ {grandTotalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
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
                        <TableHead className="text-right font-black text-[10px] text-primary uppercase tracking-widest py-5 pr-8">PAYOUT (₹)</TableHead>
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
                          <TableCell className="text-right font-black text-primary text-lg pr-8">₹ {f.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <tfoot className="bg-muted/50 border-t-2 border-black">
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={3} className="pl-8 py-6 font-black text-primary uppercase tracking-widest text-base border-r border-black">Grand Totals</TableCell>
                        <TableCell className="text-center font-black text-base border-r border-black">{grandTotalMorning.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-black text-base border-r border-black">{grandTotalEvening.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-black text-xl border-r border-black">{grandTotalQty.toFixed(2)} L</TableCell>
                        <TableCell className="text-right font-black text-primary text-2xl pr-8">₹ {grandTotalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    </tfoot>
                  </Table>
                </div>

                <div className="mt-16 flex justify-between items-end border-t border-black pt-8 text-[10px] text-muted-foreground font-black uppercase tracking-widest italic">
                  <div>Generated on {format(new Date(), 'PPP p')}</div>
                  <div className="text-right">Authorized Financial Roster</div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="audit" className="space-y-8 animate-in fade-in duration-500">
              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest pl-10 py-6">Month (Fiscal Year)</TableHead>
                      <TableHead className="text-center font-black text-primary uppercase text-[10px] tracking-widest py-6">Collection (L)</TableHead>
                      <TableHead className="text-center font-black text-primary uppercase text-[10px] tracking-widest py-6">Farmer Cost (₹)</TableHead>
                      <TableHead className="text-center font-black text-primary uppercase text-[10px] tracking-widest py-6">Sales Revenue (₹)</TableHead>
                      <TableHead className="text-right font-black text-primary uppercase text-[10px] tracking-widest pr-10 py-6">Net Profit (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyAuditSummary.map((m, idx) => (
                      <TableRow key={idx} className="hover:bg-primary/5 transition-colors border-b last:border-0">
                        <TableCell className="pl-10 py-6">
                          <span className="text-xl font-black text-primary tracking-tight">{m.monthName}</span>
                        </TableCell>
                        <TableCell className="text-center font-bold text-lg">{m.collectionL.toFixed(2)} L</TableCell>
                        <TableCell className="text-center font-mono font-medium text-destructive">₹ {m.cost.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-mono font-medium text-green-600">₹ {m.revenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10">
                          <span className={cn("text-2xl font-black tracking-tighter", m.profit >= 0 ? "text-primary" : "text-destructive")}>
                            {m.profit >= 0 ? "+" : ""} ₹ {m.profit.toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-6 bg-muted/20 border-t no-print">
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

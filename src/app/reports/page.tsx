
"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  FileText, 
  Droplets, 
  ChevronRight, 
  Loader2, 
  ClipboardList, 
  ShoppingCart, 
  Printer, 
  ArrowLeft,
  Milk,
  BarChart4,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  IndianRupee,
  PieChart
} from "lucide-react";
import { format, endOfMonth, startOfMonth } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);
  const [viewingInvoiceFarmerId, setViewingInvoiceFarmerId] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    const now = new Date();
    setSelectedMonth(format(now, 'yyyy-MM'));
    setSelectedDate(format(now, 'yyyy-MM-dd'));
  }, []);

  const monthOptions = useMemo(() => {
    if (!isClient) return [];
    const now = new Date();
    return Array.from({ length: 12 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
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

  const buyersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'buyers');
  }, [firestore]);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: allEntries, isLoading: entriesLoading } = useCollection(entriesQuery);
  const { data: farmers } = useCollection(farmersQuery);
  const { data: allSales } = useCollection(salesQuery);
  const { data: buyers } = useCollection(buyersQuery);
  const { data: ratesConfig } = useDoc(settingsRef);

  const currentCycle = cycles[activeCycle];
  
  const filteredCycleEntries = allEntries?.filter(entry => {
    if (!selectedMonth || !entry.date.startsWith(selectedMonth)) return false;
    if (!currentCycle) return false;
    const day = parseInt(entry.date.split('-')[2]);
    return day >= currentCycle.start && day <= currentCycle.end;
  });

  const cycleStats = cycles.map(c => {
    const cEntries = allEntries?.filter(entry => {
      if (!selectedMonth || !entry.date.startsWith(selectedMonth)) return false;
      const day = parseInt(entry.date.split('-')[2]);
      return day >= c.start && day <= c.end;
    }) || [];
    return { 
      qty: cEntries.reduce((acc, curr) => acc + (curr.quantity || 0), 0),
      amount: cEntries.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0)
    };
  });

  const farmerCycleBreakdown = farmers?.map(farmer => {
    const fEntries = filteredCycleEntries?.filter(e => e.farmerId === farmer.id) || [];
    return {
      ...farmer,
      totalQty: fEntries.reduce((acc, curr) => acc + (curr.quantity || 0), 0),
      totalAmount: fEntries.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0)
    };
  }).filter(f => f.totalQty > 0).sort((a, b) => {
    const aNum = parseInt(a.canNumber);
    const bNum = parseInt(b.canNumber);
    return (isNaN(aNum) || isNaN(bNum)) ? a.canNumber.localeCompare(b.canNumber) : aNum - bNum;
  });

  const dailyEntries = allEntries?.filter(e => e.date === selectedDate).sort((a, b) => {
    const fA = farmers?.find(f => f.id === a.farmerId);
    const fB = farmers?.find(f => f.id === b.farmerId);
    return (fA?.canNumber || "").localeCompare(fB?.canNumber || "");
  });

  const dailySales = allSales?.filter(s => s.date === selectedDate).sort((a, b) => {
    const bA = buyers?.find(buy => buy.id === a.buyerId);
    const bB = buyers?.find(buy => buy.id === b.buyerId);
    return (bA?.buyerCode || "").localeCompare(bB?.buyerCode || "");
  });

  // Analytics Calculations
  const totalCollectionDaily = dailyEntries?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;
  const totalSalesDaily = dailySales?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;
  const balanceDaily = totalCollectionDaily - totalSalesDaily;

  const cowVolume = dailyEntries?.filter(e => {
    const f = farmers?.find(far => far.id === e.farmerId);
    return f?.milkType === 'COW';
  }).reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;

  const buffaloVolume = dailyEntries?.filter(e => {
    const f = farmers?.find(far => far.id === e.farmerId);
    return f?.milkType === 'BUFFALO';
  }).reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;

  const invoiceFarmer = farmers?.find(f => f.id === viewingInvoiceFarmerId);
  const invoiceEntries = filteredCycleEntries?.filter(e => e.farmerId === viewingInvoiceFarmerId).sort((a, b) => a.date.localeCompare(b.date));

  // Consolidate entries by date for the invoice table
  const consolidatedInvoiceData = useMemo(() => {
    if (!invoiceEntries) return [];
    const grouped: Record<string, { date: string, morning: number, evening: number, total: number }> = {};
    
    invoiceEntries.forEach(entry => {
      if (!grouped[entry.date]) {
        grouped[entry.date] = { date: entry.date, morning: 0, evening: 0, total: 0 };
      }
      if (entry.session === 'Morning') grouped[entry.date].morning += entry.quantity || 0;
      if (entry.session === 'Evening') grouped[entry.date].evening += entry.quantity || 0;
      grouped[entry.date].total = grouped[entry.date].morning + grouped[entry.date].evening;
    });

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [invoiceEntries]);

  const currentRate = useMemo(() => {
    if (!invoiceFarmer || !ratesConfig) return 0;
    return invoiceFarmer.milkType === 'BUFFALO' ? (ratesConfig.buffaloRate || 0) : (ratesConfig.cowRate || 0);
  }, [invoiceFarmer, ratesConfig]);

  const grandTotalLitres = consolidatedInvoiceData.reduce((acc, curr) => acc + curr.total, 0);
  const grandTotalAmount = grandTotalLitres * currentRate;

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

  if (viewingInvoiceFarmerId && invoiceFarmer) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <main className="flex-grow pt-24 pb-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8 no-print">
              <Button variant="outline" onClick={() => setViewingInvoiceFarmerId(null)} className="rounded-full">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Bill
              </Button>
              <Button onClick={() => window.print()} className="rounded-full shadow-lg">
                <Printer className="w-4 h-4 mr-2" /> Print Invoice
              </Button>
            </div>

            <div className="invoice-content bg-white p-12 border shadow-sm">
              <div className="text-center mb-10">
                <h1 className="text-2xl font-bold tracking-tight mb-1">SRI GOPALA KRISHNA MILK DISTRIBUTIONS</h1>
                <h2 className="text-xl font-semibold uppercase tracking-widest">MILK INVOICE</h2>
              </div>

              <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-8 text-sm font-medium">
                <div className="flex gap-4">
                  <span className="w-24 text-muted-foreground uppercase">Name:</span>
                  <span className="font-bold border-b border-black flex-grow uppercase">{invoiceFarmer.name}</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-24 text-muted-foreground uppercase">Date:</span>
                  <span className="font-bold border-b border-black flex-grow">{format(new Date(), 'dd/MM/yyyy')}</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-24 text-muted-foreground uppercase">A/C No:</span>
                  <span className="font-bold border-b border-black flex-grow font-mono">{invoiceFarmer.bankAccountNumber || "—"}</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-24 text-muted-foreground uppercase">Period:</span>
                  <span className="font-bold border-b border-black flex-grow">
                    {currentCycle ? `${currentCycle.start}/${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0].slice(2)} to ${currentCycle.end}/${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0].slice(2)}` : "—"}
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-24 text-muted-foreground uppercase">Can No:</span>
                  <span className="font-bold border-b border-black flex-grow">{invoiceFarmer.canNumber}</span>
                </div>
                <div className="flex gap-4 invisible">
                  <span className="w-24 text-muted-foreground uppercase">—</span>
                  <span className="font-bold border-b border-black flex-grow">—</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-24 text-muted-foreground uppercase">Rate (₹):</span>
                  <span className="font-bold border-b border-black flex-grow">{currentRate.toFixed(2)}</span>
                </div>
              </div>

              <div className="border border-black">
                <Table className="border-collapse">
                  <TableHeader className="bg-white">
                    <TableRow className="hover:bg-transparent border-b border-black">
                      <TableHead className="text-center border-r border-black font-bold text-black uppercase h-10 px-2">Date</TableHead>
                      <TableHead className="text-center border-r border-black font-bold text-black uppercase h-10 px-2">Morning (L)</TableHead>
                      <TableHead className="text-center border-r border-black font-bold text-black uppercase h-10 px-2">Evening (L)</TableHead>
                      <TableHead className="text-center border-r border-black font-bold text-black uppercase h-10 px-2">Total Litres</TableHead>
                      <TableHead className="text-center border-r border-black font-bold text-black uppercase h-10 px-2">Rate (₹)</TableHead>
                      <TableHead className="text-right font-bold text-black uppercase h-10 px-4">Amount (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consolidatedInvoiceData.map((row) => (
                      <TableRow key={row.date} className="hover:bg-transparent border-b border-black last:border-b-0">
                        <TableCell className="text-center border-r border-black py-1.5 font-medium">{format(new Date(row.date), 'dd/MM/yy')}</TableCell>
                        <TableCell className="text-center border-r border-black py-1.5">{row.morning.toFixed(2)}</TableCell>
                        <TableCell className="text-center border-r border-black py-1.5">{row.evening.toFixed(2)}</TableCell>
                        <TableCell className="text-center border-r border-black py-1.5 font-bold">{row.total.toFixed(2)}</TableCell>
                        <TableCell className="text-center border-r border-black py-1.5">{currentRate.toFixed(2)}</TableCell>
                        <TableCell className="text-right py-1.5 pr-4 font-mono">{ (row.total * currentRate).toFixed(2) }</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex justify-between items-center text-lg font-bold border-t border-black pt-4">
                  <span className="uppercase">Total</span>
                  <div className="flex gap-20">
                    <span className="w-32 text-center">{grandTotalLitres.toFixed(2)}</span>
                    <span className="w-40 text-right font-mono">{grandTotalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 pt-8">
                  <div className="flex gap-4 text-base">
                    <span className="font-medium">Total Litres:</span>
                    <span className="font-bold w-24 text-right">{grandTotalLitres.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-4 text-base">
                    <span className="font-medium">Total Amount (₹):</span>
                    <span className="font-bold w-24 text-right font-mono">{grandTotalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-20 flex justify-between items-end italic text-xs text-muted-foreground">
                <p>Generated by SGK MILK Management System</p>
                <div className="text-right">
                  <p className="border-t border-black w-48 text-center pt-2 font-bold text-black uppercase">Authorized Signature</p>
                </div>
              </div>
            </div>
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
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">SGK MILK Intelligence</h1>
              <p className="text-muted-foreground font-medium">Enterprise collection logs, sales analytics and billing.</p>
            </div>
          </header>

          <Tabs defaultValue="overview" className="space-y-8">
            <TabsList className="grid grid-cols-4 w-full sm:w-[800px] rounded-full p-1 bg-muted border border-primary/5">
              <TabsTrigger value="overview" className="rounded-full font-bold gap-2 uppercase text-[10px] tracking-widest">
                <BarChart4 className="w-4 h-4" /> Overview
              </TabsTrigger>
              <TabsTrigger value="cycle" className="rounded-full font-bold gap-2 uppercase text-[10px] tracking-widest">
                <FileText className="w-4 h-4" /> Cycle Bill
              </TabsTrigger>
              <TabsTrigger value="daily" className="rounded-full font-bold gap-2 uppercase text-[10px] tracking-widest">
                <ClipboardList className="w-4 h-4" /> Collection
              </TabsTrigger>
              <TabsTrigger value="sales" className="rounded-full font-bold gap-2 uppercase text-[10px] tracking-widest">
                <ShoppingCart className="w-4 h-4" /> Sales
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-end mb-4">
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-[200px] rounded-full font-bold border-primary/20 shadow-sm bg-card"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="rounded-3xl border-none shadow-xl bg-primary text-primary-foreground overflow-hidden">
                  <CardHeader className="pb-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Collection Volume</p>
                    <CardTitle className="text-4xl font-black">{totalCollectionDaily.toFixed(1)} L</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-xs font-bold opacity-90">
                      <ArrowUpRight className="w-4 h-4" />
                      Incoming from farmers
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-none shadow-xl bg-accent text-accent-foreground overflow-hidden">
                  <CardHeader className="pb-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Distribution Volume</p>
                    <CardTitle className="text-4xl font-black">{totalSalesDaily.toFixed(1)} L</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-xs font-bold opacity-90">
                      <ArrowDownRight className="w-4 h-4" />
                      Outgoing to buyers
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader className="pb-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Inventory Balance</p>
                    <CardTitle className={cn("text-4xl font-black", balanceDaily >= 0 ? "text-green-600" : "text-destructive")}>
                      {balanceDaily.toFixed(1)} L
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                      <Scale className="w-4 h-4" />
                      Net stock difference
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader className="pb-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Farmer Payables</p>
                    <CardTitle className="text-3xl font-black text-primary">₹ {dailyEntries?.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0).toLocaleString()}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                      <IndianRupee className="w-4 h-4" />
                      Estimated daily payouts
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-card p-8">
                  <h3 className="text-xl font-black text-primary mb-6 flex items-center gap-2 uppercase tracking-tighter">
                    <PieChart className="w-5 h-5" /> Milk Composition
                  </h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-black uppercase tracking-widest text-muted-foreground">
                        <span>Cow Milk</span>
                        <span className="text-primary">{cowVolume.toFixed(1)} L</span>
                      </div>
                      <div className="h-4 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-1000" 
                          style={{ width: `${totalCollectionDaily > 0 ? (cowVolume/totalCollectionDaily)*100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-black uppercase tracking-widest text-muted-foreground">
                        <span>Buffalo Milk</span>
                        <span className="text-accent">{buffaloVolume.toFixed(1)} L</span>
                      </div>
                      <div className="h-4 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent transition-all duration-1000" 
                          style={{ width: `${totalCollectionDaily > 0 ? (buffaloVolume/totalCollectionDaily)*100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-[2.5rem] border-none shadow-xl bg-card p-8">
                  <h3 className="text-xl font-black text-primary mb-6 flex items-center gap-2 uppercase tracking-tighter">
                    <BarChart4 className="w-5 h-5" /> Efficiency Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-muted/30 rounded-3xl text-center">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Morning Yield</p>
                      <p className="text-2xl font-black text-primary">
                        {dailyEntries?.filter(e => e.session === 'Morning').reduce((acc, curr) => acc + (curr.quantity || 0), 0).toFixed(1)} L
                      </p>
                    </div>
                    <div className="p-6 bg-muted/30 rounded-3xl text-center">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Evening Yield</p>
                      <p className="text-2xl font-black text-primary">
                        {dailyEntries?.filter(e => e.session === 'Evening').reduce((acc, curr) => acc + (curr.quantity || 0), 0).toFixed(1)} L
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 p-4 border border-dashed border-primary/20 rounded-2xl text-[11px] text-muted-foreground font-medium text-center">
                    Data for {format(new Date(selectedDate), 'PPPP')}
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="cycle" className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[200px] rounded-full font-bold border-primary/20 bg-card">
                      <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                  10-Day Cycle Billing: Strictly showing collection Litres
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cycles.map((cycle, idx) => (
                  <Card 
                    key={cycle.id}
                    onClick={() => setActiveCycle(idx)}
                    className={`relative overflow-hidden rounded-[2rem] cursor-pointer transition-all duration-300 border-2 ${
                      activeCycle === idx 
                      ? "border-primary bg-primary/5 shadow-xl scale-[1.02]" 
                      : "border-transparent bg-card hover:border-primary/20"
                    }`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <Badge variant={activeCycle === idx ? "default" : "outline"} className="rounded-full font-black text-[10px] uppercase">
                          {cycle.label}
                        </Badge>
                        {activeCycle === idx && <ChevronRight className="w-5 h-5 text-primary animate-pulse" />}
                      </div>
                      <CardTitle className="text-xl font-black mt-2 tracking-tighter">{cycle.range}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-bold text-xs uppercase tracking-tighter">Volume:</span>
                        <span className="font-black text-primary text-2xl tracking-tighter">{cycleStats[idx]?.qty.toFixed(1) || "0.0"} <small className="text-xs">L</small></span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card">
                <div className="p-8 border-b bg-primary/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-primary uppercase tracking-tighter">Cycle Quantity Bill</h3>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                      {currentCycle?.label} • {currentCycle?.range} • {format(new Date(selectedMonth + "-01"), "MMMM yyyy")}
                    </p>
                  </div>
                  <div className="bg-primary px-8 py-4 rounded-3xl text-primary-foreground shadow-lg flex items-center gap-4">
                    <Milk className="w-6 h-6 opacity-50" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cycle Litres Total</p>
                      <p className="text-3xl font-black tracking-tighter">{cycleStats[activeCycle]?.qty.toFixed(2)} L</p>
                    </div>
                  </div>
                </div>
                
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[120px] font-black text-primary pl-8 py-6 uppercase text-[10px] tracking-widest">CAN</TableHead>
                      <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Farmer Name</TableHead>
                      <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Milk Type</TableHead>
                      <TableHead className="text-right font-black text-primary uppercase text-[10px] tracking-widest">Total Litres</TableHead>
                      <TableHead className="text-right pr-8 font-black text-primary uppercase text-[10px] tracking-widest">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-20">
                          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : farmerCycleBreakdown?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-32 text-muted-foreground">
                          <Droplets className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                          <p className="font-bold text-lg">No collection recorded for this cycle.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      farmerCycleBreakdown?.map((f) => (
                        <TableRow key={f.id} className="hover:bg-primary/5 transition-colors border-b last:border-0 group">
                          <TableCell className="font-black text-primary pl-8 text-xl tracking-tighter">{f.canNumber}</TableCell>
                          <TableCell className="font-bold text-base">{f.name}</TableCell>
                          <TableCell>
                            <Badge variant={f.milkType === 'BUFFALO' ? "secondary" : "outline"} className="rounded-full font-black text-[10px] uppercase">
                              {f.milkType || 'COW'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-black text-primary text-2xl tracking-tighter">{f.totalQty.toFixed(2)} <small className="text-xs opacity-60">L</small></span>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="rounded-full font-black text-[10px] uppercase tracking-widest shadow-sm"
                              onClick={() => setViewingInvoiceFarmerId(f.id)}
                            >
                              <FileText className="w-3 h-3 mr-2" />
                              View Invoice
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                
                <div className="p-6 bg-muted/20 border-t text-center">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                    Verified SGK MILK Report &bull; {format(new Date(), 'PPPP')}
                  </p>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="daily" className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-end items-center gap-3">
                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Select Date:</span>
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-[200px] rounded-full font-bold border-primary/20 shadow-sm bg-card"
                />
              </div>

              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-xl bg-card">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow>
                      <TableHead className="w-[100px] font-black text-primary pl-8 py-5 uppercase text-[10px] tracking-widest">CAN</TableHead>
                      <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Farmer Name</TableHead>
                      <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Session</TableHead>
                      <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Weight (Kg)</TableHead>
                      <TableHead className="font-black text-primary text-right pr-8 uppercase text-[10px] tracking-widest">Qty (Litre)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!dailyEntries || dailyEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">No records found for {selectedDate}.</TableCell>
                      </TableRow>
                    ) : (
                      dailyEntries.map(entry => {
                        const farmer = farmers?.find(f => f.id === entry.farmerId);
                        return (
                          <TableRow key={entry.id} className="hover:bg-primary/5 transition-colors border-b last:border-0">
                            <TableCell className="font-black text-primary pl-8 text-lg tracking-tighter">{farmer?.canNumber || "—"}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-base">{farmer?.name || "Unknown"}</span>
                                <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{farmer?.milkType}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="rounded-full font-bold text-[10px] uppercase border-primary/10">
                                {entry.session}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-base">{entry.kgWeight?.toFixed(2)}</TableCell>
                            <TableCell className="text-right pr-8 font-black text-primary text-xl tracking-tighter">
                              {entry.quantity?.toFixed(2)} <small className="text-xs opacity-60">L</small>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="sales" className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-end items-center gap-3">
                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Select Date:</span>
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-[200px] rounded-full font-bold border-primary/20 shadow-sm bg-card"
                />
              </div>

              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-xl bg-card">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow>
                      <TableHead className="w-[100px] font-black text-primary pl-8 py-5 uppercase text-[10px] tracking-widest">Code</TableHead>
                      <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Buyer Name</TableHead>
                      <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Session</TableHead>
                      <TableHead className="font-black text-primary text-right pr-8 uppercase text-[10px] tracking-widest">Qty Sold (Litre)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!dailySales || dailySales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">No distribution records found for {selectedDate}.</TableCell>
                      </TableRow>
                    ) : (
                      dailySales.map(sale => {
                        const buyer = buyers?.find(b => b.id === sale.buyerId);
                        return (
                          <TableRow key={sale.id} className="hover:bg-accent/5 transition-colors border-b last:border-0">
                            <TableCell className="font-black text-primary pl-8 text-lg tracking-tighter">{buyer?.buyerCode || "—"}</TableCell>
                            <TableCell className="font-bold text-base">{buyer?.name || "Unknown"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="rounded-full font-bold text-[10px] uppercase border-accent/20">
                                {sale.session}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-8 font-black text-primary text-xl tracking-tighter">
                              {sale.quantity?.toFixed(2)} <small className="text-xs opacity-60">L</small>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
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

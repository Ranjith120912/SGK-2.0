
"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  FileText, 
  Droplets, 
  Loader2, 
  ClipboardList, 
  ShoppingCart, 
  Printer, 
  ArrowLeft,
  Milk,
  BarChart4,
  ArrowUpRight,
  ArrowDownRight,
  IndianRupee,
  PieChart,
  CheckCircle2,
  ListChecks,
  TrendingUp,
  Wallet,
  Activity,
  History,
  Info,
  Files
} from "lucide-react";
import { format, endOfMonth, eachMonthOfInterval, startOfYear, endOfYear } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ReportsPage() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);
  const [viewingInvoiceFarmerId, setViewingInvoiceFarmerId] = useState<string | null>(null);
  const [viewingBulkInvoices, setViewingBulkInvoices] = useState(false);

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
  
  const filteredCycleEntries = useMemo(() => {
    if (!allEntries || !selectedMonth || !currentCycle) return [];
    return allEntries.filter(entry => {
      if (!entry.date.startsWith(selectedMonth)) return false;
      const day = parseInt(entry.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    });
  }, [allEntries, selectedMonth, currentCycle]);

  const cycleStats = useMemo(() => {
    return cycles.map(c => {
      const cEntries = allEntries?.filter(entry => {
        if (!selectedMonth || !entry.date.startsWith(selectedMonth)) return false;
        const day = parseInt(entry.date.split('-')[2]);
        return day >= c.start && day <= c.end;
      }) || [];
      return { 
        qty: cEntries.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0),
        amount: cEntries.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0)
      };
    });
  }, [cycles, allEntries, selectedMonth]);

  const activeFarmerCycleBreakdown = useMemo(() => {
    if (!farmers) return [];
    return farmers.map(farmer => {
      const fEntries = filteredCycleEntries.filter(e => e.farmerId === farmer.id);
      return {
        ...farmer,
        totalQty: fEntries.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0),
        totalAmount: fEntries.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0)
      };
    }).filter(f => f.totalQty > 0).sort((a, b) => {
      const aNum = parseInt(a.canNumber);
      const bNum = parseInt(b.canNumber);
      return (isNaN(aNum) || isNaN(bNum)) ? a.canNumber.localeCompare(b.canNumber) : aNum - bNum;
    });
  }, [farmers, filteredCycleEntries]);

  const farmerCycleMasterList = useMemo(() => {
    if (!farmers) return [];
    return farmers.map(farmer => {
      const fEntries = filteredCycleEntries.filter(e => e.farmerId === farmer.id);
      return {
        ...farmer,
        totalQty: fEntries.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0),
        totalAmount: fEntries.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0)
      };
    }).sort((a, b) => {
      const aNum = parseInt(a.canNumber);
      const bNum = parseInt(b.canNumber);
      return (isNaN(aNum) || isNaN(bNum)) ? a.canNumber.localeCompare(b.canNumber) : aNum - bNum;
    });
  }, [farmers, filteredCycleEntries]);

  const dailyEntries = useMemo(() => {
    if (!allEntries || !selectedDate) return [];
    return allEntries.filter(e => e.date === selectedDate).sort((a, b) => {
      const fA = farmers?.find(f => f.id === a.farmerId);
      const fB = farmers?.find(f => f.id === b.farmerId);
      return (fA?.canNumber || "").localeCompare(fB?.canNumber || "");
    });
  }, [allEntries, selectedDate, farmers]);

  const dailySales = useMemo(() => {
    if (!allSales || !selectedDate) return [];
    return allSales.filter(s => s.date === selectedDate).sort((a, b) => {
      const bA = buyers?.find(buy => buy.id === a.buyerId);
      const bB = buyers?.find(buy => buy.id === b.buyerId);
      return (bA?.buyerCode || "").localeCompare(bB?.buyerCode || "");
    });
  }, [allSales, selectedDate, buyers]);

  const monthlyEntries = useMemo(() => allEntries?.filter(e => e.date.startsWith(selectedMonth)) || [], [allEntries, selectedMonth]);
  const monthlySales = useMemo(() => allSales?.filter(s => s.date.startsWith(selectedMonth)) || [], [allSales, selectedMonth]);
  
  const totalMonthlyCollection = monthlyEntries.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const totalMonthlyProcurementCost = monthlyEntries.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
  const totalMonthlySalesRevenue = monthlySales.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
  const monthlyProfit = totalMonthlySalesRevenue - totalMonthlyProcurementCost;

  const currentYear = selectedMonth ? selectedMonth.split('-')[0] : format(new Date(), 'yyyy');
  const yearlyStats = useMemo(() => {
    if (!allEntries || !allSales || !currentYear) return [];
    
    const months = eachMonthOfInterval({
      start: startOfYear(new Date(parseInt(currentYear), 0, 1)),
      end: endOfYear(new Date(parseInt(currentYear), 0, 1))
    });

    return months.map(monthDate => {
      const monthPrefix = format(monthDate, 'yyyy-MM');
      const mEntries = allEntries.filter(e => e.date.startsWith(monthPrefix));
      const mSales = allSales.filter(s => s.date.startsWith(monthPrefix));
      
      const cost = mEntries.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
      const revenue = mSales.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
      
      return {
        month: format(monthDate, 'MMM'),
        fullName: format(monthDate, 'MMMM'),
        collection: mEntries.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0),
        cost,
        revenue,
        profit: revenue - cost
      };
    });
  }, [allEntries, allSales, currentYear]);

  const totalCollectionDailyVolume = dailyEntries.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const totalSalesDailyVolume = dailySales.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const totalFarmerCostDaily = dailyEntries.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
  const totalSalesRevenueDaily = dailySales.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
  const profitDaily = totalSalesRevenueDaily - totalFarmerCostDaily;

  const cowVolume = dailyEntries.filter(e => {
    const f = farmers?.find(far => far.id === e.farmerId);
    return f?.milkType === 'COW';
  }).reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

  const buffaloVolume = dailyEntries.filter(e => {
    const f = farmers?.find(far => far.id === e.farmerId);
    return f?.milkType === 'BUFFALO';
  }).reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

  const renderInvoice = (farmerId: string) => {
    const invFarmer = farmers?.find(f => f.id === farmerId);
    const invEntries = filteredCycleEntries.filter(e => e.farmerId === farmerId).sort((a, b) => a.date.localeCompare(b.date));
    
    if (!invFarmer || !invEntries) return null;

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
      <div className="invoice-content bg-white p-12 border shadow-sm mb-8 invoice-page-break text-black">
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
                <TableHead className="text-center border-r border-black font-bold text-black uppercase h-10 px-2">Total Litres</TableHead>
                <TableHead className="text-center border-r border-black font-bold text-black uppercase h-10 px-2">Rate (₹)</TableHead>
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
                  <TableCell className="text-center border-r border-black py-1.5">{invRate.toFixed(2)}</TableCell>
                  <TableCell className="text-right py-1.5 pr-4 font-mono">{ (row.total * invRate).toFixed(2) }</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex justify-between items-center text-lg font-bold border-t border-black pt-4">
            <span className="uppercase">Total</span>
            <div className="flex gap-20">
              <span className="w-32 text-center">{totalL.toFixed(2)}</span>
              <span className="w-40 text-right font-mono">{totalA.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 pt-8">
            <div className="flex gap-4 text-base">
              <span className="font-medium">Total Litres:</span>
              <span className="font-bold w-24 text-right">{totalL.toFixed(2)}</span>
            </div>
            <div className="flex gap-4 text-base">
              <span className="font-medium">Total Amount (₹):</span>
              <span className="font-bold w-24 text-right font-mono">{totalA.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-20 flex justify-between items-end italic text-xs text-muted-foreground">
          <p>Generated by {ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS"} Management System</p>
          <div className="flex flex-col items-center gap-2 relative">
            <div className="w-48 h-24 relative flex items-center justify-center mb-2">
              {ratesConfig?.stampUrl ? (
                <img 
                  src={ratesConfig.stampUrl} 
                  alt="Official Stamp" 
                  className="max-w-full max-h-full object-contain mix-blend-multiply opacity-90 grayscale contrast-125"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <CheckCircle2 className="w-16 h-16 text-primary/10 -rotate-12" />
                </div>
              )}
            </div>
            <p className="border-t border-black w-48 text-center pt-2 font-bold text-black uppercase relative z-10">Authorized Signature</p>
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

  // Single Invoice View
  if (viewingInvoiceFarmerId && !viewingBulkInvoices) {
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
            {renderInvoice(viewingInvoiceFarmerId)}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Bulk Invoices View
  if (viewingBulkInvoices) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <main className="flex-grow pt-24 pb-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8 no-print">
              <Button variant="outline" onClick={() => setViewingBulkInvoices(false)} className="rounded-full">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Bill
              </Button>
              <Button onClick={() => window.print()} className="rounded-full shadow-lg">
                <Printer className="w-4 h-4 mr-2" /> Print All Invoices
              </Button>
            </div>
            <div className="bulk-invoices-container">
              {activeFarmerCycleBreakdown.map(f => (
                <div key={f.id}>
                  {renderInvoice(f.id)}
                </div>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-grow pt-24 pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-black text-primary tracking-tight uppercase">
                  {ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS"} Intelligence
                </h1>
                <p className="text-muted-foreground font-medium">Enterprise collection logs, sales analytics and billing.</p>
              </div>
            </header>

            <Tabs defaultValue="overview" className="space-y-8">
              <TabsList className="flex flex-wrap h-auto gap-2 p-1.5 bg-muted rounded-2xl md:rounded-full border border-primary/5 w-full">
                <TabsTrigger value="overview" className="flex-1 md:flex-initial rounded-full font-bold gap-2 uppercase text-[9px] md:text-[10px] tracking-widest px-4 py-2.5">
                  <BarChart4 className="w-3.5 h-3.5" /> Overview
                </TabsTrigger>
                <TabsTrigger value="cycle" className="flex-1 md:flex-initial rounded-full font-bold gap-2 uppercase text-[9px] md:text-[10px] tracking-widest px-4 py-2.5">
                  <FileText className="w-3.5 h-3.5" /> Cycle Bill
                </TabsTrigger>
                <TabsTrigger value="master" className="flex-1 md:flex-initial rounded-full font-bold gap-2 uppercase text-[9px] md:text-[10px] tracking-widest px-4 py-2.5">
                  <ListChecks className="w-3.5 h-3.5" /> Master Summary
                </TabsTrigger>
                <TabsTrigger value="management" className="flex-1 md:flex-initial rounded-full font-bold gap-2 uppercase text-[9px] md:text-[10px] tracking-widest px-4 py-2.5">
                  <Activity className="w-3.5 h-3.5" /> Internal logs
                </TabsTrigger>
                <TabsTrigger value="daily" className="flex-1 md:flex-initial rounded-full font-bold gap-2 uppercase text-[9px] md:text-[10px] tracking-widest px-4 py-2.5">
                  <ClipboardList className="w-3.5 h-3.5" /> Collection
                </TabsTrigger>
                <TabsTrigger value="sales" className="flex-1 md:flex-initial rounded-full font-bold gap-2 uppercase text-[9px] md:text-[10px] tracking-widest px-4 py-2.5">
                  <ShoppingCart className="w-3.5 h-3.5" /> Sales
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-primary uppercase tracking-tighter">Daily Intelligence</h3>
                  </div>
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
                      <CardTitle className="text-4xl font-black">{totalCollectionDailyVolume.toFixed(1)} L</CardTitle>
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
                      <CardTitle className="text-4xl font-black">{totalSalesDailyVolume.toFixed(1)} L</CardTitle>
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
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Daily Net Profit</p>
                      <CardTitle className={cn("text-4xl font-black", profitDaily >= 0 ? "text-green-600" : "text-destructive")}>
                        ₹ {profitDaily.toLocaleString()}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                        <TrendingUp className={cn("w-4 h-4", profitDaily >= 0 ? "text-green-600" : "text-destructive")} />
                        Sales - Farmer Costs
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border-none shadow-xl bg-card overflow-hidden">
                    <CardHeader className="pb-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Farmer Payables</p>
                      <CardTitle className="text-3xl font-black text-primary">₹ {totalFarmerCostDaily.toLocaleString()}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                        <Wallet className="w-4 h-4" />
                        Total daily payouts
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="management" className="space-y-12 animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-black text-primary uppercase tracking-tighter">Internal Audit</h3>
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="rounded-3xl border-none shadow-xl bg-card p-6">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Monthly Procurement</p>
                    <p className="text-2xl font-black text-primary">{totalMonthlyCollection.toFixed(1)} Litres</p>
                  </Card>
                  <Card className="rounded-3xl border-none shadow-xl bg-card p-6">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Procurement Cost</p>
                    <p className="text-2xl font-black text-destructive">₹ {totalMonthlyProcurementCost.toLocaleString()}</p>
                  </Card>
                  <Card className="rounded-3xl border-none shadow-xl bg-card p-6">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Sales Revenue</p>
                    <p className="text-2xl font-black text-green-600">₹ {totalMonthlySalesRevenue.toLocaleString()}</p>
                  </Card>
                  <Card className="rounded-3xl border-none shadow-xl bg-primary text-primary-foreground p-6">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Net Monthly Profit</p>
                    <p className="text-2xl font-black">₹ {monthlyProfit.toLocaleString()}</p>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="cycle" className="space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-black text-primary uppercase tracking-tighter">Payment Cycle</h3>
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
                  <div className="flex flex-wrap gap-2">
                    {cycles.map((cycle, idx) => (
                      <Button 
                        key={cycle.id}
                        variant={activeCycle === idx ? "default" : "outline"}
                        onClick={() => setActiveCycle(idx)}
                        className="rounded-full text-[10px] font-black uppercase tracking-widest h-8"
                      >
                        {cycle.label}
                      </Button>
                    ))}
                    <Button 
                      onClick={() => setViewingBulkInvoices(true)} 
                      variant="secondary"
                      className="rounded-full text-[10px] font-black uppercase tracking-widest h-8 ml-2"
                      disabled={activeFarmerCycleBreakdown.length === 0}
                    >
                      <Files className="w-3.5 h-3.5 mr-2" /> Bulk Print Invoices
                    </Button>
                  </div>
                </div>

                <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card">
                  <Table>
                    <TableHeader className="bg-muted/50 border-b">
                      <TableRow>
                        <TableHead className="w-[120px] font-black text-primary pl-8 py-6 uppercase text-[10px] tracking-widest">CAN</TableHead>
                        <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Farmer Name</TableHead>
                        <TableHead className="text-right font-black text-primary uppercase text-[10px] tracking-widest">Total Litres</TableHead>
                        <TableHead className="text-right pr-8 font-black text-primary uppercase text-[10px] tracking-widest">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeFarmerCycleBreakdown.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground">No records found.</TableCell></TableRow>
                      ) : (
                        activeFarmerCycleBreakdown.map((f) => (
                          <TableRow key={f.id} className="hover:bg-primary/5 transition-colors border-b last:border-0">
                            <TableCell className="font-black text-primary pl-8 text-xl">{f.canNumber}</TableCell>
                            <TableCell className="font-bold">{f.name}</TableCell>
                            <TableCell className="text-right font-black text-primary text-2xl">{f.totalQty.toFixed(2)} L</TableCell>
                            <TableCell className="text-right pr-8">
                              <Button size="sm" onClick={() => setViewingInvoiceFarmerId(f.id)} className="rounded-full">View Invoice</Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <Footer />
        <style jsx global>{`
          @media print {
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            .invoice-page-break {
              page-break-after: always;
              break-after: page;
            }
            body * { visibility: hidden; }
            .invoice-content, .invoice-content *, 
            .bulk-invoices-container, .bulk-invoices-container *,
            .master-summary-print, .master-summary-print * { visibility: visible; }
            .invoice-content, .master-summary-print, .bulk-invoices-container { position: absolute; left: 0; top: 0; width: 100%; }
            .text-black { color: black !important; }
          }
        `}</style>
      </div>
    </TooltipProvider>
  );
}

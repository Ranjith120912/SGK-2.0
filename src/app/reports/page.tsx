
"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc, deleteDoc } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Loader2, 
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  FileBarChart,
  TrendingUp,
  CreditCard,
  IndianRupee,
  Scale
} from "lucide-react";
import { format, endOfMonth, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { utils, writeFile } from "xlsx";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ReportsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isClient, setIsClient] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setSelectedMonth(format(new Date(), 'yyyy-MM'));
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
  const { data: buyers } = useCollection(buyersQuery);
  const { data: allSales } = useCollection(salesQuery);
  const { data: ratesConfig } = useDoc(settingsRef);

  const CONVERSION_RATE = 0.96;
  const currentCycle = cycles[activeCycle];

  const cycleRoster = useMemo(() => {
    if (!allEntries || !selectedMonth || !currentCycle || !farmers || !ratesConfig) return [];
    
    const map: Record<string, any> = {};
    const cycleEntries = allEntries.filter(e => {
      if (!e.date.startsWith(selectedMonth)) return false;
      const day = parseInt(e.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    });

    cycleEntries.forEach(e => {
      const fid = e.farmerId;
      const farmerProfile = farmers.find(f => f.id === fid || f.canNumber === e.canNumber);
      if (!farmerProfile) return;

      if (!map[fid]) {
        map[fid] = { 
          id: fid, 
          can: farmerProfile.canNumber, 
          name: farmerProfile.name, 
          milkType: farmerProfile.milkType || "COW", 
          morningQty: 0, 
          eveningQty: 0, 
          totalQty: 0, 
          totalAmount: 0 
        };
      }

      const ltr = (Number(e.kgWeight) || 0) * CONVERSION_RATE;
      const rate = Number(farmerProfile.customRate) > 0 
        ? Number(farmerProfile.customRate) 
        : (farmerProfile.milkType === 'BUFFALO' ? (Number(ratesConfig.buffaloRate) || 0) : (Number(ratesConfig.cowRate) || 35));
      
      const amt = ltr * rate;
      if (e.session === 'Morning') map[fid].morningQty += ltr; else map[fid].eveningQty += ltr;
      map[fid].totalQty += ltr;
      map[fid].totalAmount += amt;
    });

    return Object.values(map).sort((a: any, b: any) => parseInt(a.can) - parseInt(b.can));
  }, [allEntries, farmers, selectedMonth, activeCycle, ratesConfig, currentCycle]);

  const monthlyRoster = useMemo(() => {
    if (!allEntries || !selectedMonth || !farmers || !ratesConfig) return [];
    const map: Record<string, any> = {};
    const monthEntries = allEntries.filter(e => e.date.startsWith(selectedMonth));

    monthEntries.forEach(e => {
      const fid = e.farmerId;
      const farmerProfile = farmers.find(f => f.id === fid || f.canNumber === e.canNumber);
      if (!farmerProfile) return;

      if (!map[fid]) {
        map[fid] = { 
          id: fid, 
          can: farmerProfile.canNumber, 
          name: farmerProfile.name, 
          milkType: farmerProfile.milkType || "COW", 
          morningQty: 0, 
          eveningQty: 0, 
          totalQty: 0, 
          totalAmount: 0 
        };
      }

      const ltr = (Number(e.kgWeight) || 0) * CONVERSION_RATE;
      const rate = Number(farmerProfile.customRate) > 0 
        ? Number(farmerProfile.customRate) 
        : (farmerProfile.milkType === 'BUFFALO' ? (Number(ratesConfig.buffaloRate) || 0) : (Number(ratesConfig.cowRate) || 35));
      
      const amt = ltr * rate;
      if (e.session === 'Morning') map[fid].morningQty += ltr; else map[fid].eveningQty += ltr;
      map[fid].totalQty += ltr;
      map[fid].totalAmount += amt;
    });

    return Object.values(map).sort((a: any, b: any) => parseInt(a.can) - parseInt(b.can));
  }, [allEntries, farmers, selectedMonth, ratesConfig]);

  // RECONCILED FINANCIALS: Strictly identifies unique active buyer entries per cycle
  const cycleStats = useMemo(() => {
    const cost = cycleRoster.reduce((acc, c) => acc + c.totalAmount, 0);
    const qty = cycleRoster.reduce((acc, c) => acc + c.totalQty, 0);
    
    let rev = 0;
    if (allSales && buyers) {
      const uniqueSales = new Map<string, number>();
      allSales.forEach(s => {
        if (s.month === selectedMonth && 
            s.cycleId !== undefined && 
            Number(s.cycleId) === activeCycle) {
          
          const buyerExists = buyers.find(b => b.id === s.buyerId);
          if (buyerExists) {
            // Overwrite ensures only latest/unique entry per buyer is reconciled
            uniqueSales.set(s.buyerId, Number(s.totalAmount) || 0);
          }
        }
      });
      rev = Array.from(uniqueSales.values()).reduce((a, b) => a + b, 0);
    }

    return { qty, cost, rev, profit: rev - cost };
  }, [cycleRoster, allSales, selectedMonth, activeCycle, buyers]);

  const auditData = useMemo(() => {
    if (!allEntries || !allSales || !farmers || !ratesConfig || !buyers) return [];
    
    return monthOptions.map((opt) => {
      const mEntries = allEntries.filter(e => e.date.startsWith(opt.value));
      
      let tCost = 0, tQty = 0;
      mEntries.forEach(e => {
        const f = farmers.find(item => item.id === e.farmerId || item.canNumber === e.canNumber);
        if (!f) return;
        const ltr = (Number(e.kgWeight) || 0) * CONVERSION_RATE;
        const rate = Number(f.customRate) > 0 
          ? Number(f.customRate) 
          : (f.milkType === 'BUFFALO' ? (Number(ratesConfig.buffaloRate) || 0) : (Number(ratesConfig.cowRate || 35)));
        tCost += (ltr * rate);
        tQty += ltr;
      });

      const mSales = allSales.filter(s => s.month === opt.value);
      const uniqueSales = new Map<string, number>();
      mSales.forEach(s => {
        const buyerExists = buyers.find(b => b.id === s.buyerId);
        if (buyerExists) {
          const key = `${s.buyerId}_${s.cycleId}`;
          uniqueSales.set(key, Number(s.totalAmount) || 0);
        }
      });
      const tRev = Array.from(uniqueSales.values()).reduce((a, b) => a + b, 0);

      return { label: opt.label, value: opt.value, qty: tQty, cost: tCost, revenue: tRev, profit: tRev - tCost };
    });
  }, [allEntries, allSales, farmers, ratesConfig, monthOptions, buyers]);

  const handleExportExcel = (roster: any[], title: string) => {
    const data = roster.map(f => ({ 
      CAN: f.can, 
      Name: f.name, 
      Type: f.milkType, 
      Morning: f.morningQty.toFixed(2), 
      Evening: f.eveningQty.toFixed(2), 
      Total: f.totalQty.toFixed(2), 
      Payout: f.totalAmount.toFixed(2) 
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, title);
    writeFile(wb, `${title}_${selectedMonth}.xlsx`);
  };

  const handleMasterReset = async () => {
    setIsResetting(true);
    try {
      if (allEntries) for (const e of allEntries) await deleteDoc(doc(firestore!, 'entries', e.id));
      if (allSales) for (const s of allSales) await deleteDoc(doc(firestore!, 'sales', s.id));
      toast({ title: "Reset Complete", description: "All entry and sales data wiped." });
    } catch (e) {
      toast({ title: "Reset Failed", variant: "destructive" });
    } finally { setIsResetting(false); }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1">
                <FileBarChart className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-widest">Financial Audit</span>
              </div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Audit & Reports</h1>
              <p className="text-muted-foreground font-medium">Monthly and cycle-wise procurement analytics.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
               <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full sm:w-[220px] rounded-full font-bold h-11 border-primary/20 shadow-sm bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-full border shadow-sm">
                  {cycles.map((c, i) => (
                    <button 
                      key={i} 
                      onClick={() => setActiveCycle(i)} 
                      className={cn("rounded-full text-[10px] font-black px-4 h-9 transition-all", activeCycle === i ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-muted")}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
            </div>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
              <TabsList className="bg-muted p-1 rounded-full h-auto overflow-x-auto">
                <TabsTrigger value="overview" className="rounded-full px-6 py-2 font-black uppercase text-[10px] tracking-widest">Overview</TabsTrigger>
                <TabsTrigger value="cycle" className="rounded-full px-6 py-2 font-black uppercase text-[10px] tracking-widest">Cycle Report</TabsTrigger>
                <TabsTrigger value="monthly" className="rounded-full px-6 py-2 font-black uppercase text-[10px] tracking-widest">Monthly Summary</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-full px-6 py-2 font-black uppercase text-[10px] tracking-widest">Master Log</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="rounded-[2rem] bg-primary text-white p-8 shadow-xl relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                    <Scale className="w-32 h-32" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Volume Procurement</p>
                  <p className="text-4xl font-black mt-2">{cycleStats.qty.toFixed(2)} <span className="text-lg">L</span></p>
                </Card>
                <Card className="rounded-[2rem] bg-accent text-white p-8 shadow-xl relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                    <TrendingUp className="w-32 h-32" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Revenue (Sales)</p>
                  <p className="text-4xl font-black mt-2">₹ {cycleStats.rev.toFixed(2)}</p>
                </Card>
                <Card className="rounded-[2rem] p-8 border-none bg-rose-500/10 text-rose-600 shadow-sm relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <CreditCard className="w-32 h-32 text-rose-600" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Payouts</p>
                  <p className="text-3xl font-black mt-2">₹ {cycleStats.cost.toFixed(2)}</p>
                </Card>
                <Card className="rounded-[2rem] p-8 border-none bg-emerald-500/10 text-emerald-600 shadow-sm relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <IndianRupee className="w-32 h-32 text-emerald-600" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Net Margin</p>
                  <p className="text-3xl font-black mt-2">₹ {cycleStats.profit.toFixed(2)}</p>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="cycle" className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-primary p-8 rounded-[2rem] text-white shadow-xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 flex-grow">
                    <div>
                      <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Cycle Revenue</p>
                      <p className="text-2xl font-black mt-1">₹ {cycleStats.rev.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Cycle Cost</p>
                      <p className="text-2xl font-black mt-1">₹ {cycleStats.cost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Cycle Profit</p>
                      <p className={cn("text-2xl font-black mt-1", cycleStats.profit >= 0 ? "text-emerald-300" : "text-rose-300")}>
                        ₹ {cycleStats.profit.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => handleExportExcel(cycleRoster, `Cycle_${currentCycle?.label}`)} className="rounded-full bg-white text-primary px-10 h-12 font-black uppercase text-xs shadow-lg hover:bg-white/90 shrink-0">
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Cycle
                  </Button>
                </div>
              </div>
              
              <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase py-5 tracking-widest">CAN</TableHead>
                      <TableHead className="font-black text-[10px] uppercase py-5 tracking-widest">Farmer Name</TableHead>
                      <TableHead className="font-black text-[10px] uppercase py-5 tracking-widest">Milk Type</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase py-5 tracking-widest">Total Volume (L)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase py-5 tracking-widest">Total Payout (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycleRoster.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 italic text-muted-foreground font-medium">No procurement data for this cycle.</TableCell></TableRow>
                    ) : (
                      cycleRoster.map(f => (
                        <TableRow key={f.id} className="hover:bg-primary/5 transition-colors group">
                          <TableCell className="pl-10 font-black text-primary text-lg">{f.can}</TableCell>
                          <TableCell className="font-bold uppercase text-sm">{f.name}</TableCell>
                          <TableCell>
                            <Badge variant={f.milkType === 'BUFFALO' ? "secondary" : "outline"} className="text-[9px] rounded-full px-2 font-black uppercase">
                              {f.milkType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-base">{f.totalQty.toFixed(2)}</TableCell>
                          <TableCell className="text-right pr-10 font-black text-primary text-base">₹ {f.totalAmount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="monthly" className="space-y-6 animate-in fade-in duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-center bg-accent p-8 rounded-[2rem] text-white gap-6 shadow-xl">
                <div>
                  <p className="text-xs font-black uppercase opacity-60 tracking-widest">Full Monthly Procurement Summary</p>
                  <p className="text-4xl font-black mt-1">₹ {monthlyRoster.reduce((acc, f) => acc + f.totalAmount, 0).toFixed(2)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => handleExportExcel(monthlyRoster, "Monthly_Report")} className="rounded-full bg-white text-accent px-10 h-12 font-black uppercase text-xs shadow-lg hover:bg-white/90">
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel Export
                  </Button>
                </div>
              </div>
              <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase py-5 tracking-widest">CAN</TableHead>
                      <TableHead className="font-black text-[10px] uppercase py-5 tracking-widest">Farmer Name</TableHead>
                      <TableHead className="font-black text-[10px] uppercase py-5 tracking-widest">Milk Type</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase py-5 tracking-widest">Monthly Volume (L)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase py-5 tracking-widest">Total Payout (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyRoster.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 italic text-muted-foreground font-medium">No procurement data for this month.</TableCell></TableRow>
                    ) : (
                      monthlyRoster.map(f => (
                        <TableRow key={f.id} className="hover:bg-accent/5 transition-colors group">
                          <TableCell className="pl-10 font-black text-accent text-lg">{f.can}</TableCell>
                          <TableCell className="font-bold uppercase text-sm">{f.name}</TableCell>
                          <TableCell>
                            <Badge variant={f.milkType === 'BUFFALO' ? "secondary" : "outline"} className="text-[9px] rounded-full px-2 font-black uppercase">
                              {f.milkType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-base">{f.totalQty.toFixed(2)}</TableCell>
                          <TableCell className="text-right pr-10 font-black text-accent text-base">₹ {f.totalAmount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card/50 backdrop-blur-sm">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase py-8 tracking-widest">Financial Period</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">Total Vol (L)</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">Total Payouts</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">Direct Revenue</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase tracking-widest">Net Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditData.map((row, i) => (
                      <TableRow key={i} className="border-b last:border-0 hover:bg-primary/5 transition-colors">
                        <TableCell className="pl-10 font-black text-primary uppercase py-8 text-sm">{row.label}</TableCell>
                        <TableCell className="text-center font-bold text-base">{row.qty.toFixed(2)} L</TableCell>
                        <TableCell className="text-center text-rose-600 font-black text-base">₹ {row.cost.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-accent font-black text-base">₹ {row.revenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10 font-black text-2xl tracking-tighter">
                          <span className={row.profit >= 0 ? "text-emerald-600" : "text-rose-600"}>
                            ₹ {row.profit.toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              <div className="flex justify-end pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="rounded-full text-destructive border border-dashed border-destructive/20 hover:bg-destructive/10 px-8 h-12 font-black uppercase text-[10px] tracking-widest">
                      <Trash2 className="mr-2 h-4 w-4" /> Master Financial Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase tracking-tight">
                        <AlertTriangle className="w-5 h-5" /> Irreversible Wipe
                      </AlertDialogTitle>
                      <AlertDialogDescription className="font-medium">
                        Are you sure you want to delete ALL historical entries and sales records? This will permanently wipe your audit logs. Directory items (Farmers/Buyers) will remain.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="border-t pt-4">
                      <AlertDialogCancel className="rounded-full">No, Keep Data</AlertDialogCancel>
                      <AlertDialogAction onClick={handleMasterReset} className="rounded-full bg-destructive hover:bg-destructive/90 px-8 shadow-lg">
                        {isResetting ? <Loader2 className="animate-spin mr-2" /> : "Yes, Wipe Everything"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}

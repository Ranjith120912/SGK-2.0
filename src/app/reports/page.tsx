"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc, deleteDoc } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Loader2, 
  Download,
  Trash2,
  AlertTriangle,
  Users,
  FileSpreadsheet,
  FileBarChart,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Wallet
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

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: allEntries, isLoading: entriesLoading } = useCollection(entriesQuery);
  const { data: farmers, isLoading: farmersLoading } = useCollection(farmersQuery);
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
        map[fid] = { id: fid, can: farmerProfile.canNumber, name: farmerProfile.name, milkType: farmerProfile.milkType || "COW", morningQty: 0, eveningQty: 0, totalQty: 0, totalAmount: 0 };
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
        map[fid] = { id: fid, can: farmerProfile.canNumber, name: farmerProfile.name, milkType: farmerProfile.milkType || "COW", morningQty: 0, eveningQty: 0, totalQty: 0, totalAmount: 0 };
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

  const cycleStats = useMemo(() => {
    const cost = cycleRoster.reduce((acc, c) => acc + c.totalAmount, 0);
    const qty = cycleRoster.reduce((acc, c) => acc + c.totalQty, 0);
    const rev = allSales?.filter(s => s.month === selectedMonth && s.cycleId === activeCycle).reduce((acc, s) => acc + (Number(s.totalAmount) || 0), 0) || 0;
    return { qty, cost, rev, profit: rev - cost };
  }, [cycleRoster, allSales, selectedMonth, activeCycle]);

  const auditData = useMemo(() => {
    if (!allEntries || !allSales || !farmers || !ratesConfig) return [];
    return monthOptions.map((opt) => {
      const mEntries = allEntries.filter(e => e.date.startsWith(opt.value));
      const mSales = allSales.filter(s => s.month === opt.value);
      let tCost = 0, tQty = 0;
      mEntries.forEach(e => {
        const f = farmers.find(item => item.id === e.farmerId || item.canNumber === e.canNumber);
        if (!f) return;
        const ltr = (Number(e.kgWeight) || 0) * CONVERSION_RATE;
        const rate = Number(f.customRate) > 0 ? Number(f.customRate) : (f.milkType === 'BUFFALO' ? (Number(ratesConfig.buffaloRate) || 0) : (Number(ratesConfig.cowRate) || 35));
        tCost += (ltr * rate);
        tQty += ltr;
      });
      const tRev = mSales.reduce((acc, s) => acc + (Number(s.totalAmount) || 0), 0);
      return { label: opt.label, value: opt.value, qty: tQty, cost: tCost, revenue: tRev, profit: tRev - tCost };
    });
  }, [allEntries, allSales, farmers, ratesConfig, monthOptions]);

  const handleExportExcel = (roster: any[], title: string) => {
    const data = roster.map(f => ({ CAN: f.can, Name: f.name, Type: f.milkType, Morning: f.morningQty.toFixed(2), Evening: f.eveningQty.toFixed(2), Total: f.totalQty.toFixed(2), Payout: f.totalAmount.toFixed(2) }));
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
      toast({ title: "Reset Complete" });
    } finally { setIsResetting(false); }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8 flex justify-between items-center">
            <h1 className="text-3xl font-black text-primary uppercase">Business Audit</h1>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px] rounded-full font-bold h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
            </Select>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
              <TabsList className="bg-muted p-1 rounded-full h-auto">
                <TabsTrigger value="overview" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Overview</TabsTrigger>
                <TabsTrigger value="cycle" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Cycle Report</TabsTrigger>
                <TabsTrigger value="monthly" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Monthly Report</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Audit Log</TabsTrigger>
              </TabsList>
              {activeTab === "cycle" && (
                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-full border">
                  {cycles.map((c, i) => (
                    <button key={i} onClick={() => setActiveCycle(i)} className={cn("rounded-full text-[10px] font-black px-4 h-8 transition-all", activeCycle === i ? "bg-primary text-white" : "text-muted-foreground")}>{c.label}</button>
                  ))}
                </div>
              )}
            </div>

            <TabsContent value="overview" className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="rounded-[2rem] bg-primary text-white p-8"><p className="text-[10px] font-black uppercase tracking-widest opacity-80">Volume</p><p className="text-4xl font-black mt-2">{cycleStats.qty.toFixed(2)} L</p></Card>
              <Card className="rounded-[2rem] bg-accent text-white p-8"><p className="text-[10px] font-black uppercase tracking-widest opacity-80">Revenue</p><p className="text-4xl font-black mt-2">₹ {cycleStats.rev.toFixed(2)}</p></Card>
              <Card className="rounded-[2rem] p-8 bg-destructive/10 text-destructive"><p className="text-[10px] font-black uppercase opacity-70">Payouts</p><p className="text-3xl font-black mt-2">₹ {cycleStats.cost.toFixed(2)}</p></Card>
              <Card className="rounded-[2rem] p-8 bg-green-500/10 text-green-600"><p className="text-[10px] font-black uppercase opacity-70">Profit</p><p className="text-3xl font-black mt-2">₹ {cycleStats.profit.toFixed(2)}</p></Card>
            </TabsContent>

            <TabsContent value="cycle" className="space-y-6">
              <div className="flex justify-between items-center bg-primary p-8 rounded-[2rem] text-white">
                <div><p className="text-xs font-black uppercase opacity-60">Cycle Total - {currentCycle?.range}</p><p className="text-4xl font-black mt-1">₹ {cycleStats.cost.toFixed(2)}</p></div>
                <Button onClick={() => handleExportExcel(cycleRoster, `Cycle_${currentCycle?.label}`)} className="rounded-full bg-white text-primary px-8 font-black uppercase text-xs">Excel Export</Button>
              </div>
              <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-card/50">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase">CAN</TableHead>
                      <TableHead className="font-black text-[10px] uppercase">Farmer</TableHead>
                      <TableHead className="font-black text-[10px] uppercase">Type</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase">Total (L)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase">Payout (Rs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycleRoster.map(f => (
                      <TableRow key={f.id} className="hover:bg-primary/5">
                        <TableCell className="pl-10 font-black text-primary text-lg">{f.can}</TableCell>
                        <TableCell className="font-bold uppercase text-sm">{f.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] rounded-full px-2 font-black">{f.milkType}</Badge></TableCell>
                        <TableCell className="text-right font-bold text-base">{f.totalQty.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10 font-black text-primary">₹ {f.totalAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow><TableCell colSpan={3} className="pl-10 font-black">GRAND TOTAL</TableCell><TableCell className="text-right font-black">{cycleStats.qty.toFixed(2)} L</TableCell><TableCell className="text-right pr-10 font-black">₹ {cycleStats.cost.toFixed(2)}</TableCell></TableRow>
                  </TableFooter>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="monthly" className="space-y-6">
              <div className="flex justify-between items-center bg-accent p-8 rounded-[2rem] text-white">
                <div><p className="text-xs font-black uppercase opacity-60">Monthly Procurement Total</p><p className="text-4xl font-black mt-1">₹ {monthlyRoster.reduce((acc, f) => acc + f.totalAmount, 0).toFixed(2)}</p></div>
                <Button onClick={() => handleExportExcel(monthlyRoster, "Monthly_Report")} className="rounded-full bg-white text-accent px-8 font-black uppercase text-xs">Excel Export</Button>
              </div>
              <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-card/50">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase">CAN</TableHead>
                      <TableHead className="font-black text-[10px] uppercase">Farmer</TableHead>
                      <TableHead className="font-black text-[10px] uppercase">Type</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase">Total (L)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase">Payout (Rs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyRoster.map(f => (
                      <TableRow key={f.id} className="hover:bg-accent/5">
                        <TableCell className="pl-10 font-black text-accent text-lg">{f.can}</TableCell>
                        <TableCell className="font-bold uppercase text-sm">{f.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] rounded-full px-2 font-black">{f.milkType}</Badge></TableCell>
                        <TableCell className="text-right font-bold text-base">{f.totalQty.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10 font-black text-accent">₹ {f.totalAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow><TableCell colSpan={3} className="pl-10 font-black">GRAND TOTAL</TableCell><TableCell className="text-right font-black">{monthlyRoster.reduce((acc, f) => acc + f.totalQty, 0).toFixed(2)} L</TableCell><TableCell className="text-right pr-10 font-black">₹ {monthlyRoster.reduce((acc, f) => acc + f.totalAmount, 0).toFixed(2)}</TableCell></TableRow>
                  </TableFooter>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-6">
              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card/50">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase py-6">Period</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase">Volume (L)</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase">Costs</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase">Revenue</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditData.map((row, i) => (
                      <TableRow key={i} className="border-b">
                        <TableCell className="pl-10 font-black text-primary uppercase py-6">{row.label}</TableCell>
                        <TableCell className="text-center font-bold">{row.qty.toFixed(2)} L</TableCell>
                        <TableCell className="text-center text-rose-600 font-black">₹ {row.cost.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-green-600 font-black">₹ {row.revenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10 font-black text-xl"><span className={row.profit >= 0 ? "text-green-600" : "text-rose-600"}>₹ {row.profit.toFixed(2)}</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              <div className="flex justify-end gap-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="destructive" className="rounded-full px-8">Master Financial Reset</Button></AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader><AlertDialogTitle className="font-black uppercase">Confirm Wipe</AlertDialogTitle><AlertDialogDescription>Delete all records permanently?</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleMasterReset} className="rounded-full bg-destructive">{isResetting ? <Loader2 className="animate-spin" /> : "Confirm Wipe"}</AlertDialogAction></AlertDialogFooter>
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


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
  Download,
  Trash2,
  AlertTriangle,
  Users
} from "lucide-react";
import { format, endOfMonth, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import "jspdf-autotable";
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

  const masterRoster = useMemo(() => {
    if (!allEntries || !selectedMonth || !currentCycle || !farmers || !ratesConfig) return [];
    
    const map: Record<string, any> = {};
    const cycleEntries = allEntries.filter(e => {
      if (!e.date.startsWith(selectedMonth)) return false;
      const day = parseInt(e.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    });

    cycleEntries.forEach(e => {
      const fid = e.farmerId;
      // STRICT DIRECTORY VALIDATION: Only include validated farmers
      const farmerProfile = farmers.find(f => f.id === fid || f.canNumber === e.canNumber);
      
      if (!farmerProfile) return; // REMOVE unknown farmers

      const name = farmerProfile.name;
      const can = farmerProfile.canNumber;
      const milkType = farmerProfile.milkType || "COW";

      if (!map[fid]) {
        map[fid] = {
          id: fid,
          can,
          name,
          milkType,
          morningQty: 0, eveningQty: 0, totalQty: 0, totalAmount: 0
        };
      }

      const ltr = (Number(e.kgWeight) || 0) * CONVERSION_RATE;
      
      let rate = 0;
      if (milkType === 'BUFFALO') {
        rate = Number(farmerProfile.customRate) > 0 
          ? Number(farmerProfile.customRate) 
          : (Number(ratesConfig.buffaloRate) || 0);
      } else {
        rate = Number(ratesConfig.cowRate) || 0;
      }

      const amt = ltr * rate;

      if (e.session === 'Morning') map[fid].morningQty += ltr;
      else map[fid].eveningQty += ltr;
      
      map[fid].totalQty += ltr;
      map[fid].totalAmount += amt;
    });

    return Object.values(map).sort((a: any, b: any) => {
      const aNum = parseInt(a.can);
      const bNum = parseInt(b.can);
      if (isNaN(aNum) || isNaN(bNum)) return a.can.localeCompare(b.can);
      return aNum - bNum;
    });
  }, [allEntries, farmers, selectedMonth, activeCycle, ratesConfig, currentCycle]);

  const cycleStats = useMemo(() => {
    const totalProcAmt = masterRoster.reduce((acc, c) => acc + c.totalAmount, 0);
    const totalProcQty = masterRoster.reduce((acc, c) => acc + c.totalQty, 0);

    const cycleSales = allSales?.filter(s => {
      if (!s.date.startsWith(selectedMonth)) return false;
      const day = parseInt(s.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    }) || [];

    const totalSaleAmt = cycleSales.reduce((acc, s) => acc + (Number(s.totalAmount) || 0), 0);

    return {
      qty: totalProcQty,
      procCost: totalProcAmt,
      saleRev: totalSaleAmt,
      profit: totalSaleAmt - totalProcAmt
    };
  }, [masterRoster, allSales, selectedMonth, currentCycle]);

  const handleMasterReset = async () => {
    if (!firestore) return;
    setIsResetting(true);
    try {
      if (allEntries) {
        for (const entry of allEntries) {
          await deleteDoc(doc(firestore, 'entries', entry.id));
        }
      }
      if (allSales) {
        for (const sale of allSales) {
          await deleteDoc(doc(firestore, 'sales', sale.id));
        }
      }
      toast({ title: "Master Reset Successful", description: "All records cleared." });
    } catch (e: any) {
      toast({ title: "Reset Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Reports & Audit</h1>
              <p className="text-muted-foreground font-medium flex items-center gap-2">
                <Users className="w-4 h-4" /> 
                Validated Business Resolution
              </p>
            </div>
            <div className="flex gap-4">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px] rounded-full font-bold h-11 border-primary/20 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b pb-4">
              <TabsList className="bg-muted p-1 rounded-full h-auto">
                <TabsTrigger value="overview" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Overview</TabsTrigger>
                <TabsTrigger value="master" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Master Roster</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Internal Audit</TabsTrigger>
              </TabsList>

              {["overview", "master"].includes(activeTab) && (
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-full border shadow-sm">
                  {cycles.map((c, i) => (
                    <button 
                      key={i} 
                      onClick={() => setActiveCycle(i)} 
                      className={cn(
                        "rounded-full text-[10px] font-black px-4 h-8 transition-all", 
                        activeCycle === i ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="rounded-[2rem] bg-primary text-white p-8 shadow-xl border-none">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cycle Volume</p>
                  <p className="text-4xl font-black mt-2">{cycleStats.qty.toFixed(2)} L</p>
                </Card>
                <Card className="rounded-[2rem] bg-accent text-white p-8 shadow-xl border-none">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cycle Revenue</p>
                  <p className="text-4xl font-black mt-2">₹ {cycleStats.saleRev.toFixed(2)}</p>
                </Card>
                <Card className="rounded-[2rem] p-8 border-none bg-destructive/10 text-destructive shadow-sm">
                  <p className="text-[10px] font-black uppercase opacity-70">Cycle Payout</p>
                  <p className="text-3xl font-black mt-2">₹ {cycleStats.procCost.toFixed(2)}</p>
                </Card>
                <Card className="rounded-[2rem] p-8 border-none bg-green-500/10 text-green-600 shadow-sm">
                  <p className="text-[10px] font-black uppercase opacity-70">Cycle Profit</p>
                  <p className="text-3xl font-black mt-2">₹ {cycleStats.profit.toFixed(2)}</p>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="master" className="space-y-6">
              <div className="flex justify-between items-center bg-primary p-8 rounded-[2rem] text-white shadow-xl border-none">
                <div>
                  <p className="text-xs font-black uppercase opacity-60 tracking-widest">Cycle Grand Total Procurement</p>
                  <p className="text-4xl font-black mt-1">₹ {cycleStats.procCost.toFixed(2)}</p>
                </div>
                <Button onClick={() => {
                  const pdf = new jsPDF('l', 'mm', 'a4');
                  const company = (ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS").toUpperCase();
                  pdf.setFontSize(18);
                  pdf.text(company, 14, 20);
                  pdf.setFontSize(12);
                  pdf.text(`MASTER PROCUREMENT ROSTER - ${currentCycle.label} (${selectedMonth})`, 14, 28);
                  (pdf as any).autoTable({
                    startY: 35,
                    head: [['CAN', 'FARMER NAME', 'TYPE', 'MORNING QTY', 'EVENING QTY', 'TOTAL LITRES', 'PAYOUT (Rs)']],
                    body: masterRoster.map(f => [f.can, f.name, f.milkType, f.morningQty.toFixed(2), f.eveningQty.toFixed(2), f.totalQty.toFixed(2), f.totalAmount.toFixed(2)]),
                    theme: 'grid',
                    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
                    bodyStyles: { halign: 'center' }
                  });
                  pdf.save(`Master_Roster_${selectedMonth}_${currentCycle.label}.pdf`);
                }} className="rounded-full bg-white text-primary hover:bg-white/90 h-12 px-8 font-black uppercase text-xs shadow-lg">
                  <Download className="mr-2 h-4 w-4" /> Export Roster PDF
                </Button>
              </div>

              <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] py-4 uppercase w-[100px]">CAN</TableHead>
                      <TableHead className="font-black text-[10px] uppercase">Farmer Name</TableHead>
                      <TableHead className="font-black text-[10px] uppercase">Milk Type</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase">Morning (L)</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase">Evening (L)</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase">Total (L)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase">Payout (Rs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masterRoster.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-20 italic text-muted-foreground">No validated directory records found.</TableCell></TableRow>
                    ) : (
                      masterRoster.map(f => (
                        <TableRow key={f.id} className="hover:bg-primary/5 transition-colors group">
                          <TableCell className="pl-10 font-black text-primary text-lg">{f.can}</TableCell>
                          <TableCell className="font-bold uppercase text-sm">{f.name}</TableCell>
                          <TableCell>
                            <Badge variant={f.milkType === 'BUFFALO' ? "secondary" : "outline"} className="text-[9px] rounded-full px-2 font-black">
                              {f.milkType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{f.morningQty.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{f.eveningQty.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold text-base">{f.totalQty.toFixed(2)}</TableCell>
                          <TableCell className="text-right pr-10 font-black text-primary text-base">₹ {f.totalAmount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-8">
              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card/50 backdrop-blur-sm">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] py-6 uppercase tracking-widest">Month</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">Volume (L)</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">Procurement (Rs)</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">Revenue (Rs)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase tracking-widest">Profit (Rs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthOptions.map((opt, i) => {
                       const mEntries = allEntries?.filter(e => e.date.startsWith(opt.value)) || [];
                       const mSales = allSales?.filter(s => s.date.startsWith(opt.value)) || [];
                       
                       let tCost = 0, tRev = 0, tQty = 0;
                       mEntries.forEach(e => {
                         const f = farmers?.find(item => item.id === e.farmerId || item.canNumber === e.canNumber);
                         if (!f) return; // ONLY include directory farmers
                         
                         const milkType = f.milkType || "COW";
                         const ltr = (Number(e.kgWeight) || 0) * CONVERSION_RATE;
                         
                         let rate = 0;
                         if (milkType === 'BUFFALO') {
                           rate = Number(f.customRate) > 0 ? Number(f.customRate) : (Number(ratesConfig?.buffaloRate) || 0);
                         } else {
                           rate = Number(ratesConfig?.cowRate) || 0;
                         }
                         tCost += (ltr * rate);
                         tQty += ltr;
                       });
                       mSales.forEach(s => {
                         tRev += Number(s.totalAmount) || 0;
                       });

                       return (
                        <TableRow key={i} className="hover:bg-muted/10 group transition-colors border-b last:border-0">
                          <TableCell className="pl-10 font-black text-primary uppercase text-sm py-6">{opt.label}</TableCell>
                          <TableCell className="text-center font-bold text-base">{tQty.toFixed(2)} L</TableCell>
                          <TableCell className="text-center text-rose-600 font-black">₹ {tCost.toFixed(2)}</TableCell>
                          <TableCell className="text-center text-green-600 font-black">₹ {tRev.toFixed(2)}</TableCell>
                          <TableCell className="text-right pr-10 font-black text-xl">
                            <span className={(tRev - tCost) >= 0 ? "text-green-600" : "text-rose-600"}>₹ {(tRev - tCost).toFixed(2)}</span>
                          </TableCell>
                        </TableRow>
                       );
                    })}
                  </TableBody>
                </Table>
              </Card>

              <div className="pt-10 border-t">
                <h3 className="text-xs font-black text-destructive uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> System Recovery
                </h3>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="rounded-full px-8 h-12 shadow-lg">
                      <Trash2 className="w-4 h-4 mr-2" /> Master Financial Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-black text-destructive uppercase">Confirm Global Wipe</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete ALL entries and sales records. Directory farmers will be preserved.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleMasterReset} className="rounded-full bg-destructive hover:bg-destructive/90">
                        {isResetting ? <Loader2 className="animate-spin" /> : "Confirm Full Wipe"}
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

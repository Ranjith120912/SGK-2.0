
"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, FileText, Droplets, ChevronRight, Loader2, ClipboardList, ShoppingCart, User } from "lucide-react";
import { format, endOfMonth, startOfMonth } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function ReportsPage() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const now = new Date();
    setSelectedMonth(format(now, 'yyyy-MM'));
    setSelectedDate(format(now, 'yyyy-MM-dd'));
  }, []);

  // Generate Year-Month options for the last 12 months
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

  // Calculate cycles for selected month based on 10-day logic
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

  const { data: allEntries, isLoading: entriesLoading } = useCollection(entriesQuery);
  const { data: farmers } = useCollection(farmersQuery);
  const { data: allSales } = useCollection(salesQuery);
  const { data: buyers } = useCollection(buyersQuery);

  // --- Cycle Bill Logic ---
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
    return { qty: cEntries.reduce((acc, curr) => acc + (curr.quantity || 0), 0) };
  });

  const farmerCycleBreakdown = farmers?.map(farmer => {
    const fEntries = filteredCycleEntries?.filter(e => e.farmerId === farmer.id) || [];
    return {
      ...farmer,
      totalQty: fEntries.reduce((acc, curr) => acc + (curr.quantity || 0), 0)
    };
  }).filter(f => f.totalQty > 0).sort((a, b) => {
    const aNum = parseInt(a.canNumber);
    const bNum = parseInt(b.canNumber);
    return (isNaN(aNum) || isNaN(bNum)) ? a.canNumber.localeCompare(b.canNumber) : aNum - bNum;
  });

  // --- Daily Summary Logic ---
  const dailyEntries = allEntries?.filter(e => e.date === selectedDate).sort((a, b) => {
    const fA = farmers?.find(f => f.id === a.farmerId);
    const fB = farmers?.find(f => f.id === b.farmerId);
    return (fA?.canNumber || "").localeCompare(fB?.canNumber || "");
  });

  // --- Sales Summary Logic ---
  const dailySales = allSales?.filter(s => s.date === selectedDate).sort((a, b) => {
    const bA = buyers?.find(buy => buy.id === a.buyerId);
    const bB = buyers?.find(buy => buy.id === b.buyerId);
    return (bA?.buyerCode || "").localeCompare(bB?.buyerCode || "");
  });

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
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight">SGK MILK Reports</h1>
              <p className="text-muted-foreground font-medium">Analytics for daily collection and 10-day payment cycles.</p>
            </div>
          </header>

          <Tabs defaultValue="cycle" className="space-y-8">
            <TabsList className="grid grid-cols-3 w-full sm:w-[600px] rounded-full p-1 bg-muted">
              <TabsTrigger value="cycle" className="rounded-full font-bold gap-2">
                <FileText className="w-4 h-4" /> Cycle Bill
              </TabsTrigger>
              <TabsTrigger value="daily" className="rounded-full font-bold gap-2">
                <ClipboardList className="w-4 h-4" /> Daily Summary
              </TabsTrigger>
              <TabsTrigger value="sales" className="rounded-full font-bold gap-2">
                <ShoppingCart className="w-4 h-4" /> Sales Report
              </TabsTrigger>
            </TabsList>

            {/* PAYMENT CYCLE BILL - LITRES ONLY */}
            <TabsContent value="cycle" className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-end items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[200px] rounded-full font-bold border-primary/20">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cycles.map((cycle, idx) => (
                  <Card 
                    key={cycle.id}
                    onClick={() => setActiveCycle(idx)}
                    className={`relative overflow-hidden rounded-[2rem] cursor-pointer transition-all duration-300 border-2 ${
                      activeCycle === idx 
                      ? "border-primary bg-primary/5 shadow-xl scale-[1.02]" 
                      : "border-transparent bg-card hover:bg-muted/50"
                    }`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <Badge variant={activeCycle === idx ? "default" : "outline"} className="rounded-full font-black text-[10px] uppercase">
                          {cycle.label}
                        </Badge>
                        {activeCycle === idx && <ChevronRight className="w-5 h-5 text-primary animate-pulse" />}
                      </div>
                      <CardTitle className="text-xl font-black mt-2">{cycle.range}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-bold text-xs uppercase tracking-tighter">Volume:</span>
                        <span className="font-black text-primary text-2xl">{cycleStats[idx]?.qty.toFixed(1) || "0.0"} <small className="text-xs">L</small></span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card/50 backdrop-blur-sm">
                <div className="p-8 border-b bg-primary/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-primary uppercase tracking-tighter">Cycle Quantity Bill</h3>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                      {currentCycle?.label} • {currentCycle?.range} • {format(new Date(selectedMonth + "-01"), "MMMM yyyy")}
                    </p>
                  </div>
                  <div className="bg-primary px-6 py-3 rounded-2xl text-primary-foreground shadow-lg">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Litres Collected</p>
                    <p className="text-3xl font-black tracking-tighter">{cycleStats[activeCycle]?.qty.toFixed(2)} L</p>
                  </div>
                </div>
                
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[120px] font-black text-primary pl-8 py-6">CAN</TableHead>
                      <TableHead className="font-black text-primary">Farmer Name</TableHead>
                      <TableHead className="font-black text-primary">Milk Type</TableHead>
                      <TableHead className="text-right pr-8 font-black text-primary text-lg">Total Litres</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-20">
                          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : farmerCycleBreakdown?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-32 text-muted-foreground">
                          <Droplets className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                          <p className="font-bold text-lg">No collection recorded for this cycle.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      farmerCycleBreakdown?.map((f) => (
                        <TableRow key={f.id} className="hover:bg-primary/5 transition-colors border-b last:border-0 group">
                          <TableCell className="font-black text-primary pl-8 text-xl">{f.canNumber}</TableCell>
                          <TableCell className="font-bold text-base">{f.name}</TableCell>
                          <TableCell>
                            <Badge variant={f.milkType === 'BUFFALO' ? "secondary" : "outline"} className="rounded-full font-black text-[10px]">
                              {f.milkType || 'COW'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                            <span className="font-black text-primary text-2xl tracking-tighter">{f.totalQty.toFixed(2)} <small className="text-xs opacity-60">L</small></span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                
                <div className="p-6 bg-muted/20 border-t text-center">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                    Verified SGK MILK Report • {format(new Date(), 'PPPP')}
                  </p>
                </div>
              </Card>
            </TabsContent>

            {/* DAILY SUMMARY */}
            <TabsContent value="daily" className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-end">
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-[200px] rounded-full font-bold border-primary/20 shadow-sm"
                />
              </div>

              <Card className="rounded-[2rem] overflow-hidden border-none shadow-xl bg-card">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow>
                      <TableHead className="w-[100px] font-black text-primary pl-6">CAN</TableHead>
                      <TableHead className="font-black text-primary">Farmer Details</TableHead>
                      <TableHead className="font-black text-primary">Session</TableHead>
                      <TableHead className="font-black text-primary">Weight (Kg)</TableHead>
                      <TableHead className="font-black text-primary text-right pr-6">Qty (Litre)</TableHead>
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
                          <TableRow key={entry.id} className="hover:bg-primary/5 transition-colors">
                            <TableCell className="font-black text-primary pl-6 text-lg">{farmer?.canNumber || "—"}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-base">{farmer?.name || "Unknown"}</span>
                                <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{farmer?.milkType}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="rounded-full font-bold text-[10px] uppercase">
                                {entry.session}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-base">{entry.kgWeight?.toFixed(2)}</TableCell>
                            <TableCell className="text-right pr-6 font-black text-primary text-lg">{entry.quantity?.toFixed(2)} L</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            {/* SALES REPORT */}
            <TabsContent value="sales" className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-end">
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-[200px] rounded-full font-bold border-primary/20 shadow-sm"
                />
              </div>

              <Card className="rounded-[2rem] overflow-hidden border-none shadow-xl bg-card">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow>
                      <TableHead className="w-[100px] font-black text-primary pl-6">Code</TableHead>
                      <TableHead className="font-black text-primary">Buyer Name</TableHead>
                      <TableHead className="font-black text-primary">Session</TableHead>
                      <TableHead className="font-black text-primary text-right pr-6">Qty Sold (Litre)</TableHead>
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
                          <TableRow key={sale.id} className="hover:bg-accent/5 transition-colors">
                            <TableCell className="font-black text-primary pl-6 text-lg">{buyer?.buyerCode || "—"}</TableCell>
                            <TableCell className="font-bold text-base">{buyer?.name || "Unknown"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="rounded-full font-bold text-[10px] uppercase">
                                {sale.session}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-6 font-black text-primary text-lg">{sale.quantity?.toFixed(2)} L</TableCell>
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

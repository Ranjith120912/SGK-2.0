
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
  Download,
  CheckCircle2
} from "lucide-react";
import { format, endOfMonth, startOfMonth } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

  const { data: allEntries, isLoading: entriesLoading } = useCollection(entriesQuery);
  const { data: farmers } = useCollection(farmersQuery);
  const { data: allSales } = useCollection(salesQuery);
  const { data: buyers } = useCollection(buyersQuery);

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

  const invoiceFarmer = farmers?.find(f => f.id === viewingInvoiceFarmerId);
  const invoiceEntries = filteredCycleEntries?.filter(e => e.farmerId === viewingInvoiceFarmerId).sort((a, b) => a.date.localeCompare(b.date));

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

            <Card className="rounded-[2.5rem] border-2 border-primary/10 shadow-none overflow-hidden invoice-content">
              <div className="bg-primary p-10 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Droplets className="w-8 h-8" />
                    <h1 className="text-4xl font-black tracking-tighter uppercase">SGK MILK</h1>
                  </div>
                  <p className="text-primary-foreground/80 font-bold uppercase tracking-[0.2em] text-xs">Payment Cycle Invoice</p>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-black uppercase tracking-tighter mb-1">Period</h2>
                  <p className="text-lg font-bold">{currentCycle?.label} • {currentCycle?.range}</p>
                  <p className="text-sm opacity-80">{format(new Date(selectedMonth + "-01"), "MMMM yyyy")}</p>
                </div>
              </div>

              <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10 border-b">
                <div>
                  <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Farmer Details</h3>
                  <div className="space-y-1">
                    <p className="text-2xl font-black text-primary">{invoiceFarmer.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="rounded-full font-black border-primary/20">CAN: {invoiceFarmer.canNumber}</Badge>
                      <Badge className="rounded-full font-black uppercase">{invoiceFarmer.milkType || 'COW'}</Badge>
                    </div>
                  </div>
                </div>
                <div className="bg-muted/30 p-6 rounded-3xl space-y-3">
                  <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Bank Information</h3>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase">Account Number</p>
                    <p className="font-mono font-bold text-lg">{invoiceFarmer.bankAccountNumber || "Not Provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase">IFSC Code</p>
                    <p className="font-mono font-bold">{invoiceFarmer.ifscCode || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-primary">Date</TableHead>
                      <TableHead className="font-black text-primary">Session</TableHead>
                      <TableHead className="font-black text-primary text-center">Weight (Kg)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-primary">Quantity (Litre)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceEntries?.map((entry) => (
                      <TableRow key={entry.id} className="border-b">
                        <TableCell className="pl-10 font-bold">{format(new Date(entry.date), 'dd MMM, yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-full font-bold uppercase text-[10px] border-primary/10">
                            {entry.session}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-center">{entry.kgWeight?.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10 font-black text-primary">
                          {entry.quantity?.toFixed(2)} L
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="p-10 bg-primary/5 flex flex-col sm:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-white rounded-3xl shadow-sm">
                    <Milk className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Total Cycle Volume</p>
                    <p className="text-5xl font-black text-primary tracking-tighter">
                      {invoiceEntries?.reduce((acc, curr) => acc + (curr.quantity || 0), 0).toFixed(2)} <small className="text-2xl">L</small>
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                   <div className="flex items-center gap-2 mb-2">
                     <CheckCircle2 className="w-5 h-5 text-primary" />
                     <span className="text-sm font-black text-primary uppercase tracking-widest">Verified Report</span>
                   </div>
                   <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-relaxed">
                     Generated on {format(new Date(), 'PPPP')}<br />
                     SGK MILK Management System
                   </p>
                </div>
              </div>
            </Card>
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
              <h1 className="text-3xl font-black text-primary tracking-tight">SGK MILK Reports</h1>
              <p className="text-muted-foreground font-medium">Daily collection logs and 10-day supplier invoices.</p>
            </div>
          </header>

          <Tabs defaultValue="cycle" className="space-y-8">
            <TabsList className="grid grid-cols-3 w-full sm:w-[600px] rounded-full p-1 bg-muted border border-primary/5">
              <TabsTrigger value="cycle" className="rounded-full font-bold gap-2">
                <FileText className="w-4 h-4" /> Cycle Bill
              </TabsTrigger>
              <TabsTrigger value="daily" className="rounded-full font-bold gap-2">
                <ClipboardList className="w-4 h-4" /> Daily Logs
              </TabsTrigger>
              <TabsTrigger value="sales" className="rounded-full font-bold gap-2">
                <ShoppingCart className="w-4 h-4" /> Sales Report
              </TabsTrigger>
            </TabsList>

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
                  Cycle Bills strictly show total Litres collected
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
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Litres Collected</p>
                      <p className="text-3xl font-black tracking-tighter">{cycleStats[activeCycle]?.qty.toFixed(2)} L</p>
                    </div>
                  </div>
                </div>
                
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[120px] font-black text-primary pl-8 py-6">CAN</TableHead>
                      <TableHead className="font-black text-primary">Farmer Name</TableHead>
                      <TableHead className="font-black text-primary">Milk Type</TableHead>
                      <TableHead className="text-right font-black text-primary">Total Litres</TableHead>
                      <TableHead className="text-right pr-8 font-black text-primary">Invoice</TableHead>
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
                          <TableCell className="font-black text-primary pl-8 text-xl">{f.canNumber}</TableCell>
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
                              className="rounded-full font-bold shadow-sm"
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
                    Verified SGK MILK Report &bull; {isClient ? format(new Date(), 'PPPP') : '...'}
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
                      <TableHead className="w-[100px] font-black text-primary pl-8 py-5">CAN</TableHead>
                      <TableHead className="font-black text-primary">Farmer Name</TableHead>
                      <TableHead className="font-black text-primary">Session</TableHead>
                      <TableHead className="font-black text-primary">Weight (Kg)</TableHead>
                      <TableHead className="font-black text-primary text-right pr-8">Qty (Litre)</TableHead>
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
                            <TableCell className="font-black text-primary pl-8 text-lg">{farmer?.canNumber || "—"}</TableCell>
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
                      <TableHead className="w-[100px] font-black text-primary pl-8 py-5">Code</TableHead>
                      <TableHead className="font-black text-primary">Buyer Name</TableHead>
                      <TableHead className="font-black text-primary">Session</TableHead>
                      <TableHead className="font-black text-primary text-right pr-8">Qty Sold (Litre)</TableHead>
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
                            <TableCell className="font-black text-primary pl-8 text-lg">{buyer?.buyerCode || "—"}</TableCell>
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

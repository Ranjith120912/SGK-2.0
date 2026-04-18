
"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where, serverTimestamp, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { format, endOfMonth, subMonths } from "date-fns";
import { Search, ShoppingCart, IndianRupee, Loader2, CheckCircle2, Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function CycleSalesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [quantityValues, setQuantityValues] = useState<Record<string, string>>({});
  const [amountValues, setAmountValues] = useState<Record<string, string>>({});
  const [milkTypes, setMilkTypes] = useState<Record<string, 'COW' | 'BUFFALO'>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  const [isClient, setIsClient] = useState(false);

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

  const buyersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'buyers');
  }, [firestore]);

  const salesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedMonth) return null;
    return query(
      collection(firestore, 'sales'), 
      where('month', '==', selectedMonth),
      where('cycleId', '==', activeCycle)
    );
  }, [firestore, selectedMonth, activeCycle]);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: buyers } = useCollection(buyersQuery);
  const { data: sales } = useCollection(salesQuery);
  const { data: ratesConfig } = useDoc(settingsRef);

  const filteredBuyers = buyers?.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.buyerCode.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.buyerCode.localeCompare(b.buyerCode)) || [];

  const handleQuantityChange = (buyerId: string, value: string) => {
    setQuantityValues(prev => ({ ...prev, [buyerId]: value }));
    setSavingStatus(prev => ({ ...prev, [buyerId]: 'idle' }));
  };

  const handleAmountChange = (buyerId: string, value: string) => {
    setAmountValues(prev => ({ ...prev, [buyerId]: value }));
    setSavingStatus(prev => ({ ...prev, [buyerId]: 'idle' }));
  };

  const handleMilkTypeChange = (buyerId: string, type: 'COW' | 'BUFFALO') => {
    setMilkTypes(prev => ({ ...prev, [buyerId]: type }));
    setSavingStatus(prev => ({ ...prev, [buyerId]: 'idle' }));
  };

  const handleAutoSave = (buyerId: string) => {
    const qtyStr = quantityValues[buyerId];
    const milkType = milkTypes[buyerId] || 'COW';
    if (!firestore || !selectedMonth) return;

    const existingSale = sales?.find(s => s.buyerId === buyerId && s.milkType === milkType);
    const qty = qtyStr !== undefined && qtyStr !== "" ? parseFloat(qtyStr) : (existingSale ? existingSale.quantity : 0);
    
    const manualAmountStr = amountValues[buyerId];
    const finalAmount = manualAmountStr !== undefined && manualAmountStr !== "" 
      ? parseFloat(manualAmountStr) 
      : (existingSale ? existingSale.totalAmount : 0);

    if (isNaN(qty) || isNaN(finalAmount) || qty < 0 || finalAmount < 0) return;

    // Calculate effective rate for reporting metadata
    const effectiveRate = qty > 0 ? parseFloat((finalAmount / qty).toFixed(2)) : 0;

    setSavingStatus(prev => ({ ...prev, [buyerId]: 'saving' }));

    const saleId = `${buyerId}_${selectedMonth}_C${activeCycle}_${milkType}`;
    const docRef = doc(firestore, 'sales', saleId);

    setDocumentNonBlocking(docRef, {
      buyerId,
      month: selectedMonth,
      cycleId: activeCycle,
      cycleLabel: cycles[activeCycle]?.label,
      date: `${selectedMonth}-${cycles[activeCycle]?.start.toString().padStart(2, '0')}`,
      milkType,
      quantity: qty,
      totalAmount: finalAmount,
      rate: effectiveRate,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });

    setTimeout(() => {
      setSavingStatus(prev => ({ ...prev, [buyerId]: 'saved' }));
    }, 500);
  };

  const totalCycleRevenue = useMemo(() => {
    if (!sales) return 0;
    return sales.reduce((acc, s) => acc + (Number(s.totalAmount) || 0), 0);
  }, [sales]);

  if (!isClient) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1">
                <ShoppingCart className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-widest">Business Distribution</span>
              </div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Cycle Sales</h1>
              <p className="text-muted-foreground font-medium">Record bulk sales amounts for 10-day distribution periods.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full sm:w-[200px] rounded-full font-bold h-11 border-primary/20 shadow-sm bg-card">
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
                    onClick={() => {
                      setActiveCycle(i);
                      setQuantityValues({});
                      setAmountValues({});
                      setSavingStatus({});
                    }} 
                    className={cn(
                      "rounded-full text-[10px] font-black px-4 h-9 transition-all", 
                      activeCycle === i ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                className="pl-12 h-14 bg-card rounded-2xl border-primary/10 shadow-sm focus:ring-primary/20 text-lg" 
                placeholder="Search by name or code..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <Card className="flex items-center gap-4 px-6 py-2 bg-accent/5 rounded-2xl border border-accent/10 shadow-sm">
              <div className="p-2 bg-accent/10 rounded-xl">
                <CalendarIcon className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-[10px] font-black text-accent/60 uppercase tracking-widest">Current Range</p>
                <p className="text-sm font-black uppercase">{cycles[activeCycle]?.range}</p>
              </div>
            </Card>
          </div>

          <Card className="rounded-[2rem] overflow-hidden border-none shadow-xl bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[100px] font-black text-primary pl-10 py-5 uppercase text-[10px] tracking-widest">Code</TableHead>
                  <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Buyer Name</TableHead>
                  <TableHead className="w-[140px] font-black text-primary uppercase text-[10px] tracking-widest">Milk Type</TableHead>
                  <TableHead className="w-[200px] font-black text-primary uppercase text-[10px] tracking-widest">Total Qty (L)</TableHead>
                  <TableHead className="w-[240px] font-black text-primary uppercase text-[10px] tracking-widest">Sales Amount (₹)</TableHead>
                  <TableHead className="w-[100px] text-right pr-10 font-black text-primary uppercase text-[10px] tracking-widest">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBuyers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-semibold">
                      No buyers found in directory.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBuyers.map((buyer) => {
                    const currentMilkType = milkTypes[buyer.id] || 'COW';
                    const existingSale = sales?.find(s => s.buyerId === buyer.id && s.milkType === currentMilkType);
                    
                    const currentQtyStr = quantityValues[buyer.id] !== undefined ? quantityValues[buyer.id] : (existingSale ? existingSale.quantity.toString() : "");
                    const currentAmountStr = amountValues[buyer.id] !== undefined ? amountValues[buyer.id] : (existingSale ? existingSale.totalAmount.toString() : "");
                    
                    const status = savingStatus[buyer.id] || (existingSale ? 'saved' : 'idle');

                    return (
                      <TableRow key={buyer.id} className={cn("group transition-colors border-b last:border-0", existingSale ? "bg-primary/5" : "hover:bg-primary/5")}>
                        <TableCell className="font-black text-primary pl-10 text-lg uppercase">{buyer.buyerCode}</TableCell>
                        <TableCell className="font-bold text-base uppercase">{buyer.name}</TableCell>
                        <TableCell>
                          <Select value={currentMilkType} onValueChange={(v) => handleMilkTypeChange(buyer.id, v as any)}>
                            <SelectTrigger className="h-10 rounded-xl border-primary/10 bg-background/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="COW">COW</SelectItem>
                              <SelectItem value="BUFFALO">BUFFALO</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <Input 
                              type="number" 
                              placeholder="0.00" 
                              className="h-12 rounded-xl pr-12 font-black text-lg border-primary/10 focus:border-primary" 
                              value={currentQtyStr} 
                              onChange={(e) => handleQuantityChange(buyer.id, e.target.value)}
                              onBlur={() => handleAutoSave(buyer.id)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAutoSave(buyer.id)}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary/40 uppercase">LTR</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <Input 
                              type="number" 
                              placeholder="0.00"
                              className="h-12 rounded-xl pl-10 font-black text-lg border-primary/20 focus:border-primary bg-primary/5" 
                              value={currentAmountStr} 
                              onChange={(e) => handleAmountChange(buyer.id, e.target.value)}
                              onBlur={() => handleAutoSave(buyer.id)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAutoSave(buyer.id)}
                            />
                            <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-10">
                          <div className="flex justify-end">
                            {status === 'saving' && <Loader2 className="animate-spin text-primary/40 w-6 h-6" />}
                            {status === 'saved' && <CheckCircle2 className="text-green-500 w-6 h-6 animate-in zoom-in duration-300" />}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <div className="p-5 bg-muted/20 text-center text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] border-t">
              Cycle Grand Total Distribution Revenue: ₹ {totalCycleRevenue.toFixed(2)}
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

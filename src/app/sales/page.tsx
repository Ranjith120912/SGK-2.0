
"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where, serverTimestamp, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { Sun, Moon, Search, ShoppingCart, IndianRupee, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function SalesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [date, setDate] = useState<string>("");
  const [session, setSession] = useState<'Morning' | 'Evening'>('Morning');
  const [searchTerm, setSearchTerm] = useState("");
  const [quantityValues, setQuantityValues] = useState<Record<string, string>>({});
  const [rateValues, setRateValues] = useState<Record<string, string>>({});
  const [milkTypes, setMilkTypes] = useState<Record<string, 'COW' | 'BUFFALO'>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});

  useEffect(() => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  const buyersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'buyers');
  }, [firestore]);

  const salesQuery = useMemoFirebase(() => {
    if (!firestore || !date) return null;
    return query(
      collection(firestore, 'sales'), 
      where('date', '==', date),
      where('session', '==', session)
    );
  }, [firestore, date, session]);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: buyers } = useCollection(buyersQuery);
  const { data: sales } = useCollection(salesQuery);
  const { data: ratesConfig } = useDoc(settingsRef);

  const filteredBuyers = buyers?.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.buyerCode.includes(searchTerm)
  );

  const handleQuantityChange = (buyerId: string, value: string) => {
    setQuantityValues(prev => ({ ...prev, [buyerId]: value }));
    setSavingStatus(prev => ({ ...prev, [buyerId]: 'idle' }));
  };

  const handleRateChange = (buyerId: string, value: string) => {
    setRateValues(prev => ({ ...prev, [buyerId]: value }));
    setSavingStatus(prev => ({ ...prev, [buyerId]: 'idle' }));
  };

  const handleMilkTypeChange = (buyerId: string, type: 'COW' | 'BUFFALO') => {
    setMilkTypes(prev => ({ ...prev, [buyerId]: type }));
    setSavingStatus(prev => ({ ...prev, [buyerId]: 'idle' }));
  };

  const handleAutoSave = (buyerId: string) => {
    const qtyStr = quantityValues[buyerId];
    const milkType = milkTypes[buyerId] || 'COW';
    if (!firestore) return;

    const existingSale = sales?.find(s => s.buyerId === buyerId && s.milkType === milkType);
    
    const qty = qtyStr !== undefined ? parseFloat(qtyStr) : (existingSale ? existingSale.quantity : 0);
    
    const manualRate = rateValues[buyerId];
    const defaultRate = milkType === 'BUFFALO' 
      ? (ratesConfig?.buffaloSellingRate || 0) 
      : (ratesConfig?.cowSellingRate || 0);
    const finalRate = manualRate !== undefined && manualRate !== "" ? parseFloat(manualRate) : (existingSale ? existingSale.rate : defaultRate);

    if (isNaN(qty) || qty < 0 || isNaN(finalRate)) return;

    setSavingStatus(prev => ({ ...prev, [buyerId]: 'saving' }));
    const totalAmount = qty * finalRate;

    const saleId = `${buyerId}_${date}_${session}_${milkType}`;
    const docRef = doc(firestore, 'sales', saleId);

    setDocumentNonBlocking(docRef, {
      buyerId,
      date,
      session,
      milkType,
      quantity: qty,
      rate: finalRate,
      totalAmount: totalAmount,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });

    setTimeout(() => {
      setSavingStatus(prev => ({ ...prev, [buyerId]: 'saved' }));
    }, 500);
  };

  if (!date) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight">Daily Sales</h1>
              <p className="text-muted-foreground">Record distribution for {format(new Date(date), 'MMMM dd, yyyy')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full sm:w-[200px] rounded-full" />
              <Tabs value={session} onValueChange={(v) => setSession(v as any)}>
                <TabsList className="rounded-full">
                  <TabsTrigger value="Morning" className="rounded-full gap-2"><Sun className="w-4 h-4" /> Morning</TabsTrigger>
                  <TabsTrigger value="Evening" className="rounded-full gap-2"><Moon className="w-4 h-4" /> Evening</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-10 h-12 bg-card rounded-2xl" placeholder="Search buyer code or name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 rounded-2xl border border-primary/10">
              <IndianRupee className="w-5 h-5 text-primary" />
              <div>
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Default Sell Rates</p>
                <p className="text-xs font-black">Cow: ₹{ratesConfig?.cowSellingRate || 0} | Buf: ₹{ratesConfig?.buffaloSellingRate || 0}</p>
              </div>
            </div>
          </div>

          <Card className="rounded-3xl overflow-hidden border-none shadow-xl bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[80px] font-bold pl-6">Code</TableHead>
                  <TableHead className="font-bold">Buyer Name</TableHead>
                  <TableHead className="w-[120px] font-bold">Milk Type</TableHead>
                  <TableHead className="w-[150px] font-bold">Quantity (L)</TableHead>
                  <TableHead className="w-[120px] font-bold">Rate (₹/L)</TableHead>
                  <TableHead className="w-[120px] font-bold text-right">Amount (₹)</TableHead>
                  <TableHead className="w-[80px] text-right pr-6 font-bold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBuyers?.map((buyer) => {
                  const currentMilkType = milkTypes[buyer.id] || 'COW';
                  const existingSale = sales?.find(s => s.buyerId === buyer.id && s.milkType === currentMilkType);
                  
                  const currentQtyStr = quantityValues[buyer.id] !== undefined ? quantityValues[buyer.id] : (existingSale ? existingSale.quantity.toString() : "");
                  
                  const defaultRate = currentMilkType === 'BUFFALO' 
                    ? (ratesConfig?.buffaloSellingRate || 0) 
                    : (ratesConfig?.cowSellingRate || 0);
                    
                  const currentRateStr = rateValues[buyer.id] !== undefined
                    ? rateValues[buyer.id]
                    : (existingSale ? existingSale.rate.toString() : defaultRate.toString());
                  
                  const activeRateNum = parseFloat(currentRateStr) || 0;
                  const previewAmount = (parseFloat(currentQtyStr) || 0) * activeRateNum;
                  
                  const status = savingStatus[buyer.id] || (existingSale ? 'saved' : 'idle');

                  return (
                    <TableRow key={buyer.id} className={cn(existingSale && "bg-primary/5")}>
                      <TableCell className="font-black text-primary pl-6 text-lg">{buyer.buyerCode}</TableCell>
                      <TableCell className="font-bold">{buyer.name}</TableCell>
                      <TableCell>
                        <Select value={currentMilkType} onValueChange={(v) => handleMilkTypeChange(buyer.id, v as any)}>
                          <SelectTrigger className="h-9 rounded-xl">
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
                            className="h-11 rounded-xl pr-10 font-bold" 
                            value={currentQtyStr} 
                            onChange={(e) => handleQuantityChange(buyer.id, e.target.value)}
                            onBlur={() => handleAutoSave(buyer.id)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAutoSave(buyer.id)}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-30">L</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          placeholder={defaultRate.toString()}
                          className="h-11 rounded-xl font-medium text-sm" 
                          value={currentRateStr} 
                          onChange={(e) => handleRateChange(buyer.id, e.target.value)}
                          onBlur={() => handleAutoSave(buyer.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAutoSave(buyer.id)}
                        />
                      </TableCell>
                      <TableCell className="text-right font-black">₹ {previewAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end">
                          {status === 'saving' && <Loader2 className="animate-spin text-primary/40 w-5 h-5" />}
                          {status === 'saved' && <CheckCircle2 className="text-green-500 w-5 h-5" />}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

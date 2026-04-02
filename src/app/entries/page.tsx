
"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where, serverTimestamp, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { Sun, Moon, Search, Scale, Droplets, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CONVERSION_RATE = 0.96; // 1 Kg = 0.96 Litres

export default function EntriesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [date, setDate] = useState<string>("");
  const [session, setSession] = useState<'Morning' | 'Evening'>('Morning');
  const [searchTerm, setSearchTerm] = useState("");
  const [kgValues, setKgValues] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});

  useEffect(() => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  const farmersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'farmers');
  }, [firestore]);

  const entriesQuery = useMemoFirebase(() => {
    if (!firestore || !date) return null;
    return query(
      collection(firestore, 'entries'), 
      where('date', '==', date),
      where('session', '==', session)
    );
  }, [firestore, date, session]);

  const { data: farmers } = useCollection(farmersQuery);
  const { data: entries } = useCollection(entriesQuery);

  const filteredFarmers = farmers?.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.canNumber.includes(searchTerm)
  ).sort((a, b) => {
    const aNum = parseInt(a.canNumber);
    const bNum = parseInt(b.canNumber);
    if (isNaN(aNum) || isNaN(bNum)) return a.canNumber.localeCompare(b.canNumber);
    return aNum - bNum;
  });

  const handleKgChange = (farmerId: string, value: string) => {
    setKgValues(prev => ({ ...prev, [farmerId]: value }));
    setSavingStatus(prev => ({ ...prev, [farmerId]: 'idle' }));
  };

  const handleAutoSave = (farmerId: string) => {
    const value = kgValues[farmerId];
    if (value === undefined || value === "") return;

    const kgValue = parseFloat(value);
    if (isNaN(kgValue) || kgValue < 0) return;

    if (!firestore) return;

    setSavingStatus(prev => ({ ...prev, [farmerId]: 'saving' }));

    const quantityLitre = kgValue * CONVERSION_RATE;
    const entryId = `${farmerId}_${date}_${session}`;
    const docRef = doc(firestore, 'entries', entryId);

    setDocumentNonBlocking(docRef, {
      farmerId,
      date,
      session,
      kgWeight: kgValue,
      quantity: quantityLitre,
      conversionRate: CONVERSION_RATE,
      fat: 0,
      snf: 0,
      rate: 0,
      totalAmount: 0,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(), // Merger handles if it already exists
    }, { merge: true });

    setTimeout(() => {
      setSavingStatus(prev => ({ ...prev, [farmerId]: 'saved' }));
    }, 500);
  };

  if (!date) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-grow pt-24 pb-20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight">Daily Collection (Kg → L)</h1>
              <p className="text-muted-foreground">Auto-saving entries for {format(new Date(date), 'MMMM dd, yyyy')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-card p-1 rounded-full border shadow-sm">
                <Input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  className="border-none focus-visible:ring-0 bg-transparent h-9"
                />
              </div>
              <Tabs value={session} onValueChange={(v) => setSession(v as any)} className="w-full sm:w-auto">
                <TabsList className="grid grid-cols-2 w-full sm:w-[240px] rounded-full">
                  <TabsTrigger value="Morning" className="rounded-full gap-2">
                    <Sun className="w-4 h-4" /> Morning
                  </TabsTrigger>
                  <TabsTrigger value="Evening" className="rounded-full gap-2">
                    <Moon className="w-4 h-4" /> Evening
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                className="pl-10 h-12 bg-card rounded-2xl border-primary/10 shadow-sm" 
                placeholder="Search CAN or Farmer Name..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 rounded-2xl border border-primary/10">
              <Scale className="w-5 h-5 text-primary" />
              <div className="text-xs">
                <p className="font-bold text-primary">Conversion Applied Automatically</p>
                <p className="text-muted-foreground">1 Kg = {CONVERSION_RATE} Litres</p>
              </div>
            </div>
          </div>

          <Card className="rounded-3xl overflow-hidden border-none shadow-lg bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[80px] font-bold py-4 pl-6">CAN</TableHead>
                  <TableHead className="font-bold">Farmer Name</TableHead>
                  <TableHead className="w-[180px] font-bold">Result (Litres)</TableHead>
                  <TableHead className="w-[220px] font-bold">Entry (Kg)</TableHead>
                  <TableHead className="w-[100px] text-right pr-6 font-bold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFarmers?.map((farmer) => {
                  const existingEntry = entries?.find(e => e.farmerId === farmer.id);
                  const currentKgStr = kgValues[farmer.id] !== undefined 
                    ? kgValues[farmer.id] 
                    : (existingEntry ? existingEntry.kgWeight.toString() : "");
                  
                  const kgNum = parseFloat(currentKgStr);
                  const previewLitre = !isNaN(kgNum) ? (kgNum * CONVERSION_RATE).toFixed(2) : "0.00";
                  const status = savingStatus[farmer.id] || (existingEntry ? 'saved' : 'idle');

                  return (
                    <TableRow key={farmer.id} className={cn(existingEntry && "bg-primary/5")}>
                      <TableCell className="font-black text-primary pl-6 text-lg">{farmer.canNumber}</TableCell>
                      <TableCell className="font-semibold">{farmer.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Calculated</span>
                          <span className={cn(
                            "text-sm font-bold px-3 py-1 rounded-full flex items-center gap-1 w-fit transition-colors",
                            existingEntry ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted"
                          )}>
                            <Droplets className="w-3 h-3" /> {previewLitre} L
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="relative group">
                          <Input 
                            type="number" 
                            placeholder="0.00"
                            step="0.01"
                            className="h-11 rounded-xl pr-12 font-bold text-lg border-primary/10 focus:border-primary transition-all"
                            value={currentKgStr}
                            onChange={(e) => handleKgChange(farmer.id, e.target.value)}
                            onBlur={() => handleAutoSave(farmer.id)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAutoSave(farmer.id)}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground uppercase tracking-tighter">KG</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end">
                          {status === 'saving' && <Loader2 className="w-5 h-5 animate-spin text-primary/40" />}
                          {status === 'saved' && <CheckCircle2 className="w-5 h-5 text-green-500 animate-in zoom-in duration-300" />}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="p-4 bg-muted/20 text-center text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] border-t">
              Tip: Values save automatically when you move to the next field
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

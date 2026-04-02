"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where, serverTimestamp } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { Save, Sun, Moon, Search, Scale, Droplets } from "lucide-react";
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

  useEffect(() => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  const customersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'customers');
  }, [firestore]);

  const entriesQuery = useMemoFirebase(() => {
    if (!firestore || !date) return null;
    return query(
      collection(firestore, 'entries'), 
      where('date', '==', date),
      where('session', '==', session)
    );
  }, [firestore, date, session]);

  const { data: customers } = useCollection(customersQuery);
  const { data: entries } = useCollection(entriesQuery);

  const filteredCustomers = customers?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.canNumber.includes(searchTerm)
  ).sort((a, b) => parseInt(a.canNumber) - parseInt(b.canNumber));

  const handleKgChange = (customerId: string, value: string) => {
    setKgValues(prev => ({ ...prev, [customerId]: value }));
  };

  const handleSave = (customerId: string) => {
    const kgValue = parseFloat(kgValues[customerId]);
    if (isNaN(kgValue) || kgValue <= 0) {
      toast({ title: "Error", description: "Please enter a valid weight in Kg.", variant: "destructive" });
      return;
    }

    if (!firestore) return;

    // Convert Kg to Litres based on the provided factor
    const quantityLitre = kgValue * CONVERSION_RATE;

    addDocumentNonBlocking(collection(firestore, 'entries'), {
      customerId,
      date,
      session,
      kgWeight: kgValue,
      quantity: quantityLitre, // Stored in Litres as per schema
      conversionRate: CONVERSION_RATE,
      fat: 0,
      snf: 0,
      rate: 0,
      totalAmount: 0,
      createdAt: serverTimestamp(),
    });

    toast({ 
      title: "Saved", 
      description: `${kgValue} Kg converted to ${quantityLitre.toFixed(2)} L saved.` 
    });
  };

  if (!date) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-grow pt-24 pb-20 flex items-center justify-center">
          <p className="text-muted-foreground">Initializing...</p>
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
              <h1 className="text-3xl font-black text-primary tracking-tight">Daily Entry (Kg → L)</h1>
              <p className="text-muted-foreground">Recording weight for {format(new Date(date), 'MMMM dd, yyyy')}</p>
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
                placeholder="Quick search CAN or Name..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 rounded-2xl border border-primary/10">
              <Scale className="w-5 h-5 text-primary" />
              <div className="text-xs">
                <p className="font-bold text-primary">Conversion Rate Applied</p>
                <p className="text-muted-foreground">1 Kg = {CONVERSION_RATE} Litres</p>
              </div>
            </div>
          </div>

          <Card className="rounded-3xl overflow-hidden border-none shadow-lg">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[80px]">CAN</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="w-[180px]">Status (Litre Result)</TableHead>
                  <TableHead className="w-[200px]">Weight (Kg)</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers?.map((customer) => {
                  const existingEntry = entries?.find(e => e.customerId === customer.id);
                  const currentKg = kgValues[customer.id] || "";
                  const previewLitre = currentKg ? (parseFloat(currentKg) * CONVERSION_RATE).toFixed(2) : "0.00";

                  return (
                    <TableRow key={customer.id} className={cn(existingEntry && "bg-green-50/30")}>
                      <TableCell className="font-black text-primary">{customer.canNumber}</TableCell>
                      <TableCell className="font-semibold">{customer.name}</TableCell>
                      <TableCell>
                        {existingEntry ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Stored Result</span>
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full flex items-center gap-1 w-fit">
                              <Droplets className="w-3 h-3" /> {existingEntry.quantity.toFixed(2)} L
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Estimated L</span>
                            <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full w-fit">
                              {previewLitre} L
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <Input 
                            type="number" 
                            placeholder="0.0"
                            step="0.01"
                            className="h-10 rounded-lg pr-10 font-medium"
                            value={kgValues[customer.id] || (existingEntry ? (existingEntry.kgWeight || (existingEntry.quantity / CONVERSION_RATE)).toFixed(2) : "")}
                            onChange={(e) => handleKgChange(customer.id, e.target.value)}
                            disabled={!!existingEntry}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">KG</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {!existingEntry && (
                          <Button 
                            size="sm" 
                            className="rounded-full px-6 shadow-sm"
                            onClick={() => handleSave(customer.id)}
                          >
                            <Save className="w-3 h-3 mr-2" /> Save
                          </Button>
                        )}
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
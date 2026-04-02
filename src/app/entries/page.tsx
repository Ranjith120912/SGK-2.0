"use client";

import { useState, useMemo, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where, serverTimestamp } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Save, Sun, Moon, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function EntriesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [date, setDate] = useState<string>("");
  const [session, setSession] = useState<'Morning' | 'Evening'>('Morning');
  const [searchTerm, setSearchTerm] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});

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

  const handleQuantityChange = (customerId: string, value: string) => {
    setQuantities(prev => ({ ...prev, [customerId]: value }));
  };

  const handleSave = (customerId: string) => {
    const quantity = parseFloat(quantities[customerId]);
    if (isNaN(quantity) || quantity <= 0) {
      toast({ title: "Error", description: "Please enter a valid quantity.", variant: "destructive" });
      return;
    }

    if (!firestore) return;

    addDocumentNonBlocking(collection(firestore, 'entries'), {
      customerId,
      date,
      session,
      quantity,
      fat: 0,
      snf: 0,
      rate: 0,
      totalAmount: 0,
      createdAt: serverTimestamp(),
    });

    toast({ title: "Saved", description: "Entry recorded successfully." });
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
              <h1 className="text-3xl font-black text-primary tracking-tight">Daily Milk Entry</h1>
              <p className="text-muted-foreground">Record collection for {format(new Date(date), 'MMMM dd, yyyy')}</p>
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

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              className="pl-10 h-12 bg-card rounded-2xl border-primary/10 shadow-sm" 
              placeholder="Quick search CAN or Name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Card className="rounded-3xl overflow-hidden border-none shadow-lg">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[80px]">CAN</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="w-[200px]">Quantity (L)</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers?.map((customer) => {
                  const existingEntry = entries?.find(e => e.customerId === customer.id);
                  return (
                    <TableRow key={customer.id} className={cn(existingEntry && "bg-green-50/30")}>
                      <TableCell className="font-black text-primary">{customer.canNumber}</TableCell>
                      <TableCell className="font-semibold">{customer.name}</TableCell>
                      <TableCell>
                        {existingEntry ? (
                          <span className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full">Collected: {existingEntry.quantity}L</span>
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full">Pending</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          placeholder="0.0"
                          step="0.1"
                          className="h-9 rounded-lg"
                          value={quantities[customer.id] || ""}
                          onChange={(e) => handleQuantityChange(customer.id, e.target.value)}
                          disabled={!!existingEntry}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {!existingEntry && (
                          <Button 
                            size="sm" 
                            className="rounded-full"
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

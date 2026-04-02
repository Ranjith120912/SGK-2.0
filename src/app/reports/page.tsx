
"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, FileText, Droplets, ChevronRight, Loader2 } from "lucide-react";
import { format, endOfMonth } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function ReportsPage() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedMonth(format(now, 'yyyy-MM'));
  }, []);

  // Generate Year-Month options for the last 12 months
  const monthOptions = useMemo(() => {
    if (!currentDate) return [];
    return Array.from({ length: 12 }).map((_, i) => {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() - i);
      return {
        value: format(d, 'yyyy-MM'),
        label: format(d, 'MMMM yyyy')
      };
    });
  }, [currentDate]);

  // Calculate cycles for selected month
  const cycles = useMemo(() => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthEnd = endOfMonth(new Date(year, month - 1));
    const lastDay = monthEnd.getDate();

    return [
      { id: 0, label: "Cycle 1", range: "1st - 10th", start: 1, end: 10 },
      { id: 1, label: "Cycle 2", range: "11th - 20th", start: 11, end: 20 },
      { id: 2, label: "Cycle 3", range: `21st - ${lastDay}${lastDay === 31 ? ' (11 days)' : 'st'}`, start: 21, end: lastDay }
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

  const { data: allEntries, isLoading: entriesLoading } = useCollection(entriesQuery);
  const { data: farmers } = useCollection(farmersQuery);

  // Filter entries based on selected month and cycle
  const currentCycle = cycles[activeCycle];
  const filteredEntries = allEntries?.filter(entry => {
    if (!selectedMonth || !entry.date.startsWith(selectedMonth)) return false;
    if (!currentCycle) return false;
    const day = parseInt(entry.date.split('-')[2]);
    return day >= currentCycle.start && day <= currentCycle.end;
  });

  // Calculate stats for all cycles in the month
  const cycleStats = cycles.map(c => {
    const cEntries = allEntries?.filter(entry => {
      if (!selectedMonth || !entry.date.startsWith(selectedMonth)) return false;
      const day = parseInt(entry.date.split('-')[2]);
      return day >= c.start && day <= c.end;
    }) || [];
    
    return {
      qty: cEntries.reduce((acc, curr) => acc + (curr.quantity || 0), 0)
    };
  });

  // Detailed farmer breakdown for the active cycle
  const farmerBreakdown = farmers?.map(farmer => {
    const fEntries = filteredEntries?.filter(e => e.farmerId === farmer.id) || [];
    return {
      ...farmer,
      totalQty: fEntries.reduce((acc, curr) => acc + (curr.quantity || 0), 0)
    };
  }).filter(f => f.totalQty > 0).sort((a, b) => {
    const aNum = parseInt(a.canNumber);
    const bNum = parseInt(b.canNumber);
    return (isNaN(aNum) || isNaN(bNum)) ? a.canNumber.localeCompare(b.canNumber) : aNum - bNum;
  });

  if (!currentDate || !selectedMonth) {
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
              <h1 className="text-3xl font-black text-primary tracking-tight">Payment Cycle Bill</h1>
              <p className="text-muted-foreground">Quantity summary for 10-day cycles.</p>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px] rounded-full font-bold">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </header>

          {/* Cycle Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {cycles.map((cycle, idx) => (
              <Card 
                key={cycle.id}
                onClick={() => setActiveCycle(idx)}
                className={`relative overflow-hidden rounded-3xl cursor-pointer transition-all duration-300 border-2 ${
                  activeCycle === idx 
                  ? "border-primary bg-primary/5 shadow-xl scale-[1.02]" 
                  : "border-transparent bg-card hover:bg-muted/50"
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <Badge variant={activeCycle === idx ? "default" : "outline"} className="rounded-full">
                      {cycle.label}
                    </Badge>
                    {activeCycle === idx && <ChevronRight className="w-5 h-5 text-primary animate-pulse" />}
                  </div>
                  <CardTitle className="text-xl font-black mt-2">{cycle.range}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Total Litres:</span>
                    <span className="font-bold text-primary text-lg">{cycleStats[idx]?.qty.toFixed(1) || "0.0"} L</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detailed Table */}
          <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card/50 backdrop-blur-sm">
            <div className="p-8 border-b bg-muted/30 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-primary">Cycle Breakdown (Litres Only)</h3>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  {currentCycle?.label}: {currentCycle?.range}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-muted-foreground uppercase">Grand Total Qty</p>
                <p className="text-2xl font-black text-primary">{cycleStats[activeCycle]?.qty.toFixed(2) || "0.00"} L</p>
              </div>
            </div>
            
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[120px] font-black text-primary pl-8 py-5">CAN</TableHead>
                  <TableHead className="font-black text-primary">Farmer Name</TableHead>
                  <TableHead className="font-black text-primary">Milk Type</TableHead>
                  <TableHead className="text-right pr-8 font-black text-primary text-lg">Total Qty (Litre)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                      <p className="text-sm font-bold text-muted-foreground mt-4">Generating Bill...</p>
                    </TableCell>
                  </TableRow>
                ) : farmerBreakdown?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-24">
                      <FileText className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                      <p className="text-muted-foreground font-bold italic">No collection recorded for this cycle.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  farmerBreakdown?.map((f) => (
                    <TableRow key={f.id} className="hover:bg-primary/5 transition-colors border-b last:border-0 group">
                      <TableCell className="font-black text-primary pl-8 text-xl">{f.canNumber}</TableCell>
                      <TableCell>
                        <span className="font-bold text-base">{f.name}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.milkType === 'BUFFALO' ? "secondary" : "outline"} className="rounded-full font-bold">
                          {f.milkType || 'COW'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <span className="font-black text-primary text-xl">{f.totalQty.toFixed(2)} L</span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            <div className="p-6 bg-muted/20 border-t text-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                Verified SGK MILK Quantity Report &bull; {currentDate ? format(currentDate, 'PPPP') : '...'}
              </p>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

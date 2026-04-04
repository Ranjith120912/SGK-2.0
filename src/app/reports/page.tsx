
"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Loader2, 
  BarChart4,
  Download,
  IndianRupee,
  ChevronRight,
  FileDown,
  Milk,
  CalendarDays,
  PieChart,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { format, endOfMonth, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function ReportsPage() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setSelectedMonth(format(new Date(), 'yyyy-MM'));
  }, []);

  // Standard locked conversion
  const STANDARD_CONVERSION = 0.96;

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

  const { data: allEntries } = useCollection(entriesQuery);
  const { data: farmers } = useCollection(farmersQuery);
  const { data: allSales } = useCollection(salesQuery);
  const { data: ratesConfig } = useDoc(settingsRef);

  const currentCycle = cycles[activeCycle];

  /**
   * UNIFIED FINANCIAL RESOLUTION ENGINE (REPORTS VERSION)
   * This is the single source of truth for ALL report math.
   */
  const resolveEntryData = (entry: any, farmersList: any[], config: any) => {
    // Volume: Standard 0.96 conversion from KgWeight
    const kg = Number(entry.kgWeight) || 0;
    const qtyLitre = Number(entry.quantity) || parseFloat((kg * STANDARD_CONVERSION).toFixed(2));
    
    // Rate: Buffalo Custom > Global Config
    const farmer = farmersList?.find(f => f.id === entry.farmerId);
    let resolvedRate = Number(entry.rate) || 0;
    
    if (resolvedRate === 0 && farmer) {
      if (farmer.milkType === 'BUFFALO') {
        resolvedRate = Number(farmer.customRate) > 0 ? Number(farmer.customRate) : (Number(config?.buffaloRate) || 0);
      } else {
        resolvedRate = Number(config?.cowRate) || 0;
      }
    }

    // Amount: Precision Locked multiplication
    const cost = Number(entry.totalAmount) || parseFloat((qtyLitre * resolvedRate).toFixed(2));
    
    return { qtyLitre, cost, resolvedRate };
  };

  const resolveSaleData = (sale: any, config: any) => {
    const qty = Number(sale.quantity) || 0;
    let rate = Number(sale.rate) || 0;
    if (rate === 0) {
      rate = sale.milkType === 'BUFFALO' ? (Number(config?.buffaloSellingRate) || 0) : (Number(config?.cowSellingRate) || 0);
    }
    const revenue = Number(sale.totalAmount) || parseFloat((qty * rate).toFixed(2));
    return { qty, revenue, rate };
  };

  // 1. MASTER ROSTER (Source of Truth for Cycle)
  const masterRoster = useMemo(() => {
    if (!allEntries || !farmers || !ratesConfig || !selectedMonth || !currentCycle) return [];
    
    const cycleEntries = allEntries.filter(e => {
      if (!e.date.startsWith(selectedMonth)) return false;
      const day = parseInt(e.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    });

    const farmerMap: Record<string, any> = {};

    cycleEntries.forEach(entry => {
      const fId = entry.farmerId;
      if (!farmerMap[fId]) {
        const info = farmers.find(f => f.id === fId);
        farmerMap[fId] = {
          id: fId,
          name: info?.name || "Deleted Supplier",
          canNumber: info?.canNumber || "???",
          bankAccountNumber: info?.bankAccountNumber || "",
          milkType: info?.milkType || "COW",
          customRate: info?.customRate || 0,
          morningQty: 0, eveningQty: 0, totalQty: 0, totalAmount: 0
        };
      }

      const { qtyLitre, cost } = resolveEntryData(entry, farmers, ratesConfig);
      if (entry.session === 'Morning') farmerMap[fId].morningQty += qtyLitre;
      else farmerMap[fId].eveningQty += qtyLitre;
      farmerMap[fId].totalAmount += cost;
    });

    return Object.values(farmerMap).map(f => ({
      ...f,
      morningQty: parseFloat(f.morningQty.toFixed(2)),
      eveningQty: parseFloat(f.eveningQty.toFixed(2)),
      totalQty: parseFloat((f.morningQty + f.eveningQty).toFixed(2)),
      totalAmount: parseFloat(f.totalAmount.toFixed(2))
    })).sort((a, b) => parseInt(a.canNumber) - parseInt(b.canNumber));
  }, [allEntries, farmers, ratesConfig, selectedMonth, currentCycle]);

  const cowRoster = masterRoster.filter(f => f.milkType === 'COW');
  const buffaloRoster = masterRoster.filter(f => f.milkType === 'BUFFALO');

  // 2. CYCLE STATS (Overview Sync - Derived from Roster)
  const cycleStats = useMemo(() => {
    const totalEntryAmt = masterRoster.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const totalEntryQty = masterRoster.reduce((acc, curr) => acc + curr.totalQty, 0);

    let totalSaleAmt = 0;
    let totalSaleQty = 0;

    const cycleSales = allSales?.filter(s => {
      if (!s.date.startsWith(selectedMonth)) return false;
      const day = parseInt(s.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    }) || [];

    cycleSales.forEach(s => {
      const { revenue, qty } = resolveSaleData(s, ratesConfig);
      totalSaleAmt += revenue;
      totalSaleQty += qty;
    });

    return {
      totalEntryQty: parseFloat(totalEntryQty.toFixed(2)),
      totalSaleQty: parseFloat(totalSaleQty.toFixed(2)),
      totalEntryAmt: parseFloat(totalEntryAmt.toFixed(2)),
      totalSaleAmt: parseFloat(totalSaleAmt.toFixed(2)),
      profit: parseFloat((totalSaleAmt - totalEntryAmt).toFixed(2))
    };
  }, [masterRoster, allSales, selectedMonth, currentCycle, ratesConfig]);

  // 3. MONTHLY SUMMARY & AUDIT (Synchronized reduction)
  const monthStats = useMemo(() => {
    if (!allEntries || !allSales || !selectedMonth || !farmers || !ratesConfig) {
      return { totalEntryQty: 0, totalSaleQty: 0, totalEntryAmt: 0, totalSaleAmt: 0, profit: 0 };
    }
    
    const mEntries = allEntries.filter(e => e.date.startsWith(selectedMonth));
    const mSales = allSales.filter(s => s.date.startsWith(selectedMonth));

    let tEntryQty = 0, tEntryAmt = 0, tSaleQty = 0, tSaleAmt = 0;

    mEntries.forEach(e => {
      const res = resolveEntryData(e, farmers, ratesConfig);
      tEntryQty += res.qtyLitre;
      tEntryAmt += res.cost;
    });

    mSales.forEach(s => {
      const res = resolveSaleData(s, ratesConfig);
      tSaleQty += res.qty;
      tSaleAmt += res.revenue;
    });

    return {
      totalEntryQty: parseFloat(tEntryQty.toFixed(2)),
      totalSaleQty: parseFloat(tSaleQty.toFixed(2)),
      totalEntryAmt: parseFloat(tEntryAmt.toFixed(2)),
      totalSaleAmt: parseFloat(tSaleAmt.toFixed(2)),
      profit: parseFloat((tSaleAmt - tEntryAmt).toFixed(2))
    };
  }, [allEntries, allSales, selectedMonth, farmers, ratesConfig]);

  const monthlyAuditSummary = useMemo(() => {
    if (!allEntries || !allSales || !isClient || !farmers || !ratesConfig || !selectedMonth) return [];
    
    const [yearPart] = selectedMonth.split('-').map(Number);
    const monthOfSelection = parseInt(selectedMonth.split('-')[1]);
    // Fiscal Year April to March
    const fiscalYearStart = monthOfSelection <= 3 ? yearPart - 1 : yearPart;
    
    return Array.from({ length: 12 }).map((_, i) => {
      const monthIdx = (3 + i) % 12; // Start from April
      const year = fiscalYearStart + (3 + i >= 12 ? 1 : 0);
      const d = new Date(year, monthIdx, 1);
      const mStr = format(d, 'yyyy-MM');
      
      const mEntries = allEntries.filter(e => e.date.startsWith(mStr));
      const mSales = allSales.filter(s => s.date.startsWith(mStr));
      
      let collL = 0, cost = 0, rev = 0;

      mEntries.forEach(e => {
        const res = resolveEntryData(e, farmers, ratesConfig);
        collL += res.qtyLitre;
        cost += res.cost;
      });

      mSales.forEach(s => {
        const res = resolveSaleData(s, ratesConfig);
        rev += res.revenue;
      });
      
      return { 
        monthName: format(d, 'MMMM yyyy'), 
        collectionL: parseFloat(collL.toFixed(2)), 
        cost: parseFloat(cost.toFixed(2)), 
        revenue: parseFloat(rev.toFixed(2)), 
        profit: parseFloat((rev - cost).toFixed(2)) 
      };
    });
  }, [allEntries, allSales, isClient, farmers, ratesConfig, selectedMonth]);

  const activeInvoices = masterRoster.filter(f => f.totalQty > 0);

  const rosterTotals = (r: any[]) => ({
    morning: r.reduce((acc, c) => acc + c.morningQty, 0),
    evening: r.reduce((acc, c) => acc + c.eveningQty, 0),
    total: r.reduce((acc, c) => acc + c.totalQty, 0),
    amount: r.reduce((acc, c) => acc + c.totalAmount, 0)
  });

  const cowTotals = rosterTotals(cowRoster);
  const buffaloTotals = rosterTotals(buffaloRoster);

  // 4. PDF ENGINE (Fully Synchronized)
  const generateSingleInvoice = (pdf: jsPDF, f: any) => {
    const company = (ratesConfig?.companyName || "SRI GOPALA KRISHNA MILK DISTRIBUTIONS").toUpperCase();
    const [y_part, m_part] = selectedMonth.split('-').map(Number);
    const range = `${currentCycle.start.toString().padStart(2, '0')}/${m_part.toString().padStart(2, '0')} to ${currentCycle.end.toString().padStart(2, '0')}/${m_part.toString().padStart(2, '0')}/${y_part.toString().slice(-2)}`;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(company, 105, 20, { align: 'center' });
    pdf.setFontSize(11);
    pdf.text("SUPPLIER MILK PAYMENT BILL", 105, 26, { align: 'center' });
    pdf.line(20, 30, 190, 30);

    pdf.setFontSize(9);
    let y = 40;
    pdf.setFont("helvetica", "normal"); pdf.text("NAME:", 20, y); pdf.setFont("helvetica", "bold"); pdf.text(f.name.toUpperCase(), 45, y);
    pdf.setFont("helvetica", "normal"); pdf.text("PERIOD:", 110, y); pdf.setFont("helvetica", "bold"); pdf.text(range, 135, y);
    
    y += 8;
    pdf.setFont("helvetica", "normal"); pdf.text("CAN NO:", 20, y); pdf.setFont("helvetica", "bold"); pdf.text(f.canNumber, 45, y);
    pdf.setFont("helvetica", "normal"); pdf.text("A/C NO:", 110, y); pdf.setFont("helvetica", "bold"); pdf.text(f.bankAccountNumber || "—", 135, y);

    y += 8;
    pdf.setFont("helvetica", "normal"); pdf.text("TYPE:", 20, y); pdf.setFont("helvetica", "bold"); pdf.text(f.milkType, 45, y);

    const fEntries = allEntries!.filter(e => e.farmerId === f.id && e.date.startsWith(selectedMonth) && parseInt(e.date.split('-')[2]) >= currentCycle.start && parseInt(e.date.split('-')[2]) <= currentCycle.end);
    
    const rows = fEntries.sort((a, b) => a.date.localeCompare(b.date)).map(e => {
      const res = resolveEntryData(e, farmers!, ratesConfig);
      return [
        format(new Date(e.date), 'dd/MM'),
        e.session === 'Morning' ? res.qtyLitre.toFixed(2) : "-",
        e.session === 'Evening' ? res.qtyLitre.toFixed(2) : "-",
        res.qtyLitre.toFixed(2),
        res.resolvedRate.toFixed(2),
        res.cost.toFixed(2)
      ];
    });

    (pdf as any).autoTable({
      startY: y + 10,
      head: [['DATE', 'MORNING', 'EVENING', 'TOTAL L', 'RATE', 'AMOUNT']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { textColor: 0, halign: 'center' },
      margin: { left: 20, right: 20 }
    });

    const finalY = (pdf as any).lastAutoTable.finalY + 8;
    pdf.setFontSize(12);
    pdf.text(`TOTAL VOLUME: ${f.totalQty.toFixed(2)} L`, 20, finalY);
    pdf.text(`TOTAL PAYOUT: Rs. ${f.totalAmount.toFixed(2)}`, 190, finalY, { align: 'right' });
    pdf.line(20, finalY + 2, 190, finalY + 2);
    
    pdf.setFontSize(8);
    pdf.text("Authorized Signature", 160, 270);
  };

  const downloadRosterPDF = () => {
    const pdf = new jsPDF('l', 'mm', 'a4');
    const label = `${currentCycle.label} - ${monthOptions.find(o => o.value === selectedMonth)?.label}`;

    pdf.setFontSize(16);
    pdf.text("MASTER PROCUREMENT ROSTER", 14, 20);
    pdf.setFontSize(10);
    pdf.text(label, 14, 26);

    const addSect = (t: string, r: any[], y: number, tot: any) => {
      pdf.setFontSize(12); pdf.text(t, 14, y);
      (pdf as any).autoTable({
        startY: y + 4,
        head: [['CAN', 'FARMER NAME', 'MORNING', 'EVENING', 'TOTAL L', 'PAYOUT (Rs)']],
        body: r.map(f => [f.canNumber, f.name, f.morningQty.toFixed(2), f.eveningQty.toFixed(2), f.totalQty.toFixed(2), f.totalAmount.toFixed(2)]),
        theme: 'striped',
        foot: [['', 'TOTALS', tot.morning.toFixed(2), tot.evening.toFixed(2), tot.total.toFixed(2), tot.amount.toFixed(2)]],
        margin: { bottom: 20 }
      });
      return (pdf as any).lastAutoTable.finalY + 15;
    };

    let curY = 35;
    if (cowRoster.length) curY = addSect("COW MILK PROCUREMENT", cowRoster, curY, cowTotals);
    if (buffaloRoster.length) addSect("BUFFALO MILK PROCUREMENT", buffaloRoster, curY, buffaloTotals);

    pdf.save(`Roster_${selectedMonth}_${currentCycle.label}.pdf`);
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Reports & Audit</h1>
              <p className="text-muted-foreground font-medium">Standard 0.96 Payouts • {monthOptions.find(o => o.value === selectedMonth)?.label}</p>
            </div>
            <div className="flex gap-4">
               <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px] rounded-full font-bold h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
              <TabsList className="bg-muted p-1 rounded-full h-auto">
                <TabsTrigger value="overview" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Overview</TabsTrigger>
                <TabsTrigger value="cycle" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Farmer Bills</TabsTrigger>
                <TabsTrigger value="master" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Master Summary</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Internal Audit</TabsTrigger>
              </TabsList>

              {activeTab !== "audit" && (
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-full border">
                  {cycles.map((c, i) => (
                    <button 
                      key={i} 
                      onClick={() => setActiveCycle(i)} 
                      className={cn(
                        "rounded-full text-[10px] font-black px-4 h-8 transition-all", 
                        activeCycle === i ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <TabsContent value="overview" className="space-y-12">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-xs">
                  <CalendarDays className="w-4 h-4" /> Cycle Performance ({currentCycle.label})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card className="rounded-[2rem] bg-primary text-white p-8 shadow-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cycle Volume</p>
                    <p className="text-4xl font-black mt-2">{cycleStats.totalEntryQty.toFixed(2)} L</p>
                  </Card>
                  <Card className="rounded-[2rem] bg-accent text-white p-8 shadow-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cycle Revenue</p>
                    <p className="text-4xl font-black mt-2">₹{cycleStats.totalSaleAmt.toFixed(2)}</p>
                  </Card>
                  <Card className="rounded-[2rem] p-8 border-none bg-destructive/10 text-destructive">
                    <p className="text-[10px] font-black uppercase opacity-70">Cycle Payout</p>
                    <p className="text-3xl font-black mt-2">₹{cycleStats.totalEntryAmt.toFixed(2)}</p>
                  </Card>
                  <Card className="rounded-[2rem] p-8 border-none bg-green-500/10 text-green-600">
                    <p className="text-[10px] font-black uppercase opacity-70">Cycle Profit</p>
                    <p className="text-3xl font-black mt-2">₹{cycleStats.profit.toFixed(2)}</p>
                  </Card>
                </div>
              </div>

              <div className="space-y-4 pt-8 border-t">
                <div className="flex items-center gap-2 text-muted-foreground font-black uppercase tracking-widest text-xs">
                  <PieChart className="w-4 h-4" /> Monthly Snapshot
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-muted/30 rounded-3xl border flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Volume</span>
                    <span className="text-2xl font-black text-primary">{monthStats.totalEntryQty.toFixed(2)} L</span>
                  </div>
                  <div className="p-6 bg-muted/30 rounded-3xl border flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Procurement</span>
                    <span className="text-2xl font-black text-destructive">₹{monthStats.totalEntryAmt.toFixed(2)}</span>
                  </div>
                  <div className="p-6 bg-muted/30 rounded-3xl border flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Profit</span>
                    <span className={cn("text-2xl font-black", monthStats.profit >= 0 ? "text-green-600" : "text-destructive")}>₹{monthStats.profit.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="cycle" className="space-y-6">
              <div className="flex justify-end">
                <Button onClick={() => {
                  const doc = new jsPDF();
                  activeInvoices.forEach((f, i) => { if (i > 0) doc.addPage(); generateSingleInvoice(doc, f); });
                  doc.save(`Bulk_Bills_${selectedMonth}_${currentCycle.label}.pdf`);
                }} disabled={activeInvoices.length === 0} className="rounded-full bg-red-600 hover:bg-red-700 h-12 px-8">
                  <Download className="w-4 h-4 mr-2" /> Download All Bills
                </Button>
              </div>
              <Card className="rounded-3xl overflow-hidden border-none shadow-xl">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase py-5">CAN</TableHead>
                      <TableHead className="font-black text-[10px] uppercase py-5">Farmer Name</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase py-5">Total L</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase py-5">Total Rs</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase py-5">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeInvoices.map(f => (
                      <TableRow key={f.id} className="hover:bg-primary/5">
                        <TableCell className="pl-10 font-black text-primary text-lg">{f.canNumber}</TableCell>
                        <TableCell className="font-bold uppercase text-sm">{f.name}</TableCell>
                        <TableCell className="text-right font-black">{f.totalQty.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-primary font-bold">₹{f.totalAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10">
                          <Button variant="ghost" size="sm" onClick={() => {
                            const pdf = new jsPDF();
                            generateSingleInvoice(pdf, f);
                            pdf.save(`Bill_${f.canNumber}_${f.name}.pdf`);
                          }} className="text-red-600 font-black uppercase text-[10px]">
                            <Download className="w-3 h-3 mr-2" /> PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="master" className="space-y-10">
              <div className="flex justify-between items-center">
                <div className="bg-primary/5 border border-primary/20 px-8 py-4 rounded-[2rem]">
                  <p className="text-[10px] font-black uppercase text-primary opacity-60">Cycle Grand Total</p>
                  <p className="text-3xl font-black text-primary">₹{cycleStats.totalEntryAmt.toFixed(2)}</p>
                </div>
                <Button onClick={downloadRosterPDF} className="rounded-full h-12 px-10 font-black uppercase">
                  <FileDown className="w-4 h-4 mr-2" /> Export PDF Summary
                </Button>
              </div>

              {[
                { label: "Cow Milk Procurement", roster: cowRoster, tot: cowTotals, color: "text-blue-600" },
                { label: "Buffalo Milk Procurement", roster: buffaloRoster, tot: buffaloTotals, color: "text-indigo-600" }
              ].map(s => s.roster.length > 0 && (
                <div key={s.label} className="space-y-4">
                  <h2 className={cn("text-xl font-black uppercase", s.color)}>{s.label}</h2>
                  <Card className="rounded-3xl overflow-hidden border-none shadow-lg">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="pl-8 font-black text-[10px] uppercase py-4">CAN</TableHead>
                          <TableHead className="font-black text-[10px] uppercase">Farmer Name</TableHead>
                          <TableHead className="text-center font-black text-[10px] uppercase">Morning</TableHead>
                          <TableHead className="text-center font-black text-[10px] uppercase">Evening</TableHead>
                          <TableHead className="text-center font-black text-[10px] uppercase">Total L</TableHead>
                          <TableHead className="text-right pr-8 font-black text-[10px] uppercase">Payout Rs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {s.roster.map(f => (
                          <TableRow key={f.id}>
                            <TableCell className="pl-8 font-black text-primary text-lg">{f.canNumber}</TableCell>
                            <TableCell className="font-bold uppercase text-xs">{f.name}</TableCell>
                            <TableCell className="text-center">{f.morningQty.toFixed(2)}</TableCell>
                            <TableCell className="text-center">{f.eveningQty.toFixed(2)}</TableCell>
                            <TableCell className="text-center font-black">{f.totalQty.toFixed(2)}</TableCell>
                            <TableCell className="text-right pr-8 font-black text-primary">₹{f.totalAmount.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <tfoot className="bg-muted/30 border-t font-black">
                        <TableRow>
                          <TableCell colSpan={2} className="pl-8 uppercase text-xs">Subtotals</TableCell>
                          <TableCell className="text-center">{s.tot.morning.toFixed(2)}</TableCell>
                          <TableCell className="text-center">{s.tot.evening.toFixed(2)}</TableCell>
                          <TableCell className="text-center">{s.tot.total.toFixed(2)} L</TableCell>
                          <TableCell className="text-right pr-8 text-primary">₹{s.tot.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      </tfoot>
                    </Table>
                  </Card>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="audit" className="space-y-8">
              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase py-5">Month</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase py-5">Volume (L)</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase py-5">Procurement (Rs)</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase py-5">Revenue (Rs)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase py-5">Profit (Rs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyAuditSummary.map((m, i) => (
                      <TableRow key={i} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="pl-10 font-black text-primary uppercase text-sm">{m.monthName}</TableCell>
                        <TableCell className="text-center font-bold">{m.collectionL.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-destructive font-bold">₹{m.cost.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-green-600 font-bold">₹{m.revenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10 font-black text-lg">
                          <span className={m.profit >= 0 ? "text-green-600" : "text-destructive"}>₹{m.profit.toFixed(2)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
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

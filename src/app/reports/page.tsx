
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
  IndianRupee,
  Scale,
  Printer,
  Calendar,
  FileSpreadsheet,
  Users,
  Milk,
  FileDown,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { format, endOfMonth, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { utils, writeFile } from "xlsx";
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
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isClient, setIsClient] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const now = new Date();
    setSelectedMonth(format(now, 'yyyy-MM'));
    setSelectedDailyDate(format(now, 'yyyy-MM-dd'));
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

  const currentCycle = cycles[activeCycle];

  // IDENTITY RESOLUTION ENGINE: Strictly maps entries to Farmer Directory
  const dailyData = useMemo(() => {
    if (!allEntries || !selectedDailyDate || !farmers) return [];
    const map: Record<string, any> = {};
    const filteredEntries = allEntries.filter(e => e.date === selectedDailyDate);
    
    filteredEntries.forEach(e => {
      const fid = e.farmerId;
      const farmerProfile = farmers.find(f => f.id === fid);
      
      const name = farmerProfile?.name || e.farmerName || "Farmer";
      const can = farmerProfile?.canNumber || e.canNumber || "---";
      const milkType = farmerProfile?.milkType || e.milkType || "COW";
      
      if (!map[fid]) {
        map[fid] = {
          fid,
          can,
          name,
          milkType,
          amKg: 0, amLtr: 0,
          pmKg: 0, pmLtr: 0,
          totalLtr: 0, totalAmt: 0
        };
      }
      
      const kg = Number(e.kgWeight) || 0;
      const ltr = Number(e.quantity) || 0;
      const amt = Number(e.totalAmount) || 0;

      if (e.session === 'Morning') {
        map[fid].amKg += kg;
        map[fid].amLtr += ltr;
      } else {
        map[fid].pmKg += kg;
        map[fid].pmLtr += ltr;
      }
      
      map[fid].totalLtr += ltr;
      map[fid].totalAmt += amt;
    });

    return Object.values(map).sort((a: any, b: any) => {
      const aNum = parseInt(a.can);
      const bNum = parseInt(b.can);
      if (isNaN(aNum) || isNaN(bNum)) return a.can.localeCompare(b.can);
      return aNum - bNum;
    });
  }, [allEntries, farmers, selectedDailyDate]);

  const masterRoster = useMemo(() => {
    if (!allEntries || !selectedMonth || !currentCycle || !farmers) return [];
    
    const map: Record<string, any> = {};
    const cycleEntries = allEntries.filter(e => {
      if (!e.date.startsWith(selectedMonth)) return false;
      const day = parseInt(e.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    });

    cycleEntries.forEach(e => {
      const fid = e.farmerId;
      const farmerProfile = farmers.find(f => f.id === fid);
      const name = farmerProfile?.name || e.farmerName || "Farmer";
      const can = farmerProfile?.canNumber || e.canNumber || "---";
      const milkType = farmerProfile?.milkType || e.milkType || "COW";

      if (!map[fid]) {
        map[fid] = {
          id: fid,
          can,
          name,
          milkType,
          morningQty: 0, eveningQty: 0, totalQty: 0, totalAmount: 0
        };
      }

      const ltr = Number(e.quantity) || 0;
      const amt = Number(e.totalAmount) || 0;

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
  }, [allEntries, farmers, selectedMonth, currentCycle]);

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

  const generateProfessionalInvoice = (pdf: jsPDF, f: any) => {
    const company = (ratesConfig?.companyName || "SRI GOPALA KRISHNA MILK DISTRIBUTIONS").toUpperCase();
    const [year, month] = selectedMonth.split('-').map(Number);
    const periodStartStr = `${currentCycle.start}/${month}/${year.toString().slice(-2)}`;
    const periodEndStr = `${currentCycle.end}/${month}/${year.toString().slice(-2)}`;
    const period = `${periodStartStr} to ${periodEndStr}`;
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(company, 105, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text("MILK INVOICE", 105, 27, { align: 'center' });
    pdf.line(93, 28, 117, 28); 

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    
    const drawUnderlinedField = (label: string, value: string, x: number, y: number, width: number) => {
      pdf.text(label, x, y);
      const labelWidth = pdf.getTextWidth(label);
      pdf.setFont("helvetica", "bold");
      pdf.text(value.toUpperCase(), x + labelWidth + 5, y);
      pdf.line(x + labelWidth + 4, y + 1, x + width, y + 1);
      pdf.setFont("helvetica", "normal");
    };

    drawUnderlinedField("NAME:", f.name, 20, 45, 100);
    drawUnderlinedField("DATE:", format(new Date(), 'dd/MM/yyyy'), 110, 45, 190);
    
    const farmerProfile = farmers?.find(item => item.id === f.id);
    drawUnderlinedField("A/C NO:", farmerProfile?.bankAccountNumber || "---", 20, 55, 100);
    drawUnderlinedField("PERIOD:", period, 110, 55, 190);
    
    drawUnderlinedField("CAN NO:", f.can, 20, 65, 100);
    const avgRate = f.totalQty > 0 ? (f.totalAmount / f.totalQty).toFixed(2) : "0.00";
    drawUnderlinedField("RATE (Rs):", avgRate, 110, 65, 190);

    const dateObjects = [];
    for (let d = currentCycle.start; d <= currentCycle.end; d++) {
      dateObjects.push(new Date(year, month - 1, d));
    }

    const rows = dateObjects.map(dateObj => {
      const dateStr = format(dateObj, 'yyyy-MM-dd');
      const dayEntries = allEntries!.filter(e => e.farmerId === f.id && e.date === dateStr);
      const mQty = dayEntries.find(e => e.session === 'Morning')?.quantity || 0;
      const eQty = dayEntries.find(e => e.session === 'Evening')?.quantity || 0;
      const tQty = mQty + eQty;
      const rate = dayEntries[0]?.rate || 0;
      const amt = tQty * rate;

      return [
        format(dateObj, 'dd/MM/yy'),
        mQty.toFixed(2),
        eQty.toFixed(2),
        tQty.toFixed(2),
        rate.toFixed(2),
        amt.toFixed(2)
      ];
    });

    (pdf as any).autoTable({
      startY: 75,
      head: [['DATE', 'MORNING (L)', 'EVENING (L)', 'TOTAL LITRES', 'RATE (Rs)', 'AMOUNT (Rs)']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: 0, halign: 'center', fontStyle: 'bold', lineWidth: 0.1 },
      bodyStyles: { halign: 'center', textColor: 0, lineWidth: 0.1 },
      styles: { fontSize: 9, cellPadding: 2.5 },
      margin: { left: 20, right: 20 }
    });

    const finalY = (pdf as any).lastAutoTable.finalY;
    pdf.setFont("helvetica", "bold");
    pdf.line(20, finalY, 190, finalY);
    pdf.text("TOTAL", 25, finalY + 7);
    pdf.text(f.totalQty.toFixed(2), 125, finalY + 7, { align: 'center' });
    pdf.text(f.totalAmount.toFixed(2), 178, finalY + 7, { align: 'center' });
    pdf.line(20, finalY + 11, 190, finalY + 11);

    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.text("AUTHORIZED SIGNATURE", 190, pageHeight - 15, { align: 'right' });
    pdf.line(140, pageHeight - 17, 190, pageHeight - 17);
  };

  const handleExportDailyExcel = () => {
    const data = dailyData.map((p: any) => ({
      "CAN": p.can,
      "FARMER NAME": p.name,
      "MILK TYPE": p.milkType,
      "AM-KG": p.amKg.toFixed(2),
      "AM-LITRE": p.amLtr.toFixed(2),
      "PM-KG": p.pmKg.toFixed(2),
      "PM-LITRE": p.pmLtr.toFixed(2),
      "TOTAL LITRES": p.totalLtr.toFixed(2),
      "PAYOUT (Rs)": p.totalAmt.toFixed(2)
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Daily Procurement");
    writeFile(wb, `Daily_Procurement_${selectedDailyDate}.xlsx`);
  };

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
      toast({ title: "Master Reset Successful", description: "All collection and sales records have been cleared." });
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
                Reflecting Farmer Management & Collection Registry
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
                <TabsTrigger value="daily" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Daily Report</TabsTrigger>
                <TabsTrigger value="cycle" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Farmer Bills</TabsTrigger>
                <TabsTrigger value="master" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Master Roster</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-full px-6 py-2 font-black uppercase text-[10px]">Internal Audit</TabsTrigger>
              </TabsList>

              {["overview", "cycle", "master"].includes(activeTab) && (
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

            <TabsContent value="daily" className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card p-6 rounded-3xl border shadow-sm">
                <div className="flex items-center gap-4">
                  <Calendar className="text-primary w-5 h-5" />
                  <Input 
                    type="date" 
                    value={selectedDailyDate} 
                    onChange={(e) => setSelectedDailyDate(e.target.value)} 
                    className="w-[200px] font-bold h-11 rounded-full px-6 border-primary/10" 
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleExportDailyExcel} variant="outline" className="rounded-full h-11 px-6 font-bold uppercase text-[10px] border-primary/20">
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel Export
                  </Button>
                  <Button onClick={() => {
                    const pdf = new jsPDF('l', 'mm', 'a4');
                    const company = (ratesConfig?.companyName || "SRI GOPALA KRISHNA MILK DISTRIBUTIONS").toUpperCase();
                    pdf.setFontSize(18);
                    pdf.text(company, 148, 20, { align: 'center' });
                    pdf.setFontSize(12);
                    pdf.text(`DAILY PROCUREMENT REPORT - ${format(new Date(selectedDailyDate), 'dd/MM/yyyy')}`, 148, 28, { align: 'center' });
                    (pdf as any).autoTable({
                      startY: 35,
                      head: [['CAN', 'FARMER NAME', 'TYPE', 'AM-KG', 'AM-L', 'PM-KG', 'PM-L', 'TOT-L', 'PAYOUT (Rs)']],
                      body: dailyData.map(p => [p.can, p.name, p.milkType, p.amKg.toFixed(2), p.amLtr.toFixed(2), p.pmKg.toFixed(2), p.pmLtr.toFixed(2), p.totalLtr.toFixed(2), p.totalAmt.toFixed(2)]),
                      theme: 'grid',
                      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
                      bodyStyles: { halign: 'center' }
                    });
                    pdf.save(`Daily_Procurement_${selectedDailyDate}.pdf`);
                  }} className="rounded-full h-11 px-8 font-bold uppercase text-[10px] shadow-lg">
                    <Printer className="mr-2 h-4 w-4" /> Print Daily Report
                  </Button>
                </div>
              </div>

              <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-black text-[10px] text-center border-r w-[80px]">CAN</TableHead>
                      <TableHead className="font-black text-[10px] border-r">Farmer Name</TableHead>
                      <TableHead className="font-black text-[10px] border-r text-center">Milk Type</TableHead>
                      <TableHead colSpan={2} className="text-center font-black text-[10px] border-r bg-primary/5 uppercase tracking-widest">AM (Morning)</TableHead>
                      <TableHead colSpan={2} className="text-center font-black text-[10px] border-r bg-accent/5 uppercase tracking-widest">PM (Evening)</TableHead>
                      <TableHead className="text-center font-black text-[10px] border-r bg-muted/20">Total L</TableHead>
                      <TableHead className="text-right font-black text-[10px] pr-6">Amount (Rs)</TableHead>
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableHead className="border-r"></TableHead>
                      <TableHead className="border-r"></TableHead>
                      <TableHead className="border-r"></TableHead>
                      <TableHead className="text-center text-[8px] font-black border-r">KG</TableHead>
                      <TableHead className="text-center text-[8px] font-black border-r">LTR</TableHead>
                      <TableHead className="text-center text-[8px] font-black border-r">KG</TableHead>
                      <TableHead className="text-center text-[8px] font-black border-r">LTR</TableHead>
                      <TableHead className="border-r bg-muted/20"></TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyData.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-20 italic text-muted-foreground font-medium uppercase text-[10px] tracking-widest">No procurement records found.</TableCell></TableRow>
                    ) : (
                      dailyData.map((p: any, i) => (
                        <TableRow key={i} className="hover:bg-primary/5 group transition-colors">
                          <TableCell className="text-center font-black border-r text-primary text-base">{p.can}</TableCell>
                          <TableCell className="font-bold border-r uppercase text-sm">{p.name}</TableCell>
                          <TableCell className="text-center border-r">
                            <Badge variant={p.milkType === 'BUFFALO' ? "secondary" : "outline"} className="text-[8px] rounded-full px-2 font-black uppercase">
                              {p.milkType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center border-r text-xs text-muted-foreground">{p.amKg.toFixed(2)}</TableCell>
                          <TableCell className="text-center border-r font-black text-primary">{p.amLtr.toFixed(2)}</TableCell>
                          <TableCell className="text-center border-r text-xs text-muted-foreground">{p.pmKg.toFixed(2)}</TableCell>
                          <TableCell className="text-center border-r font-black text-accent">{p.pmLtr.toFixed(2)}</TableCell>
                          <TableCell className="text-center border-r font-black text-primary bg-primary/5">{p.totalLtr.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-black pr-6 text-foreground/80">₹ {p.totalAmt.toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="cycle" className="space-y-6">
              <div className="flex justify-end">
                <Button onClick={() => {
                  const pdf = new jsPDF();
                  const valid = masterRoster.filter(f => f.totalQty > 0);
                  valid.forEach((f, i) => { if (i > 0) pdf.addPage(); generateProfessionalInvoice(pdf, f); });
                  pdf.save(`Bills_${selectedMonth}_${currentCycle.label}.pdf`);
                }} className="rounded-full bg-destructive hover:bg-destructive/90 h-12 px-10 shadow-lg font-black uppercase text-xs">
                  <FileDown className="mr-2 h-4 w-4" /> Download All Bills (PDF)
                </Button>
              </div>
              <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase w-[100px]">CAN</TableHead>
                      <TableHead className="font-black text-[10px] uppercase">Farmer Name</TableHead>
                      <TableHead className="font-black text-[10px] uppercase">Milk Type</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase">Volume (L)</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase">Payout (Rs)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masterRoster.filter(f => f.totalQty > 0).map(f => (
                      <TableRow key={f.id} className="hover:bg-primary/5 transition-colors group">
                        <TableCell className="pl-10 font-black text-primary text-lg">{f.can}</TableCell>
                        <TableCell className="font-bold uppercase text-sm">{f.name}</TableCell>
                        <TableCell>
                          <Badge variant={f.milkType === 'BUFFALO' ? "secondary" : "outline"} className="text-[9px] rounded-full px-2 font-black">
                            {f.milkType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-base">{f.totalQty.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-black text-primary text-base">₹ {f.totalAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10">
                          <Button variant="ghost" size="sm" onClick={() => {
                            const pdf = new jsPDF();
                            generateProfessionalInvoice(pdf, f);
                            pdf.save(`Bill_${f.can}_${f.name.replace(/\s+/g, '_')}.pdf`);
                          }} className="text-primary font-black uppercase text-[10px] group-hover:bg-primary/10 rounded-full h-8 px-4">
                            PDF Bill
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="master" className="space-y-6">
              <div className="flex justify-between items-center bg-primary p-8 rounded-[2rem] text-white shadow-xl border-none">
                <div>
                  <p className="text-xs font-black uppercase opacity-60 tracking-widest">Cycle Grand Total Procurement</p>
                  <p className="text-4xl font-black mt-1">₹ {cycleStats.procCost.toFixed(2)}</p>
                </div>
                <Button onClick={() => {
                  const pdf = new jsPDF('l', 'mm', 'a4');
                  const company = (ratesConfig?.companyName || "SRI GOPALA KRISHNA MILK DISTRIBUTIONS").toUpperCase();
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
                         tCost += Number(e.totalAmount) || 0;
                         tQty += Number(e.quantity) || 0;
                       });
                       mSales.forEach(s => {
                         tRev += Number(s.totalAmount) || 0;
                       });

                       return (
                        <TableRow key={i} className="hover:bg-muted/10 group transition-colors border-b last:border-0">
                          <TableCell className="pl-10 font-black text-primary uppercase text-sm py-6">{opt.label}</TableCell>
                          <TableCell className="text-center font-bold text-base">{tQty.toFixed(2)} L</TableCell>
                          <TableCell className="text-center text-destructive font-black">₹ {tCost.toFixed(2)}</TableCell>
                          <TableCell className="text-center text-green-600 font-black">₹ {tRev.toFixed(2)}</TableCell>
                          <TableCell className="text-right pr-10 font-black text-xl">
                            <span className={(tRev - tCost) >= 0 ? "text-green-600" : "text-destructive"}>₹ {(tRev - tCost).toFixed(2)}</span>
                          </TableCell>
                        </TableRow>
                       );
                    })}
                  </TableBody>
                </Table>
              </Card>

              <div className="pt-10 border-t">
                <h3 className="text-xs font-black text-destructive uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Dangerous Operations
                </h3>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="rounded-full px-8 h-12 shadow-lg">
                      <Trash2 className="w-4 h-4 mr-2" /> Master Data Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-black text-destructive uppercase">Confirm Full Reset</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete ALL collection entries and sales records across all months. This action is irreversible and will result in total loss of historical audit data.
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

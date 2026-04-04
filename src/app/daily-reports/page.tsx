
"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileBarChart, 
  Printer, 
  Calendar, 
  FileSpreadsheet, 
  Users, 
  Loader2 
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { utils, writeFile } from "xlsx";

export default function DailyReportsPage() {
  const firestore = useFirestore();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  const entriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'entries');
  }, [firestore]);

  const farmersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'farmers');
  }, [firestore]);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: allEntries, isLoading: entriesLoading } = useCollection(entriesQuery);
  const { data: farmers, isLoading: farmersLoading } = useCollection(farmersQuery);
  const { data: ratesConfig } = useDoc(settingsRef);

  const dailyData = useMemo(() => {
    if (!allEntries || !selectedDate || !farmers) return [];
    
    const map: Record<string, any> = {};
    const filteredEntries = allEntries.filter(e => e.date === selectedDate);
    
    filteredEntries.forEach(e => {
      const fid = e.farmerId;
      // Precision Resolution: Prioritize directory lookup to fix "Farmer [ID]" bug
      const farmerProfile = farmers.find(f => f.id === fid);
      
      const name = farmerProfile?.name || e.farmerName || "Farmer (CAN: " + (e.canNumber || "---") + ")";
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
  }, [allEntries, farmers, selectedDate]);

  const handleExportExcel = () => {
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
    writeFile(wb, `Daily_Procurement_${selectedDate}.xlsx`);
  };

  const handlePrintPDF = () => {
    const pdf = new jsPDF('l', 'mm', 'a4');
    const company = (ratesConfig?.companyName || "SRI GOPALA KRISHNA MILK DISTRIBUTIONS").toUpperCase();
    pdf.setFontSize(18);
    pdf.text(company, 148, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text(`DAILY PROCUREMENT REPORT - ${format(new Date(selectedDate), 'dd/MM/yyyy')}`, 148, 28, { align: 'center' });
    
    (pdf as any).autoTable({
      startY: 35,
      head: [['CAN', 'FARMER NAME', 'TYPE', 'AM-KG', 'AM-L', 'PM-KG', 'PM-L', 'TOT-L', 'PAYOUT (Rs)']],
      body: dailyData.map(p => [
        p.can, 
        p.name, 
        p.milkType, 
        p.amKg.toFixed(2), 
        p.amLtr.toFixed(2), 
        p.pmKg.toFixed(2), 
        p.pmLtr.toFixed(2), 
        p.totalLtr.toFixed(2), 
        p.totalAmt.toFixed(2)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
      bodyStyles: { halign: 'center' }
    });
    
    pdf.save(`Daily_Procurement_${selectedDate}.pdf`);
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1">
                <FileBarChart className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-widest">Accuracy Guaranteed</span>
              </div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Daily Reports</h1>
              <p className="text-muted-foreground font-medium flex items-center gap-2">
                <Users className="w-4 h-4" /> 
                Consolidated Procurement Summaries (AM/PM Sessions)
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-3 bg-card p-2 rounded-full border shadow-sm px-6">
                <Calendar className="w-4 h-4 text-primary" />
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  className="border-none focus-visible:ring-0 bg-transparent h-8 w-[140px] font-bold" 
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleExportExcel} variant="outline" className="rounded-full font-black uppercase text-[10px] h-11 px-6">
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                </Button>
                <Button onClick={handlePrintPDF} className="rounded-full font-black uppercase text-[10px] h-11 px-8 shadow-lg">
                  <Printer className="mr-2 h-4 w-4" /> Print PDF
                </Button>
              </div>
            </div>
          </header>

          <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-black text-[10px] text-center border-r w-[80px] uppercase">CAN</TableHead>
                  <TableHead className="font-black text-[10px] border-r uppercase">Farmer Name</TableHead>
                  <TableHead className="font-black text-[10px] border-r text-center uppercase">Milk Type</TableHead>
                  <TableHead colSpan={2} className="text-center font-black text-[10px] border-r bg-primary/5 uppercase tracking-widest">AM (Morning)</TableHead>
                  <TableHead colSpan={2} className="text-center font-black text-[10px] border-r bg-accent/5 uppercase tracking-widest">PM (Evening)</TableHead>
                  <TableHead className="text-center font-black text-[10px] border-r bg-muted/20 uppercase">Total (L)</TableHead>
                  <TableHead className="text-right font-black text-[10px] pr-8 uppercase">Amount (Rs)</TableHead>
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
                {entriesLoading || farmersLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : dailyData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-20 italic text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
                      No procurement records found for this date.
                    </TableCell>
                  </TableRow>
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
                      <TableCell className="text-right font-black pr-8 text-foreground/80">₹ {p.totalAmt.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

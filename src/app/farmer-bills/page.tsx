
"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Printer, 
  Loader2, 
  ChevronRight,
  FileDown
} from "lucide-react";
import { format, endOfMonth, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

export default function FarmerBillsPage() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
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

  const CONVERSION_RATE = 0.96;
  const currentCycle = cycles[activeCycle];

  const masterRoster = useMemo(() => {
    if (!allEntries || !selectedMonth || !currentCycle || !farmers || !ratesConfig) return [];
    
    const map: Record<string, any> = {};
    const cycleEntries = allEntries.filter(e => {
      if (!e.date.startsWith(selectedMonth)) return false;
      const day = parseInt(e.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    });

    cycleEntries.forEach(e => {
      const fid = e.farmerId;
      const farmerProfile = farmers.find(f => f.id === fid || f.canNumber === e.canNumber);
      
      if (!farmerProfile) return;

      const name = farmerProfile.name;
      const can = farmerProfile.canNumber;
      const milkType = farmerProfile.milkType || "COW";

      if (!map[fid]) {
        map[fid] = {
          id: fid,
          can,
          name,
          milkType,
          totalQty: 0,
          totalAmount: 0
        };
      }

      const ltr = (Number(e.kgWeight) || 0) * CONVERSION_RATE;
      const rate = Number(farmerProfile.customRate) > 0 
        ? Number(farmerProfile.customRate) 
        : (milkType === 'BUFFALO' ? (Number(ratesConfig.buffaloRate) || 0) : (Number(ratesConfig.cowRate) || 35));

      map[fid].totalQty += ltr;
      map[fid].totalAmount += (ltr * rate);
    });

    return Object.values(map).sort((a: any, b: any) => {
      const aNum = parseInt(a.can);
      const bNum = parseInt(b.can);
      return (isNaN(aNum) || isNaN(bNum)) ? a.can.localeCompare(b.can) : aNum - bNum;
    });
  }, [allEntries, farmers, selectedMonth, activeCycle, ratesConfig, currentCycle]);

  const generateProfessionalInvoice = (pdf: jsPDF, f: any) => {
    const company = (ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS").toUpperCase();
    const [year, month] = selectedMonth.split('-').map(Number);
    const period = `${currentCycle.start}/${month}/${year.toString().slice(-2)} to ${currentCycle.end}/${month}/${year.toString().slice(-2)}`;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(company, pageWidth / 2, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text("MILK INVOICE", pageWidth / 2, 27, { align: 'center' });
    pdf.line(pageWidth / 2 - 12, 28, pageWidth / 2 + 12, 28); 

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    
    const drawField = (label: string, value: string, x: number, y: number, width: number) => {
      pdf.text(label, x, y);
      const labelW = pdf.getTextWidth(label);
      pdf.setFont("helvetica", "bold");
      pdf.text(value.toUpperCase(), x + labelW + 5, y);
      pdf.line(x + labelW + 4, y + 1, x + width, y + 1);
      pdf.setFont("helvetica", "normal");
    };

    drawField("NAME:", f.name, 20, 45, 100);
    drawField("DATE:", format(new Date(), 'dd/MM/yyyy'), 110, 45, 190);
    
    const profile = farmers?.find(item => item.id === f.id);
    drawField("A/C NO:", profile?.bankAccountNumber || "---", 20, 55, 100);
    drawField("PERIOD:", period, 110, 55, 190);
    drawField("CAN NO:", f.can, 20, 65, 100);
    const avgR = f.totalQty > 0 ? (f.totalAmount / f.totalQty).toFixed(2) : "0.00";
    drawField("RATE (Rs):", avgR, 110, 65, 190);

    const rows = [];
    for (let d = currentCycle.start; d <= currentCycle.end; d++) {
      const ds = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const dayE = allEntries!.filter(e => (e.farmerId === f.id || e.canNumber === f.can) && e.date === ds);
      const mQ = (Number(dayE.find(e => e.session === 'Morning')?.kgWeight) || 0) * CONVERSION_RATE;
      const eQ = (Number(dayE.find(e => e.session === 'Evening')?.kgWeight) || 0) * CONVERSION_RATE;
      const tQ = mQ + eQ;
      const rate = profile && Number(profile.customRate) > 0 
        ? Number(profile.customRate) 
        : (f.milkType === 'BUFFALO' ? (Number(ratesConfig?.buffaloRate) || 0) : (Number(ratesConfig?.cowRate) || 35));
      
      rows.push([format(new Date(year, month - 1, d), 'dd/MM/yy'), mQ.toFixed(2), eQ.toFixed(2), tQ.toFixed(2), rate.toFixed(2), (tQ * rate).toFixed(2)]);
    }

    (pdf as any).autoTable({
      startY: 75,
      head: [['DATE', 'MORNING (L)', 'EVENING (L)', 'TOTAL (L)', 'RATE (Rs)', 'AMOUNT (Rs)']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold' },
      bodyStyles: { halign: 'center' },
      margin: { left: 20, right: 20 }
    });

    const finalY = (pdf as any).lastAutoTable.finalY;
    pdf.setFont("helvetica", "bold");
    pdf.text("TOTAL", 25, finalY + 7);
    pdf.text(f.totalQty.toFixed(2), 115, finalY + 7, { align: 'center' });
    pdf.text(f.totalAmount.toFixed(2), 178, finalY + 7, { align: 'center' });

    // SIGNATORY FOOTER: Stamp edge locked 25mm above signature line
    const sigLineY = pageHeight - 25;
    if (ratesConfig?.stampUrl) {
      try {
        const formatMatch = ratesConfig.stampUrl.match(/^data:image\/([a-zA-Z+]+);base64,/);
        const imageFormat = formatMatch ? formatMatch[1].toUpperCase() : 'PNG';
        const finalFormat = imageFormat.includes('JP') ? 'JPEG' : 'PNG';
        
        pdf.addImage(ratesConfig.stampUrl, finalFormat, pageWidth - 70, sigLineY - 50, 50, 25);
      } catch (e) {
        console.error("PDF Stamp Error:", e);
      }
    }
    pdf.text("AUTHORIZED SIGNATURE", pageWidth - 20, pageHeight - 15, { align: 'right' });
    pdf.line(pageWidth - 75, sigLineY, pageWidth - 20, sigLineY);
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Farmer Bills</h1>
              <p className="text-muted-foreground font-medium">Professional invoices for validated farmers.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px] rounded-full font-bold h-11 border-primary/20 shadow-sm">
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
                    onClick={() => setActiveCycle(i)} 
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

          <div className="mb-6 flex justify-end">
            <Button 
              onClick={() => {
                const pdf = new jsPDF();
                masterRoster.filter(f => f.totalQty > 0).forEach((f, i) => { if (i > 0) pdf.addPage(); generateProfessionalInvoice(pdf, f); });
                pdf.save(`Bills_${selectedMonth}_${currentCycle.label}.pdf`);
              }}
              className="rounded-full bg-rose-600 hover:bg-rose-700 h-12 px-10 shadow-lg font-black uppercase text-xs"
            >
              <FileDown className="mr-2 h-4 w-4" /> Download All Bills
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
                {entriesLoading || farmersLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : masterRoster.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-20 italic text-muted-foreground">No matching data found for this cycle.</TableCell></TableRow>
                ) : (
                  masterRoster.map(f => (
                    <TableRow key={f.id} className="hover:bg-primary/5 transition-colors group">
                      <TableCell className="pl-10 font-black text-primary text-lg">{f.can}</TableCell>
                      <TableCell className="font-bold uppercase text-sm">{f.name}</TableCell>
                      <TableCell>
                        <Badge variant={f.milkType === 'BUFFALO' ? "secondary" : "outline"} className="text-[9px] rounded-full px-2 font-black">
                          {f.milkType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-base">{f.totalQty.toFixed(2)}</TableCell>
                      <TableCell className="text-right pr-10 font-black text-primary text-base">₹ {f.totalAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right pr-10">
                        <Button 
                          variant="ghost" size="sm" 
                          onClick={() => {
                            const pdf = new jsPDF();
                            generateProfessionalInvoice(pdf, f);
                            pdf.save(`Bill_${f.can}_${f.name.replace(/\s+/g, '_')}.pdf`);
                          }}
                          className="text-primary font-black uppercase text-[10px] group-hover:bg-primary/10 rounded-full h-8 px-4"
                        >
                          Print <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </TableCell>
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

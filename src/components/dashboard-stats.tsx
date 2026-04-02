
"use client";

import { useState, useEffect } from "react";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Droplets, Users, TrendingUp, Calendar, ShoppingCart } from "lucide-react";
import { format } from "date-fns";

export function DashboardStats() {
  const firestore = useFirestore();
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  const today = currentDate ? format(currentDate, 'yyyy-MM-dd') : null;

  const farmersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'farmers');
  }, [firestore]);

  const entriesQuery = useMemoFirebase(() => {
    if (!firestore || !today) return null;
    return query(collection(firestore, 'entries'), where('date', '==', today));
  }, [firestore, today]);

  const salesQuery = useMemoFirebase(() => {
    if (!firestore || !today) return null;
    return query(collection(firestore, 'sales'), where('date', '==', today));
  }, [firestore, today]);

  const { data: farmers } = useCollection(farmersQuery);
  const { data: todayEntries } = useCollection(entriesQuery);
  const { data: todaySales } = useCollection(salesQuery);

  const totalCollection = todayEntries?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;
  const totalSales = todaySales?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-none shadow-sm bg-primary/5 overflow-hidden relative">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-1">Collection (L)</p>
              <h3 className="text-3xl font-black text-primary">{totalCollection.toFixed(1)} L</h3>
            </div>
            <div className="p-2 bg-primary/10 rounded-xl">
              <Droplets className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground italic">Today's total purchase</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-accent/5 overflow-hidden relative">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-accent/60 uppercase tracking-widest mb-1">Sales (L)</p>
              <h3 className="text-3xl font-black text-accent">{totalSales.toFixed(1)} L</h3>
            </div>
            <div className="p-2 bg-accent/10 rounded-xl">
              <ShoppingCart className="w-5 h-5 text-accent" />
            </div>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground italic">Today's total sold</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-secondary/5 overflow-hidden relative">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-1">Inventory Balance</p>
              <h3 className="text-3xl font-black text-primary">{(totalCollection - totalSales).toFixed(1)} L</h3>
            </div>
            <div className="p-2 bg-secondary/10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-secondary" />
            </div>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground italic">Current surplus/deficit</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-muted overflow-hidden relative">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Suppliers</p>
              <h3 className="text-2xl font-black text-primary">
                {farmers?.length || 0} Active
              </h3>
            </div>
            <div className="p-2 bg-background rounded-xl">
              <Users className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="mt-5 text-xs font-medium text-muted-foreground uppercase tracking-tighter">
            {format(currentDate || new Date(), 'dd MMM, yyyy')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

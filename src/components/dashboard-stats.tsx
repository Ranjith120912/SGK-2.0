"use client";

import { useState, useEffect } from "react";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Droplets, Users, TrendingUp, Calendar } from "lucide-react";
import { format } from "date-fns";

export function DashboardStats() {
  const firestore = useFirestore();
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  const today = currentDate ? format(currentDate, 'yyyy-MM-dd') : null;

  const customersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'customers');
  }, [firestore]);

  const entriesQuery = useMemoFirebase(() => {
    if (!firestore || !today) return null;
    return query(collection(firestore, 'entries'), where('date', '==', today));
  }, [firestore, today]);

  const { data: customers } = useCollection(customersQuery);
  const { data: todayEntries } = useCollection(entriesQuery);

  const totalLitres = todayEntries?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;
  const morningLitres = todayEntries?.filter(e => e.session === 'Morning').reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;
  const eveningLitres = todayEntries?.filter(e => e.session === 'Evening').reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-none shadow-sm bg-primary/5 overflow-hidden relative">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-1">Total Litres Today</p>
              <h3 className="text-3xl font-black text-primary">{totalLitres.toFixed(1)} L</h3>
            </div>
            <div className="p-2 bg-primary/10 rounded-xl">
              <Droplets className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="mt-4 flex gap-4 text-xs font-medium text-muted-foreground">
            <span>M: {morningLitres.toFixed(1)}L</span>
            <span>E: {eveningLitres.toFixed(1)}L</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-accent/5 overflow-hidden relative">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-accent/60 uppercase tracking-widest mb-1">Total Customers</p>
              <h3 className="text-3xl font-black text-primary">{customers?.length || 0}</h3>
            </div>
            <div className="p-2 bg-accent/10 rounded-xl">
              <Users className="w-5 h-5 text-accent" />
            </div>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-green-500" />
            Active suppliers
          </p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-secondary/5 overflow-hidden relative">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-secondary/60 uppercase tracking-widest mb-1">Entries Made</p>
              <h3 className="text-3xl font-black text-primary">{todayEntries?.length || 0}</h3>
            </div>
            <div className="p-2 bg-secondary/10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-secondary" />
            </div>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground">
            {((todayEntries?.length || 0) / (customers?.length || 1) * 100).toFixed(0)}% completion rate
          </p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-muted overflow-hidden relative">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Date</p>
              <h3 className="text-2xl font-black text-primary">
                {currentDate ? format(currentDate, 'dd MMM, yyyy') : 'Loading...'}
              </h3>
            </div>
            <div className="p-2 bg-background rounded-xl">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="mt-5 text-xs font-medium text-muted-foreground">
            Status: Collection ongoing
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

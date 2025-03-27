
import Background from "@/components/layout/Background";
import Navbar from "@/components/layout/Navbar";
import SwapCard from "@/components/ui/SwapCard";

export default function Swap() {
  return (
    <div className="min-h-screen flex flex-col">
      <Background />
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 pt-24 pb-12">
        <div className="max-w-2xl mx-auto mt-8">
          <SwapCard />
        </div>
      </main>
    </div>
  );
}

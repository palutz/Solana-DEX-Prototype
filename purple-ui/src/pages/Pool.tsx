
import Background from "@/components/layout/Background";
import Navbar from "@/components/layout/Navbar";
import PoolCard from "@/components/ui/PoolCard";

export default function Pool() {
  return (
    <div className="min-h-screen flex flex-col">
      <Background />
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 pt-24 pb-12">
        <div className="max-w-2xl mx-auto mt-8">
          <PoolCard />
        </div>
      </main>
    </div>
  );
}

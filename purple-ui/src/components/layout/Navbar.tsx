
import { Link, useLocation } from "react-router-dom";
import WalletButton from "@/components/wallet/WalletButton";

export default function Navbar() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/10">
      <div className="container mx-auto px-4 sm:px-6 flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-dex-purple-dark to-dex-purple-light animate-pulse-soft"></div>
              <div className="absolute inset-0.5 rounded-full bg-black/80 flex items-center justify-center text-dex-purple font-bold">
                D
              </div>
            </div>
            <span className="text-xl font-bold text-gradient">Dexplore</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link 
              to="/" 
              className={`text-sm transition-colors ${isActive('/') ? 'text-white' : 'text-white/70 hover:text-white'}`}
            >
              Home
            </Link>
            <Link 
              to="/swap" 
              className={`text-sm transition-colors ${isActive('/swap') ? 'text-white' : 'text-white/70 hover:text-white'}`}
            >
              Swap
            </Link>
            <Link 
              to="/pool" 
              className={`text-sm transition-colors ${isActive('/pool') ? 'text-white' : 'text-white/70 hover:text-white'}`}
            >
              Pool
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

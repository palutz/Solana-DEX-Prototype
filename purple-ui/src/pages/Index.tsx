
import { useNavigate } from "react-router-dom";
import Background from "@/components/layout/Background";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";

export default function Index() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen flex flex-col">
      <Background />
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 pt-24 pb-12">
        <div className="max-w-4xl mx-auto mt-12 mb-24 text-center">
          <div className="inline-block rounded-full bg-white/10 px-3 py-1 text-sm text-dex-purple-light mb-4">
            Powered by Solana
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-gradient">
            Dexplore the Future of Decentralized Trading
          </h1>
          
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            A modern DEX platform for seamless token swaps and liquidity provision on Solana.
            Fast, secure, and built for the next generation of DeFi.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => navigate('/swap')} className="button-primary py-6 px-8 text-lg">
              Start Trading
            </Button>
            <Button onClick={() => navigate('/pool')} className="button-secondary py-6 px-8 text-lg">
              Manage Liquidity
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <div className="glass-card p-6 rounded-xl backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-dex-purple/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute -top-3 -right-3 w-20 h-20 blur-3xl bg-dex-purple/20 rounded-full"></div>
            
            <h3 className="text-xl font-semibold mb-3 text-white relative z-10">Swap Tokens</h3>
            <p className="text-white/70 mb-4 relative z-10">
              Trade tokens seamlessly with minimal slippage and low fees.
              Our optimized routing ensures you get the best prices.
            </p>
            <Button onClick={() => navigate('/swap')} variant="outline" className="relative z-10 button-outline">
              Swap Now
            </Button>
          </div>
          
          <div className="glass-card p-6 rounded-xl backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-dex-purple/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute -top-3 -right-3 w-20 h-20 blur-3xl bg-dex-purple/20 rounded-full"></div>
            
            <h3 className="text-xl font-semibold mb-3 text-white relative z-10">Add Liquidity</h3>
            <p className="text-white/70 mb-4 relative z-10">
              Provide liquidity to pools and earn fees from trades.
              Stake your LP tokens to earn additional rewards.
            </p>
            <Button onClick={() => navigate('/pool')} variant="outline" className="relative z-10 button-outline">
              Add Liquidity
            </Button>
          </div>
          
          <div className="glass-card p-6 rounded-xl backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-dex-purple/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute -top-3 -right-3 w-20 h-20 blur-3xl bg-dex-purple/20 rounded-full"></div>
            
            <h3 className="text-xl font-semibold mb-3 text-white relative z-10">Earn Rewards</h3>
            <p className="text-white/70 mb-4 relative z-10">
              Maximize your returns by participating in liquidity pools
              with competitive APY rates and incentive programs.
            </p>
            <Button variant="outline" className="relative z-10 button-outline">
              Coming Soon
            </Button>
          </div>
        </div>
        
        <div className="glass-card rounded-xl overflow-hidden mb-20 backdrop-blur-2xl">
          <div className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="max-w-2xl">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gradient">The Next Generation Decentralized Exchange</h2>
                <p className="text-white/80 mb-6">
                  Dexplore is built on Solana, offering lightning-fast transactions with minimal fees.
                  Our platform is designed for both beginners and experienced traders,
                  providing an intuitive interface and advanced features.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-dex-purple">$0M+</span>
                    <span className="text-sm text-white/70">Total Value Locked</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-dex-purple">0K+</span>
                    <span className="text-sm text-white/70">Users</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-dex-purple">000K+</span>
                    <span className="text-sm text-white/70">Transactions</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="bg-dex-dark-lighter rounded-xl overflow-hidden shadow-lg h-36 w-40 flex flex-col justify-center items-center animate-float">
                  <div className="text-2xl font-bold text-dex-purple mb-2">0.00%</div>
                  <div className="text-sm text-white/70 text-center px-2">Average Trade Fee</div>
                </div>
                <div className="bg-dex-dark-lighter rounded-xl overflow-hidden shadow-lg h-36 w-40 flex flex-col justify-center items-center animate-float" style={{ animationDelay: "-2s" }}>
                  <div className="text-2xl font-bold text-dex-purple mb-2">000ms</div>
                  <div className="text-sm text-white/70 text-center px-2">Average Transaction Time</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="border-t border-white/10 py-8">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-dex-purple-dark to-dex-purple-light animate-pulse-soft"></div>
                <div className="absolute inset-0.5 rounded-full bg-black/80 flex items-center justify-center text-dex-purple font-bold">
                  D
                </div>
              </div>
              <span className="text-xl font-bold text-gradient">Dexplore</span>
            </div>
            
            <div className="flex flex-wrap justify-center gap-6 mb-4 md:mb-0">
              <a href="#" className="text-sm text-white/70 hover:text-white">About</a>
              <a href="#" className="text-sm text-white/70 hover:text-white">Documentation</a>
              <a href="#" className="text-sm text-white/70 hover:text-white">Governance</a>
              <a href="#" className="text-sm text-white/70 hover:text-white">Community</a>
              <a href="#" className="text-sm text-white/70 hover:text-white">Blog</a>
            </div>
            
            <div className="text-sm text-white/50">
              © 2025 Dexplore. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

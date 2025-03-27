
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PoolState, Pool } from '@/types';
import { POOLS } from '@/constants/tokens';
import TokenSelector from './TokenSelector';
import { toast } from "sonner";

export default function PoolCard() {
  const [poolState, setPoolState] = useState<PoolState>({
    pool: null,
    depositAmount1: '',
    depositAmount2: '',
    withdrawAmount: '',
    sharePercentage: 0
  });
  
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const handlePoolSelect = (poolId: string) => {
    const pool = POOLS.find(p => p.id === poolId);
    setSelectedPoolId(poolId);
    setPoolState(prev => ({
      ...prev,
      pool,
      depositAmount1: '',
      depositAmount2: ''
    }));
  };
  
  const handleDepositAmount1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d+(\.\d{0,6})?$/.test(value)) {
      setPoolState(prev => ({
        ...prev,
        depositAmount1: value,
        // In a real app, calculate based on pool ratio
        depositAmount2: value ? (parseFloat(value) * 100).toString() : ''
      }));
    }
  };
  
  const handleWithdrawAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d+(\.\d{0,6})?$/.test(value)) {
      setPoolState(prev => ({
        ...prev,
        withdrawAmount: value,
        sharePercentage: value ? Math.min(parseFloat(value) * 10, 100) : 0
      }));
    }
  };
  
  const handleDeposit = () => {
    if (!poolState.pool || !poolState.depositAmount1 || !poolState.depositAmount2) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setIsLoading(true);
    
    // Simulate a deposit operation
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: 'Processing deposit...',
        success: () => {
          setIsLoading(false);
          setPoolState(prev => ({
            ...prev,
            depositAmount1: '',
            depositAmount2: ''
          }));
          return `Successfully deposited to ${poolState.pool.name} pool`;
        },
        error: () => {
          setIsLoading(false);
          return 'Deposit failed. Please try again.';
        },
      }
    );
  };
  
  const handleWithdraw = () => {
    if (!poolState.pool || !poolState.withdrawAmount) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setIsLoading(true);
    
    // Simulate a withdraw operation
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: 'Processing withdrawal...',
        success: () => {
          setIsLoading(false);
          setPoolState(prev => ({
            ...prev,
            withdrawAmount: '',
            sharePercentage: 0
          }));
          return `Successfully withdrew from ${poolState.pool.name} pool`;
        },
        error: () => {
          setIsLoading(false);
          return 'Withdrawal failed. Please try again.';
        },
      }
    );
  };
  
  return (
    <div className="glass-card rounded-xl overflow-hidden w-full max-w-md mx-auto">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Liquidity Pools</h2>
        
        <Tabs defaultValue="deposit" className="w-full">
          <TabsList className="grid w-full grid-cols-2 glass-card">
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          </TabsList>
          
          <TabsContent value="deposit" className="space-y-4 mt-4">
            <div className="glass-card rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3 text-white/90">Select Pool</h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {POOLS.map((pool) => (
                  <Button
                    key={pool.id}
                    variant="outline"
                    size="sm"
                    className={`h-10 justify-start ${selectedPoolId === pool.id ? 'bg-dex-purple/20 border-dex-purple/40' : 'glass-card'}`}
                    onClick={() => handlePoolSelect(pool.id)}
                  >
                    <div className="flex items-center text-xs">
                      <div className="flex -space-x-1 mr-2">
                        <img src={pool.tokens[0].logoURI} alt={pool.tokens[0].symbol} className="w-4 h-4 rounded-full" />
                        <img src={pool.tokens[1].logoURI} alt={pool.tokens[1].symbol} className="w-4 h-4 rounded-full" />
                      </div>
                      {pool.name}
                    </div>
                  </Button>
                ))}
              </div>
              
              {poolState.pool && (
                <div className="text-xs text-white/70 flex justify-between">
                  <span>APY: {poolState.pool.apy}%</span>
                  <span>Fee: {poolState.pool.fee}%</span>
                </div>
              )}
            </div>
            
            {poolState.pool && (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Deposit {poolState.pool.tokens[0].symbol}</label>
                  <div className="flex items-center gap-2 glass-card p-3 rounded-lg">
                    <Input 
                      type="text" 
                      placeholder="0.0"
                      value={poolState.depositAmount1}
                      onChange={handleDepositAmount1Change}
                      className="border-0 bg-transparent shadow-none text-lg font-medium focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                    />
                    <div className="flex items-center gap-2 px-3 py-1 glass-card rounded-md">
                      <img 
                        src={poolState.pool.tokens[0].logoURI} 
                        alt={poolState.pool.tokens[0].symbol} 
                        className="w-5 h-5 rounded-full"
                      />
                      <span>{poolState.pool.tokens[0].symbol}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Deposit {poolState.pool.tokens[1].symbol}</label>
                  <div className="flex items-center gap-2 glass-card p-3 rounded-lg">
                    <Input 
                      type="text" 
                      placeholder="0.0"
                      value={poolState.depositAmount2}
                      readOnly
                      className="border-0 bg-transparent shadow-none text-lg font-medium focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                    />
                    <div className="flex items-center gap-2 px-3 py-1 glass-card rounded-md">
                      <img 
                        src={poolState.pool.tokens[1].logoURI} 
                        alt={poolState.pool.tokens[1].symbol} 
                        className="w-5 h-5 rounded-full"
                      />
                      <span>{poolState.pool.tokens[1].symbol}</span>
                    </div>
                  </div>
                </div>
                
                {parseFloat(poolState.depositAmount1) > 0 && (
                  <div className="glass-card p-3 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/70">LP Tokens Received (est.)</span>
                      <span className="font-medium">
                        {(parseFloat(poolState.depositAmount1) * 0.5).toFixed(6)} LP
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Share of Pool</span>
                      <span>0.01%</span>
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={handleDeposit}
                  disabled={isLoading || !poolState.depositAmount1 || !poolState.depositAmount2}
                  className="w-full button-primary py-6 text-base"
                >
                  {isLoading ? 'Processing...' : 'Add Liquidity'}
                </Button>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="withdraw" className="space-y-4 mt-4">
            <div className="glass-card rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3 text-white/90">Select Pool</h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {POOLS.map((pool) => (
                  <Button
                    key={pool.id}
                    variant="outline"
                    size="sm"
                    className={`h-10 justify-start ${selectedPoolId === pool.id ? 'bg-dex-purple/20 border-dex-purple/40' : 'glass-card'}`}
                    onClick={() => handlePoolSelect(pool.id)}
                  >
                    <div className="flex items-center text-xs">
                      <div className="flex -space-x-1 mr-2">
                        <img src={pool.tokens[0].logoURI} alt={pool.tokens[0].symbol} className="w-4 h-4 rounded-full" />
                        <img src={pool.tokens[1].logoURI} alt={pool.tokens[1].symbol} className="w-4 h-4 rounded-full" />
                      </div>
                      {pool.name}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
            
            {poolState.pool && (
              <>
                <div className="glass-card p-4 rounded-lg space-y-3">
                  <h3 className="text-sm font-medium text-white/90">Your Position</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">LP Tokens</span>
                    <span>0.5 LP</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <img src={poolState.pool.tokens[0].logoURI} alt={poolState.pool.tokens[0].symbol} className="w-4 h-4 rounded-full" />
                      <span className="text-sm">{poolState.pool.tokens[0].symbol}</span>
                    </div>
                    <span className="text-sm">1.25</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <img src={poolState.pool.tokens[1].logoURI} alt={poolState.pool.tokens[1].symbol} className="w-4 h-4 rounded-full" />
                      <span className="text-sm">{poolState.pool.tokens[1].symbol}</span>
                    </div>
                    <span className="text-sm">125.00</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm text-white/70">LP Tokens to Withdraw</label>
                  <div className="flex items-center gap-2 glass-card p-3 rounded-lg">
                    <Input 
                      type="text" 
                      placeholder="0.0"
                      value={poolState.withdrawAmount}
                      onChange={handleWithdrawAmountChange}
                      className="border-0 bg-transparent shadow-none text-lg font-medium focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                    />
                    <button className="text-xs text-dex-purple hover:text-dex-purple-light">MAX</button>
                  </div>
                </div>
                
                <div className="relative pt-5">
                  <div className="glass-card h-2 overflow-hidden rounded-full">
                    <div 
                      className="h-full bg-gradient-to-r from-dex-purple-dark to-dex-purple-light"
                      style={{ width: `${poolState.sharePercentage}%` }}
                    ></div>
                  </div>
                  <div className="absolute -top-1 start-0 -translate-x-1/2 text-xs text-white/70">0%</div>
                  <div className="absolute -top-1 end-0 translate-x-1/2 text-xs text-white/70">100%</div>
                  <div 
                    className="absolute -top-1 text-xs text-dex-purple"
                    style={{ 
                      left: `${poolState.sharePercentage}%`, 
                      transform: 'translateX(-50%)' 
                    }}
                  >
                    {poolState.sharePercentage.toFixed(0)}%
                  </div>
                </div>
                
                {parseFloat(poolState.withdrawAmount) > 0 && (
                  <div className="glass-card p-3 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/70">You Will Receive (est.)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1">
                        <img src={poolState.pool.tokens[0].logoURI} alt={poolState.pool.tokens[0].symbol} className="w-4 h-4 rounded-full" />
                        <span>{poolState.pool.tokens[0].symbol}</span>
                      </div>
                      <span>{(parseFloat(poolState.withdrawAmount) * 2.5).toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1">
                        <img src={poolState.pool.tokens[1].logoURI} alt={poolState.pool.tokens[1].symbol} className="w-4 h-4 rounded-full" />
                        <span>{poolState.pool.tokens[1].symbol}</span>
                      </div>
                      <span>{(parseFloat(poolState.withdrawAmount) * 250).toFixed(6)}</span>
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={handleWithdraw}
                  disabled={isLoading || !poolState.withdrawAmount}
                  className="w-full button-primary py-6 text-base"
                >
                  {isLoading ? 'Processing...' : 'Remove Liquidity'}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

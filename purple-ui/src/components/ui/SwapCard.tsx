import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import TokenSelector from './TokenSelector';
import { ArrowDown, Settings, Repeat } from 'lucide-react';
import { Token, SwapState } from '@/types';
import { toast } from "sonner";
import { TOKENS, getTokenBySymbol } from '@/constants/tokens';

export default function SwapCard() {
  const [swapState, setSwapState] = useState<SwapState>({
    tokenFrom: TOKENS.length > 0 ? TOKENS[0] : null, // Default to SOL or null if not available
    tokenTo: TOKENS.length > 1 ? TOKENS[1] : TOKENS.length > 0 ? TOKENS[0] : null, // Default to USDC or SOL as fallback
    amountFrom: '',
    amountTo: ''
  });

  const [slippage, setSlippage] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Update estimated amount when input changes
  useEffect(() => {
    if (swapState.amountFrom && swapState.tokenFrom && swapState.tokenTo) {
      // TODO: Replace with backend functionality to get the price
      // For now, it's mocking via a simple conversion rate
      const getEstimatedAmount = () => {
        const amount = parseFloat(swapState.amountFrom);
        
        // TODO: Fetch actual conversion rates from DEX smart contract?
        const rates: Record<string, Record<string, number>> = {
          SOL: { 
            USDC: 100, 
            JUP: 500, 
            RAY: 30 
          },
          USDC: { 
            SOL: 0.01, 
            JUP: 5, 
            RAY: 0.3 
          },
          JUP: { 
            SOL: 0.002, 
            USDC: 0.2, 
            RAY: 0.06 
          },
          RAY: { 
            SOL: 0.033, 
            USDC: 3.33, 
            JUP: 16.67 
          }
        };
        
        const fromSymbol = swapState.tokenFrom?.symbol || '';
        const toSymbol = swapState.tokenTo?.symbol || '';
        
        // If we don't have a rate, use 1:1 as fallback
        const rate = rates[fromSymbol]?.[toSymbol] || 1;
        
        return (amount * rate).toFixed(6).toString();
      };
      
      // Add a small delay to simulate API call
      const timeout = setTimeout(() => {
        setSwapState(prev => ({
          ...prev,
          amountTo: getEstimatedAmount()
        }));
      }, 500);
      
      return () => clearTimeout(timeout);
    }
  }, [swapState.amountFrom, swapState.tokenFrom, swapState.tokenTo]);
  
  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty input or numbers with up to 6 decimal places
    if (value === '' || /^\d+(\.\d{0,6})?$/.test(value)) {
      setSwapState(prev => ({
        ...prev,
        amountFrom: value
      }));
    }
  };
  
  const handleToAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty input or numbers with up to 6 decimal places
    if (value === '' || /^\d+(\.\d{0,6})?$/.test(value)) {
      setSwapState(prev => ({
        ...prev,
        amountTo: value
      }));
    }
  };
  
  const handleFromTokenChange = (token: Token) => {
    setSwapState(prev => ({
      ...prev,
      tokenFrom: token,
      // Reset amount if token changes
      amountFrom: prev.tokenFrom?.id !== token.id ? '' : prev.amountFrom,
      amountTo: prev.tokenFrom?.id !== token.id ? '' : prev.amountTo
    }));
  };
  
  const handleToTokenChange = (token: Token) => {
    setSwapState(prev => ({
      ...prev,
      tokenTo: token,
      // Reset amount to if token changes
      amountTo: prev.tokenTo?.id !== token.id ? '' : prev.amountTo
    }));
  };
  
  const handleSwitch = () => {
    setSwapState(prev => ({
      tokenFrom: prev.tokenTo,
      tokenTo: prev.tokenFrom,
      amountFrom: prev.amountTo,
      amountTo: prev.amountFrom
    }));
  };
  
  const handleSlippageChange = (value: number) => {
    setSlippage(value);
  };
  
  const handleSwap = async () => {
    if (!swapState.tokenFrom || !swapState.tokenTo || !swapState.amountFrom) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setIsLoading(true);
    
    // TODO: Implement actual swap functionality using the dex/ smart contract by
    // 1. Creating and sending the swap transaction to the blockchain
    // 2. Handling approval/confirmation from the user's wallet
    // 3. Waiting for the transaction to be confirmed
    // 4. Updating UI based on transaction result
    
    // Simulate a swap operation
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: 'Processing swap...',
        success: () => {
          setIsLoading(false);
          setSwapState(prev => ({
            ...prev,
            amountFrom: '',
            amountTo: ''
          }));
          return `Swapped ${swapState.amountFrom} ${swapState.tokenFrom?.symbol} for ${swapState.amountTo} ${swapState.tokenTo?.symbol}`;
        },
        error: () => {
          setIsLoading(false);
          return 'Swap failed. Please try again.';
        },
      }
    );
  };
  
  return (
    <div className="glass-card rounded-xl overflow-hidden w-full max-w-md mx-auto">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Swap</h2>
          <Button 
            variant="ghost" 
            size="icon"
            className="text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
        
        {showSettings && (
          <div className="mb-6 glass-card rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3 text-white/90">Settings</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="slippage" className="text-sm text-white/80">Slippage Tolerance</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-7 px-2 ${slippage === 0.1 ? 'bg-dex-purple/20 border-dex-purple/40' : 'glass-card'}`}
                    onClick={() => handleSlippageChange(0.1)}
                  >
                    0.1%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-7 px-2 ${slippage === 0.5 ? 'bg-dex-purple/20 border-dex-purple/40' : 'glass-card'}`}
                    onClick={() => handleSlippageChange(0.5)}
                  >
                    0.5%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-7 px-2 ${slippage === 1.0 ? 'bg-dex-purple/20 border-dex-purple/40' : 'glass-card'}`}
                    onClick={() => handleSlippageChange(1.0)}
                  >
                    1.0%
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="dealline" className="text-sm text-white/80">Transaction Deadline</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="deadline"
                    type="number"
                    defaultValue={30}
                    min={1}
                    className="w-16 h-7 glass-card"
                  />
                  <span className="text-sm text-white/70">minutes</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm text-white/80">Expert Mode</Label>
                <Switch />
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm text-white/70">From</label>
              <button className="text-xs text-dex-purple hover:text-dex-purple-light">Max</button>
            </div>
            <div className="flex items-center gap-2 glass-card p-3 rounded-lg focus-within:ring-1 focus-within:ring-dex-purple/30">
              <Input 
                type="text" 
                placeholder="0.0"
                value={swapState.amountFrom}
                onChange={handleFromAmountChange}
                className="border-0 bg-transparent shadow-none text-lg font-medium focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
              />
              <TokenSelector 
                value={swapState.tokenFrom} 
                onChange={handleFromTokenChange}
                excludeToken={swapState.tokenTo}
              />
            </div>
            {swapState.tokenFrom && (
              <div className="text-xs text-white/60 pl-1">
                Balance: 5.72 {swapState.tokenFrom.symbol}
              </div>
            )}
          </div>
          
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSwitch}
              className="bg-dex-dark-lighter rounded-full h-8 w-8 shadow-md shadow-black/30 text-white/70 hover:text-white hover:bg-dex-purple/20"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm text-white/70">To</label>
              <div className="text-xs text-white/60">
                {parseFloat(swapState.amountFrom) && parseFloat(swapState.amountTo) ? 
                  `1 ${swapState.tokenFrom?.symbol} ≈ ${(parseFloat(swapState.amountTo) / parseFloat(swapState.amountFrom)).toFixed(6)} ${swapState.tokenTo?.symbol}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2 glass-card p-3 rounded-lg focus-within:ring-1 focus-within:ring-dex-purple/30">
              <Input 
                type="text" 
                placeholder="0.0"
                value={swapState.amountTo}
                onChange={handleToAmountChange}
                className="border-0 bg-transparent shadow-none text-lg font-medium focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
              />
              <TokenSelector 
                value={swapState.tokenTo} 
                onChange={handleToTokenChange}
                excludeToken={swapState.tokenFrom}
              />
            </div>
            {swapState.tokenTo && (
              <div className="text-xs text-white/60 pl-1">
                Balance: 0.00 {swapState.tokenTo.symbol}
              </div>
            )}
          </div>
          
          {parseFloat(swapState.amountFrom) > 0 && (
            <div className="glass-card p-3 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/70">Minimum received</span>
                <span className="font-medium">
                  {/* TODO: calculate actual minimum received based on slippage from DEX contract */}
                  {(parseFloat(swapState.amountTo) * (1 - slippage / 100)).toFixed(6)} {swapState.tokenTo?.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Price impact</span>
                {/* TODO: calculate actual price impact from DEX contract */}
                <span className="text-green-400">{'< 0.01%'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70">Slippage tolerance</span>
                <span>{slippage}%</span>
              </div>
            </div>
          )}
          
          <Button
            onClick={handleSwap}
            disabled={isLoading || !swapState.amountFrom || !swapState.tokenFrom || !swapState.tokenTo}
            className="w-full button-primary py-6 text-base"
          >
            {isLoading ? 'Swapping...' : 'Swap'}
          </Button>
        </div>
      </div>
    </div>
  );
}

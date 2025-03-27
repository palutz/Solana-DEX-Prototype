
import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WalletState } from '@/types';
import { toast } from "sonner";
import { 
  useWallet, 
  useConnection 
} from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function WalletButton() {
  const { connection } = useConnection();
  const { 
    publicKey, 
    wallet, 
    disconnect, 
    connected
  } = useWallet();
  
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    publicKey: null,
    balance: 0
  });

  // Update wallet state when connection status changes
  useEffect(() => {
    setWalletState(prevState => ({
      ...prevState,
      connected: connected,
      publicKey: publicKey ? publicKey.toString() : null
    }));

    // Fetch balance if connected
    if (connected && publicKey) {
      fetchBalance();
    }
  }, [connected, publicKey]);

  // Fetch wallet balance
  const fetchBalance = async () => {
    try {
      if (publicKey) {
        const balance = await connection.getBalance(publicKey);
        setWalletState(prevState => ({
          ...prevState,
          balance: balance / LAMPORTS_PER_SOL
        }));
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  // Disconnect wallet handler
  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast.success('Wallet disconnected');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      toast.error('Failed to disconnect wallet');
    }
  };

  // Use the WalletMultiButton when not connected
  if (!walletState.connected) {
    return (
      <div className="wallet-adapter-wrapper">
        <WalletMultiButton className="button-primary" />
      </div>
    );
  }

  // Show connected wallet UI
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="button-primary">
          {walletState.balance.toFixed(2)} SOL
        </Button>
      </PopoverTrigger>
      <PopoverContent className="glass-card w-60">
        <div className="space-y-3">
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-white">Wallet</h4>
            <p className="text-xs text-white/70 truncate">
              {walletState.publicKey ? 
                `${walletState.publicKey.slice(0, 8)}...${walletState.publicKey.slice(-8)}` : 
                'Not connected'}
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-white">Balance</h4>
            <p className="text-sm text-white">{walletState.balance.toFixed(4)} SOL</p>
          </div>
          <Button 
            variant="outline" 
            className="w-full button-outline"
            onClick={handleDisconnect}
          >
            Disconnect
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

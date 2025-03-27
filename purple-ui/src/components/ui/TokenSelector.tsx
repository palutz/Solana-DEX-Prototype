
import { useState, useEffect } from 'react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from "@/components/ui/command";
import { Token } from '@/types';
import { TOKENS } from '@/constants/tokens';
import { CheckIcon, ChevronsUpDown } from 'lucide-react';

interface TokenSelectorProps {
  value: Token | null;
  onChange: (token: Token) => void;
  excludeToken?: Token | null;
}

export default function TokenSelector({ value, onChange, excludeToken }: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState<Token[]>([]);
  
  useEffect(() => {
    // Filter out excluded token
    setTokens(TOKENS.filter(token => 
      !excludeToken || token.id !== excludeToken.id
    ));
  }, [excludeToken]);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox"
          aria-expanded={open}
          className="w-full flex justify-between items-center glass-card hover:bg-white/10 transition-all"
        >
          {value ? (
            <div className="flex items-center gap-2 text-left">
              <img 
                src={value.logoURI} 
                alt={value.name} 
                className="w-6 h-6 rounded-full"
              />
              <div>
                <div className="font-medium">{value.symbol}</div>
                <div className="text-xs opacity-70">{value.name}</div>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">Select token</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="glass-card p-0 border-white/10">
        <Command className="bg-transparent">
          <CommandInput placeholder="Search tokens..." className="border-none focus:ring-0 py-3 text-white" />
          <CommandList className="thin-scrollbar max-h-80">
            <CommandEmpty>No token found.</CommandEmpty>
            <CommandGroup>
              {tokens.map((token) => (
                <CommandItem
                  key={token.id}
                  value={token.id}
                  onSelect={() => {
                    onChange(token);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer hover:bg-white/10 aria-selected:bg-white/10"
                >
                  <img 
                    src={token.logoURI} 
                    alt={token.name} 
                    className="w-6 h-6 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{token.symbol}</div>
                    <div className="text-xs opacity-70 truncate">{token.name}</div>
                  </div>
                  {value?.id === token.id && (
                    <CheckIcon className="h-4 w-4 text-dex-purple" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

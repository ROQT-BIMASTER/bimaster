import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  nome_empresa: string;
  cnpj?: string | null;
}

interface ClientSearchSelectProps {
  customers: Customer[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
}

export function ClientSearchSelect({
  customers,
  value,
  onValueChange,
  placeholder = "Buscar por nome ou CNPJ..."
}: ClientSearchSelectProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find selected customer
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === value);
  }, [customers, value]);

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;

    const query = searchQuery.toLowerCase();
    const queryNumbers = searchQuery.replace(/\D/g, "");

    return customers.filter((customer) => {
      const nameMatch = customer.nome_empresa?.toLowerCase().includes(query);
      const cnpjMatch = queryNumbers && customer.cnpj?.replace(/\D/g, "").includes(queryNumbers);
      return nameMatch || cnpjMatch;
    });
  }, [customers, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (customer: Customer) => {
    onValueChange(customer.id);
    setSearchQuery("");
    setIsOpen(false);
  };

  const handleClear = () => {
    onValueChange(null);
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Selected display or search input */}
      {value && selectedCustomer && !isOpen ? (
        <div 
          className="flex items-center justify-between p-3 border rounded-md bg-background cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setIsOpen(true)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium truncate">{selectedCustomer.nome_empresa}</p>
              {selectedCustomer.cnpj && (
                <p className="text-xs text-muted-foreground">{selectedCustomer.cnpj}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-1 hover:bg-accent rounded-full"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-full"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full border rounded-md bg-popover shadow-lg max-h-60 overflow-y-auto">
          {filteredCustomers.length > 0 ? (
            <div className="p-1">
              {filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                    value === customer.id && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => handleSelect(customer)}
                >
                  <div className="font-medium">{customer.nome_empresa}</div>
                  {customer.cnpj && (
                    <div className="text-xs text-muted-foreground">{customer.cnpj}</div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export const SUGGESTED_ROLES = [
  "Account Lead",
  "Account Manager",
  "Project Manager",
  "Senior PM",
  "Strategist",
  "UX Designer",
  "Creative Director",
  "Developer",
  "Senior Developer",
  "Technical Lead",
  "DevOps Engineer",
  "QA Engineer",
  "Copywriter",
  "MD",
  "Director",
  "Consultant",
];

interface RoleComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function RoleCombobox({
  value,
  onChange,
  placeholder = "Select or type a role",
  disabled = false,
  className,
}: RoleComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep local input in sync when form resets from outside
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSelect = (role: string) => {
    setInputValue(role);
    onChange(role);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    onChange(v);
    if (!open && v.length > 0) setOpen(true);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setOpen(false);
    // Enter closes the popover and keeps the typed value
    if (e.key === "Enter") { e.preventDefault(); setOpen(false); }
  };

  const filtered = inputValue.trim()
    ? SUGGESTED_ROLES.filter((r) =>
        r.toLowerCase().includes(inputValue.toLowerCase())
      )
    : SUGGESTED_ROLES;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative flex items-center", className)}>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="pr-8"
          />
          <ChevronsUpDown
            className="absolute right-2.5 h-3.5 w-3.5 shrink-0 text-muted-foreground pointer-events-none"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[220px]"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {filtered.length === 0 ? (
              <CommandEmpty>
                <span className="text-xs text-muted-foreground px-2">
                  Press Enter to use "{inputValue}"
                </span>
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((role) => (
                  <CommandItem
                    key={role}
                    value={role}
                    onSelect={() => handleSelect(role)}
                    className="text-sm cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5 shrink-0",
                        value === role ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {role}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

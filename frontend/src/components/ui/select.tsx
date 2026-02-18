"use client"

import * as React from "react"

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  selectedLabel: string
  setSelectedLabel: (label: string) => void
}

const SelectContext = React.createContext<SelectContextValue | undefined>(undefined)

const Select = ({
  value,
  onValueChange,
  children,
}: {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}) => {
  const [open, setOpen] = React.useState(false)
  const [selectedLabel, setSelectedLabel] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, selectedLabel, setSelectedLabel }}>
      <div ref={containerRef} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => context?.setOpen(!context?.open)}
      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
      {...props}
    >
      {children}
      <svg
        className="h-4 w-4 opacity-50 ml-2 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = ({ placeholder }: { placeholder?: string; children?: React.ReactNode }) => {
  const context = React.useContext(SelectContext)
  
  return (
    <span className="block truncate">
      {context?.selectedLabel || placeholder || "Select..."}
    </span>
  )
}

const SelectContent = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  const context = React.useContext(SelectContext)
  
  if (!context?.open) {
    return null
  }

  return (
    <div
      className={`absolute z-50 mt-1 w-full min-w-[8rem] overflow-hidden rounded-md border bg-white text-popover-foreground shadow-md ${className || ''}`}
    >
      <div className="max-h-60 overflow-y-auto p-1">
        {children}
      </div>
    </div>
  )
}

const SelectItem = ({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) => {
  const context = React.useContext(SelectContext)
  const isSelected = context?.value === value
  
  // Update selected label when the value matches
  React.useEffect(() => {
    if (isSelected && typeof children === 'string') {
      context?.setSelectedLabel(children)
    } else if (isSelected && React.isValidElement(children)) {
      // Handle React elements
      const label = React.Children.toArray(children).join('')
      context?.setSelectedLabel(label)
    }
  }, [isSelected, children, context])
  
  return (
    <div
      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${
        isSelected ? 'bg-accent' : ''
      } ${className || ''}`}
      onClick={() => {
        const label = typeof children === 'string' ? children : React.Children.toArray(children).join('')
        context?.setSelectedLabel(label)
        context?.onValueChange(value)
        context?.setOpen(false)
      }}
    >
      {children}
    </div>
  )
}

export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
}



# Fix: Submenu Flickering and Controlled Close

## Root Cause

The `Popover` and `Drawer` components call `onOpenChange(boolean)` with the desired open state, but the handler ignores the boolean and blindly toggles:

```typescript
onOpenChange={() => toggleModuleOpen(moduleCode)}  // ignores the actual value
```

This causes state desync — the Popover fires `onOpenChange(false)` to close, but `toggleModuleOpen` may re-open it, creating the flicker loop.

## Fix (single file: `AppSidebar.tsx`)

### 1. Replace toggle with explicit set

Change `toggleModuleOpen` to accept an optional boolean:

```typescript
const setModuleOpen = useCallback((code: string, open?: boolean) => {
  setOpenModules(prev => {
    const next = new Set(prev);
    const shouldOpen = open ?? !next.has(code);
    if (shouldOpen) next.add(code);
    else next.delete(code);
    return next;
  });
}, []);
```

### 2. Update all Popover/Drawer `onOpenChange` handlers

From: `onOpenChange={() => toggleModuleOpen(code)}`
To: `onOpenChange={(open) => setModuleOpen(code, open)}`

Keep the trigger button click as toggle: `onClick={() => setModuleOpen(code)}`

This ensures:
- Clicking trigger toggles open/close
- Clicking outside calls `onOpenChange(false)` → closes cleanly, no flicker
- Pressing Escape closes cleanly

### 3. Add close button (X) to PopoverContent header

Add an `X` icon button in the submenu header bar for explicit close:

```tsx
<button onClick={() => setModuleOpen(moduleCode, false)}>
  <X className="h-3.5 w-3.5" />
</button>
```

### 4. Apply to all 3 submenu instances

- `ModuleSubmenu` component (modules)
- Department submenus (Tarefas)
- Central de Inteligência submenu

All use the same pattern — same fix in each spot (~6 `onOpenChange` callbacks total).


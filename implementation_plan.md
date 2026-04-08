# Implement Dynamic Commodity Fetching

## Goal Description
Replace static commodity dropdown in the Book Warehouse page with real-time data fetched from MongoDB. Provide automatic rate synchronization, loading/error states, and caching/revalidation.

## User Review Required
[!IMPORTANT]
- Confirm the desired field name for the commodity ID/value in the form (currently using `commodityName`).
- Confirm if the rate should be displayed in a separate "Rate per MT" field or integrated elsewhere.
- Confirm any additional UI styling preferences for loading/error placeholders.

## Proposed Changes
---
### Server Actions
#### [MODIFY] [rates.ts](file:///d:/WMA/wms-app/src/app/actions/rates.ts)
- Add a new server action `getActiveCommodities` that queries the `commodities` collection, filters `isActive: true`, and returns `{ id, name, rate }`.
- Export the function for client use.

#### [MODIFY] [commodities.ts](file:///d:/WMA/wms-app/src/app/actions/commodities.ts)
- Rename existing `fetchCommodities` to `fetchAllCommodities` (internal use).
- Add a new server action `getActiveCommodities` that calls `fetchAllCommodities` and filters `isActive` before returning.
- Ensure `revalidatePath('/dashboard/commodities')` is called after any add/update/delete.

---
### Client Component
#### [MODIFY] [booking-form.tsx](file:///d:/WMA/wms-app/src/components/features/bookings/booking-form.tsx)
- Import the new server action via `import { getActiveCommodities } from '@/app/actions/commodities';`.
- Use `use` (Server Component) or `useEffect` with `fetch` to load commodities on mount.
- Replace the static `<select>` options with a map over the fetched array, rendering `<SelectItem>` from shadcn/ui.
- Add loading placeholder (`"Loading commodities..."`) and empty state (`"No commodities found"`).
- Add an `onChange` handler that sets the "Rate per MT" field (`setValue('ratePerMT', selected.rate)`).
- Ensure the form registers a hidden `commodityId` field if you prefer storing the ID instead of name.

---
### Caching & Revalidation
#### [MODIFY] [commodities.ts] (already covered)
- Use `revalidatePath('/dashboard/bookings')` inside `getActiveCommodities` if needed, or rely on Next.js ISR.
- Add `export const dynamic = 'force-dynamic';` at top of the page component to always fetch fresh data.

## Open Questions
- Do you want the commodity dropdown to store the commodity **ID** or **name** as the form value?
- Should the rate field be editable by the user, or strictly read‑only?
- Any custom styling (dark mode, glassmorphism) you’d like for the loading spinner or empty state?

## Verification Plan
### Automated Tests
- Run `npm run dev` and navigate to `/dashboard/bookings` to verify the dropdown populates.
- Submit a booking with a selected commodity and ensure the rate field updates instantly.
- Add a new commodity via the Commodity Master and confirm the dropdown reflects the change without a full page reload.

### Manual Verification
- Ask the user to open the Book Warehouse page and observe the dynamic behavior.
- Verify that rate updates propagate after editing a commodity in the master list.

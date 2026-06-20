# Security Specification - Gestión de Almacén Pro

## Data Invariants
1. A transaction must always link to a valid product and have a valid user ID.
2. Stock levels (min, max, current) must be numbers.
3. Transactions are immutable once created.
4. Users can only manage their own profile metadata unless they are admins.

## The Dirty Dozen Payloads
1. **Identity Spoofing**: Attempt to create a transaction with another user's ID.
2. **Resource Poisoning**: Create a product with a 1MB name string.
3. **Price Manipulation**: (N/A for now, price isn't in core yet, but stock level hijacking is relevant).
4. **Invalid State Transition**: Change a transaction type from IN to OUT after creation.
5. **Orphaned Moves**: Create a transaction for a productId that doesn't exist.
6. **Bypassing Verification**: Write data without `email_verified` (if strict).
7. **Phantom Stock**: Update product `currentStock` without creating a transaction record (client logic, rules just check field safety).
8. **Negative Stock**: (Hard to prevent solely with rules if logic is complex, but we can check `quantity > 0`).
9. **Admin Escalation**: Attempt to write to `role` in `users` collection as a non-admin.
10. **ID Junkyard**: Use emoji or 1KB string as document IDs.
11. **Shadow Fields**: Add `isVerified: true` to a product document.
12. **PII Leak**: Read all user emails from the `users` collection as an operator.

## Testing Strategy
We will use the `handleFirestoreError` in the client to trace any permission issues correctly.
The `firestore.rules` have been drafted with validation helpers to block these payloads.

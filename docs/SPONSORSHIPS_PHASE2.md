# Sponsored listings — Phase 2 (agreement 5.6 / 5.7)

Senior design that satisfies Phase 2 while staying safe for later reward engines.

## Product model

| Layer | Role |
|---|---|
| **SponsoredPackage** | Admin catalog: name, price, duration, status, placement (top / section / badge / priority), **optional geo allow-list**, **optional community allow-list** |
| **Checkout location** | Seller always picks country / state / city (audience). Stored on the purchase as `geoSnapshot` |
| **Community** | Optional (or required by package). Powers **5.7** owner commission |
| **SponsoredPurchase / Placement / Earning** | Immutable commercial + display + ledger records |

### Why both package geo and checkout location?

- **Package geo (optional)** = who may *buy* this package (regional SKU). Blank = global Starter/Medium/Full.
- **Checkout location (required)** = where the boost is *targeted* / reported. Feeds soft-match viewers; Phase 3 can tighten.

Sellers always see every **active** package. Regional packages disable at pay time if location does not match — never an empty “no packages” screen for global tiers.

## Phase 2 flows

1. Admin creates 3–4 global packages (geo blank) + optional regional ones.
2. Admin sets `communitySponsoredCommissionPercent` (default **20%**).
3. Seller: location → package → optional community → Flutterwave fee (not item price).
4. Webhook / return verify → placement active (or queued if listing already boosted).
5. Marketplace + community surfaces show badge / top / section per placement flags.
6. If community set: `CommunitySponsoredEarning = amount × %` (ledger only).
7. Admin reports: packages, purchases, active placements, earnings.

## Data retention (Phase 3 readiness)

Do **not** discard for future algorithmic rewards:

- `Referral` qualified rows (admin + member history)
- `SponsoredPurchase` + snapshots (placement, geo, package, commission %)
- `CommunitySponsoredEarning` ledger (refunds reverse, do not hard-delete)
- Existing activity (likes, comments, posts, badges) remains in primary collections

Phase 3 may add Stars/Gems / activity-weighted splits **on top of** these ledgers — no schema wipe required.

## Explicit Phase 2 non-goals

- Item sale / escrow through Fointer  
- Automated owner payouts  
- Referral cash rewards / MLM  
- Keyword ads  

## Operator checklist

1. Create **Starter / Medium / Full** with blank geo.  
2. Set commission % (20% default).  
3. Smoke: promote with location + optional community → success “Active until …”.  
4. Confirm admin Referrals + Sponsorships reports.  

# FPAMAS data protection policy

Internal policy for the Federal Public Asset Management platform under the
Nigeria Data Protection Act 2023 (NDPA). The user-facing summary is the
dashboard's Privacy page (`/app/privacy`); keep the two consistent. Items marked
**[FPAM to confirm]** need a decision from FPAM management / its DPO.

## Roles

- **Data controller:** Federal Public Assets Maintenance Department (FPAM), Federal Ministry of Housing and Urban Development.
- **Data Protection Officer:** **[FPAM to confirm — name and contact]**.
- **Processors:** Render (API hosting), MongoDB Atlas (database), Vercel (website), the email provider and, if enabled, the SMS provider. Each needs a data processing agreement on file **[FPAM to confirm]**.

## Personal data held

| Data | Whose | Purpose | Lawful basis |
|---|---|---|---|
| Name, official email, role, division, MDA, states covered | Staff and MDA users | Accounts and access control | Public task (NDPA s.25(1)(e)) |
| Phone number (optional) | Staff | SMS alerts | Consent (they add it) |
| Password hash, two-step secret, recovery-code hashes | Users | Sign-in security | Public task / security |
| Sign-in times, IP address, browser, audit trail | Users | Security and accountability | Legitimate interest / public task |
| Asset records, photos (may include people incidentally), GPS | Field data | Asset register | Public task |
| Browser error reports (page, error, browser) | Users | Fixing faults | Legitimate interest |
| Revenue prototype (customer name, NIN/RC, contacts) | Public customers | **Prototype only — stored in each browser, not on servers** | — |

Before the revenue system goes live with real customer data, complete a Data
Protection Impact Assessment (NIN/BVN-level identity data at scale requires one).

## Retention

| Data | Kept | How |
|---|---|---|
| Asset records and audit log | Permanently, as part of the public record | — |
| Active accounts | While the person works with FPAM | — |
| Deactivated accounts | Reviewed after **[FPAM to confirm, e.g. 2 years]**, then anonymised | Manual review |
| In-app notifications | 90 days | Automatic (database TTL) |
| Error reports | 30 days | Automatic (database TTL) |
| Backups | **[FPAM to confirm, e.g. 35 days rolling]** | Atlas backup policy / manual deletion |
| Email/SMS provider logs | Per provider; choose short retention | Provider settings |

## Security measures

- Encryption in transit (HTTPS) on the site and API; Atlas encrypts data at rest.
- Passwords hashed with bcrypt; plain-text passwords are never stored or logged.
- Two-step sign-in available to every user and recommended for approvers and admins.
- Session revocation (sign out everywhere; automatic on password change and deactivation).
- Role- and division-based access; MDA Agents see only their own MDA.
- Upload content checks (optionally antivirus); Content-Security-Policy on the dashboard.
- Audit trail of changes; System health error log.

## Data subject requests

Requests to access, correct, restrict or object go to the DPO. Respond within
the NDPA timeframe **[FPAM to confirm process]**. A System Admin can export a
person's account record (Users page) and their audit-log entries (Audit log,
filter by user). Users can change their own password, phone and two-step
sign-in themselves.

## Breaches

1. Contain: revoke sessions (Users → deactivate / sign out everywhere), rotate secrets (see backend `docs/OPERATIONS.md` §2).
2. Assess what data and whose was affected (audit log, Render and Atlas logs).
3. Notify the Nigeria Data Protection Commission within **72 hours** of becoming aware, where required, and affected people without undue delay if there is high risk to them.
4. Record the incident and the fix.

**Known past incident to record:** until October 2026 the login route wrote
submitted passwords to the server logs. Fixed on 2026-10-20; users should
change passwords and old Render logs should be purged.

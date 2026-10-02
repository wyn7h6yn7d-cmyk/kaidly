# KAIDLY — Privacy requests (manual process for launch)

The operating company is not founded yet (operator details TBA, owner decision 2026-10-03);
the privacy contact below is provisional. Retention periods and automated erasure are **not decided** (legal/product decision, see
IMPLEMENTATION_PLAN.md). Until then every request is handled manually by the platform
admin. Nothing is deleted automatically and no statutory period is assumed.

## How users ask

- **Account deletion:** Konto → "Konto kustutamise taotlus" opens an email to
  `KAIDLY_CONTACT_EMAIL` with the subject "Konto kustutamise taotlus (<email>)".
- **Data export / access:** by email to the same address. Company data can also be exported
  by the user themselves (Aruanded → PDF/CSV), also in a read-only company.

## Two kinds of data

| Data | Belongs to | Handling |
|---|---|---|
| Account: name, email, phone, language, sign-in sessions | the person | deleted on request after identity check |
| Operating records: log entries, deficiencies, plan, documents (incl. the recorder's name snapshot) | the company | **not deleted automatically**; may be needed for the company's legal obligations; decided with the company's owner |

## Steps for the platform admin

1. **Verify identity:** the request comes from the account's own email address (reply to it).
2. **Look up** the user in `/admin/users`: memberships, owned companies, usage.
3. **Export (if requested):** account data from `/admin/users/<id>`; company data via the
   company's own reports (the owner exports) — the admin console has no customer-content export.
4. **Deletion review:**
   - If the user is the **last owner** of a company, the company must first get another owner
     or be deactivated/deleted under the lifecycle rules (empty company may be deleted;
     with history only deactivated).
   - Remove memberships (`/admin/users/<id>` → remove from company), disable the account,
     revoke sessions.
   - Delete the Auth user only after the review (database owner, SQL:
     `delete from auth.users where id = '<uuid>'` — profiles cascade; operating records keep
     their name snapshots and lose the account link). Records the company must keep are
     not deleted.
5. **Reply** to the user with what was deleted and what is retained and why; note the
   request and outcome (date, admin) outside customer data.

## Not done automatically

- No automatic deletion of inactive accounts or expired companies (90-day flag only).
- No anonymisation of historic name snapshots in operating records (needs a legal decision).

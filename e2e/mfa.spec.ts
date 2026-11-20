import { createUser, expect, login, sql, test } from "./support/fixtures";
import { totp } from "./support/totp";

// Two-step sign-in (docs/MFA.md): required for platform admins, optional for everyone.
test.describe("Kaheastmeline sisselogimine", () => {
  test("a platform admin must enrol TOTP before the admin console; next sign-in asks for the code", async ({ page, context }) => {
    test.setTimeout(120_000);
    const admin = await createUser("Mari Haldur");
    sql(`select private.bootstrap_platform_admin('${admin.email}');`);

    await login(page, admin, "/admin");
    await expect(page).toHaveURL(/\/auth\/kaheastmeline\?next=(%2F|\/)admin$/);
    await expect(page.getByText("KAIDLY halduskonsooli kasutamiseks on kaheastmeline sisselogimine kohustuslik.")).toBeVisible();
    await expect(page.getByRole("img", { name: "QR-kood autentimisrakendusse lisamiseks" })).toBeVisible();
    const secret = (await page.getByTestId("totp-secret").textContent())!.trim();

    // A wrong code is refused with a clear message.
    await page.getByLabel("Kood").fill("000000");
    await page.getByRole("button", { name: "Kinnita" }).click();
    await expect(page.getByTestId("auth-card").getByRole("alert")).toContainText("Kood ei sobi");

    await page.getByLabel("Kood").fill(totp(secret));
    await page.getByRole("button", { name: "Kinnita" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    // The local Auth server marks the factor verified a moment after issuing the aal2 session.
    await expect.poll(() => sql(`select count(*) from auth.mfa_factors where user_id = '${admin.id}' and status = 'verified'`)).toBe("1");

    // Signed out and in again: the password alone is not enough for any app page.
    await context.clearCookies();
    await login(page, admin, "/o");
    await expect(page).toHaveURL(/\/auth\/kaheastmeline/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth\/kaheastmeline/);
    // Wait for the next 30-second window so the code differs from the one used above.
    await page.waitForTimeout(31_000 - (Date.now() % 30_000));
    await page.getByLabel("Kood").fill(totp(secret));
    await page.getByRole("button", { name: "Kinnita" }).click();
    await expect(page).toHaveURL(/\/o$|\/o\//);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("any user can switch it on in the account page; a non-admin without it is never sent there", async ({ page }) => {
    const user = await createUser("Tavaline Kasutaja");
    await login(page, user, "/konto");
    await expect(page).toHaveURL(/\/konto$/);
    const section = page.getByTestId("two-step");
    await expect(section).toContainText("Väljas");
    await section.getByRole("link", { name: "Lülita sisse" }).click();
    await expect(page).toHaveURL(/\/auth\/kaheastmeline\?next=(%2F|\/)konto$/);
    await expect(page.getByText("kohustuslik")).toHaveCount(0);
    const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
    await page.getByLabel("Kood").fill(totp(secret));
    await page.getByRole("button", { name: "Kinnita" }).click();
    await expect(page).toHaveURL(/\/konto$/);
    await expect(page.getByTestId("two-step")).toContainText("Sees");
    // A regular user asking for /admin still gets the ordinary not-found, not the MFA page.
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Lehte ei leitud" })).toBeVisible();
  });
});

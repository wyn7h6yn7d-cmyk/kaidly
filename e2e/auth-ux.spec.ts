import type { BrowserContext } from "@playwright/test";
import { createUser, expect, expectNoHorizontalScroll, field, test, uniqueId } from "./support/fixtures";

async function setLanguage(context: BrowserContext, locale: "en" | "ru") {
  await context.addCookies([{ name: "kaidly_locale", value: locale, url: "http://localhost:3100" }]);
}

test.describe("Sisselogimise ja konto loomise kasutuskogemus", () => {
  test("auth header: back to home and languages only; the switch sits under the form @responsive", async ({ page }) => {
    await page.goto("/auth/login");
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "Tagasi avalehele" })).toHaveAttribute("href", "/");
    await expect(banner.getByRole("link", { name: "Kuidas töötab" })).toHaveCount(0);
    await expect(banner.getByRole("link", { name: "Loo konto" })).toHaveCount(0);
    await expect(banner.getByRole("link", { name: "Logi sisse" })).toHaveCount(0);
    await expect(page.getByTestId("auth-card").getByRole("link", { name: "Loo konto" })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByTestId("auth-card").getByRole("link", { name: "Loo konto" }).click();
    await expect(page.getByRole("heading", { name: "Loo konto" })).toBeVisible();
    await expect(page.getByTestId("auth-card").getByRole("link", { name: "Logi sisse" })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto("/auth/forgot-password");
    await expectNoHorizontalScroll(page);
    await page.getByRole("banner").getByRole("link", { name: "Tagasi avalehele" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("password visibility toggles without submitting or losing the value", async ({ page }) => {
    await page.goto("/auth/login");
    await field(page, "password").fill("Salajane-parool-1");
    const toggle = page.getByRole("button", { name: "Näita parooli" });
    await toggle.click();
    await expect(field(page, "password")).toHaveAttribute("type", "text");
    await expect(field(page, "password")).toHaveValue("Salajane-parool-1");
    await expect(page.getByRole("button", { name: "Peida parool" })).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/\/auth\/login$/);
    await page.getByRole("button", { name: "Peida parool" }).press("Enter");
    await expect(field(page, "password")).toHaveAttribute("type", "password");
    await expect(page).toHaveURL(/\/auth\/login$/);

    // Sign-up: both password fields have their own toggle.
    await page.goto("/auth/sign-up");
    await expect(page.getByRole("button", { name: "Näita parooli" })).toHaveCount(2);
  });

  test("sign-up: the length hint turns green and a mismatch is shown inline before submitting", async ({ page }) => {
    await page.goto("/auth/sign-up");
    const hint = page.getByText("Vähemalt 10 tähemärki.");
    await expect(hint).toHaveAttribute("data-met", "false");
    await field(page, "password").fill("Pikk-parool-123");
    await expect(hint).toHaveAttribute("data-met", "true");
    await field(page, "repeatPassword").fill("Pikk-parool");
    await field(page, "fullName").focus(); // leave the field
    await expect(page.getByText("Paroolid ei kattu.")).toBeVisible();
    await expect(field(page, "repeatPassword")).toHaveAttribute("aria-invalid", "true");
    await field(page, "repeatPassword").fill("Pikk-parool-123");
    await expect(page.getByText("Paroolid ei kattu.")).toHaveCount(0);
  });

  test("sign-in shows its busy state and a double click sends one request", async ({ page }) => {
    const user = await createUser("Topelt Klõps");
    let requests = 0;
    await page.route("**/auth/v1/token**", async (route) => {
      requests += 1;
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await page.goto("/auth/login");
    await page.waitForLoadState("networkidle");
    await field(page, "email").fill(user.email);
    await field(page, "password").fill(user.password);
    const submit = page.locator('form button[type="submit"]');
    await submit.dblclick();
    await expect(page.getByRole("button", { name: "Sisenen…" })).toBeDisabled();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"));
    expect(requests).toBe(1);
    expect(page.url()).not.toContain(encodeURIComponent(user.email));
  });

  test("wrong credentials: an application message next to the form, no provider text", async ({ page }) => {
    await page.goto("/auth/login");
    await page.waitForLoadState("networkidle");
    await field(page, "email").fill(`${uniqueId("pole")}@example.ee`);
    await field(page, "password").fill("vale-parool-123");
    await page.getByRole("button", { name: "Logi sisse" }).click();
    const alert = page.getByTestId("auth-card").getByRole("alert");
    await expect(alert).toHaveText("Vale e-post või parool.");
    await expect(page.getByTestId("auth-card")).not.toContainText(/invalid_credentials|Invalid login/i);
  });

  test("English and Russian auth strings", async ({ page, context }) => {
    await setLanguage(context, "en");
    await page.goto("/auth/login");
    await expect(page.getByRole("banner").getByRole("link", { name: "Back to home" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show password" })).toBeVisible();
    await setLanguage(context, "ru");
    await page.goto("/auth/sign-up");
    await expect(page.getByRole("banner").getByRole("link", { name: "На главную" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Показать пароль" })).toHaveCount(2);
  });
});

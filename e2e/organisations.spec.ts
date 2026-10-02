import { addMember, createOrg, createUser, expect, expectNoHorizontalScroll, field, login, test } from "./support/fixtures";

test.describe("Organisatsioonid", () => {
  test("create an organisation and switch between two @responsive", async ({ page }) => {
    const user = await createUser("Olev Omanik");
    await login(page, user);
    await page.getByRole("link", { name: "Loo ettevõte" }).first().click();
    await field(page, "name").fill("Esimene Elekter OÜ");
    await page.getByRole("button", { name: "Loo ettevõte" }).click();
    await expect(page).toHaveURL(/\/o\/esimene-elekter-ou-[a-z2-9]{6}(\?uus=1)?$/);
    await expect(page.getByText("Sinu roll: Omanik")).toBeVisible();
    await expectNoHorizontalScroll(page);

    const other = await createOrg("Teine Firma AS");
    await addMember(other, user, "viewer");
    await page.reload(); // the switcher lists memberships as of page load
    await page
      .getByRole("button", { name: /Vali ettevõte: Esimene Elekter OÜ/ })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Teine Firma AS" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${other.slug}$`));
    await expect(page.getByText("Sinu roll: Vaataja")).toBeVisible();
  });

  test("invitation link: wrong account refused, invitee joins with the invited role", async ({ page, browser }) => {
    const org = await createOrg();
    const invitee = await createUser("Kati Kutsutu");
    const stranger = await createUser("Võõras");

    await login(page, org.users.admin, `/o/${org.slug}/seaded/liikmed`);
    await page.getByLabel("Kolleegi e-post").fill(invitee.email);
    await page.getByLabel("Roll", { exact: true }).selectOption("operator");
    await page.getByRole("button", { name: "Loo kutse link" }).click();
    const link = await page.getByLabel("Kutse link on valmis").inputValue();
    expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);
    const path = new URL(link).pathname;

    const strangerPage = await browser.newPage();
    await login(strangerPage, stranger, path);
    await expect(strangerPage.getByText("Kutse on saadetud teisele e-posti aadressile.")).toBeVisible();
    await expect(strangerPage.getByRole("button", { name: "Võta kutse vastu" })).toHaveCount(0);
    await strangerPage.close();

    const inviteePage = await browser.newPage();
    await login(inviteePage, invitee, path);
    await inviteePage.getByRole("button", { name: "Võta kutse vastu" }).click();
    await expect(inviteePage).toHaveURL(new RegExp(`/o/${org.slug}$`));
    await expect(inviteePage.getByText("Sinu roll: Käitaja")).toBeVisible();
    await inviteePage.goto(path);
    await expect(inviteePage.getByText("Seda kutset on juba kasutatud.")).toBeVisible();
    await inviteePage.close();
  });

  test("tenant isolation: another organisation is not found, even with the right URL", async ({ page }) => {
    const mine = await createOrg("Minu OÜ");
    const theirs = await createOrg("Nende OÜ");
    await login(page, mine.users.owner, `/o/${theirs.slug}`);
    await expect(page.getByRole("heading", { name: "Ettevõtet ei leitud" })).toBeVisible();
    await expect(page.getByText("Nende OÜ")).toHaveCount(0);
    await page.goto(`/o/${theirs.slug}/seaded/liikmed`);
    await expect(page.getByRole("heading", { name: "Ettevõtet ei leitud" })).toBeVisible();
  });
});

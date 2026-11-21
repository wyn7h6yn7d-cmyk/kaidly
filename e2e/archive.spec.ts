import {
  apiAs,
  createInstallation,
  createOrg,
  createSite,
  createUser,
  expect,
  login,
  sql,
  test,
} from "./support/fixtures";

const limit = (orgId: string, n: number) => sql(`update private.organisation_access set installation_limit = ${n} where organisation_id = '${orgId}';`);

test.describe("Arhiveerimine ja kustutamine", () => {
  test("direct API requests cannot get around the limits (restore and archive)", async () => {
    const org = await createOrg("Arhiivi API OÜ");
    const site = await createSite(org, "Objekt");
    const k1 = await createInstallation(org, site, "K1");
    const k2 = await createInstallation(org, site, "K2");
    limit(org.id, 2);
    const api = await apiAs(org.users.admin);

    // Archive K2 → add K3 → restoring K2 must fail (2 active already).
    expect((await api.from("electrical_installations").update({ archived_at: new Date().toISOString() }).eq("id", k2)).error).toBeNull();
    await createInstallation(org, site, "K3");
    const restore = await api.from("electrical_installations").update({ archived_at: null }).eq("id", k2);
    expect(restore.error?.message).toBe("plan_restore_limit");

    // Archive cap = 2: K1 is the second archived one, K3 the third → refused.
    expect((await api.from("electrical_installations").update({ archived_at: new Date().toISOString() }).eq("id", k1)).error).toBeNull();
    await createInstallation(org, site, "K4");
    const k3 = sql(`select id from public.electrical_installations where organisation_id = '${org.id}' and name = 'K3'`);
    const archive = await api.from("electrical_installations").update({ archived_at: new Date().toISOString() }).eq("id", k3);
    expect(archive.error?.message).toBe("plan_archive_limit");
    // No direct delete either.
    const del = await api.from("electrical_installations").delete().eq("id", k1).select("id");
    expect(del.data ?? []).toHaveLength(0);
    expect(sql(`select count(*) from public.electrical_installations where id = '${k1}'`)).toBe("1");
  });

  test("archive warning, restore and archive-full messages in the app @responsive", async ({ page }) => {
    const org = await createOrg("Arhiivi UI OÜ");
    const site = await createSite(org, "Objekt");
    const k1 = await createInstallation(org, site, "Peakilp");
    sql(`insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, created_by)
         values ('${org.id}', '${site}', '${k1}', 'Avatud puudus', 'x', 'high', '${org.users.operator.id}');
         insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, next_due_on)
         values ('${org.id}', '${site}', '${k1}', 'Kontroll', 'once', current_date + 10);`);
    limit(org.id, 1);

    await login(page, org.users.admin, `/o/${org.slug}/paigaldised/${k1}/muuda`);
    let message = "";
    page.once("dialog", (d) => {
      message = d.message();
      void d.accept();
    });
    await page.getByRole("button", { name: "Arhiveeri paigaldis" }).click();
    await expect.poll(() => message).toContain("1 avatud puudust ja 1 eelseisvat tegevust");
    await expect(page).toHaveURL(new RegExp(`/objektid/${site}$`));

    // The slot is taken by a new installation; restoring shows the owner's message.
    await createInstallation(org, site, "Uus kilp");
    await page.goto(`/o/${org.slug}/paigaldised/${k1}`);
    await page.getByRole("button", { name: "Taasta paigaldis" }).click();
    await expect(page.getByText("Paigaldise taastamiseks pole paketis vaba kohta. Arhiveeri mõni aktiivne paigaldis või vali suurem pakett.")).toBeVisible();
    // Archived: the edit page shows no form.
    await page.goto(`/o/${org.slug}/paigaldised/${k1}/muuda`);
    await expect(page.getByText("Arhiveeritud paigaldist ei saa muuta. Muutmiseks taasta see.")).toBeVisible();

    // Archive full (1/1).
    const k2 = sql(`select id from public.electrical_installations where organisation_id = '${org.id}' and name = 'Uus kilp'`);
    await page.goto(`/o/${org.slug}/paigaldised/${k2}/muuda`);
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Arhiveeri paigaldis" }).click();
    await expect(page.getByText("Arhiiv on täis (1/1). Arhiveerimiseks ekspordi ja kustuta mõni arhiveeritud paigaldis või vali suurem pakett.")).toBeVisible();
  });

  test("an empty installation can be deleted; an archived one with history only through export and delete", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await createOrg("Kustutuse OÜ");
    const site = await createSite(org, "Objekt");
    const empty = await createInstallation(org, site, "Tühi kilp");
    const full = await createInstallation(org, site, "Vana kilp", "VK-1");
    sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
         values ('${org.id}', '${site}', '${full}', 'inspection', 'Vana kanne', '${org.users.operator.id}');
         update public.electrical_installations set archived_at = now() where id = '${full}';`);

    await login(page, org.users.admin, `/o/${org.slug}/paigaldised/${empty}/muuda`);
    page.once("dialog", (d) => void d.accept());
    await page.getByTestId("delete-empty").getByRole("button", { name: "Kustuta paigaldis" }).click();
    await expect(page).toHaveURL(new RegExp(`/objektid/${site}$`));
    expect(sql(`select count(*) from public.electrical_installations where id = '${empty}'`)).toBe("0");

    await page.goto(`/o/${org.slug}/paigaldised/${full}`);
    await page.getByRole("link", { name: "Ekspordi ja kustuta" }).click();
    const purge = page.getByTestId("purge");
    await expect(purge).toContainText("1 sissekannet");
    const submit = purge.getByRole("button", { name: "Kustuta jäädavalt" });
    await purge.getByLabel("Paigaldise nimi").fill("Vana kilp");
    await expect(submit).toBeDisabled();
    const [pdf] = await Promise.all([page.waitForEvent("download"), purge.getByTestId("purge-pdf").click()]);
    expect(pdf.suggestedFilename()).toMatch(/^KAIDLY_Auditipakett_.*\.pdf$/);
    const [csv] = await Promise.all([page.waitForEvent("download"), purge.getByTestId("purge-csv").click()]);
    expect(csv.suggestedFilename()).toMatch(/\.csv$/);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(new RegExp(`/objektid/${site}$`));
    expect(sql(`select count(*) from public.log_entries where electrical_installation_id = '${full}'`)).toBe("0");
    expect(sql(`select old_data ->> 'name' || '/' || (old_data ->> 'log_entries') from public.activity_history where record_id = '${full}' and action = 'delete'`)).toBe("Vana kilp/1");
  });

  test("a site viewer downloads the audit package and CSV of an archived installation; the admin sees restore churn", async ({ page, context }) => {
    const org = await createOrg("Vaataja Arhiiv OÜ");
    const site = await createSite(org, "Objekt");
    const inst = await createInstallation(org, site, "Arhiivi kilp");
    sql(`insert into public.log_entries (organisation_id, site_id, electrical_installation_id, entry_type, description, created_by)
         values ('${org.id}', '${site}', '${inst}', 'inspection', 'Kanne', '${org.users.operator.id}');
         update public.electrical_installations set archived_at = now() where id = '${inst}';`);
    const viewer = await createUser("Juhatus");
    sql(`insert into public.site_viewers (organisation_id, site_id, user_id) values ('${org.id}', '${site}', '${viewer.id}');`);
    await login(page, viewer, `/vaade/${site}`);
    const archived = page.getByTestId("viewer-archived");
    await expect(archived).toContainText("Arhiivi kilp");
    const pdf = await page.request.get(`/vaade/${site}/auditipakett?paigaldis=${inst}&alates=1990-01-01`);
    expect(pdf.status()).toBe(200);
    const csv = await page.request.get(`/vaade/${site}/eksport?paigaldis=${inst}`);
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("Kanne");

    // Platform admin: more than 5 restore cycles in 30 days.
    const admin = await createUser("Haldur");
    sql(`select private.bootstrap_platform_admin('${admin.email}'); update private.platform_admins set mfa_required = false where user_id = '${admin.id}';
         insert into public.activity_history (organisation_id, actor_id, table_name, record_id, action, old_data, new_data)
         select '${org.id}', '${org.users.admin.id}', 'electrical_installations', '${inst}', 'update', '{"archived_at":"2026-01-01"}', '{"archived_at":null}'
           from generate_series(1, 6);`);
    const a = await context.browser()!.newPage();
    await login(a, admin, "/admin/arhiveerimine");
    await expect(a.getByTestId("archive-churn")).toContainText("Vaataja Arhiiv OÜ");
    await a.close();
  });
});

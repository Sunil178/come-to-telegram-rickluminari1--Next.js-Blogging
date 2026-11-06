import { expect, test } from "./fixtures";

test("the footer links to the About, Contact, Terms and Privacy pages", async ({ page }) => {
    for (const [link, heading] of [["About", "About Vedev.Guru"], ["Contact", "Contact"], ["Terms", "Terms of use"], ["Privacy", "Privacy policy"]]) {
        await page.goto("/");
        await page.getByRole("contentinfo").getByRole("link", { name: link, exact: true }).click();
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Children" })).toBeVisible();
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: "Grievance officer" })).toBeVisible();
});

test("sign-up asks for confirmation of age 18+ and acceptance of the terms", async ({ page }) => {
    await page.goto("/auth/register");
    const consent = page.getByRole("checkbox", { name: /I am 18 or older/ });
    await expect(consent).toHaveAttribute("required", "");
    await expect(page.getByRole("link", { name: "Terms of use" })).toHaveAttribute("href", "/terms");
});
